function parseISODate(value) {
  const raw = String(value ?? "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

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

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function formatCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return compactCurrencyFormatter.format(value);
}

export function formatShortDate(value) {
  const date = value instanceof Date ? value : parseISODate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return shortDateFormatter.format(date);
}

export { parseISODate };

