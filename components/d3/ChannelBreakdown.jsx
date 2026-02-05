"use client";

import { useEffect, useMemo, useState } from "react";
import { max, pointer, scaleBand, scaleLinear } from "d3";
import useResizeObserver from "../../lib/d3/useResizeObserver";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function normalizeChannel(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || "Unknown";
}

function ChannelSkeleton() {
  return (
    <div className="mt-4 grid gap-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="h-8 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function ChannelBreakdown({
  selectedChannel,
  onSelectChannel,
  title = "Channel breakdown",
  subtitle = "30-day activity volume by channel",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { ref, width } = useResizeObserver({ height: 220 });

  const channelCounts = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const counts = new Map();

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const ts = new Date(row.timestamp).getTime();
      if (!Number.isFinite(ts) || ts < cutoff) return;
      const channel = normalizeChannel(row.channel);
      counts.set(channel, (counts.get(channel) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count || a.channel.localeCompare(b.channel));
  }, [rows]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const pageSizeMax = 50;
        const maxPages = 6;
        const collected = [];

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

          const nextRows = Array.isArray(payload.rows) ? payload.rows : [];
          collected.push(...nextRows);

          totalPages =
            typeof payload.totalPages === "number" && payload.totalPages > 0
              ? payload.totalPages
              : 1;
          if (pageIndex >= totalPages) break;
        }

        if (cancelled) return;
        setRows(collected);
      } catch (err) {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "Unknown error.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const chart = useMemo(() => {
    const w = Math.max(0, width);
    const data = channelCounts;
    if (!w || !data.length) {
      return { w, h: 0, bars: [], x: null, y: null };
    }

    const margin = { top: 6, right: 12, bottom: 8, left: 88 };
    const barH = 18;
    const gap = 10;
    const h = margin.top + margin.bottom + data.length * (barH + gap) - gap;

    const innerW = Math.max(1, w - margin.left - margin.right);
    const innerH = Math.max(1, h - margin.top - margin.bottom);

    const maxCount = max(data, (d) => d.count) ?? 1;

    const x = scaleLinear().domain([0, maxCount]).range([0, innerW]).nice();
    const y = scaleBand()
      .domain(data.map((d) => d.channel))
      .range([0, innerH])
      .padding(0.25);

    const bars = data.map((d) => {
      const yPos = y(d.channel) ?? 0;
      return {
        ...d,
        x: 0,
        y: yPos,
        width: x(d.count),
        height: y.bandwidth(),
      };
    });

    return { w, h, bars, x, y, margin, innerW, innerH };
  }, [channelCounts, width]);

  const [hovered, setHovered] = useState(null);

  function handleSelect(channel) {
    if (typeof onSelectChannel !== "function") return;
    const next = selectedChannel === channel ? "" : channel;
    onSelectChannel(next);
  }

  function handleMove(event) {
    if (!chart?.bars?.length) return;
    const [mx, my] = pointer(event);
    const within = chart.bars.find(
      (bar) =>
        my >= chart.margin.top + bar.y &&
        my <= chart.margin.top + bar.y + bar.height
    );
    if (!within) {
      setHovered(null);
      return;
    }
    setHovered({
      channel: within.channel,
      count: within.count,
      x: mx,
      y: my,
    });
  }

  function handleLeave() {
    setHovered(null);
  }

  const tooltip = useMemo(() => {
    if (!hovered || !chart?.w) return null;
    const tooltipWidth = 190;
    const tooltipHeight = 82;
    const left = clamp(
      hovered.x + 12,
      8,
      Math.max(8, chart.w - tooltipWidth - 8)
    );
    const maxTop = Math.max(8, chart.h - tooltipHeight - 8);
    const top = clamp(hovered.y - tooltipHeight / 2, 8, maxTop);
    return { left, top, width: tooltipWidth };
  }, [hovered, chart?.w, chart?.h]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {selectedChannel ? (
          <button
            type="button"
            onClick={() => handleSelect(selectedChannel)}
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            title="Clear channel filter"
          >
            {selectedChannel} • clear
          </button>
        ) : null}
      </div>

      {loading ? (
        <div ref={ref} className="relative mt-4">
          <ChannelSkeleton />
        </div>
      ) : (
        <div ref={ref} className="relative mt-4">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : !width ? (
            <div className="h-28 w-full animate-pulse rounded-xl bg-slate-100" />
          ) : !chart?.bars?.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No activity available for channel breakdown.
            </div>
          ) : (
            <>
              <svg
                width={chart.w}
                height={chart.h}
                viewBox={`0 0 ${chart.w} ${chart.h}`}
                role="img"
                aria-label="Channel breakdown bar chart"
                className="block"
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
              >
                <g transform={`translate(${chart.margin.left},${chart.margin.top})`}>
                  {chart.bars.map((bar) => {
                    const interactive = typeof onSelectChannel === "function";
                    const isSelected = selectedChannel === bar.channel;
                    const isHovered = hovered?.channel === bar.channel;
                    const fill = isSelected
                      ? "#2563eb"
                      : isHovered
                        ? "rgba(37, 99, 235, 0.28)"
                        : "rgba(37, 99, 235, 0.18)";
                    const stroke = isSelected
                      ? "#1d4ed8"
                      : isHovered
                        ? "rgba(37, 99, 235, 0.55)"
                        : "rgba(148, 163, 184, 0.35)";

                    const ariaLabel = interactive
                      ? `${bar.channel}: ${bar.count} events. Click to filter.`
                      : `${bar.channel}: ${bar.count} events.`;

                    return (
                      <g
                        key={bar.channel}
                        role={interactive ? "button" : undefined}
                        tabIndex={interactive ? 0 : undefined}
                        aria-label={ariaLabel}
                        onClick={interactive ? () => handleSelect(bar.channel) : undefined}
                        onFocus={
                          interactive
                            ? () => {
                                setHovered({
                                  channel: bar.channel,
                                  count: bar.count,
                                  x:
                                    chart.margin.left +
                                    Math.min(chart.innerW, bar.width),
                                  y: chart.margin.top + bar.y + bar.height / 2,
                                });
                              }
                            : undefined
                        }
                        onBlur={interactive ? () => setHovered(null) : undefined}
                        onKeyDown={
                          interactive
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  handleSelect(bar.channel);
                                }
                              }
                            : undefined
                        }
                      >
                        <text
                          x={-12}
                          y={bar.y + bar.height / 2}
                          textAnchor="end"
                          dy="0.32em"
                          fontSize={12}
                          fill="#475569"
                        >
                          {bar.channel}
                        </text>
                        <rect
                          x={0}
                          y={bar.y}
                          width={chart.innerW}
                          height={bar.height}
                          rx={8}
                          fill="rgba(148, 163, 184, 0.12)"
                        />
                        <rect
                          x={0}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          rx={8}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={1}
                          style={{
                            cursor: interactive ? "pointer" : "default",
                            transition: "fill 180ms ease, stroke 180ms ease",
                          }}
                        />
                        <text
                          x={bar.width + 8}
                          y={bar.y + bar.height / 2}
                          dy="0.32em"
                          fontSize={12}
                          fill="#0f172a"
                          fontWeight={600}
                        >
                          {bar.count}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {tooltip && hovered ? (
                <div
                  className="pointer-events-none absolute rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition-opacity duration-150"
                  style={{
                    left: tooltip.left,
                    top: tooltip.top,
                    width: tooltip.width,
                  }}
                  aria-hidden="true"
                >
                  <p className="font-semibold text-slate-900">{hovered.channel}</p>
                  <p className="mt-1 text-slate-600">{hovered.count} events</p>
                  {typeof onSelectChannel === "function" ? (
                    <p className="mt-1 text-slate-500">
                      Click to filter the activity table.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
