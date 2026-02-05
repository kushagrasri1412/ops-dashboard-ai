"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import StatusBadge from "./StatusBadge";
import Pagination from "./Pagination";
import { formatTimestamp } from "../lib/format";

const PAGE_SIZES = [10, 20, 50];

const COLUMNS = [
  { key: "client", label: "Client / Store", sortable: true },
  { key: "channel", label: "Channel", sortable: false },
  { key: "last_activity_ms", label: "Last Activity", sortable: true },
  { key: "total_events_30d", label: "30d Events", sortable: true, align: "right" },
  { key: "active_status", label: "Status", sortable: false },
];

function SortIcon({ direction }) {
  if (direction === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
  return <ArrowDown className="h-3.5 w-3.5" />;
}

function SortIndicator({ sortable, isSorted, direction }) {
  if (!sortable) return null;
  if (!isSorted) {
    return (
      <ArrowUpDown className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-70" />
    );
  }
  return <SortIcon direction={direction} />;
}

function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const ms = date.getTime();
  if (!Number.isFinite(ms)) return "—";

  const diffMs = Date.now() - ms;
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "Just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function ClientTable({
  clients,
  totalCount,
  loading,
  error,
  sortBy,
  sortDir,
  onToggleSort,
  selectedId,
  onSelect,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onRetry,
}) {
  const total = typeof totalCount === "number" ? totalCount : Array.isArray(clients) ? clients.length : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Clients</p>
          <p className="text-sm text-slate-500">
            Store-level operational signals derived from channel activity
          </p>
        </div>
        <div className="text-sm text-slate-500">
            {loading ? "Loading…" : `${total} stores`}
        </div>
      </div>

      {error ? (
        <div className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-sm font-semibold text-rose-800">
            Failed to load clients
          </p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-t border-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <tr>
              {COLUMNS.map((column) => {
                const isSorted = sortBy === column.key;
                const sortable = column.sortable;
                const ariaSort = sortable
                  ? isSorted
                    ? sortDir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                  : undefined;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={
                      "whitespace-nowrap px-4 py-3 " +
                      (column.align === "right" ? "text-right" : "text-left")
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onToggleSort(column.key)}
                        className={
                          "group inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 " +
                          (isSorted ? "text-slate-900" : "")
                        }
                      >
                        {column.label}
                        <SortIndicator
                          sortable={sortable}
                          isSorted={isSorted}
                          direction={sortDir}
                        />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="border-t border-slate-200">
                  {COLUMNS.map((column) => (
                    <td
                      key={`${column.key}-${idx}`}
                      className={
                        "whitespace-nowrap px-4 py-3 " +
                        (column.align === "right" ? "text-right" : "text-left")
                      }
                    >
                      <div
                        className={
                          "h-4 animate-pulse rounded-lg bg-slate-100 " +
                          (column.key === "client"
                            ? "w-40"
                            : column.key === "channel"
                              ? "w-24"
                              : column.key === "last_activity_ms"
                                ? "w-24"
                                : "w-16")
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : !error && total === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No activity found. Switch to demo mode or try again.
                </td>
              </tr>
            ) : (
              clients.map((client) => {
                const isSelected = selectedId === client.id;
                const rowClass = isSelected
                  ? "border-t border-slate-200 bg-blue-50/60"
                  : "border-t border-slate-200";

                return (
                  <tr
                    key={client.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(client.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(client.id);
                      }
                    }}
                    className={
                      rowClass +
                      " cursor-pointer transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {client.client}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {client.channel}
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3 text-slate-600"
                      title={formatTimestamp(client.last_activity_at)}
                    >
                      {client.last_activity_at
                        ? formatRelativeTime(client.last_activity_at)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                      {client.total_events_30d}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={client.active_status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
