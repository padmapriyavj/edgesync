import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { CacheClient } from "./cache/redis.client";
import { OriginClient } from "./clients/origin.client";
import {
  InvalidationConsumer,
  InvalidationEvent,
} from "./messaging/kafka.consumer";
import { MetricsTracker } from "./metrics/metrics.tracker";

dotenv.config();

const app = express();
const PORT = process.env.EDGE_PORT || 5001;
const REGION_NAME = process.env.REGION_NAME || "us-east";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:4000";
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "3600");
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(
  ","
);
const INVALIDATION_STRATEGY = process.env.INVALIDATION_STRATEGY || "eager";
const PROPAGATION_DELAY = parseInt(process.env.PROPAGATION_DELAY || "0");

// Initialize clients
const cache = new CacheClient(REDIS_URL);
const originClient = new OriginClient(ORIGIN_URL, REGION_NAME);
const invalidationConsumer = new InvalidationConsumer(
  KAFKA_BROKERS,
  REGION_NAME
);
const metrics = new MetricsTracker();

// Sleep utility for simulating geographic delay
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Geographic delay configuration
const getRegionDelay = (region: string): number => {
  const delays: Record<string, number> = {
    "us-east": 100,
    "eu-west": 300,
    "ap-south": 600,
  };
  return delays[region] || 0;
};

// Invalidation handler with geographic delay
async function handleInvalidation(event: InvalidationEvent): Promise<void> {
  const eventReceivedAt = Date.now();
  const delay = PROPAGATION_DELAY || getRegionDelay(REGION_NAME);

  console.log(
    ` [${REGION_NAME}] Received invalidation event: ${event.type} - ${event.target}`
  );
  console.log(
    ` [${REGION_NAME}] Simulating ${delay}ms geographic propagation delay...`
  );

  await sleep(delay);

  const processingStartedAt = Date.now();
  const actualDelay = processingStartedAt - eventReceivedAt;

  console.log(
    ` [${REGION_NAME}] Processing invalidation after ${actualDelay}ms: ${event.type} - ${event.target}`
  );

  try {
    if (INVALIDATION_STRATEGY === "eager") {
      await eagerInvalidate(event);
      metrics.recordInvalidation("eager");
    } else if (INVALIDATION_STRATEGY === "lazy") {
      await lazyInvalidate(event);
      metrics.recordInvalidation("lazy");
    }
  } catch (error) {
    console.error(` [${REGION_NAME}] Invalidation error:`, error);
  }
}

// Eager invalidation: Delete immediately
async function eagerInvalidate(event: InvalidationEvent): Promise<void> {
  if (event.type === "key") {
    await cache.del(event.target);
    console.log(` [${REGION_NAME}] EAGER: Deleted ${event.target}`);
  }
}

// Lazy invalidation: Mark as stale
async function lazyInvalidate(event: InvalidationEvent): Promise<void> {
  if (event.type === "key") {
    await cache.markStale(event.target);
    console.log(` [${REGION_NAME}] LAZY: Marked ${event.target} as stale`);
  }
}

// Background revalidation for lazy invalidation
async function backgroundRevalidate(
  cacheKey: string,
  id: string
): Promise<void> {
  try {
    console.log(`🔄 [${REGION_NAME}] Background revalidation: ${cacheKey}`);

    const content = await originClient.getContent(id);

    await cache.setWithMetadata(
      cacheKey,
      {
        value: content,
        metadata: {
          version: content.version,
          cachedAt: Date.now(),
          expiresAt: Date.now() + CACHE_TTL * 1000,
          stale: false,
        },
      },
      CACHE_TTL
    );

    await cache.clearStale(cacheKey);

    console.log(
      ` [${REGION_NAME}] Background revalidation complete: ${cacheKey}`
    );
  } catch (error) {
    console.error(` [${REGION_NAME}] Background revalidation failed:`, error);
  }
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/health", async (req: Request, res: Response) => {
  const originHealthy = await originClient.healthCheck();

  res.json({
    status: "ok",
    service: "edge",
    region: REGION_NAME,
    cache: cache.isConnected() ? "connected" : "disconnected",
    origin: originHealthy ? "connected" : "disconnected",
    strategy: INVALIDATION_STRATEGY,
  });
});

// Metrics endpoint
app.get("/metrics", (req: Request, res: Response) => {
  const snapshot = metrics.getSnapshot();
  res.json({
    success: true,
    region: REGION_NAME,
    strategy: INVALIDATION_STRATEGY,
    metrics: snapshot,
  });
});

// Content endpoint with caching and metrics
app.get("/api/content/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `content:${id}`;
  const startTime = Date.now();

  try {
    const cached = await cache.getWithMetaData(cacheKey);
    const isStale = await cache.isStale(cacheKey);

    // Fresh cache hit
    if (cached && !isStale) {
      const latency = Date.now() - startTime;
      metrics.recordCacheHit(latency, false);
      console.log(
        ` [${REGION_NAME}] Cache HIT (fresh): ${cacheKey} - ${latency}ms`
      );
      return res.json({
        success: true,
        data: cached.value,
        source: "cache",
        status: "fresh",
        region: REGION_NAME,
        latency_ms: latency,
        cached_at: new Date(cached.metadata.cachedAt).toISOString(),
      });
    }

    // Stale cache hit (lazy invalidation)
    if (cached && isStale) {
      const latency = Date.now() - startTime;
      metrics.recordCacheHit(latency, true);
      console.log(
        ` [${REGION_NAME}] Cache HIT (stale): ${cacheKey} - ${latency}ms`
      );

      res.json({
        success: true,
        data: cached.value,
        source: "cache",
        status: "stale",
        region: REGION_NAME,
        latency_ms: latency,
        cached_at: new Date(cached.metadata.cachedAt).toISOString(),
      });

      backgroundRevalidate(cacheKey, id).catch((err) =>
        console.error(`Background revalidation failed for ${cacheKey}:`, err)
      );

      return;
    }

    // Cache miss
    console.log(` [${REGION_NAME}] Cache MISS: ${cacheKey}`);
    const content = await originClient.getContent(id);

    await cache.setWithMetadata(
      cacheKey,
      {
        value: content,
        metadata: {
          version: content.version,
          cachedAt: Date.now(),
          expiresAt: Date.now() + CACHE_TTL * 1000,
          stale: false,
        },
      },
      CACHE_TTL
    );

    const latency = Date.now() - startTime;
    metrics.recordCacheMiss(latency);
    console.log(` [${REGION_NAME}] Cached: ${cacheKey} - ${latency}ms`);

    res.json({
      success: true,
      data: content,
      source: "origin",
      status: "fresh",
      region: REGION_NAME,
      latency_ms: latency,
    });
  } catch (error) {
    console.error(` [${REGION_NAME}] Error:`, error);

    if ((error as Error).message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: "Content not found",
      });
    }

    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// List all content
app.get("/api/content", async (req: Request, res: Response) => {
  try {
    const content = await originClient.getAllContent();
    res.json({
      success: true,
      data: content,
      region: REGION_NAME,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

// Start server
async function start() {
  try {
    await cache.connect();
    await invalidationConsumer.connect();
    await invalidationConsumer.subscribe(handleInvalidation);

    const originHealthy = await originClient.healthCheck();
    if (!originHealthy) {
      console.warn(" Warning: Origin server not responding");
    } else {
      console.log(" Origin server connected");
    }

    app.listen(PORT, () => {
      console.log(` Edge service [${REGION_NAME}] running on port ${PORT}`);
      console.log(` Strategy: ${INVALIDATION_STRATEGY.toUpperCase()}`);
      console.log(
        ` Propagation delay: ${
          PROPAGATION_DELAY || getRegionDelay(REGION_NAME)
        }ms`
      );
      console.log(` Health: http://localhost:${PORT}/health`);
      console.log(` Metrics: http://localhost:${PORT}/metrics`);
      console.log(` Content: http://localhost:${PORT}/api/content/:id`);
    });

    // Log metrics every 60 seconds
    setInterval(() => {
      metrics.logSummary(REGION_NAME);
    }, 60000);
  } catch (error) {
    console.error("Failed to start edge service:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n Shutting down gracefully...");
  metrics.logSummary(REGION_NAME);
  await invalidationConsumer.disconnect();
  await cache.disconnect();
  process.exit(0);
});

start();
