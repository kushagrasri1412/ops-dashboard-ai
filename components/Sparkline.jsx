"use client";

import { useMemo, useState } from "react";
import { area, curveMonotoneX, line, max, min, scaleLinear } from "d3";
import useResizeObserver from "../lib/d3/useResizeObserver";
import { formatCompactCurrency } from "../lib/d3/formatters";

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

export default function Sparkline({
  data,
  label,
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
  const [hovered, setHovered] = useState(false);

  const chart = useMemo(() => {
    const w = Math.max(0, width);
    const h = Math.max(0, height);

    if (!w || values.length < 2) {
      return { w, h, linePath: "", areaPath: "", last: null };
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

    const lineGen = line()
      .x((_, idx) => x(idx))
      .y((d) => y(d))
      .curve(curveMonotoneX);

    const areaGen = area()
      .x((_, idx) => x(idx))
      .y0(padding + innerH)
      .y1((d) => y(d))
      .curve(curveMonotoneX);

    const lastIndex = values.length - 1;
    const last = {
      value: values[lastIndex],
      x: x(lastIndex),
      y: y(values[lastIndex]),
    };

    return {
      w,
      h,
      linePath: lineGen(values) || "",
      areaPath: areaGen(values) || "",
      last,
    };
  }, [values, width, height]);

  const tooltipValue =
    chart.last && typeof chart.last.value === "number"
      ? formatCompactCurrency(chart.last.value)
      : "—";

  const tooltipLeft = chart.last ? clamp(chart.last.x - 48, 6, width - 100) : 6;

  return (
    <div
      ref={ref}
      className="relative h-11 w-28"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {values.length < 2 || !chart.w ? (
        <div className="h-full w-full animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <svg
          width={chart.w}
          height={chart.h}
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          role="img"
          aria-label={label ? `${label} sparkline` : "Sparkline"}
        >
          <path d={chart.areaPath} fill={stroke} opacity={0.12} />
          <path
            d={chart.linePath}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
          {chart.last ? (
            <circle
              cx={chart.last.x}
              cy={chart.last.y}
              r={3.5}
              fill={stroke}
              stroke="#ffffff"
              strokeWidth={1.8}
              style={{
                transition: "transform 180ms ease",
                transformOrigin: `${chart.last.x}px ${chart.last.y}px`,
                transform: hovered ? "scale(1.12)" : "scale(1)",
              }}
            />
          ) : null}
        </svg>
      )}

      <div
        className={
          "pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition-opacity duration-150 " +
          (hovered ? "opacity-100" : "opacity-0")
        }
        style={{ left: tooltipLeft }}
        aria-hidden="true"
      >
        <span className="text-slate-500">{label ? `${label}: ` : ""}</span>
        <span className="font-semibold text-slate-900">{tooltipValue}</span>
      </div>
    </div>
  );
}
