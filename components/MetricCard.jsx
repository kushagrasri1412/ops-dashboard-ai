"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import RevenueSparkArea from "./d3/RevenueSparkArea";

export default function MetricCard({
  label,
  value,
  helper,
  delta,
  loading,
  sparklineData,
  sparklineLabel,
  sparklineAriaLabel,
}) {
  const isPositive = typeof delta === "number" && delta >= 0;
  const showDelta = typeof delta === "number";
  const showSparkline =
    Array.isArray(sparklineData) && sparklineData.filter(Number.isFinite).length >= 2;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {label}
          </p>
          {loading ? (
            <div className="mt-3 space-y-2">
              <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {value}
              </p>
              {helper ? (
                <p className="mt-1 text-sm text-slate-500">{helper}</p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          {showDelta && !loading ? (
            <div
              className={
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold " +
                (isPositive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700")
              }
            >
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </div>
          ) : null}

          {loading && showSparkline ? (
            <div className="h-11 w-28 animate-pulse rounded-xl bg-slate-100" />
          ) : showSparkline && !loading ? (
            <RevenueSparkArea
              data={sparklineData}
              ariaLabel={sparklineAriaLabel || sparklineLabel || label}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
