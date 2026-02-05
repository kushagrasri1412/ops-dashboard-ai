"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import ClientTable from "../../components/ClientTable";
import ClientDetails from "../../components/ClientDetails";
import ChannelBreakdown from "../../components/d3/ChannelBreakdown";
import { summarizeClientsFromActivityRows } from "../../lib/clients";
import { X } from "lucide-react";

export default function ClientsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [clients, setClients] = useState([]);
  const [activitiesByClient, setActivitiesByClient] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);

  const [dataMode, setDataMode] = useState("");
  const [dataSource, setDataSource] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState("last_activity_ms");
  const [sortDir, setSortDir] = useState("desc");

  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState("");
  const [copilotResult, setCopilotResult] = useState(null);
  const [copilotNotice, setCopilotNotice] = useState(null);
  const [copilotNoticeVariant, setCopilotNoticeVariant] = useState("info");

  function formatModeLabel(mode) {
    if (mode === "live") return "Live";
    if (mode === "mixed") return "Mixed";
    return "Demo";
  }

  async function loadActivity() {
    setLoading(true);
    setError("");

    try {
      const pageSizeMax = 50;
      const maxPages = 6;
      const rows = [];

      let firstPayload = null;
      let totalPages = 1;

      for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
        const params = new URLSearchParams();
        params.set("page", String(pageIndex));
        params.set("pageSize", String(pageSizeMax));
        params.set("sortBy", "timestamp");
        params.set("sortDir", "desc");

        const response = await fetch(`/api/activity?${params.toString()}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load activity.");
        }

        if (!firstPayload) firstPayload = payload;

        const nextRows = Array.isArray(payload.rows) ? payload.rows : [];
        rows.push(...nextRows);

        totalPages =
          typeof payload.totalPages === "number" && payload.totalPages > 0
            ? payload.totalPages
            : 1;
        if (pageIndex >= totalPages) break;
      }

      const summary = summarizeClientsFromActivityRows(rows);

      setClients(Array.isArray(summary.clients) ? summary.clients : []);
      setActivitiesByClient(summary.activitiesByClient || {});

      setDataMode(firstPayload?.data_mode || "");
      setDataSource(firstPayload?.data_source || "");
    } catch (err) {
      setClients([]);
      setActivitiesByClient({});
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!clients.length) {
      setSelectedId("");
      return;
    }

    const stillExists = selectedId && clients.some((c) => c.id === selectedId);
    if (!stillExists) setSelectedId(clients[0].id);
  }, [clients, loading, selectedId]);

  useEffect(() => {
    // Clear client-specific copilot output when switching clients.
    setCopilotError("");
    setCopilotResult(null);
    setCopilotNotice(null);
  }, [selectedId]);

  useEffect(() => {
    if (!mobileDetailsOpen) return;

    function onKeyDown(event) {
      if (event.key === "Escape") setMobileDetailsOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileDetailsOpen]);

  const sortedClients = useMemo(() => {
    const list = Array.isArray(clients) ? clients.slice() : [];

    list.sort((a, b) => {
      if (sortBy === "client") {
        const left = String(a.client || "");
        const right = String(b.client || "");
        return sortDir === "asc"
          ? left.localeCompare(right)
          : right.localeCompare(left);
      }

      if (sortBy === "total_events_30d") {
        const left = Number(a.total_events_30d) || 0;
        const right = Number(b.total_events_30d) || 0;
        return sortDir === "asc" ? left - right : right - left;
      }

      const left = Number(a.last_activity_ms) || 0;
      const right = Number(b.last_activity_ms) || 0;
      return sortDir === "asc" ? left - right : right - left;
    });

    return list;
  }, [clients, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedClients.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedClients = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedClients.slice(start, start + pageSize);
  }, [sortedClients, safePage, pageSize]);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  function toggleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      setPage(1);
      return;
    }

    setSortBy(columnKey);
    setSortDir(columnKey === "client" ? "asc" : "desc");
    setPage(1);
  }

  function handlePageSize(nextSize) {
    setPageSize(nextSize);
    setPage(1);
  }

  const selectedClient = clients.find((c) => c.id === selectedId) || null;
  const selectedActivities = selectedClient
    ? activitiesByClient[selectedClient.id] || []
    : [];

  function buildClientCopilotContext({ client, activities }) {
    const points = [];

    points.push(`client: ${client.client}`);
    points.push(`client_channel: ${client.channel}`);

    if (client.last_activity_at) {
      points.push(`client_last_activity: ${client.last_activity_at}`);
    }

    points.push(`client_events_30d: ${client.total_events_30d}`);
    points.push(`client_completed_30d: ${client.completed_count_30d}`);
    points.push(`client_pending_30d: ${client.pending_count_30d}`);

    const recent = Array.isArray(activities) ? activities.slice(0, 6) : [];
    recent.forEach((row, idx) => {
      const action = typeof row?.action === "string" ? row.action.trim() : "";
      const channel = typeof row?.channel === "string" ? row.channel.trim() : "";
      const status = typeof row?.status === "string" ? row.status.trim() : "";
      const ts = typeof row?.timestamp === "string" ? row.timestamp : "";

      if (!action) return;
      points.push(
        `client_activity_${idx + 1}: ${ts} ${status} ${action}${
          channel ? ` (${channel})` : ""
        }`
      );
    });

    return points;
  }

  async function handleAskCopilot() {
    if (!selectedClient) return;

    setCopilotLoading(true);
    setCopilotError("");
    setCopilotResult(null);
    setCopilotNotice(null);

    const query =
      "Given the provided revenue series + anomalies + this client’s last 30 days activity, " +
      `summarize key drivers and recommended actions for ${selectedClient.client}.`;

    const extraDataPoints = buildClientCopilotContext({
      client: selectedClient,
      activities: selectedActivities,
    });

    let promptVersion = "v1";
    let apiKey = "dev_local_key";

    try {
      const storedKey = window.localStorage.getItem("copilot_api_key");
      const storedPrompt = window.localStorage.getItem("copilot_prompt_version");

      if (storedKey) apiKey = storedKey;
      if (storedPrompt === "v1" || storedPrompt === "v2") {
        promptVersion = storedPrompt;
      }
    } catch (error) {
      // Ignore localStorage issues
    }

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          prompt_version: promptVersion,
          extra_data_points: extraDataPoints,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Copilot request failed.");
      }

      const metaMode =
        payload?.meta?.mode === "demo" || payload?.meta?.mode === "live"
          ? payload.meta.mode
          : "";

      const metaFallback =
        typeof payload?.meta?.fallback_reason === "string"
          ? payload.meta.fallback_reason
          : "";

      const openaiMode = metaMode || response.headers.get("x-openai-mode") || "";
      const fallbackReason =
        metaFallback || response.headers.get("x-copilot-fallback") || "none";
      if (openaiMode === "demo") {
        setCopilotNotice("Demo Copilot mode: OpenAI key not configured.");
        setCopilotNoticeVariant("info");
      } else if (openaiMode === "live" && fallbackReason === "openai_error") {
        setCopilotNotice(
          "Live Copilot is temporarily unavailable. Showing a safe fallback."
        );
        setCopilotNoticeVariant("info");
      } else if (openaiMode === "live" && fallbackReason === "schema_invalid") {
        setCopilotNotice(
          "Copilot response failed schema validation. Showing a safe fallback."
        );
        setCopilotNoticeVariant("info");
      }

      setCopilotResult(payload);
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setCopilotLoading(false);
    }
  }

  const modeLabel = formatModeLabel(dataMode);

  function handleSelectClient(nextId) {
    setSelectedId(nextId);
    setMobileDetailsOpen(true);
  }

  return (
    <AppShell active="clients">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
            <p className="mt-1 text-sm text-slate-500">
              Restaurant digital operations overview at the store level
            </p>
          </div>
          <div
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
            title={dataSource ? `Data source: ${dataSource}` : undefined}
          >
            <span className="font-semibold text-slate-900">{modeLabel}</span>{" "}
            data
          </div>
        </div>

        <ChannelBreakdown
          title="Channel breakdown"
          subtitle="Recent events by channel"
        />

        <div className="grid gap-4 lg:grid-cols-[1.35fr,1fr]">
          <ClientTable
            clients={pagedClients}
            totalCount={sortedClients.length}
            loading={loading}
            error={error}
            sortBy={sortBy}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            selectedId={selectedId}
            onSelect={handleSelectClient}
            page={safePage}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={handlePageSize}
            onRetry={loadActivity}
          />

          <div className="hidden lg:block">
            <ClientDetails
              client={selectedClient}
              activities={selectedActivities}
              loading={loading}
              error=""
              onRetry={null}
              onAskCopilot={handleAskCopilot}
              copilotLoading={copilotLoading}
              copilotError={copilotError}
              copilotResult={copilotResult}
              copilotNotice={copilotNotice}
              copilotNoticeVariant={copilotNoticeVariant}
            />
          </div>
        </div>

        <div
          className={
            "fixed inset-0 z-50 lg:hidden " +
            (mobileDetailsOpen && selectedClient ? "" : "pointer-events-none")
          }
          aria-hidden={mobileDetailsOpen && selectedClient ? "false" : "true"}
        >
          <div
            className={
              "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 " +
              (mobileDetailsOpen && selectedClient ? "opacity-100" : "opacity-0")
            }
            onClick={() => setMobileDetailsOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Client details"
            className={
              "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out " +
              (mobileDetailsOpen && selectedClient ? "translate-x-0" : "translate-x-full")
            }
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Store details</p>
                <p className="text-xs text-slate-500">
                  {selectedClient ? selectedClient.client : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileDetailsOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <ClientDetails
                client={selectedClient}
                activities={selectedActivities}
                loading={loading}
                error=""
                onRetry={null}
                onAskCopilot={handleAskCopilot}
                copilotLoading={copilotLoading}
                copilotError={copilotError}
                copilotResult={copilotResult}
                copilotNotice={copilotNotice}
                copilotNoticeVariant={copilotNoticeVariant}
              />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
