export type ContentRow = {
  id: number;
  slug: string;
  title: string;
  body: string;
  metadata?: unknown;
  version: number;
  created_at?: string;
  updated_at?: string;
};

export type EdgeContentResponse = {
  success: boolean;
  data?: ContentRow;
  source?: string;
  status?: string;
  region?: string;
  latency_ms?: number;
  cached_at?: string;
  error?: string;
};

export type MetricsPayload = {
  success: boolean;
  region: string;
  strategy: string;
  metrics: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    staleHits: number;
    hitRatio: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    totalInvalidations: number;
    eagerInvalidations: number;
    lazyInvalidations: number;
    uptime: number;
  };
};

export type HealthPayload = {
  status: string;
  service: string;
  region?: string;
  strategy?: string;
  cache?: string;
  origin?: string;
};
