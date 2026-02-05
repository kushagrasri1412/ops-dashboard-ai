export function getDataMode() {
  const raw = String(process.env.DATA_MODE || "demo").toLowerCase().trim();
  if (raw === "live" || raw === "mixed" || raw === "demo") return raw;
  return "demo";
}

export function getCacheTtlMs() {
  const rawSeconds = process.env.DATA_CACHE_TTL_SECONDS;
  const parsed = Number(rawSeconds);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed * 1000);
  }

  return 5 * 60 * 1000;
}
