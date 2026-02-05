"use client";

import { useEffect, useMemo, useState } from "react";
import { area, curveMonotoneX, line, max, min, pointer, scaleLinear } from "d3";
import useResizeObserver from "../../lib/d3/useResizeObserver";
import { formatCompactCurrency } from "../../lib/d3/formatters";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

export default function RevenueSparkArea({
  data,
  ariaLabel,
  height = 44,
  stroke = "#2563eb",
}) {
  const values = useMemo(() => {
    return Array.isArray(data)
      ? data
          .map((v) => (typeof v === "number" ? v : Number(v)))
          .filter(Number.isFinite)
      : [];
  }, [data]);

  const { ref, width } = useResizeObserver({ height });

  const [hoverIndex, setHoverIndex] = useState(-1);
  const [hasFocus, setHasFocus] = useState(false);
  const [cursorX, setCursorX] = useState(0);

  useEffect(() => {
    if (!hasFocus) return;
    if (values.length < 2) return;
    if (hoverIndex >= 0) return;
    setHoverIndex(values.length - 1);
  }, [hasFocus, hoverIndex, values.length]);

  const chart = useMemo(() => {
    const w = Math.max(0, width);
    const h = Math.max(0, height);

    if (!w || values.length < 2) {
      return {
        w,
        h,
        linePath: "",
        areaPath: "",
        points: [],
        x: null,
        y: null,
      };
    }

    const padding = 4;
    const innerW = Math.max(1, w - padding * 2);
    const innerH = Math.max(1, h - padding * 2);

    const x = scaleLinear()
      .domain([0, values.length - 1])
      .range([padding, padding + innerW]);

    const minValue = min(values) ?? 0;
    const maxValue = max(values) ?? 0;
    const yPad = (maxValue - minValue) * 0.12 || 1;

    const y = scaleLinear()
      .domain([minValue - yPad, maxValue + yPad])
      .range([padding + innerH, padding]);

    const points = values.map((value, idx) => ({
      value,
      idx,
      x: x(idx),
      y: y(value),
    }));

    const lineGen = line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveMonotoneX);

    const areaGen = area()
      .x((d) => d.x)
      .y0(padding + innerH)
      .y1((d) => d.y)
      .curve(curveMonotoneX);

    return {
      w,
      h,
      linePath: lineGen(points) || "",
      areaPath: areaGen(points) || "",
      points,
      x,
      y,
    };
  }, [values, width, height]);

  const activePoint =
    hoverIndex >= 0 && hoverIndex < chart.points.length
      ? chart.points[hoverIndex]
      : chart.points.length
        ? chart.points[chart.points.length - 1]
        : null;

  const tooltipValue =
    activePoint && typeof activePoint.value === "number"
      ? formatCompactCurrency(activePoint.value)
      : "—";

  function handlePointerMove(event) {
    if (values.length < 2 || !chart.w) return;
    const [mx] = pointer(event);
    setCursorX(mx);

    const idx = clamp(
      Math.round(((mx - 4) / Math.max(1, chart.w - 8)) * (values.length - 1)),
      0,
      values.length - 1
    );
    setHoverIndex(idx);
  }

  function handlePointerLeave() {
    if (hasFocus) return;
    setHoverIndex(-1);
  }

  function handleKeyDown(event) {
    if (values.length < 2 || !chart.w) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();

    const current =
      hoverIndex >= 0 ? hoverIndex : Math.max(0, values.length - 1);
    const next =
      event.key === "ArrowLeft"
        ? clamp(current - 1, 0, values.length - 1)
        : clamp(current + 1, 0, values.length - 1);

    setHoverIndex(next);

    const p = chart.points[next];
    if (p) setCursorX(p.x);
  }

  const tooltipLeft = (() => {
    const w = Math.max(0, width);
    if (!w) return 6;
    const x = activePoint ? activePoint.x : cursorX;
    return clamp(x - 46, 6, Math.max(6, w - 110));
  })();

  const showTooltip = (hasFocus || hoverIndex >= 0) && values.length >= 2;

  return (
    <div
      ref={ref}
      className="relative h-11 w-28"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => setHasFocus(true)}
      onBlur={() => {
        setHasFocus(false);
        setHoverIndex(-1);
      }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      aria-label={ariaLabel || "Revenue sparkline"}
    >
      {values.length < 2 || !chart.w ? (
        <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <svg
          width={chart.w}
          height={chart.h}
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          role="img"
          aria-label={ariaLabel ? `${ariaLabel} sparkline` : "Revenue sparkline"}
          className="block"
        >
          <path d={chart.areaPath} fill={stroke} opacity={0.14} />
          <path
            d={chart.linePath}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {activePoint ? (
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={3.5}
              fill={stroke}
              stroke="#ffffff"
              strokeWidth={1.8}
              style={{
                transition: "transform 180ms ease",
                transformOrigin: `${activePoint.x}px ${activePoint.y}px`,
                transform: showTooltip ? "scale(1.12)" : "scale(1)",
              }}
            />
          ) : null}
        </svg>
      )}

      <div
        className={
          "pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-opacity duration-150 " +
          (showTooltip ? "opacity-100" : "opacity-0")
        }
        style={{ left: tooltipLeft }}
        aria-hidden="true"
      >
        <span className="text-slate-500">{ariaLabel ? `${ariaLabel}: ` : ""}</span>
        <span className="font-semibold text-slate-900">{tooltipValue}</span>
      </div>
    </div>
  );
}

