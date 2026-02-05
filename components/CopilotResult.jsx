"use client";

import { ShieldAlert, Info } from "lucide-react";
import { useEffect, useState } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function PriorityPill({ priority }) {
  const value = String(priority || "medium").toLowerCase();
  const variant =
    value === "high"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : value === "low"
        ? "bg-slate-100 text-slate-700 border-slate-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold " +
        variant
      }
    >
      {value}
    </span>
  );
}

function ConfidenceMeter({ confidence }) {
  const numeric =
    typeof confidence === "number" && Number.isFinite(confidence)
      ? clamp(confidence, 0, 1)
      : 0;

  const pct = Math.round(numeric * 100);

  const color =
    numeric >= 0.8
      ? "bg-emerald-500"
      : numeric >= 0.55
        ? "bg-blue-600"
        : "bg-amber-500";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
        <span className="uppercase tracking-[0.18em]">Confidence</span>
        <span className="text-slate-900">{pct}%</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Higher confidence means more supporting data points.
      </p>
    </div>
  );
}

function NoticeBanner({ message, variant }) {
  if (!message) return null;

  const isWarning = variant === "warning";

  return (
    <div
      className={
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm " +
        (isWarning
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-blue-200 bg-blue-50 text-blue-800")
      }
    >
      {isWarning ? (
        <ShieldAlert className="mt-0.5 h-4 w-4" />
      ) : (
        <Info className="mt-0.5 h-4 w-4" />
      )}
      <span>{message}</span>
    </div>
  );
}

export default function CopilotResult({ result, notice, noticeVariant }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!result) return;
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [result]);

  if (!result) return null;

  return (
    <div
      className={
        "mt-5 space-y-5 transition-all duration-200 ease-out " +
        (entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1")
      }
    >
      <NoticeBanner message={notice} variant={noticeVariant} />

      <div className="rounded-2xl bg-slate-50 px-5 py-4">
        <p className="text-sm font-semibold text-slate-900">Summary</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {result.summary}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Key Drivers</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            {(result.key_drivers || []).map((driver, idx) => (
              <li key={`${driver}-${idx}`}>{driver}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Used Data</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(result.used_data_points || []).map((point, idx) => (
              <span
                key={`${point}-${idx}`}
                className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                title={point}
              >
                <span className="truncate">{point}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,0.45fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">
              Recommended Actions
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {(result.recommended_actions || []).map((action, idx) => (
              <div
                key={`${action.action}-${idx}`}
                className="rounded-2xl bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {action.action}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {action.reason}
                    </p>
                  </div>
                  <PriorityPill priority={action.priority} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <ConfidenceMeter confidence={Number(result.confidence)} />
      </div>
    </div>
  );
}
