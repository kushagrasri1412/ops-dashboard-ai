"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import AppShell from "../../components/AppShell";
import RiskHeatStrip from "../../components/d3/RiskHeatStrip";
import { summarizeClientsFromActivityRows } from "../../lib/clients";
import { buildSchedule } from "../../lib/schedule";
import { formatShortDate } from "../../lib/format";

function formatModeLabel(mode) {
  if (mode === "live") return "Live";
  if (mode === "mixed") return "Mixed";
  return "Demo";
}

function ItemChip({ children, variant }) {
  const styles =
    variant === "risk"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : variant === "catering"
        ? "border-purple-200 bg-purple-50 text-purple-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold " +
        styles
      }
    >
      {children}
    </span>
  );
}

function RiskChip({ level }) {
  const value = String(level || "low").toLowerCase();
  const label =
    value === "high" ? "High risk" : value === "medium" ? "Medium risk" : "Low risk";

  const styles =
    value === "high"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : value === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold " +
        styles
      }
    >
      {label}
    </span>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,320px]" aria-hidden="true">
      <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

export default function SchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dataMode, setDataMode] = useState("");
  const [dataSource, setDataSource] = useState("");

  const [clientNames, setClientNames] = useState([]);
  const [selectedStore, setSelectedStore] = useState("");

  const [revenueSeries, setRevenueSeries] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  const [view, setView] = useState("week");
  const [filter, setFilter] = useState("all");

  const [activeItem, setActiveItem] = useState(null);

  async function load() {
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

      const revenueRes = await fetch("/api/revenue", { cache: "no-store" });
      const forecastRes = await fetch("/api/forecast", { cache: "no-store" });
      const anomaliesRes = await fetch("/api/anomalies", { cache: "no-store" });

      const revenuePayload = await revenueRes.json().catch(() => ({}));
      const forecastPayload = await forecastRes.json().catch(() => ({}));
      const anomaliesPayload = await anomaliesRes.json().catch(() => ({}));

      if (!revenueRes.ok) {
        throw new Error(revenuePayload.error || "Failed to load revenue.");
      }
      if (!forecastRes.ok) {
        throw new Error(forecastPayload.error || "Failed to load forecast.");
      }
      if (!anomaliesRes.ok) {
        throw new Error(anomaliesPayload.error || "Failed to load anomalies.");
      }

      const clientSummary = summarizeClientsFromActivityRows(rows);
      const names = (clientSummary.clients || []).map((client) => client.client);

      setClientNames(names);
      setRevenueSeries(Array.isArray(revenuePayload.series) ? revenuePayload.series : []);
      setForecast(Array.isArray(forecastPayload.forecast) ? forecastPayload.forecast : []);
      setAnomalies(Array.isArray(anomaliesPayload.anomalies) ? anomaliesPayload.anomalies : []);

      setDataMode(firstPayload?.data_mode || revenuePayload?.data_mode || "");
      setDataSource(firstPayload?.data_source || revenuePayload?.data_source || "");
    } catch (err) {
      setClientNames([]);
      setRevenueSeries([]);
      setForecast([]);
      setAnomalies([]);
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeItem) return;

    function onKeyDown(event) {
      if (event.key === "Escape") setActiveItem(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeItem]);

  useEffect(() => {
    if (!clientNames.length) {
      setSelectedStore("");
      return;
    }
    if (selectedStore && clientNames.includes(selectedStore)) return;
    setSelectedStore(clientNames[0]);
  }, [clientNames, selectedStore]);

  const schedule = useMemo(() => {
    if (!clientNames.length) return null;
    return buildSchedule({
      clients: clientNames,
      revenueSeries,
      forecast,
      anomalies,
    });
  }, [clientNames, revenueSeries, forecast, anomalies]);

  const scheduleDays = useMemo(() => {
    if (!schedule || !selectedStore) return [];
    return schedule.schedules_by_client?.[selectedStore] || [];
  }, [schedule, selectedStore]);

  const filteredDays = useMemo(() => {
    if (filter === "all") return scheduleDays;
    const wantType = filter === "catering" ? "catering" : "shift";
    return scheduleDays.map((day) => ({
      ...day,
      items: (day.items || []).filter((item) => item.type === wantType),
    }));
  }, [scheduleDays, filter]);

  const health = useMemo(() => {
    const daysWithRisk = filteredDays.filter((day) => day.risk_level && day.risk_level !== "low").length;
    const cateringEvents = filteredDays.reduce(
      (acc, day) =>
        acc + (day.items || []).filter((item) => item.type === "catering").length,
      0
    );
    const suggestions = filteredDays.reduce(
      (acc, day) => acc + (day.risk_level && day.risk_level !== "low" ? 1 : 0),
      0
    );

    return { daysWithRisk, cateringEvents, suggestions };
  }, [filteredDays]);

  const modeLabel = formatModeLabel(dataMode);

  return (
    <AppShell active="schedule">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Schedule</h1>
            <p className="mt-1 text-sm text-slate-500">
              Planning view with risk tags derived from revenue + anomalies
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

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr,180px,220px]">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Store
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                value={selectedStore}
                onChange={(event) => setSelectedStore(event.target.value)}
                disabled={loading || !clientNames.length}
              >
                {clientNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              View
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                {[
                  { key: "week", label: "Week" },
                  { key: "day", label: "Day" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setView(option.key)}
                    className={
                      "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 " +
                      (view === option.key
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Filter
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                disabled={loading}
              >
                <option value="all">All</option>
                <option value="shifts">Shifts</option>
                <option value="catering">Catering</option>
              </select>
            </label>
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="flex items-center justify-between gap-3">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {loading ? (
          <ScheduleSkeleton />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {view === "week" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                  {filteredDays.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {day.day_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatShortDate(day.date)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          <RiskChip level={day.risk_level} />
                          {(day.risk_tags || []).slice(0, 1).map((tag) => (
                            <ItemChip key={tag} variant="risk">
                              {tag}
                            </ItemChip>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(day.items || []).length === 0 ? (
                          <p className="text-xs text-slate-500">
                            No items for this filter.
                          </p>
                        ) : (
                          (day.items || []).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveItem(item)}
                              className={
                                "w-full rounded-xl border px-3 py-2 text-left text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 " +
                                (item.type === "catering"
                                  ? "border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100"
                                  : "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100")
                              }
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {item.title}
                                  </p>
                                  <p className="mt-1 text-xs opacity-80">
                                    {item.start}–{item.end}
                                  </p>
                                </div>
                                <ItemChip
                                  variant={item.type === "catering" ? "catering" : "shift"}
                                >
                                  {item.type === "catering" ? "Catering" : "Shift"}
                                </ItemChip>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredDays.map((day) => (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {day.day_name} • {formatShortDate(day.date)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Expected revenue:{" "}
                            <span className="font-semibold text-slate-700">
                              {day.expected_revenue || "—"}
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <RiskChip level={day.risk_level} />
                          {(day.risk_tags || []).slice(0, 2).map((tag) => (
                            <ItemChip key={tag} variant="risk">
                              {tag}
                            </ItemChip>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
                        {(day.items || [])
                          .slice()
                          .sort((a, b) => String(a.start).localeCompare(String(b.start)))
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setActiveItem(item)}
                              className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                            >
                              <div className="w-20 flex-shrink-0 text-sm font-semibold text-slate-700">
                                {item.start}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {item.title}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.type === "catering" ? "Catering" : "Shift"} • {item.end}
                                </p>
                              </div>
                              <ItemChip
                                variant={item.type === "catering" ? "catering" : "shift"}
                              >
                                {item.type === "catering" ? "Catering" : "Shift"}
                              </ItemChip>
                            </button>
                          ))}

                        {(day.items || []).length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No items for this filter.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Schedule Health</p>
              <p className="text-sm text-slate-500">
                Risk tags and upcoming events for the next 7 days
              </p>

              <div className="mt-5">
                <RiskHeatStrip days={scheduleDays} loading={loading} error={error} />
              </div>

              <div className="mt-5 grid gap-4">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Risk Days
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {health.daysWithRisk}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Catering Events
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {health.cateringEvents}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Suggested Adjustments
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">
                    {health.suggestions}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Suggestions are deterministic and derived from revenue forecast and anomaly signals.
              </p>
            </div>
          </div>
        )}

        {activeItem ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8"
            role="dialog"
            aria-modal="true"
            aria-label="Schedule item details"
            onClick={() => setActiveItem(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {activeItem.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStore} • {formatShortDate(activeItem.date)} • {activeItem.start}–{activeItem.end}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <ItemChip variant={activeItem.type === "catering" ? "catering" : "shift"}>
                  {activeItem.type === "catering" ? "Catering" : "Shift"}
                </ItemChip>
                <RiskChip level={activeItem.risk_level} />
                {(activeItem.risk_tags || []).slice(0, 3).map((tag) => (
                  <ItemChip key={tag} variant="risk">
                    {tag}
                  </ItemChip>
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 px-5 py-4">
                <p className="text-sm font-semibold text-slate-900">Suggested action</p>
                <p className="mt-2 text-sm text-slate-700">
                  {activeItem.suggested_action}
                </p>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                This schedule is generated deterministically for demo realism (no staffing database required).
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
