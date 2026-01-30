#!/bin/bash

echo "EdgeSync HEAVY Load Test - 1000 requests per region"
echo ""

REQUESTS=1000

echo "Phase 1: Priming caches..."
for i in $(seq 1 50); do
  curl -s http://localhost:5001/api/content/1 > /dev/null
  curl -s http://localhost:5002/api/content/1 > /dev/null
  curl -s http://localhost:5003/api/content/1 > /dev/null
done
echo "Caches primed!"
echo ""

echo "Phase 2: Heavy load (${REQUESTS} requests per region)..."
for i in $(seq 1 $REQUESTS); do
  curl -s http://localhost:5001/api/content/1 > /dev/null &
  curl -s http://localhost:5002/api/content/1 > /dev/null &
  curl -s http://localhost:5003/api/content/1 > /dev/null &
  
  if [ $((i % 50)) -eq 0 ]; then
    echo "   Progress: ${i}/${REQUESTS}"
    sleep 0.05
  fi
done
wait
echo "Phase 2 complete!"
echo ""

sleep 1

echo "Phase 3: Trigger invalidation..."
curl -s -X PUT http://localhost:4000/api/content/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Heavy Load Test"}' > /dev/null
echo "Invalidation sent!"
echo ""

sleep 1

echo "Phase 4: Post-invalidation load..."
for i in $(seq 1 200); do
  curl -s http://localhost:5001/api/content/1 > /dev/null &
  curl -s http://localhost:5002/api/content/1 > /dev/null &
  curl -s http://localhost:5003/api/content/1 > /dev/null &
done
wait
echo "Load test complete!"
echo ""

sleep 2

echo "============================================"
echo "           FINAL METRICS REPORT"
echo "============================================"
echo ""

echo "US EAST (EAGER Strategy):"
curl -s http://localhost:5001/metrics | jq -r '.metrics | 
"   Requests: \(.totalRequests)
   Hit Ratio: \(.hitRatio)%
   Cache Hits: \(.cacheHits) | Misses: \(.cacheMisses)
   Avg Latency: \(.avgLatency)ms
   P50/P95/P99: \(.p50Latency)ms / \(.p95Latency)ms / \(.p99Latency)ms
   Invalidations: \(.totalInvalidations) eager"'

echo ""
echo "EU WEST (LAZY Strategy):"
curl -s http://localhost:5002/metrics | jq -r '.metrics | 
"   Requests: \(.totalRequests)
   Hit Ratio: \(.hitRatio)%
   Cache Hits: \(.cacheHits) | Misses: \(.cacheMisses)
   Stale Hits: \(.staleHits) ⚡
   Avg Latency: \(.avgLatency)ms
   P50/P95/P99: \(.p50Latency)ms / \(.p95Latency)ms / \(.p99Latency)ms
   Invalidations: \(.totalInvalidations) lazy"'

echo ""
echo "AP SOUTH (LAZY Strategy):"
curl -s http://localhost:5003/metrics | jq -r '.metrics | 
"   Requests: \(.totalRequests)
   Hit Ratio: \(.hitRatio)%
   Cache Hits: \(.cacheHits) | Misses: \(.cacheMisses)
   Stale Hits: \(.staleHits) ⚡
   Avg Latency: \(.avgLatency)ms
   P50/P95/P99: \(.p50Latency)ms / \(.p95Latency)ms / \(.p99Latency)ms
   Invalidations: \(.totalInvalidations) lazy"'

echo ""
echo "============================================"
echo "RESUME-READY METRICS:"
echo "============================================"
echo ""

US_METRICS=$(curl -s http://localhost:5001/metrics)
EU_METRICS=$(curl -s http://localhost:5002/metrics)
AP_METRICS=$(curl -s http://localhost:5003/metrics)

echo "Overall Performance:"
TOTAL_REQUESTS=$(echo "$US_METRICS $EU_METRICS $AP_METRICS" | jq -s 'map(.metrics.totalRequests) | add')
TOTAL_HITS=$(echo "$US_METRICS $EU_METRICS $AP_METRICS" | jq -s 'map(.metrics.cacheHits) | add')
OVERALL_RATIO=$(echo "scale=2; ($TOTAL_HITS / $TOTAL_REQUESTS) * 100" | bc)
echo "   Total Requests: ${TOTAL_REQUESTS}"
echo "   Overall Hit Ratio: ${OVERALL_RATIO}%"

echo ""
echo "Latency Performance:"
US_P99=$(echo "$US_METRICS" | jq -r '.metrics.p99Latency')
EU_P99=$(echo "$EU_METRICS" | jq -r '.metrics.p99Latency')
AP_P99=$(echo "$AP_METRICS" | jq -r '.metrics.p99Latency')
echo "   US East P99: ${US_P99}ms (eager)"
echo "   EU West P99: ${EU_P99}ms (lazy)"
echo "   AP South P99: ${AP_P99}ms (lazy)"

echo ""
echo "Stale-While-Revalidate Impact:"
EU_STALE=$(echo "$EU_METRICS" | jq -r '.metrics.staleHits')
AP_STALE=$(echo "$AP_METRICS" | jq -r '.metrics.staleHits')
echo "   ⚡ EU West: ${EU_STALE} requests served stale (instant response)"
echo "   ⚡ AP South: ${AP_STALE} requests served stale (instant response)"

echo ""
echo "Test Complete! Use these numbers for your resume."
echo ""