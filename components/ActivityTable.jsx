"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import StatusBadge from "./StatusBadge";
import Pagination from "./Pagination";
import { formatCompactCurrency, formatTimestamp } from "../lib/format";

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZES = [10, 20, 50];

const COLUMNS = [
  { key: "timestamp", label: "Time", sortable: true },
  { key: "store", label: "Store", sortable: true },
  { key: "channel", label: "Channel", sortable: true },
  { key: "action", label: "Activity", sortable: false },
  { key: "status", label: "Status", sortable: true },
  { key: "revenue_delta", label: "Revenue Impact", sortable: true, align: "right" },
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

export default function ActivityTable({
  channelFilter = "",
  onClearChannelFilter,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");

  const normalizedChannelFilter = String(channelFilter || "").trim();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    return params.toString();
  }, [page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    if (!normalizedChannelFilter) return;
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedChannelFilter]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (normalizedChannelFilter) {
          const pageSizeMax = 50;
          const maxPages = 6;
          const collected = [];

          let totalPagesFromApi = 1;

          for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
            const params = new URLSearchParams();
            params.set("page", String(pageIndex));
            params.set("pageSize", String(pageSizeMax));
            params.set("sortBy", sortBy);
            params.set("sortDir", sortDir);

            const response = await fetch(`/api/activity?${params.toString()}`, {
              cache: "no-store",
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload.error || "Failed to load activity.");
            }

            const nextRows = Array.isArray(payload.rows) ? payload.rows : [];
            collected.push(...nextRows);

            totalPagesFromApi =
              typeof payload.totalPages === "number" && payload.totalPages > 0
                ? payload.totalPages
                : 1;
            if (pageIndex >= totalPagesFromApi) break;
          }

          const filtered = collected.filter((row) => {
            const channel = String(row?.channel || "").trim();
            return (
              channel.toLowerCase() === normalizedChannelFilter.toLowerCase()
            );
          });

          const filteredTotal = filtered.length;
          const nextTotalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
          const safePage = Math.min(page, nextTotalPages);
          const start = (safePage - 1) * pageSize;
          const sliced = filtered.slice(start, start + pageSize);

          if (cancelled) return;

          if (safePage !== page) setPage(safePage);
          setRows(sliced);
          setTotal(filteredTotal);
          setTotalPages(nextTotalPages);
        } else {
          const response = await fetch(`/api/activity?${queryString}`, {
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload.error || "Failed to load activity.");
          }
          if (cancelled) return;

          setRows(Array.isArray(payload.rows) ? payload.rows : []);
          setTotal(typeof payload.total === "number" ? payload.total : 0);
          setTotalPages(
            typeof payload.totalPages === "number" ? payload.totalPages : 1
          );
        }
        if (cancelled) return;
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [normalizedChannelFilter, page, pageSize, queryString, sortBy, sortDir]);

  function toggleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      setPage(1);
      return;
    }
    setSortBy(columnKey);
    setSortDir("asc");
    setPage(1);
  }

  function handlePageSize(nextSize) {
    setPageSize(nextSize);
    setPage(1);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Recent Activity</p>
          <p className="text-sm text-slate-500">
            Latest operational changes across channels
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-slate-500 sm:items-end">
          <div>{loading ? "Loading…" : `${total} events`}</div>
          {normalizedChannelFilter ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {normalizedChannelFilter}
              </span>
              {typeof onClearChannelFilter === "function" ? (
                <button
                  type="button"
                  onClick={onClearChannelFilter}
                  className="text-xs font-semibold text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
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
                      "whitespace-nowrap px-4 py-3 text-left " +
                      (column.align === "right" ? "text-right" : "text-left")
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
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
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="border-t border-slate-200">
                  {COLUMNS.map((column) => (
                    <td
                      key={`${column.key}-${rowIndex}`}
                      className={
                        "whitespace-nowrap px-4 py-3 " +
                        (column.align === "right" ? "text-right" : "text-left")
                      }
                    >
                      <div
                        className={
                          "h-4 animate-pulse rounded-lg bg-slate-100 " +
                          (column.key === "action"
                            ? "w-56"
                            : column.key === "timestamp"
                              ? "w-28"
                              : "w-24")
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  {normalizedChannelFilter ? (
                    <div className="space-y-2">
                      <p>
                        No activity events found for{" "}
                        <span className="font-semibold text-slate-700">
                          {normalizedChannelFilter}
                        </span>
                        .
                      </p>
                      {typeof onClearChannelFilter === "function" ? (
                        <button
                          type="button"
                          onClick={onClearChannelFilter}
                          className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                        >
                          Clear filter
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    "No activity events found."
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-200 transition hover:bg-slate-50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {row.store}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {row.channel}
                  </td>
                  <td className="min-w-[260px] px-4 py-3 text-slate-600">
                    {row.action}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                    {formatCompactCurrency(row.revenue_delta)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        pageSizeOptions={PAGE_SIZES}
        onPageChange={setPage}
        onPageSizeChange={handlePageSize}
      />
    </div>
  );
}
