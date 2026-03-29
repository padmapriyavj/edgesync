import { useState } from "react";
import { ContentSection } from "./ContentSection";
import { MetricsSection } from "./MetricsSection";
import { RegionLab } from "./RegionLab";
import { originBase } from "./config";

type Tab = "content" | "regions" | "metrics";

export default function App() {
  const [tab, setTab] = useState<Tab>("content");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>EdgeSync</h1>
          <p>
            Manage origin content, probe edge behavior, and watch cache metrics. Origin API base:{" "}
            <code style={{ fontFamily: "var(--mono)", fontSize: "0.85em" }}>{originBase}</code>
          </p>
        </div>
      </header>

      <nav className="tabs" aria-label="Primary">
        <button
          type="button"
          className={tab === "content" ? "active" : ""}
          onClick={() => setTab("content")}
        >
          Content
        </button>
        <button
          type="button"
          className={tab === "regions" ? "active" : ""}
          onClick={() => setTab("regions")}
        >
          Region lab
        </button>
        <button
          type="button"
          className={tab === "metrics" ? "active" : ""}
          onClick={() => setTab("metrics")}
        >
          Metrics
        </button>
      </nav>

      <main>
        {tab === "content" ? <ContentSection /> : null}
        {tab === "regions" ? <RegionLab /> : null}
        {tab === "metrics" ? <MetricsSection /> : null}
      </main>
    </div>
  );
}
