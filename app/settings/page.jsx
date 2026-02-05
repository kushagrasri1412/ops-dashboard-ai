"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw } from "lucide-react";
import AppShell from "../../components/AppShell";

function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function formatModeLabel(mode) {
  if (mode === "live") return "Live";
  if (mode === "mixed") return "Mixed";
  return "Demo";
}

function maskUrl(url) {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    const host = parsed.host;
    const path = parsed.pathname.length > 18 ? `${parsed.pathname.slice(0, 18)}…` : parsed.pathname;
    return `${host}${path}`;
  } catch (error) {
    return url.length > 28 ? `${url.slice(0, 28)}…` : url;
  }
}

function MetricTile({ label, value, helper }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [metrics, setMetrics] = useState(null);

  const [copilotApiKey, setCopilotApiKey] = useState("dev_local_key");
  const [promptVersion, setPromptVersion] = useState("v1");
  const [preferredMode, setPreferredMode] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/metrics", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to load settings.");
      }
      setMetrics(payload);
    } catch (err) {
      setMetrics(null);
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    try {
      const storedKey = window.localStorage.getItem("copilot_api_key");
      const storedPrompt = window.localStorage.getItem("copilot_prompt_version");
      const storedMode = window.localStorage.getItem("ui_data_mode_preference");

      if (storedKey) setCopilotApiKey(storedKey);
      if (storedPrompt === "v1" || storedPrompt === "v2") {
        setPromptVersion(storedPrompt);
      }
      if (storedMode === "demo" || storedMode === "mixed" || storedMode === "live") {
        setPreferredMode(storedMode);
      }
    } catch (error) {
      // Ignore localStorage issues
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("copilot_api_key", copilotApiKey);
    } catch (error) {
      // Ignore localStorage issues
    }
  }, [copilotApiKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem("copilot_prompt_version", promptVersion);
    } catch (error) {
      // Ignore localStorage issues
    }
  }, [promptVersion]);

  useEffect(() => {
    if (!preferredMode) return;
    try {
      window.localStorage.setItem("ui_data_mode_preference", preferredMode);
    } catch (error) {
      // Ignore localStorage issues
    }
  }, [preferredMode]);

  const serverMode = metrics?.data_mode || "demo";
  const ttlSeconds = metrics?.data_cache_ttl_seconds;
  const liveUrl = metrics?.live_activity_url || "";

  const openaiConfigured = Boolean(metrics?.openai_configured);

  const openaiStatus = openaiConfigured
    ? "Copilot using OpenAI (server-side)."
    : "Copilot running in Demo mode (no OpenAI key configured).";

  const maskedLiveUrl = useMemo(() => maskUrl(liveUrl), [liveUrl]);

  const modeLabel = formatModeLabel(serverMode);

  return (
    <AppShell active="settings">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure data modes, copilot prompt versions, and safety limits
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            <div className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Data Mode</p>
            <p className="text-sm text-slate-500">
              Demo vs Live activity caching (server-side)
            </p>

            {loading ? (
              <div className="mt-5 space-y-3">
                <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {modeLabel}
                    </span>{" "}
                    server data
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                    TTL{" "}
                    <span className="font-semibold text-slate-900">
                      {typeof ttlSeconds === "number" ? ttlSeconds : "—"}
                    </span>
                    s
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Live Source
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900" title={liveUrl}>
                    {maskedLiveUrl}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    For deployed environments, set <code className="font-mono">DATA_MODE</code>,{" "}
                    <code className="font-mono">DATA_CACHE_TTL_SECONDS</code>, and{" "}
                    <code className="font-mono">LIVE_ACTIVITY_URL</code> via environment variables.
                  </p>
                </div>

                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Preferred mode (UI-only)
                  <select
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    value={preferredMode || serverMode}
                    onChange={(event) => setPreferredMode(event.target.value)}
                  >
                    <option value="demo">demo</option>
                    <option value="mixed">mixed</option>
                    <option value="live">live</option>
                  </select>
                </label>
                <p className="text-xs text-slate-500">
                  This app reads data mode on the server. To truly switch modes, update env vars and restart.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Copilot Configuration</p>
            <p className="text-sm text-slate-500">
              Prompt versioning and API access
            </p>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Prompt Version
                <select
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                  value={promptVersion}
                  onChange={(event) => setPromptVersion(event.target.value)}
                >
                  <option value="v1">v1</option>
                  <option value="v2">v2</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Copilot API Key
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                    value={copilotApiKey}
                    onChange={(event) => setCopilotApiKey(event.target.value)}
                    placeholder="dev_local_key"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(copilotApiKey);
                      } catch (error) {
                        // Clipboard may be blocked; ignore.
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    aria-label="Copy copilot API key"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </label>

              <p className="text-xs text-slate-500">
                This key is sent as <code className="font-mono">x-api-key</code> and must match{" "}
                <code className="font-mono">COPILOT_API_KEY</code> on the server.
              </p>

              <div
                className={
                  "rounded-2xl border px-5 py-4 text-sm " +
                  (openaiConfigured
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800")
                }
              >
                <p className="text-sm font-semibold text-slate-900">OpenAI status</p>
                <p className="mt-1 text-sm text-slate-700">{openaiStatus}</p>
                <p className="mt-2 text-xs text-slate-500">
                  OPENAI_API_KEY is never exposed to the browser. Copilot calls OpenAI server-side only.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Health & Limits</p>
                <p className="text-sm text-slate-500">Last 24 hours</p>
              </div>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                <MetricTile
                  label="p95 Latency"
                  value={`${metrics?.p95_latency_ms_24h ?? "—"}ms`}
                />
                <MetricTile
                  label="Error Rate"
                  value={formatPercent(metrics?.error_rate_24h)}
                />
                <MetricTile
                  label="Copilot Requests"
                  value={metrics?.copilot_requests_24h ?? metrics?.ai_requests_24h ?? "—"}
                />
                <MetricTile
                  label="Schema Pass"
                  value={formatPercent(metrics?.copilot_schema_pass_rate_24h)}
                  helper="Structured output validity"
                />
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Copilot rate limit: <span className="font-semibold text-slate-700">10 requests/minute/IP</span>.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
