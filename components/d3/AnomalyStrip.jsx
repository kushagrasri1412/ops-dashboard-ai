"use client";

import { useEffect, useMemo, useState } from "react";
import { pointer } from "d3";
import useResizeObserver from "../../lib/d3/useResizeObserver";
import { formatCurrency, formatShortDate } from "../../lib/d3/formatters";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function colorForAnomaly(anomaly) {
  if (!anomaly) {
    return {
      fill: "rgba(148, 163, 184, 0.35)",
      label: "No anomaly",
    };
  }

  const z = typeof anomaly.z === "number" ? Math.abs(anomaly.z) : 0;
  const intensity = clamp(z / 3.25, 0, 1);
  const opacity = 0.18 + intensity * 0.62;

  if (anomaly.direction === "down") {
    return { fill: `rgba(225, 29, 72, ${opacity})`, label: "Negative anomaly" };
  }

  return { fill: `rgba(37, 99, 235, ${opacity})`, label: "Positive anomaly" };
}

export default function AnomalyStrip({ series, anomalies, loading, error }) {
  const { ref, width } = useResizeObserver({ height: 64 });
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [cursorX, setCursorX] = useState(0);
  const [hasFocus, setHasFocus] = useState(false);

  const points = useMemo(() => {
    const rows = Array.isArray(series) ? series.slice(-30) : [];
    return rows.map((point) => ({
      date: point.date,
      revenue: typeof point?.revenue === "number" ? point.revenue : Number(point?.revenue),
    }));
  }, [series]);

  const anomalyByDate = useMemo(() => {
    const map = new Map();
    (Array.isArray(anomalies) ? anomalies : []).forEach((a) => {
      if (a?.date) map.set(a.date, a);
    });
    return map;
  }, [anomalies]);

  const segments = useMemo(() => {
    return points.map((point) => {
      const anomaly = anomalyByDate.get(point.date) || null;
      const meta = colorForAnomaly(anomaly);
      return { ...point, anomaly, ...meta };
    });
  }, [points, anomalyByDate]);

  useEffect(() => {
    if (!hasFocus) return;
    if (!segments.length) return;
    if (hoverIndex >= 0) return;
    setHoverIndex(segments.length - 1);
  }, [hasFocus, hoverIndex, segments.length]);

  const innerW = Math.max(0, width);
  const stripH = 16;
  const n = segments.length || 30;

  const activeSegment =
    hoverIndex >= 0 && hoverIndex < segments.length ? segments[hoverIndex] : null;

  function indexFromX(mx) {
    if (!segments.length || !innerW) return -1;
    return clamp(Math.floor((mx / innerW) * segments.length), 0, segments.length - 1);
  }

  function handleMove(event) {
    if (!segments.length || !innerW) return;
    const [mx] = pointer(event);
    setCursorX(mx);
    setHoverIndex(indexFromX(mx));
  }

  function handleLeave() {
    if (hasFocus) return;
    setHoverIndex(-1);
  }

  function handleKeyDown(event) {
    if (!segments.length) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const current = hoverIndex >= 0 ? hoverIndex : segments.length - 1;
    const next =
      event.key === "ArrowLeft"
        ? clamp(current - 1, 0, segments.length - 1)
        : clamp(current + 1, 0, segments.length - 1);

    setHoverIndex(next);
    setCursorX(((next + 0.5) / segments.length) * innerW);
  }

  const tooltip = useMemo(() => {
    if (!activeSegment || !innerW) return null;
    const tooltipWidth = 240;
    const left = clamp(cursorX - tooltipWidth / 2, 8, Math.max(8, innerW - tooltipWidth - 8));
    return {
      left,
      dateLabel: formatShortDate(activeSegment.date),
      revenueLabel: formatCurrency(activeSegment.revenue),
      zLabel:
        activeSegment.anomaly && typeof activeSegment.anomaly.z === "number"
          ? activeSegment.anomaly.z.toFixed(2)
          : "—",
      anomalyLabel: activeSegment.anomaly ? activeSegment.label : "No anomaly detected",
    };
  }, [activeSegment, cursorX, innerW]);

  const showTooltip = Boolean(tooltip) && (hasFocus || hoverIndex >= 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Anomaly Strip</p>
          <p className="text-sm text-slate-500">
            Density view of anomalies across the last 30 days
          </p>
        </div>
        <p className="text-xs text-slate-500">{segments.length} days</p>
      </div>

      <div
        ref={ref}
        className="relative mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => {
          setHasFocus(false);
          setHoverIndex(-1);
        }}
        aria-label="Anomaly density strip for the last 30 days"
      >
        {loading ? (
          <div className="h-6 w-full animate-pulse rounded-xl bg-slate-100" />
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : !innerW ? (
          <div className="h-6 w-full animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <svg
            width={innerW}
            height={stripH}
            viewBox={`0 0 ${innerW} ${stripH}`}
            role="img"
            aria-label="Anomaly strip across the last 30 days"
            className="block"
          >
            {segments.map((seg, idx) => {
              const segW = innerW / n;
              const x = idx * segW;
              return (
                <rect
                  key={seg.date}
                  x={x}
                  y={0}
                  width={Math.max(1, segW - 1)}
                  height={stripH}
                  rx={3}
                  fill={seg.fill}
                />
              );
            })}

            <rect
              x={0}
              y={0}
              width={innerW}
              height={stripH}
              fill="transparent"
              onMouseMove={handleMove}
              onMouseLeave={handleLeave}
            />
          </svg>
        )}

        {showTooltip && tooltip ? (
          <div
            className="pointer-events-none absolute top-8 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition-opacity duration-150"
            style={{ left: tooltip.left }}
            aria-hidden="true"
          >
            <p className="font-semibold text-slate-900">{tooltip.dateLabel}</p>
            <p className="mt-1">
              Revenue: <span className="font-semibold">{tooltip.revenueLabel}</span>
            </p>
            {activeSegment?.anomaly ? (
              <p className="mt-1">
                z-score: <span className="font-semibold">{tooltip.zLabel}</span>
              </p>
            ) : null}
            <p className="mt-1 text-slate-500">{tooltip.anomalyLabel}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

