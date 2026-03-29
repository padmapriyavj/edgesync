import { useEffect, useState } from "react";
import { fetchEdgeHealth, fetchEdgeMetrics } from "./api";
import { regionCards, type EdgeRegionKey } from "./config";
import type { HealthPayload, MetricsPayload } from "./types";

type Bundle = {
  key: EdgeRegionKey;
  label: string;
  metrics: MetricsPayload | null;
  health: HealthPayload | null;
  err?: string;
};

export function MetricsSection() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Bundle[] = [];
      for (const r of regionCards) {
        try {
          const [metrics, health] = await Promise.all([
            fetchEdgeMetrics(r.key),
            fetchEdgeHealth(r.key),
          ]);
          if (!cancelled) {
            next.push({ key: r.key, label: r.label, metrics, health });
          }
        } catch (e) {
          if (!cancelled) {
            next.push({
              key: r.key,
              label: r.label,
              metrics: null,
              health: null,
              err: (e as Error).message,
            });
          }
        }
      }
      if (!cancelled) setBundles(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <div className="panel">
      <h2>Edge metrics</h2>
      <p className="muted" style={{ marginTop: "-0.5rem" }}>
        Polled every ~2.5s from each edge <code>/metrics</code> and <code>/health</code>.
      </p>
      <div className="cards-3" style={{ marginTop: "1rem" }}>
        {bundles.length === 0 ? (
          <p className="muted">Loading…</p>
        ) : (
          bundles.map((b) => (
            <div key={b.key} className="region-card">
              <h3>{b.label}</h3>
              <p className="sub">
                {b.health?.strategy ? (
                  <>
                    Strategy: <strong>{b.health.strategy}</strong>
                    {b.health.cache === "connected" ? (
                      <span className="badge badge-fresh" style={{ marginLeft: 6 }}>
                        redis
                      </span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </p>
              {b.err ? (
                <p className="err">{b.err}</p>
              ) : b.metrics ? (
                <>
                  <div className="metric-row">
                    <span>Hit ratio</span>
                    <span>{b.metrics.metrics.hitRatio}%</span>
                  </div>
                  <div className="metric-row">
                    <span>Requests</span>
                    <span>{b.metrics.metrics.totalRequests}</span>
                  </div>
                  <div className="metric-row">
                    <span>Stale hits</span>
                    <span>{b.metrics.metrics.staleHits}</span>
                  </div>
                  <div className="metric-row">
                    <span>P99 latency</span>
                    <span>{b.metrics.metrics.p99Latency} ms</span>
                  </div>
                  <div className="metric-row">
                    <span>Invalidations</span>
                    <span>{b.metrics.metrics.totalInvalidations}</span>
                  </div>
                  <div className="metric-row">
                    <span>Uptime</span>
                    <span>{b.metrics.metrics.uptime}s</span>
                  </div>
                </>
              ) : (
                <p className="err">No metrics</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
