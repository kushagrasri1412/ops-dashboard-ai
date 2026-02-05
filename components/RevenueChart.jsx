"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  bisector,
  curveMonotoneX,
  line,
  max,
  scaleLinear,
  scaleTime,
} from "d3";
import useResizeObserver from "../lib/d3/useResizeObserver";
import {
  formatCompactCurrency,
  formatCurrency,
  formatShortDate,
  parseISODate,
} from "../lib/d3/formatters";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function crisp(value) {
  return Math.round(value) + 0.5;
}

function buildPoints(rows, kind) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => {
      const dateKey = typeof row?.date === "string" ? row.date : "";
      const revenue = Number(row?.revenue);
      if (!dateKey || !Number.isFinite(revenue)) return null;

      const date = parseISODate(dateKey);
      if (Number.isNaN(date.getTime())) return null;

      return { dateKey, date, revenue, kind };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function summarizeSeries(series) {
  const points = Array.isArray(series) ? series : [];
  if (!points.length) return { lastValue: null, change: null };

  const revenues = points.map((p) => p.revenue).filter(Number.isFinite);
  const lastValue = revenues.length ? revenues[revenues.length - 1] : null;

  const last7 = revenues.slice(-7);
  const prev7 = revenues.slice(-14, -7);

  const sum = (values) => values.reduce((acc, value) => acc + value, 0);
  const last7Sum = last7.length ? sum(last7) : null;
  const prev7Sum = prev7.length ? sum(prev7) : null;

  const change =
    last7Sum != null && prev7Sum != null && prev7Sum !== 0
      ? (last7Sum - prev7Sum) / prev7Sum
      : null;

  return { lastValue, change };
}

export default function RevenueChart({
  series,
  forecast,
  anomalies,
  loading,
  error,
  onRetry,
}) {
  const { ref, width, height } = useResizeObserver({ height: 288 });
  const containerRef = useRef(null);

  const [hover, setHover] = useState(null);
  const [hasFocus, setHasFocus] = useState(false);

  const actualPoints = useMemo(() => buildPoints(series, "actual"), [series]);
  const forecastPoints = useMemo(() => buildPoints(forecast, "forecast"), [forecast]);

  const hoverPoints = useMemo(() => {
    return [...actualPoints, ...forecastPoints].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [actualPoints, forecastPoints]);

  const anomalyByDate = useMemo(() => {
    const map = new Map();
    (Array.isArray(anomalies) ? anomalies : []).forEach((anomaly) => {
      if (anomaly?.date) map.set(anomaly.date, anomaly);
    });
    return map;
  }, [anomalies]);

  const actualByDate = useMemo(() => {
    return new Map(actualPoints.map((point) => [point.dateKey, point]));
  }, [actualPoints]);

  const forecastByDate = useMemo(() => {
    return new Map(forecastPoints.map((point) => [point.dateKey, point]));
  }, [forecastPoints]);

  const summary = useMemo(() => summarizeSeries(actualPoints), [actualPoints]);

  const margin = { top: 18, right: 24, bottom: 34, left: 58 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(() => {
    const domainPoints = hoverPoints.length ? hoverPoints : actualPoints;
    if (!domainPoints.length || !innerW) return null;

    const minDate = domainPoints[0].date;
    const maxDate = domainPoints[domainPoints.length - 1].date;

    return scaleTime().domain([minDate, maxDate]).range([0, innerW]);
  }, [hoverPoints, actualPoints, innerW]);

  const yScale = useMemo(() => {
    if (!hoverPoints.length || !innerH) return null;

    const maxValue = max(hoverPoints, (d) => d.revenue) ?? 0;
    const upper = Math.max(0, maxValue) * 1.12;

    return scaleLinear().domain([0, upper]).nice(5).range([innerH, 0]);
  }, [hoverPoints, innerH]);

  const yTicks = useMemo(() => {
    if (!yScale) return [];
    return yScale.ticks(5);
  }, [yScale]);

  const xTicks = useMemo(() => {
    if (!xScale) return [];
    return xScale.ticks(6);
  }, [xScale]);

  const actualPath = useMemo(() => {
    if (!xScale || !yScale || actualPoints.length < 2) return "";

    const generator = line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.revenue))
      .curve(curveMonotoneX);

    return generator(actualPoints) || "";
  }, [actualPoints, xScale, yScale]);

  const forecastPath = useMemo(() => {
    if (!xScale || !yScale || !forecastPoints.length) return "";

    const base = actualPoints.length ? actualPoints[actualPoints.length - 1] : null;
    const connected = base ? [base, ...forecastPoints] : forecastPoints;

    const generator = line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.revenue))
      .curve(curveMonotoneX);

    return generator(connected) || "";
  }, [actualPoints, forecastPoints, xScale, yScale]);

  const bisectDate = useMemo(() => bisector((d) => d.date).left, []);

  function updateHoverForPoint(point, { containerX, containerY } = {}) {
    if (!point || !xScale || !yScale) return;

    const x = xScale(point.date);
    const y = yScale(point.revenue);

    const anomaly = anomalyByDate.get(point.dateKey) || null;
    const direction = anomaly?.direction || null;

    setHover({
      point,
      anomaly,
      direction,
      x,
      y,
      containerX: containerX ?? margin.left + x,
      containerY: containerY ?? margin.top + y,
    });
  }

  function handleMouseMove(event) {
    if (!hoverPoints.length || !xScale || !yScale) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;

    const hoveredDate = xScale.invert(mx);
    const idx = bisectDate(hoverPoints, hoveredDate, 1);

    const prev = hoverPoints[idx - 1];
    const next = hoverPoints[idx];

    let closest = prev || next;
    if (prev && next) {
      closest =
        hoveredDate.getTime() - prev.date.getTime() <
        next.date.getTime() - hoveredDate.getTime()
          ? prev
          : next;
    }

    const containerEl = containerRef.current;
    const containerRect = containerEl ? containerEl.getBoundingClientRect() : rect;

    updateHoverForPoint(closest, {
      containerX: event.clientX - containerRect.left,
      containerY: event.clientY - containerRect.top,
    });
  }

  function handleMouseLeave() {
    if (hasFocus) return;
    setHover(null);
  }

  function handleKeyDown(event) {
    if (!hoverPoints.length || !xScale || !yScale) return;

    const key = event.key;
    if (key !== "ArrowLeft" && key !== "ArrowRight") return;

    event.preventDefault();

    const currentIndex = hover?.point
      ? hoverPoints.findIndex((p) => p.dateKey === hover.point.dateKey && p.kind === hover.point.kind)
      : -1;

    const startIndex = currentIndex >= 0 ? currentIndex : Math.max(0, actualPoints.length - 1);
    const nextIndex =
      key === "ArrowLeft"
        ? clamp(startIndex - 1, 0, hoverPoints.length - 1)
        : clamp(startIndex + 1, 0, hoverPoints.length - 1);

    const nextPoint = hoverPoints[nextIndex];
    updateHoverForPoint(nextPoint, {
      containerX: margin.left + xScale(nextPoint.date),
      containerY: margin.top + yScale(nextPoint.revenue),
    });
  }

  useEffect(() => {
    if (!hasFocus) return;
    if (!hover && actualPoints.length) {
      const last = actualPoints[actualPoints.length - 1];
      updateHoverForPoint(last, {
        containerX: margin.left + (xScale ? xScale(last.date) : 0),
        containerY: margin.top + (yScale ? yScale(last.revenue) : 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFocus]);

  const tooltip = useMemo(() => {
    if (!hover || !width) return null;

    const tooltipWidth = 240;
    const tooltipHeight = 118;

    const maxLeft = Math.max(8, width - tooltipWidth - 8);
    const maxTop = Math.max(8, height - tooltipHeight - 8);

    const left = clamp(hover.containerX + 14, 8, maxLeft);
    const top = clamp(hover.containerY - tooltipHeight - 12, 8, maxTop);

    const label = hover.point.kind === "forecast" ? "Forecast" : "Actual";

    return {
      left,
      top,
      width: tooltipWidth,
      label,
    };
  }, [hover, width, height]);

  const ariaSummary = useMemo(() => {
    const lastLabel = summary.lastValue != null ? formatCurrency(summary.lastValue) : "—";
    const change =
      typeof summary.change === "number" && Number.isFinite(summary.change)
        ? `${(summary.change * 100).toFixed(1)}%`
        : "—";

    return `Revenue chart. Latest value ${lastLabel}. Week-over-week change ${change}.`;
  }, [summary]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Channel revenue</p>
          <p className="text-sm text-slate-500">
            Last 30 days with 7-day forecast overlay
          </p>
        </div>
        <div className="text-xs text-slate-500">
          <span className="mr-3 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Actual
          </span>
          <span className="mr-3 inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-300" /> Forecast
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> Anomaly
          </span>
        </div>
      </div>

      <div className="sr-only">{ariaSummary}</div>

      <div
        ref={(node) => {
          ref.current = node;
          containerRef.current = node;
        }}
        className="relative mt-4 h-72 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => {
          setHasFocus(false);
          setHover(null);
        }}
        aria-label="Revenue line chart with forecast and anomaly markers"
      >
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-6 text-center text-sm text-rose-700">
            <p className="font-semibold text-rose-800">Failed to load revenue</p>
            <p className="mt-1">{error}</p>
            {typeof onRetry === "function" ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/40"
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : !width || innerW <= 0 || innerH <= 0 ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
        ) : !xScale || !yScale || !innerW || !innerH ? (
          <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
            No chart data available.
          </div>
        ) : (
          <>
            <svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="Revenue over time"
              className="block"
            >
              <g transform={`translate(${margin.left},${margin.top})`}>
                {yTicks.map((tick) => (
                  <line
                    key={`grid-${tick}`}
                    x1={0}
                    x2={innerW}
                    y1={crisp(yScale(tick))}
                    y2={crisp(yScale(tick))}
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    shapeRendering="crispEdges"
                  />
                ))}

                <line
                  x1={0}
                  x2={innerW}
                  y1={crisp(innerH)}
                  y2={crisp(innerH)}
                  stroke="#e2e8f0"
                  shapeRendering="crispEdges"
                />

                <line
                  x1={crisp(0)}
                  x2={crisp(0)}
                  y1={0}
                  y2={innerH}
                  stroke="#e2e8f0"
                  shapeRendering="crispEdges"
                />

                {yTicks.map((tick) => (
                  <g
                    key={`y-${tick}`}
                    transform={`translate(0,${Math.round(yScale(tick))})`}
                  >
                    <line
                      x1={0}
                      x2={-6}
                      y1={crisp(0)}
                      y2={crisp(0)}
                      stroke="#e2e8f0"
                      shapeRendering="crispEdges"
                    />
                    <text
                      x={-10}
                      dy="0.32em"
                      textAnchor="end"
                      fill="#64748b"
                      fontSize={12}
                    >
                      {formatCompactCurrency(tick)}
                    </text>
                  </g>
                ))}

                {xTicks.map((tick) => (
                  <g
                    key={`x-${tick.toISOString()}`}
                    transform={`translate(${Math.round(xScale(tick))},${innerH})`}
                  >
                    <line
                      x1={crisp(0)}
                      x2={crisp(0)}
                      y1={0}
                      y2={6}
                      stroke="#e2e8f0"
                      shapeRendering="crispEdges"
                    />
                    <text
                      y={20}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize={12}
                    >
                      {formatShortDate(tick)}
                    </text>
                  </g>
                ))}

                <path
                  d={actualPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                <path
                  d={forecastPath}
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray="6 6"
                />

                {actualPoints.map((point) => {
                  const anomaly = anomalyByDate.get(point.dateKey);
                  if (!anomaly) return null;

                  const fill =
                    anomaly.direction === "down" ? "#e11d48" : "#2563eb";
                  const radius = anomaly.direction === "down" ? 5.5 : 4.5;

                  return (
                    <circle
                      key={`anomaly-${point.dateKey}`}
                      cx={xScale(point.date)}
                      cy={yScale(point.revenue)}
                      r={radius}
                      fill={fill}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  );
                })}

                {hover ? (
                  <g pointerEvents="none">
                    <line
                      x1={hover.x}
                      x2={hover.x}
                      y1={0}
                      y2={innerH}
                      stroke="#94a3b8"
                      strokeDasharray="3 3"
                      opacity={0.8}
                    />
                    <circle
                      cx={hover.x}
                      cy={hover.y}
                      r={6}
                      fill={hover.direction === "down" ? "#e11d48" : "#2563eb"}
                      stroke="#ffffff"
                      strokeWidth={2}
                      style={{ transition: "transform 160ms ease" }}
                    />
                  </g>
                ) : null}

                <rect
                  x={0}
                  y={0}
                  width={innerW}
                  height={innerH}
                  fill="transparent"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            </svg>

            {hover && tooltip ? (
              <div
                className="pointer-events-none absolute rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg transition-opacity duration-150"
                style={{
                  left: tooltip.left,
                  top: tooltip.top,
                  width: tooltip.width,
                }}
                aria-hidden="true"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {tooltip.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatShortDate(hover.point.date)}
                    </p>
                  </div>
                  {hover.anomaly ? (
                    <span
                      className={
                        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold " +
                        (hover.anomaly.direction === "down"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-blue-200 bg-blue-50 text-blue-700")
                      }
                    >
                      Anomaly
                    </span>
                ) : null}
                </div>

                <div className="mt-3 space-y-1">
                  {actualByDate.has(hover.point.dateKey) ? (
                    <p className="text-lg font-semibold text-slate-900">
                      {formatCurrency(actualByDate.get(hover.point.dateKey).revenue)}
                    </p>
                  ) : null}

                  {forecastByDate.has(hover.point.dateKey) ? (
                    <p className="text-sm font-semibold text-slate-900">
                      Forecast:{" "}
                      <span className="font-semibold">
                        {formatCurrency(forecastByDate.get(hover.point.dateKey).revenue)}
                      </span>
                    </p>
                  ) : null}

                  {!actualByDate.has(hover.point.dateKey) &&
                  !forecastByDate.has(hover.point.dateKey) ? (
                    <p className="text-lg font-semibold text-slate-900">—</p>
                  ) : null}
                </div>
                {hover.anomaly ? (
                  <p className="mt-1 text-xs text-slate-500">
                    z-score{" "}
                    <span className="font-semibold text-slate-700">
                      {typeof hover.anomaly.z === "number"
                        ? hover.anomaly.z.toFixed(2)
                        : "—"}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No anomaly detected.</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
