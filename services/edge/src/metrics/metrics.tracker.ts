export interface MetricsSnapshot {
    // Cache performance
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    staleHits: number;
    hitRatio: number;
    
    // Latency stats
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    
    // Invalidation stats
    totalInvalidations: number;
    eagerInvalidations: number;
    lazyInvalidations: number;
    
    // Time window
    startTime: string;
    uptime: number;
  }
  
  export class MetricsTracker {
    private cacheHits = 0;
    private cacheMisses = 0;
    private staleHits = 0;
    private latencies: number[] = [];
    private maxLatencies = 10000; // Keep last 10k requests
    
    private totalInvalidations = 0;
    private eagerInvalidations = 0;
    private lazyInvalidations = 0;
    
    private startTime: number;
    
    constructor() {
      this.startTime = Date.now();
    }
  
    // Record cache hit
    recordCacheHit(latency: number, isStale: boolean = false): void {
      this.cacheHits++;
      this.recordLatency(latency);
      
      if (isStale) {
        this.staleHits++;
      }
    }
  
    // Record cache miss
    recordCacheMiss(latency: number): void {
      this.cacheMisses++;
      this.recordLatency(latency);
    }
  
    // Record invalidation
    recordInvalidation(strategy: 'eager' | 'lazy'): void {
      this.totalInvalidations++;
      
      if (strategy === 'eager') {
        this.eagerInvalidations++;
      } else {
        this.lazyInvalidations++;
      }
    }
  
    // Record latency
    private recordLatency(latency: number): void {
      this.latencies.push(latency);
      
      // Keep only last N latencies to prevent memory issues
      if (this.latencies.length > this.maxLatencies) {
        this.latencies.shift();
      }
    }
  
    // Calculate percentile
    private calculatePercentile(percentile: number): number {
      if (this.latencies.length === 0) return 0;
      
      const sorted = [...this.latencies].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    }
  
    // Get metrics snapshot
    getSnapshot(): MetricsSnapshot {
      const totalRequests = this.cacheHits + this.cacheMisses;
      const hitRatio = totalRequests > 0 
        ? (this.cacheHits / totalRequests) * 100 
        : 0;
  
      const avgLatency = this.latencies.length > 0
        ? this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length
        : 0;
  
      return {
        totalRequests,
        cacheHits: this.cacheHits,
        cacheMisses: this.cacheMisses,
        staleHits: this.staleHits,
        hitRatio: Math.round(hitRatio * 100) / 100,
        
        avgLatency: Math.round(avgLatency * 100) / 100,
        p50Latency: this.calculatePercentile(50),
        p95Latency: this.calculatePercentile(95),
        p99Latency: this.calculatePercentile(99),
        minLatency: this.latencies.length > 0 ? Math.min(...this.latencies) : 0,
        maxLatency: this.latencies.length > 0 ? Math.max(...this.latencies) : 0,
        
        totalInvalidations: this.totalInvalidations,
        eagerInvalidations: this.eagerInvalidations,
        lazyInvalidations: this.lazyInvalidations,
        
        startTime: new Date(this.startTime).toISOString(),
        uptime: Math.round((Date.now() - this.startTime) / 1000),
      };
    }
  
    // Reset metrics
    reset(): void {
      this.cacheHits = 0;
      this.cacheMisses = 0;
      this.staleHits = 0;
      this.latencies = [];
      this.totalInvalidations = 0;
      this.eagerInvalidations = 0;
      this.lazyInvalidations = 0;
      this.startTime = Date.now();
    }
  
    // Log summary
    logSummary(regionName: string): void {
      const snapshot = this.getSnapshot();
      
      console.log(`\n [${regionName}] Metrics Summary:`);
      console.log(`   Total Requests: ${snapshot.totalRequests}`);
      console.log(`   Cache Hit Ratio: ${snapshot.hitRatio}%`);
      console.log(`   Cache Hits: ${snapshot.cacheHits} (${snapshot.staleHits} stale)`);
      console.log(`   Cache Misses: ${snapshot.cacheMisses}`);
      console.log(`   Avg Latency: ${snapshot.avgLatency}ms`);
      console.log(`   P50/P95/P99: ${snapshot.p50Latency}ms / ${snapshot.p95Latency}ms / ${snapshot.p99Latency}ms`);
      console.log(`   Invalidations: ${snapshot.totalInvalidations} (${snapshot.eagerInvalidations} eager, ${snapshot.lazyInvalidations} lazy)`);
      console.log(`   Uptime: ${snapshot.uptime}s\n`);
    }
  }