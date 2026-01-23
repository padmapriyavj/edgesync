import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { CacheClient } from "./cache/redis.client";
import { OriginClient } from "./clients/origin.client";

dotenv.config();

const app = express();
const PORT = process.env.EDGE_PORT || 5001;
const REGION_NAME = process.env.REGION_NAME || "us-east";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:4000";
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "3600");

// Initialize clients
const cache = new CacheClient(REDIS_URL);
const originClient = new OriginClient(ORIGIN_URL, REGION_NAME);

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
  });
});

// Content endpoint with caching
app.get("/api/content/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `content:${id}`;

  try {
    // 1. Check cache first
    const cached = await cache.getWithMetaData(cacheKey);

    if (cached && !cached.metadata.stale) {
      console.log(`[${REGION_NAME}] Cache HIT: ${cacheKey}`);
      return res.json({
        success: true,
        data: cached.value,
        source: "cache",
        region: REGION_NAME,
        cached_at: new Date(cached.metadata.cachedAt).toISOString(),
      });
    }

    // 2. Cache miss - fetch from origin
    console.log(`[${REGION_NAME}] Cache MISS: ${cacheKey}`);
    const content = await originClient.getContent(id);

    // 3. Store in cache with metadata
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

    console.log(`[${REGION_NAME}] Cached: ${cacheKey}`);

    // 4. Return data
    res.json({
      success: true,
      data: content,
      source: "origin",
      region: REGION_NAME,
    });
  } catch (error) {
    console.error(`[${REGION_NAME}] Error:`, error);

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

// Test cache endpoint (for debugging)
app.get("/test-cache", async (req: Request, res: Response) => {
  try {
    await cache.set("test-key", { message: "Hello from cache!" }, 60);
    const value = await cache.get("test-key");

    res.json({
      success: true,
      region: REGION_NAME,
      cached: value,
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
    // Connect to Redis
    await cache.connect();

    // Check origin health
    const originHealthy = await originClient.healthCheck();
    if (!originHealthy) {
      console.warn("⚠️  Warning: Origin server not responding");
    } else {
      console.log("Origin server connected");
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Edge service [${REGION_NAME}] running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Content: http://localhost:${PORT}/api/content/:id`);
      console.log(`List: http://localhost:${PORT}/api/content`);
    });
  } catch (error) {
    console.error("Failed to start edge service:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n Shutting down gracefully...");
  await cache.disconnect();
  process.exit(0);
});

start();
