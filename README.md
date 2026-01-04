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
- Real-time observability and metrics
- Cache stampede prevention techniques

**Why EdgeSync?** Because cache invalidation is one of the two hardest problems in computer science, and this project makes those challenges visible and understandable.

---

## Features

### Core Functionality
- **3 Geographic Regions**: US East (100ms), EU West (300ms), AP South (600ms)
- **Smart Caching**: Redis with TTL, versioning, and metadata tracking
- **Event-Driven Architecture**: Kafka for reliable event propagation
- **Invalidation Strategies**:
  - **Eager**: Immediate cache deletion (strong consistency)
  - **Lazy**: Stale-while-revalidate (better performance)
- **Stampede Prevention**: Request coalescing and single-flight pattern
- **Tag & Pattern Support**: Invalidate by tags or URL patterns

### Observability
- **React Dashboard**: Real-time visualization of cache behavior
- **Prometheus Metrics**: Hit rates, latencies, propagation delays
- **Structured Logging**: Complete audit trail of all operations
- **Geographic Visualization**: See invalidation propagate across regions

---

## Architecture
```
                    ┌─────────────────┐
                    │  React Dashboard │
                    │  (Port 3000)    │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────▼─────┐       ┌─────▼──────┐      ┌─────▼──────┐
   │ US East  │       │  EU West   │      │  AP South  │
   │  Edge    │       │   Edge     │      │   Edge     │
   │ (100ms)  │       │  (300ms)   │      │  (600ms)   │
   │          │       │            │      │            │
   │  Redis   │       │   Redis    │      │   Redis    │
   └────┬─────┘       └─────┬──────┘      └─────┬──────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    ┌───────▼────────┐
                    │     Kafka      │
                    │  (3 partitions)│
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │ Origin Server  │
                    │  PostgreSQL    │
                    └────────────────┘
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

**Invalidation Flow**:
```
Origin Update → Kafka Topic → Consumer Groups → Edge Regions (with delays) → Cache Invalidation
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
docker-compose up
```

That's it! 

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | React monitoring UI |
| Origin Server | http://localhost:4000 | Content management API |
| US East Edge | http://localhost:5001 | North America region |
| EU West Edge | http://localhost:5002 | Europe region |
| AP South Edge | http://localhost:5003 | Asia Pacific region |
| Kafka UI | http://localhost:8080 | Message queue monitoring |

---

## 📖 Usage Examples

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
# Immediately after update
curl http://localhost:5001/api/content/1  # US: Fresh (100ms passed)
curl http://localhost:5002/api/content/1  # EU: Might be stale
curl http://localhost:5003/api/content/1  # AP: Likely stale (600ms delay)

# After 1 second
curl http://localhost:5003/api/content/1  # AP: Now fresh
```

### 5. View Metrics
```bash
# Prometheus format
curl http://localhost:5001/metrics

# JSON format (custom)
curl http://localhost:5001/api/metrics
```

---

## Configuration

### Environment Variables

Each service can be configured via `.env` file:
```bash
# Origin Server
ORIGIN_PORT=4000
DATABASE_URL=postgresql://user:pass@postgres:5432/edgesync
KAFKA_BROKER=kafka:29092

# Edge Regions
REGION_NAME=us-east
EDGE_PORT=5001
PROPAGATION_DELAY=100              # milliseconds
INVALIDATION_STRATEGY=eager         # eager | lazy
REDIS_URL=redis://redis-us:6379
CACHE_TTL=3600                      # seconds

# Dashboard
DASHBOARD_PORT=3000
REFRESH_INTERVAL=2000               # milliseconds
```

### Switching Invalidation Strategies

Edit `docker-compose.yml`:
```yaml
edge-us-east:
  environment:
    - INVALIDATION_STRATEGY=lazy  # Change to 'eager' or 'lazy'
```

Restart: `docker-compose restart edge-us-east`

---

## Key Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| Cache Hit Ratio | % of requests served from cache | > 90% |
| P99 Latency | 99th percentile response time | < 100ms |
| Invalidation Lag | Time to process invalidation event | < 1000ms |
| Stale Responses | Responses served from stale cache | < 1% |
| Origin Load | Requests forwarded to origin | Minimize |

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

3. **Cascading Failures**
   - Cache stampede can overwhelm origin servers
   - Message queue backlog during outages
   - Partial failures during invalidation

### Distributed Systems Concepts Demonstrated

- **Eventual Consistency**: All regions converge to the same state
- **CAP Theorem**: Choosing Availability + Partition Tolerance
- **Pub/Sub Pattern**: Decoupled event-driven architecture
- **Idempotency**: Safe to process events multiple times
- **Observability**: Metrics, logging, and visualization

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Node.js 20 + TypeScript | Services runtime |
| **API Framework** | Express.js | HTTP servers |
| **Database** | PostgreSQL 15 | Content storage |
| **Cache** | Redis 7 | Distributed caching |
| **Message Queue** | Apache Kafka 3.5 | Event streaming |
| **Frontend** | React 18 + TypeScript | Dashboard UI |
| **Build Tool** | Vite | Fast React builds |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Charts** | Recharts | Data visualization |
| **Metrics** | Prometheus (prom-client) | Observability |
| **Logging** | Winston | Structured logging |
| **Containers** | Docker + Compose | Infrastructure |

---

## Project Structure
```
edgesync/
├── docker-compose.yml          # Service orchestration
├── .env.example                # Configuration template
├── README.md                   # This file
├── package.json                # Workspace root
│
├── services/
│   ├── origin/                 # Origin server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── messaging/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── edge/                   # Edge region service
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── cache/
│   │   │   ├── invalidation/
│   │   │   └── metrics/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── dashboard/              # React dashboard
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   └── api/
│       ├── Dockerfile
│       ├── package.json
│       └── vite.config.ts
│
├── infrastructure/
│   ├── postgres/
│   │   └── init.sql
│   ├── redis/
│   │   └── redis.conf
│   └── kafka/
│       └── init-topics.sh
│
└── docs/
    ├── ARCHITECTURE.md
    ├── PROJECT_PLAN.md
    └── diagrams/
```

---

## Testing

### Run Integration Tests
```bash
npm test
```

### Load Testing
```bash
# Using k6
k6 run tests/load-test.js

# Using Apache Bench
ab -n 10000 -c 100 http://localhost:5001/api/content/1
```

### Chaos Testing
```bash
# Stop Redis to test fallback
docker-compose stop redis-us-east

# Stop Kafka to test degraded mode
docker-compose stop kafka

# Stop origin to test stale serving
docker-compose stop origin
```

---

## Troubleshooting

### Cache Not Updating After Invalidation

**Symptoms**: Content changes not reflected in edge regions

**Possible Causes**:
1. Kafka not running
2. Edge consumer not processing messages
3. Propagation delay not expired

**Fix**:
```bash
# Check Kafka
docker-compose logs kafka

# Check consumer logs
docker-compose logs edge-us-east | grep invalidation

# Check Kafka UI
open http://localhost:8080
```

### High Origin Request Rate

**Symptoms**: Too many cache misses

**Possible Causes**:
1. TTL too short
2. Cache stampede
3. Frequent invalidations

**Fix**:
```bash
# Increase TTL
export CACHE_TTL=7200

# Enable request coalescing (check code)
```

---

## Roadmap

### Phase 1: MVP (Current)
- [x] Basic caching
- [x] Kafka-based invalidation
- [x] Geographic delays
- [x] Simple dashboard

### Phase 2: Advanced Features
- [ ] WebSocket for real-time dashboard updates
- [ ] GraphQL API
- [ ] Multi-tenancy support
- [ ] Advanced cache warming

### 📋 Phase 3: Production Ready
- [ ] Authentication & authorization
- [ ] Rate limiting
- [ ] Circuit breakers
- [ ] Kubernetes deployment
- [ ] Distributed tracing (Jaeger)

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

---

## Further Reading

- [Cloudflare: How We Use Kafka](https://blog.cloudflare.com/)
- [Netflix: Cache Warming Strategies](https://netflixtechblog.com/)
- [RFC 7234: HTTP Caching](https://tools.ietf.org/html/rfc7234)
- [Designing Data-Intensive Applications](https://dataintensive.net/)
- [Kafka Documentation](https://kafka.apache.org/documentation/)

---

## Contact

**Padmapriya Vijayaragava Rengaraj**

- GitHub: [@padmapriyavj](https://github.com/padmapriyavj)
- LinkedIn: [Your LinkedIn](https://www.linkedin.com/in/padmapriya-v-48ab1220a/)
- Email: padmapriya.vrj@gmail.com
---

<div align="center">

** If this project helped you understand distributed systems, please star the repository! ⭐**

Built with ❤️ to demonstrate why cache invalidation is hard

</div>
