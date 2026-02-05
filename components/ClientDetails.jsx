"use client";

import { Bot, RefreshCcw, Send, ShieldAlert } from "lucide-react";
import StatusBadge from "./StatusBadge";
import CopilotResult from "./CopilotResult";
import { formatCompactCurrency, formatTimestamp } from "../lib/format";

function MetricTile({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function CopilotSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-hidden="true">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

export default function ClientDetails({
  client,
  activities,
  loading,
  error,
  onAskCopilot,
  copilotLoading,
  copilotError,
  copilotResult,
  copilotNotice,
  copilotNoticeVariant,
  onRetry,
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="mt-6 h-48 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-800">
              Failed to load client details
            </p>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
          </div>
        </div>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Client Details</p>
        <p className="mt-2 text-sm text-slate-500">
          Select a client from the table to view recent activity and suggested actions.
        </p>
      </div>
    );
  }

  const recentActivities = Array.isArray(activities) ? activities.slice(0, 10) : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{client.client}</p>
          <p className="text-sm text-slate-500">
            Channel: <span className="font-medium text-slate-700">{client.channel}</span>
          </p>
        </div>
        <StatusBadge status={client.active_status} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MetricTile label="Completed (30d)" value={client.completed_count_30d} />
        <MetricTile label="Pending (30d)" value={client.pending_count_30d} />
        <MetricTile label="Events (30d)" value={client.total_events_30d} />
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-slate-900">Latest Activity</p>
        <div className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {recentActivities.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">
              No activity events available for this client.
            </div>
          ) : (
            recentActivities.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {row.action}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatTimestamp(row.timestamp)} • {row.channel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={row.status} />
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCompactCurrency(row.revenue_delta)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-slate-50 p-2 text-slate-500">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Ask Copilot About This Client
              </p>
              <p className="text-sm text-slate-500">
                Uses revenue + anomalies plus this client’s recent activity context.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onAskCopilot}
            disabled={copilotLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
          >
            {copilotLoading ? "Running…" : "Ask"}
            <Send className="h-4 w-4" />
          </button>
        </div>

        {copilotError ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <ShieldAlert className="mt-0.5 h-4 w-4" />
            <span>{copilotError}</span>
          </div>
        ) : null}

        {copilotLoading ? <CopilotSkeleton /> : null}

        <CopilotResult
          key={
            copilotResult ? String(copilotResult.summary || "").slice(0, 80) : "empty"
          }
          result={copilotResult}
          notice={copilotNotice}
          noticeVariant={copilotNoticeVariant}
        />
      </div>
    </div>
  );
}
