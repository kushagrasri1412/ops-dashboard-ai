function stableHash(input) {
  const str = String(input ?? "");
  let hash = 2166136261;

  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

const FALLBACK_STORE_COUNT = 10;

export function deriveStoreNameFromId(id) {
  const hash = stableHash(id);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const idx = hash % FALLBACK_STORE_COUNT;
  const suffix = alphabet[idx % alphabet.length];
  return `Store ${suffix}`;
}

export function getClientNameFromActivity(row) {
  const store =
    typeof row?.store === "string" ? row.store.trim() : "";
  if (store) return store;

  const client =
    typeof row?.client === "string" ? row.client.trim() : "";
  if (client) return client;

  return deriveStoreNameFromId(row?.id);
}

function parseTimestamp(value) {
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isWithinDays(timestampMs, nowMs, days) {
  if (!timestampMs) return false;
  return nowMs - timestampMs <= days * 24 * 60 * 60 * 1000;
}

function pickPrimaryChannel(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const channel = typeof row?.channel === "string" ? row.channel.trim() : "";
    if (!channel) return;
    counts.set(channel, (counts.get(channel) || 0) + 1);
  });

  let best = "";
  let bestCount = 0;
  counts.forEach((count, channel) => {
    if (count > bestCount) {
      best = channel;
      bestCount = count;
    }
  });

  return best || "Website";
}

export function summarizeClientsFromActivityRows(activityRows, { now = new Date() } = {}) {
  const rows = Array.isArray(activityRows) ? activityRows : [];
  const nowMs = now.getTime();

  const days30Ms = 30 * 24 * 60 * 60 * 1000;
  const cutoff30d = nowMs - days30Ms;

  const byClient = new Map();

  rows.forEach((row) => {
    const clientName = getClientNameFromActivity(row);
    const tsMs = parseTimestamp(row?.timestamp);

    const entry = byClient.get(clientName) || {
      client: clientName,
      rows: [],
      last_activity_ms: 0,
    };

    entry.rows.push(row);
    if (tsMs > entry.last_activity_ms) entry.last_activity_ms = tsMs;

    byClient.set(clientName, entry);
  });

  const clients = [];
  const activitiesByClient = {};

  byClient.forEach((entry, clientName) => {
    const sortedRows = entry.rows
      .slice()
      .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp));

    activitiesByClient[clientName] = sortedRows;

    const rows30d = sortedRows.filter((row) => parseTimestamp(row.timestamp) >= cutoff30d);

    const completed30d = rows30d.filter(
      (row) => String(row?.status || "").toLowerCase() === "completed"
    ).length;
    const pending30d = rows30d.length - completed30d;

    clients.push({
      id: clientName,
      client: clientName,
      channel: pickPrimaryChannel(rows30d.length ? rows30d : sortedRows),
      last_activity_at: entry.last_activity_ms
        ? new Date(entry.last_activity_ms).toISOString()
        : "",
      last_activity_ms: entry.last_activity_ms,
      total_events_30d: rows30d.length,
      completed_count_30d: completed30d,
      pending_count_30d: pending30d,
      active_status: isWithinDays(entry.last_activity_ms, nowMs, 7)
        ? "Active"
        : "Inactive",
    });
  });

  return { clients, activitiesByClient };
}

