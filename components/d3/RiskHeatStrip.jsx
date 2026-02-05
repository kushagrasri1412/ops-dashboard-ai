"use client";

import { useEffect, useMemo, useState } from "react";
import { pointer } from "d3";
import useResizeObserver from "../../lib/d3/useResizeObserver";
import { formatShortDate } from "../../lib/d3/formatters";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function labelForRisk(level) {
  if (level === "high") return "High risk";
  if (level === "medium") return "Medium risk";
  return "Low risk";
}

function fillForRisk(level, score) {
  const s = typeof score === "number" ? score : 0;
  if (level === "high") {
    const intensity = clamp(s / 3, 0.4, 1);
    return `rgba(225, 29, 72, ${0.22 + intensity * 0.55})`;
  }
  if (level === "medium") {
    const intensity = clamp(s / 2, 0.35, 1);
    return `rgba(245, 158, 11, ${0.18 + intensity * 0.45})`;
  }
  return "rgba(148, 163, 184, 0.28)";
}

export default function RiskHeatStrip({ days, loading, error }) {
  const { ref, width } = useResizeObserver({ height: 52 });
  const [hoverIndex, setHoverIndex] = useState(-1);
  const [cursorX, setCursorX] = useState(0);
  const [hasFocus, setHasFocus] = useState(false);

  const segments = useMemo(() => {
    const rows = Array.isArray(days) ? days.slice(0, 7) : [];
    return rows.map((day) => ({
      date: day.date,
      risk_level: day.risk_level || "low",
      risk_score: typeof day.risk_score === "number" ? day.risk_score : 0,
      risk_tags: Array.isArray(day.risk_tags) ? day.risk_tags : [],
    }));
  }, [days]);

  useEffect(() => {
    if (!hasFocus) return;
    if (!segments.length) return;
    if (hoverIndex >= 0) return;
    setHoverIndex(0);
  }, [hasFocus, hoverIndex, segments.length]);

  const innerW = Math.max(0, width);
  const stripH = 14;
  const n = segments.length || 7;

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

    const current = hoverIndex >= 0 ? hoverIndex : 0;
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
    const left = clamp(
      cursorX - tooltipWidth / 2,
      8,
      Math.max(8, innerW - tooltipWidth - 8)
    );

    const tags = activeSegment.risk_tags.filter(Boolean).slice(0, 3);

    return {
      left,
      dateLabel: formatShortDate(activeSegment.date),
      riskLabel: labelForRisk(activeSegment.risk_level),
      tags,
    };
  }, [activeSegment, cursorX, innerW]);

  const showTooltip = Boolean(tooltip) && (hasFocus || hoverIndex >= 0);

  return (
    <div
      ref={ref}
      className="relative rounded-xl bg-slate-50 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setHasFocus(true)}
      onBlur={() => {
        setHasFocus(false);
        setHoverIndex(-1);
      }}
      aria-label="7-day risk heatmap strip"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Risk heatmap
        </p>
        <p className="text-xs text-slate-500">Next 7 days</p>
      </div>

      {loading ? (
        <div className="mt-3 h-4 w-full animate-pulse rounded-lg bg-slate-100" />
      ) : error ? (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : !innerW ? (
        <div className="mt-3 h-4 w-full animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <svg
          width={innerW}
          height={stripH}
          viewBox={`0 0 ${innerW} ${stripH}`}
          role="img"
          aria-label="Risk intensity strip"
          className="mt-3 block"
        >
          {segments.map((seg, idx) => {
            const segW = innerW / n;
            const x = idx * segW;
            const fill = fillForRisk(seg.risk_level, seg.risk_score);
            return (
              <rect
                key={seg.date}
                x={x}
                y={0}
                width={Math.max(1, segW - 1)}
                height={stripH}
                rx={3}
                fill={fill}
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
          className="pointer-events-none absolute left-2 top-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm transition-opacity duration-150"
          style={{ left: tooltip.left }}
          aria-hidden="true"
        >
          <p className="font-semibold text-slate-900">{tooltip.dateLabel}</p>
          <p className="mt-1 text-slate-600">{tooltip.riskLabel}</p>
          {tooltip.tags.length ? (
            <p className="mt-1 text-slate-500">{tooltip.tags.join(" • ")}</p>
          ) : (
            <p className="mt-1 text-slate-500">No risk tags detected.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

