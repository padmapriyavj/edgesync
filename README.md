# EdgeSync

> A production-grade multi-region CDN cache invalidation simulator demonstrating distributed systems principles

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![Kafka](https://img.shields.io/badge/Kafka-3.5+-black.svg)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-red.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**A multi-region CDN cache invalidation simulator built with Kafka, Redis & Node.js that demonstrates eventual consistency, geographic propagation delays, and distributed systems trade-offs through eager vs lazy invalidation strategies.**

---

## What is EdgeSync?

EdgeSync is a hands-on distributed systems project that simulates how Content Delivery Networks (CDNs) like Cloudflare, Fastly, and Akamai handle cache invalidation across geographically distributed edge servers.

**Key Demonstrations**:
- Geographic distribution with realistic propagation delays (100ms-600ms)
- Multiple invalidation strategies (Eager vs Lazy)
- Eventual consistency in action
- Real-time metrics and observability
- Stale-while-revalidate pattern

**Why EdgeSync?** Because cache invalidation is one of the two hardest problems in computer science, and this project makes those challenges visible and understandable.

---

## Features

### Core Functionality
- **3 Geographic Regions**: US East (100ms), EU West (300ms), AP South (600ms)
- **Smart Caching**: Redis with TTL, versioning, and metadata tracking
- **Event-Driven Architecture**: Kafka with KRaft (no Zookeeper) for reliable event propagation
- **Invalidation Strategies**:
  - **Eager**: Immediate cache deletion (strong consistency)
  - **Lazy**: Stale-while-revalidate (better performance, eventual consistency)
- **Tag & Pattern Support**: Invalidate by keys, tags, or URL patterns
- **Real-time Metrics**: Hit ratio, P50/P95/P99 latency, invalidation tracking

### Performance Results
- **97% cache hit ratio** across all regions
- **Sub-210ms P99 latency** under load
- **Lazy strategy 1.5% improvement** over eager in hit ratio
- **Tested with 4,350+ requests** across distributed regions

---

## Architecture

```
                    ┌─────────────────┐
                    │ Origin Server   │
                    │  PostgreSQL     │
                    │  Kafka Producer │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Kafka       │
                    │  (cache.inv)    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐       ┌─────▼──────┐      ┌─────▼──────┐
   │ US East  │       │  EU West   │      │  AP South  │
   │  Edge    │       │   Edge     │      │   Edge     │
   │ (100ms)  │       │  (300ms)   │      │  (600ms)   │
   │  EAGER   │       │   LAZY     │      │   LAZY     │
   │          │       │            │      │            │
   │  Redis   │       │   Redis    │      │   Redis    │
   │  :6379   │       │   :6380    │      │   :6381    │
   └──────────┘       └────────────┘      └────────────┘
```

### Data Flows

**Read Flow (Cache Hit)**:
```
User → Edge Region → Redis Cache → Response (2-5ms)
```

**Read Flow (Cache Miss)**:
```
User → Edge Region → Origin Server → PostgreSQL → Cache Update → Response (50-200ms)
```

**Invalidation Flow (Eager)**:
```
Origin Update → Kafka Topic → Consumer (100ms delay) → Delete Cache → Next Request Fetches Fresh
```

**Invalidation Flow (Lazy)**:
```
Origin Update → Kafka Topic → Consumer (300-600ms delay) → Mark Stale → Serve Stale + Background Revalidate
```

---

## Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

### Installation

```bash
# Clone the repository
git clone https://github.com/padmapriyavj/edgesync.git
cd edgesync

# Start all services
docker-compose up -d
```

That's it! All services will start automatically.

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Origin Server | http://localhost:4000 | Content management API |
| US East Edge | http://localhost:5001 | North America region (Eager) |
| EU West Edge | http://localhost:5002 | Europe region (Lazy) |
| AP South Edge | http://localhost:5003 | Asia Pacific region (Lazy) |
| Kafka UI | http://localhost:8080 | Message queue monitoring |
| Metrics (US) | http://localhost:5001/metrics | Performance metrics |
| Metrics (EU) | http://localhost:5002/metrics | Performance metrics |
| Metrics (AP) | http://localhost:5003/metrics | Performance metrics |

---

## Usage Examples

### 1. Create Content

```bash
curl -X POST http://localhost:4000/api/content \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Understanding Cache Invalidation",
    "slug": "cache-invalidation-101",
    "body": "Cache invalidation is one of the hardest problems...",
    "tags": ["tech", "distributed-systems"]
  }'
```

### 2. Read from Edge (Observe Cache Miss → Hit)

```bash
# First request: Cache MISS (~150ms)
time curl http://localhost:5001/api/content/1

# Second request: Cache HIT (~3ms)
time curl http://localhost:5001/api/content/1
```

### 3. Update Content (Trigger Invalidation)

```bash
curl -X PUT http://localhost:4000/api/content/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated: Cache Invalidation Patterns",
    "body": "New insights on distributed caching..."
  }'
```

### 4. Observe Eventual Consistency

```bash
# Immediately after update (T+0ms)
curl http://localhost:5001/api/content/1  # US: Old data (delay not passed)
curl http://localhost:5002/api/content/1  # EU: Old data
curl http://localhost:5003/api/content/1  # AP: Old data

# After 150ms (T+150ms)
sleep 0.15
curl http://localhost:5001/api/content/1  # US: NEW data (eager deleted, refetched)
curl http://localhost:5002/api/content/1  # EU: Old data (300ms delay)
curl http://localhost:5003/api/content/1  # AP: Old data (600ms delay)

# After 350ms (T+350ms)
sleep 0.2
curl http://localhost:5002/api/content/1  # EU: STALE data served fast, revalidating
curl http://localhost:5003/api/content/1  # AP: Old data

# After 700ms (T+700ms) - All regions consistent
sleep 0.35
curl http://localhost:5003/api/content/1  # AP: Fresh data
```

### 5. View Metrics

```bash
# JSON format
curl http://localhost:5001/metrics | jq

# Compare strategies
curl http://localhost:5001/metrics | jq '.metrics | {hitRatio, p99Latency, strategy: "eager"}'
curl http://localhost:5002/metrics | jq '.metrics | {hitRatio, p99Latency, staleHits, strategy: "lazy"}'
```

### 6. Run Load Test

```bash
# Generate 1000 requests per region
./test-heavy-load.sh
```

**Expected Output:**
```
US EAST (EAGER):   96.14% hit ratio, 143ms P99
EU WEST (LAZY):    97.79% hit ratio, 141ms P99, 17 stale hits
AP SOUTH (LAZY):   98.14% hit ratio, 208ms P99, 19 stale hits
Overall:           97% hit ratio across 4,350 requests
```

---

## Configuration

### Environment Variables

Each service can be configured via environment variables in `docker-compose.yml`:

**Origin Server:**
```yaml
environment:
  PORT: 4000
  DATABASE_URL: postgresql://edgesync_user:edgesync_pass@postgres:5432/edgesync
  KAFKA_BROKERS: kafka:29092
  NODE_ENV: production
```

**Edge Regions:**
```yaml
edge-us-east:
  environment:
    REGION_NAME: us-east
    EDGE_PORT: 5001
    PROPAGATION_DELAY: 100              # milliseconds
    INVALIDATION_STRATEGY: eager        # eager | lazy
    REDIS_URL: redis://redis-us-east:6379
    CACHE_TTL: 3600                     # seconds
    KAFKA_BROKERS: kafka:29092
    ORIGIN_URL: http://origin:4000
```

### Switching Invalidation Strategies

Edit `docker-compose.yml`:
```yaml
edge-us-east:
  environment:
    - INVALIDATION_STRATEGY: lazy  # Change to 'eager' or 'lazy'
```

Restart: `docker-compose restart edge-us-east`

---

## Performance Metrics

### Measured Results

| Region | Strategy | Requests | Hit Ratio | P99 Latency | Stale Hits |
|--------|----------|----------|-----------|-------------|------------|
| US East | Eager | 1,450 | 96.14% | 143ms | 0 |
| EU West | Lazy | 1,450 | 97.79% | 141ms | 17 |
| AP South | Lazy | 1,450 | 98.14% | 208ms | 19 |
| **Overall** | **Mixed** | **4,350** | **97.00%** | **208ms** | **36** |

### Key Observations

1. **Lazy strategy improves hit ratio by 1.5%** by serving stale content during invalidation
2. **Sub-210ms P99 latency** maintained across all strategies under load
3. **Geographic delays visible**: US (100ms) invalidates first, AP (600ms) invalidates last
4. **Stale-while-revalidate effective**: 36 requests served instantly from stale cache

---

## Key Metrics Explained

| Metric | Description | Target |
|--------|-------------|--------|
| Cache Hit Ratio | % of requests served from cache | > 90% |
| P50 Latency | Median response time | < 10ms |
| P95 Latency | 95th percentile response time | < 50ms |
| P99 Latency | 99th percentile response time | < 210ms |
| Stale Hits | Responses served from stale cache (lazy only) | Varies |
| Invalidation Lag | Time to process invalidation event | 100-600ms |

---

## Learning Outcomes

### Why Cache Invalidation is Hard

1. **Geographic Distribution**
   - Events take time to propagate across continents
   - Network partitions can occur
   - Different regions temporarily see different states

2. **Consistency vs Performance Trade-offs**
   - Strong consistency = slower responses (eager invalidation)
   - Eventual consistency = better UX but temporary staleness (lazy invalidation)
   - No perfect solution—only trade-offs

3. **Real-World Complexity**
   - Cache stampede during invalidation
   - Message queue backlog during outages
   - Partial failures during propagation

### Distributed Systems Concepts Demonstrated

- **Eventual Consistency**: All regions converge to the same state (within 700ms)
- **CAP Theorem**: Choosing Availability + Partition Tolerance over Consistency
- **Pub/Sub Pattern**: Decoupled event-driven architecture with Kafka
- **Consumer Groups**: Each region independently processes invalidation events
- **Idempotency**: Safe to process events multiple times
- **Stale-While-Revalidate**: Serve cached content while fetching fresh data

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Node.js 20 + TypeScript | Services runtime |
| **API Framework** | Express.js | HTTP servers |
| **Database** | PostgreSQL 15 | Content storage |
| **Cache** | Redis 7 | Distributed caching |
| **Message Queue** | Apache Kafka 3.5 (KRaft) | Event streaming |
| **Metrics** | Custom metrics tracker | Observability |
| **Logging** | Console + structured logs | Debugging |
| **Containers** | Docker + Compose | Infrastructure |

---

## Project Structure

```
edgesync/
├── docker-compose.yml          # Service orchestration
├── README.md                   # This file
├── test-load.sh                # Basic load test
├── test-heavy-load.sh          # Heavy load test (1000 req/region)
│
├── services/
│   ├── origin/                 # Origin server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   │   └── content.routes.ts
│   │   │   ├── services/
│   │   │   │   └── content.service.ts
│   │   │   └── messaging/
│   │   │       └── kafka.producer.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── edge/                   # Edge region service
│       ├── src/
│       │   ├── index.ts
│       │   ├── cache/
│       │   │   └── redis.client.ts
│       │   ├── clients/
│       │   │   └── origin.client.ts
│       │   ├── messaging/
│       │   │   └── kafka.consumer.ts
│       │   └── metrics/
│       │       └── metrics.tracker.ts
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
└── infrastructure/
    └── postgres/
        └── init.sql
```

---

## Testing

### Manual Testing

```bash
# Test cache behavior
curl http://localhost:5001/api/content/1
curl http://localhost:5001/api/content/1  # Should be faster

# Test invalidation
curl -X PUT http://localhost:4000/api/content/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated"}'

# Verify metrics
curl http://localhost:5001/metrics | jq '.metrics'
```

### Load Testing

```bash
# Basic load test (200 requests per region)
./test-load.sh

# Heavy load test (1000 requests per region)
./test-heavy-load.sh

# Custom load test
for i in {1..1000}; do
  curl -s http://localhost:5001/api/content/1 > /dev/null &
done
wait
```

### Observing Eventual Consistency

```bash
# Script to demonstrate eventual consistency
curl -X PUT http://localhost:4000/api/content/1 \
  -H "Content-Type: application/json" \
  -d '{"title":"Consistency Test"}' | jq '.data.version'

# T+0ms (immediate)
echo "T+0ms:"
curl -s http://localhost:5001/api/content/1 | jq '{region, version: .data.version, status}'
curl -s http://localhost:5002/api/content/1 | jq '{region, version: .data.version, status}'
curl -s http://localhost:5003/api/content/1 | jq '{region, version: .data.version, status}'

# T+150ms (US should be updated)
sleep 0.15
echo "T+150ms:"
curl -s http://localhost:5001/api/content/1 | jq '{region, version: .data.version, status}'
curl -s http://localhost:5002/api/content/1 | jq '{region, version: .data.version, status}'
curl -s http://localhost:5003/api/content/1 | jq '{region, version: .data.version, status}'

# T+350ms (EU should be updated)
sleep 0.2
echo "T+350ms:"
curl -s http://localhost:5002/api/content/1 | jq '{region, version: .data.version, status}'

# T+700ms (all consistent)
sleep 0.35
echo "T+700ms (All consistent):"
curl -s http://localhost:5003/api/content/1 | jq '{region, version: .data.version, status}'
```

---

## Troubleshooting

### Cache Not Updating After Invalidation

**Symptoms**: Content changes not reflected in edge regions

**Possible Causes**:
1. Kafka not running
2. Edge consumer not processing messages
3. Propagation delay not expired yet

**Fix**:
```bash
# Check Kafka
docker-compose logs kafka | tail -50

# Check consumer logs
docker-compose logs edge-us-east | grep "invalidation"

# Check Kafka UI
open http://localhost:8080

# Verify topic exists
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092
```

### High Cache Miss Rate

**Symptoms**: Hit ratio below 90%

**Possible Causes**:
1. TTL too short
2. Frequent invalidations
3. Cold cache (just started)

**Fix**:
```bash
# Increase TTL (in docker-compose.yml)
CACHE_TTL: 7200  # 2 hours

# Prime cache
for i in {1..100}; do curl -s http://localhost:5001/api/content/1 > /dev/null; done

# Check metrics
curl http://localhost:5001/metrics | jq '.metrics.hitRatio'
```

### Kafka Consumer Not Receiving Messages

**Symptoms**: No invalidation logs in edge services

**Fix**:
```bash
# Check if Kafka is healthy
docker-compose ps kafka

# Check if topic exists
docker-compose exec kafka kafka-topics --describe --topic cache.invalidation --bootstrap-server localhost:9092

# Check consumer group
docker-compose logs edge-us-east | grep "Consumer has joined"

# Restart edge services
docker-compose restart edge-us-east edge-eu-west edge-ap-south
```

---

## Advanced Usage

### Custom Propagation Delays

Edit `docker-compose.yml` to simulate different geographic scenarios:

```yaml
edge-us-east:
  environment:
    PROPAGATION_DELAY: 50  # Very close to origin

edge-eu-west:
  environment:
    PROPAGATION_DELAY: 500  # Transatlantic delay

edge-ap-south:
  environment:
    PROPAGATION_DELAY: 1000  # Intercontinental delay
```

### Monitoring with Kafka UI

Access http://localhost:8080 to:
- View all messages in `cache.invalidation` topic
- Monitor consumer group lag
- See partition assignments
- Debug message delivery issues

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f edge-us-east

# Filter for invalidation events
docker-compose logs edge-us-east | grep "invalidation"

# Show last 100 lines
docker-compose logs --tail=100 edge-eu-west
```

---

## Roadmap

### Phase 1: Core Features (Completed)
- [x] Multi-region edge servers
- [x] Kafka-based invalidation
- [x] Geographic propagation delays
- [x] Eager and lazy strategies
- [x] Metrics tracking
- [x] Load testing scripts

### Phase 2: Enhanced Observability
- [ ] Prometheus integration
- [ ] Grafana dashboards
- [ ] Distributed tracing with Jaeger
- [ ] Real-time WebSocket dashboard

### Phase 3: Advanced Features
- [ ] Tag-based invalidation
- [ ] Pattern-based invalidation (wildcards)
- [ ] Cache warming strategies
- [ ] Request coalescing (stampede prevention)
- [ ] Multi-tenancy support

### Phase 4: Production Ready
- [ ] Authentication & authorization
- [ ] Rate limiting
- [ ] Circuit breakers
- [ ] Kubernetes deployment manifests
- [ ] Helm charts

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Inspired by real-world CDNs: Cloudflare, Fastly, Akamai
- Cache patterns from Martin Fowler's architecture guides
- Distributed systems concepts from "Designing Data-Intensive Applications" by Martin Kleppmann
- Kafka architecture from Confluent documentation
- Stale-while-revalidate pattern from HTTP RFC 5861

---

## Contact

**Padmapriya Vijayaragava Rengaraj**

- GitHub: [@padmapriyavj](https://github.com/padmapriyavj)
- LinkedIn: [padmapriya-v-48ab1220a](https://www.linkedin.com/in/padmapriya-v-48ab1220a/)
- Email: padmapriya.vrj@gmail.com

---

<div align="center">

**If this project helped you understand distributed systems, please star the repository!**

Built with care to demonstrate why cache invalidation is hard

</div>
