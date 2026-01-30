#!/bin/bash

echo " EdgeSync Load Test - Generating Traffic..."
echo ""

# Number of requests per region
REQUESTS=100

echo " Phase 1: Warming up caches (${REQUESTS} requests per region)..."

for i in $(seq 1 $REQUESTS); do
  curl -s http://localhost:5001/api/content/1 > /dev/null &
  curl -s http://localhost:5002/api/content/1 > /dev/null &
  curl -s http://localhost:5003/api/content/1 > /dev/null &
done

wait
echo " Cache warm-up complete!"
echo ""

sleep 2

echo " Phase 2: Triggering invalidation..."
curl -s -X PUT http://localhost:4000/api/content/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Load Test Invalidation Event"}' > /dev/null

echo " Invalidation triggered!"
echo ""

sleep 1

echo " Phase 3: Post-invalidation traffic (${REQUESTS} requests per region)..."

for i in $(seq 1 $REQUESTS); do
  curl -s http://localhost:5001/api/content/1 > /dev/null &
  curl -s http://localhost:5002/api/content/1 > /dev/null &
  curl -s http://localhost:5003/api/content/1 > /dev/null &
  
  # Add small delay every 10 requests to avoid overwhelming
  if [ $((i % 10)) -eq 0 ]; then
    sleep 0.1
  fi
done

wait
echo " Load test complete!"
echo ""

sleep 2

echo " Collecting Metrics..."
echo ""

echo "=== US EAST (EAGER) ==="
curl -s http://localhost:5001/metrics | jq '.metrics | {
  totalRequests,
  hitRatio: "\(.hitRatio)%",
  cacheHits,
  cacheMisses,
  staleHits,
  avgLatency: "\(.avgLatency)ms",
  p50: "\(.p50Latency)ms",
  p95: "\(.p95Latency)ms",
  p99: "\(.p99Latency)ms",
  invalidations: {
    total: .totalInvalidations,
    eager: .eagerInvalidations,
    lazy: .lazyInvalidations
  }
}'

echo ""
echo "=== EU WEST (LAZY) ==="
curl -s http://localhost:5002/metrics | jq '.metrics | {
  totalRequests,
  hitRatio: "\(.hitRatio)%",
  cacheHits,
  cacheMisses,
  staleHits,
  avgLatency: "\(.avgLatency)ms",
  p50: "\(.p50Latency)ms",
  p95: "\(.p95Latency)ms",
  p99: "\(.p99Latency)ms",
  invalidations: {
    total: .totalInvalidations,
    eager: .eagerInvalidations,
    lazy: .lazyInvalidations
  }
}'

echo ""
echo "=== AP SOUTH (LAZY) ==="
curl -s http://localhost:5003/metrics | jq '.metrics | {
  totalRequests,
  hitRatio: "\(.hitRatio)%",
  cacheHits,
  cacheMisses,
  staleHits,
  avgLatency: "\(.avgLatency)ms",
  p50: "\(.p50Latency)ms",
  p95: "\(.p95Latency)ms",
  p99: "\(.p99Latency)ms",
  invalidations: {
    total: .totalInvalidations,
    eager: .eagerInvalidations,
    lazy: .lazyInvalidations
  }
}'

echo ""
echo " Load Test Summary:"
echo "   - Total Requests: $((REQUESTS * 2 * 3)) (200 per region)"
echo "   - Regions: US East (Eager), EU West (Lazy), AP South (Lazy)"
echo "   - Invalidations: 1 event propagated to all regions"
echo ""
echo " Key Metrics for Resume:"
curl -s http://localhost:5001/metrics | jq -r '"   - US East Hit Ratio: \(.metrics.hitRatio)% | P99 Latency: \(.metrics.p99Latency)ms"'
curl -s http://localhost:5002/metrics | jq -r '"   - EU West Hit Ratio: \(.metrics.hitRatio)% | P99 Latency: \(.metrics.p99Latency)ms (with \(.metrics.staleHits) stale hits)"'
curl -s http://localhost:5003/metrics | jq -r '"   - AP South Hit Ratio: \(.metrics.hitRatio)% | P99 Latency: \(.metrics.p99Latency)ms (with \(.metrics.staleHits) stale hits)"'
echo ""