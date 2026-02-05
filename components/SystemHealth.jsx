"use client";

import { Activity, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

export default function SystemHealth() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/metrics", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load metrics.");
        }
        if (cancelled) return;

        setMetrics(payload);
        setError("");
        setUpdatedAt(new Date());
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const status = (() => {
    if (!metrics) return "unknown";
    if (metrics.error_rate_24h > 0.03) return "degraded";
    if (metrics.p95_latency_ms_24h > 900) return "degraded";
    if (
      typeof metrics.copilot_schema_pass_rate_24h === "number" &&
      metrics.copilot_schema_pass_rate_24h < 0.95
    ) {
      return "degraded";
    }
    return "healthy";
  })();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">System Health</p>
          <p className="text-sm text-slate-500">Last 24 hours</p>
        </div>
        <div
          className={
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold " +
            (status === "healthy"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700")
          }
        >
          {status === "healthy" ? (
            <Activity className="h-4 w-4" />
          ) : (
            <TriangleAlert className="h-4 w-4" />
          )}
          {status === "healthy" ? "Healthy" : "Degraded"}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              p95 Latency
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {metrics.p95_latency_ms_24h ?? "—"}
              <span className="ml-1 text-sm font-medium text-slate-500">ms</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Error Rate
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatPercent(metrics.error_rate_24h)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Copilot Requests
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {metrics.copilot_requests_24h ?? metrics.ai_requests_24h ?? "—"}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Schema Pass
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {formatPercent(metrics.copilot_schema_pass_rate_24h)}
            </p>
          </div>
        </div>
      )}

      {updatedAt ? (
        <p className="mt-4 text-xs text-slate-500">
          Updated {updatedAt.toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  );
}
