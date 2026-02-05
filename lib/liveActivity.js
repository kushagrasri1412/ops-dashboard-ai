import fs from "fs";
import path from "path";

const CACHE_FILENAME = "live_activity_cache.json";
const DEFAULT_URL = "https://jsonplaceholder.typicode.com/todos";

const memoryCache = globalThis.__liveActivityCache || {
  fetchedAtMs: 0,
  expiresAtMs: 0,
  rows: null,
};

// Preserve across hot reloads in dev.
globalThis.__liveActivityCache = memoryCache;

function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getCachePath() {
  const dir = ensureDataDir();
  return path.join(dir, CACHE_FILENAME);
}

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function safeWriteJson(filePath, payload) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    return true;
  } catch (error) {
    return false;
  }
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function seededNumber(seed) {
  // Simple deterministic pseudo-random [0,1) based on an integer seed.
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const STORES = [
  "Downtown",
  "River North",
  "West Loop",
  "South Market",
  "Lakeside",
  "Uptown",
  "Old Town",
  "Mission",
  "SoMa",
  "Capitol Hill",
];

const CHANNELS = ["DoorDash", "Uber Eats", "Google", "Website", "Catering"];

function mapTodoToActivity(todo, { anchorMs }) {
  const id = Number(todo?.id) || 0;
  const userId = Number(todo?.userId) || 0;

  const store = STORES[userId % STORES.length];
  const channel = CHANNELS[id % CHANNELS.length];

  const daysAgo = id % 14;
  const minutesOffset = (id * 37) % (24 * 60);

  const timestamp = new Date(anchorMs);
  timestamp.setDate(timestamp.getDate() - daysAgo);
  timestamp.setMinutes(timestamp.getMinutes() - minutesOffset);

  const completed = Boolean(todo?.completed);

  const rand = seededNumber(id * 13 + userId * 97);
  const revenueDelta = Math.round(((rand - 0.42) * 900) / 10) * 10;

  const title = typeof todo?.title === "string" ? todo.title.trim() : "";
  const action = title
    ? title.charAt(0).toUpperCase() + title.slice(1)
    : "External dataset event";

  return {
    id: `live_${id}`,
    timestamp: timestamp.toISOString(),
    store,
    channel,
    action,
    status: completed ? "Completed" : "Pending",
    revenue_delta: revenueDelta,
  };
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCachePayload(payload) {
  const fetchedAtMs = Number(payload?.fetchedAtMs) || 0;
  const rows = Array.isArray(payload?.rows) ? payload.rows : null;

  if (!fetchedAtMs || !rows) return null;

  return {
    fetchedAtMs,
    rows,
  };
}

export async function getLiveActivityRows({ ttlMs, maxItems = 200 } = {}) {
  const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 5 * 60 * 1000;
  const now = Date.now();

  if (memoryCache.rows && now < memoryCache.expiresAtMs) {
    return {
      rows: memoryCache.rows.slice(0, maxItems),
      source: "memory_cache",
      fetchedAtMs: memoryCache.fetchedAtMs,
    };
  }

  const cachePath = getCachePath();
  const diskPayload = normalizeCachePayload(safeReadJson(cachePath));

  const hasDisk = Boolean(diskPayload);
  const isDiskFresh = hasDisk ? now < diskPayload.fetchedAtMs + ttl : false;

  if (hasDisk && isDiskFresh) {
    memoryCache.fetchedAtMs = diskPayload.fetchedAtMs;
    memoryCache.expiresAtMs = diskPayload.fetchedAtMs + ttl;
    memoryCache.rows = diskPayload.rows;

    return {
      rows: diskPayload.rows.slice(0, maxItems),
      source: "disk_cache_fresh",
      fetchedAtMs: diskPayload.fetchedAtMs,
    };
  }

  // Attempt a refresh.
  const url = process.env.LIVE_ACTIVITY_URL || DEFAULT_URL;

  try {
    const fetchedAtMs = Date.now();
    const json = await fetchJsonWithTimeout(url, 7500);
    const todos = Array.isArray(json) ? json : [];

    const anchorMs = fetchedAtMs;
    const rows = todos
      .slice(0, maxItems)
      .map((todo) => mapTodoToActivity(todo, { anchorMs }));

    const payload = {
      fetchedAtMs,
      rows,
    };

    safeWriteJson(cachePath, payload);

    memoryCache.fetchedAtMs = fetchedAtMs;
    memoryCache.expiresAtMs = fetchedAtMs + ttl;
    memoryCache.rows = rows;

    return {
      rows,
      source: "fetched",
      fetchedAtMs,
    };
  } catch (error) {
    // Fall back to last-known-good cache (even if stale).
    if (hasDisk) {
      memoryCache.fetchedAtMs = diskPayload.fetchedAtMs;
      memoryCache.expiresAtMs = now + Math.min(ttl, 60_000);
      memoryCache.rows = diskPayload.rows;

      return {
        rows: diskPayload.rows.slice(0, maxItems),
        source: "disk_cache_stale",
        fetchedAtMs: diskPayload.fetchedAtMs,
      };
    }

    return {
      rows: null,
      source: "unavailable",
      fetchedAtMs: 0,
    };
  }
}

export function deriveRevenueSeriesFromActivity(
  activityRows,
  { days = 30, endDate = new Date() } = {}
) {
  const rows = Array.isArray(activityRows) ? activityRows : [];
  if (!rows.length) return null;

  const baseDate = new Date(endDate);
  const buckets = new Map();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() - i);
    const key = toISODate(date);

    // Start with a baseline to keep the series stable.
    buckets.set(key, {
      date: key,
      revenue: 10500,
      count: 0,
    });
  }

  rows.forEach((row) => {
    const ts = new Date(row.timestamp);
    const day = toISODate(ts);
    const bucket = buckets.get(day);
    if (!bucket) return;

    const delta = Number(row.revenue_delta);
    bucket.count += 1;
    bucket.revenue += Number.isFinite(delta) ? delta : 0;
  });

  const series = Array.from(buckets.values()).map((bucket) => {
    const lift = bucket.count * 55;
    const value = clamp(Math.round(bucket.revenue + lift), 6500, 26000);
    return {
      date: bucket.date,
      revenue: value,
    };
  });

  return series;
}
