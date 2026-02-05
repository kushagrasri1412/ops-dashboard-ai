export default function StatusBadge({ status }) {
  const normalized = String(status || "").toLowerCase();
  const variant = (() => {
    if (normalized === "completed" || normalized === "success") {
      return {
        label: "Completed",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    if (normalized === "pending") {
      return {
        label: "Pending",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    }

    if (normalized === "active") {
      return {
        label: "Active",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }

    if (normalized === "inactive") {
      return {
        label: "Inactive",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
    }

    return {
      label: status ? String(status) : "—",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  })();

  return (
    <span
      className={
        "inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold " +
        variant.className
      }
    >
      {variant.label}
    </span>
  );
}
