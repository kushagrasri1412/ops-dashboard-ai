const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return compactCurrencyFormatter.format(value);
}

export function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatShortDate(dateString) {
  const raw = String(dateString);
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  // Treat YYYY-MM-DD values as local dates to avoid timezone shifting (UTC midnight parsing).
  const date = isoMatch
    ? new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
    : new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
