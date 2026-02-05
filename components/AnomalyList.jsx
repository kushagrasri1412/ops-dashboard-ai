import { AlertTriangle } from "lucide-react";
import { formatCompactCurrency, formatShortDate } from "../lib/format";

export default function AnomalyList({ anomalies, loading, error }) {
  const items = Array.isArray(anomalies) ? anomalies : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Anomalies</p>
          <p className="text-sm text-slate-500">Rolling z-score alerts</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 text-slate-500">
          <AlertTriangle className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No anomalies detected.</p>
        ) : (
          <ul className="space-y-3">
            {items.slice(0, 6).map((item) => (
              <li
                key={item.date}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatShortDate(item.date)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Revenue {formatCompactCurrency(item.revenue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      z={Number(item.z).toFixed(2)}
                    </p>
                    <p
                      className={
                        "text-xs font-semibold " +
                        (item.direction === "down"
                          ? "text-rose-600"
                          : "text-emerald-600")
                      }
                    >
                      {item.direction === "down" ? "Drop" : "Spike"}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
