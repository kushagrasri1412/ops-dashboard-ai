"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import MetricCard from "../../components/MetricCard";
import RevenueChart from "../../components/RevenueChart";
import ActivityTable from "../../components/ActivityTable";
import CopilotPanel from "../../components/CopilotPanel";
import AnomalyList from "../../components/AnomalyList";
import AnomalyStrip from "../../components/AnomalyStrip";
import ChannelBreakdown from "../../components/d3/ChannelBreakdown";
import SystemHealth from "../../components/SystemHealth";
import { formatCurrency, formatPercent } from "../../lib/format";

export default function DashboardPage() {
  const [revenueSeries, setRevenueSeries] = useState([]);
  const [kpis, setKpis] = useState(null);

  const [forecast, setForecast] = useState([]);
  const [anomalies, setAnomalies] = useState([]);

  const [channelFilter, setChannelFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [revenueRes, forecastRes, anomaliesRes] = await Promise.all([
          fetch("/api/revenue", { cache: "no-store" }),
          fetch("/api/forecast", { cache: "no-store" }),
          fetch("/api/anomalies", { cache: "no-store" }),
        ]);

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

        if (cancelled) return;

        setRevenueSeries(Array.isArray(revenuePayload.series) ? revenuePayload.series : []);
        setKpis(revenuePayload.kpis || null);
        setForecast(Array.isArray(forecastPayload.forecast) ? forecastPayload.forecast : []);
        setAnomalies(Array.isArray(anomaliesPayload.anomalies) ? anomaliesPayload.anomalies : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const revenueSparkline = useMemo(() => {
    return Array.isArray(revenueSeries)
      ? revenueSeries.slice(-30).map((point) => point.revenue).filter(Number.isFinite)
      : [];
  }, [revenueSeries]);

  return (
    <AppShell active="dashboard">
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Restaurant Digital Ops
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Revenue health, channel operations, and AI-assisted anomaly response
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Revenue (30d)"
            value={kpis ? formatCurrency(kpis.total_revenue_30d) : "—"}
            helper="Across all channels"
            delta={kpis?.deltas?.total_revenue_30d}
            loading={!kpis && loading}
            sparklineData={revenueSparkline}
            sparklineAriaLabel="Revenue (30d)"
          />
          <MetricCard
            label="Active Stores"
            value={kpis ? String(kpis.active_stores) : "—"}
            helper="Currently reporting"
            delta={kpis?.deltas?.active_stores}
            loading={!kpis && loading}
          />
          <MetricCard
            label="Upcoming Catering"
            value={kpis ? String(kpis.upcoming_catering_orders) : "—"}
            helper="Next 7 days"
            delta={kpis?.deltas?.upcoming_catering_orders}
            loading={!kpis && loading}
          />
          <MetricCard
            label="On-time Pickup"
            value={kpis ? formatPercent(kpis.on_time_pickup_rate) : "—"}
            helper="Last 14 days"
            delta={kpis?.deltas?.on_time_pickup_rate}
            loading={!kpis && loading}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <RevenueChart
              series={revenueSeries}
              forecast={forecast}
              anomalies={anomalies}
              loading={loading}
              error={error}
              onRetry={() => setReloadKey((prev) => prev + 1)}
            />

            <AnomalyStrip
              series={revenueSeries}
              anomalies={anomalies}
              loading={loading}
              error={error}
            />
          </div>
          <AnomalyList anomalies={anomalies} loading={loading} error={error} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            <ChannelBreakdown
              selectedChannel={channelFilter}
              onSelectChannel={setChannelFilter}
              title="Channel activity"
              subtitle="Recent activity volume by channel (click to filter)"
            />
            <ActivityTable
              channelFilter={channelFilter}
              onClearChannelFilter={() => setChannelFilter("")}
            />
          </div>
          <div className="flex flex-col gap-4">
            <SystemHealth />
            <CopilotPanel />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
