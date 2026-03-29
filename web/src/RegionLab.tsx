import { useState } from "react";
import { fetchEdgeContent } from "./api";
import { regionCards, type EdgeRegionKey } from "./config";
import type { EdgeContentResponse } from "./types";

type Result = { key: EdgeRegionKey; label: string; data: EdgeContentResponse | null; err?: string };

export function RegionLab() {
  const [id, setId] = useState("1");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  async function probe() {
    const n = parseInt(id, 10);
    if (Number.isNaN(n) || n < 1) return;
    setLoading(true);
    setResults(null);
    const out: Result[] = [];
    for (const r of regionCards) {
      try {
        const data = await fetchEdgeContent(r.key, n);
        out.push({ key: r.key, label: r.label, data });
      } catch (e) {
        out.push({
          key: r.key,
          label: r.label,
          data: null,
          err: (e as Error).message,
        });
      }
    }
    setResults(out);
    setLoading(false);
  }

  return (
    <div className="panel">
      <h2>Region lab</h2>
      <p className="muted" style={{ marginTop: "-0.5rem" }}>
        Fetch the same item from each edge and compare version, source, and latency. After an
        update from Content, US (eager) tends to reflect first; EU/AP (lazy) may show{" "}
        <span className="badge badge-stale">stale</span> briefly.
      </p>
      <div className="inline-input">
        <label htmlFor="probe-id" className="muted">
          Content ID
        </label>
        <input
          id="probe-id"
          type="number"
          min={1}
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={() => void probe()}
        >
          {loading ? "Fetching…" : "Fetch all regions"}
        </button>
      </div>

      {results ? (
        <div className="cards-3">
          {results.map((r) => (
            <div key={r.key} className="region-card">
              <h3>{r.label}</h3>
              <p className="sub">localhost:{regionCards.find((c) => c.key === r.key)?.port}</p>
              {r.err ? (
                <p className="err">{r.err}</p>
              ) : r.data?.success && r.data.data ? (
                <>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                    <strong>{r.data.data.title}</strong>
                  </p>
                  <div className="metric-row">
                    <span>Version</span>
                    <span>{r.data.data.version}</span>
                  </div>
                  <div className="metric-row">
                    <span>Source</span>
                    <span>
                      <span
                        className={
                          r.data.source === "origin"
                            ? "badge badge-origin"
                            : "badge badge-cache"
                        }
                      >
                        {r.data.source}
                      </span>
                    </span>
                  </div>
                  <div className="metric-row">
                    <span>Status</span>
                    <span>
                      <span
                        className={
                          r.data.status === "stale"
                            ? "badge badge-stale"
                            : "badge badge-fresh"
                        }
                      >
                        {r.data.status}
                      </span>
                    </span>
                  </div>
                  <div className="metric-row">
                    <span>Latency</span>
                    <span>{r.data.latency_ms ?? "—"} ms</span>
                  </div>
                </>
              ) : (
                <p className="err">{r.data?.error || "No data"}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
