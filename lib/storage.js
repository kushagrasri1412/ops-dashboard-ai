import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import('better-sqlite3').Database | null} */
let db = null;

function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDb() {
  if (db) return db;

  const Database = require("better-sqlite3");
  const dir = ensureDataDir();
  const filename = path.join(dir, "ops_logs.db");

  db = new Database(filename);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      error_type TEXT,
      model_used TEXT,
      prompt_version TEXT,
      schema_pass INTEGER
    );
    CREATE INDEX IF NOT EXISTS api_logs_ts_idx ON api_logs (ts);
    CREATE INDEX IF NOT EXISTS api_logs_endpoint_idx ON api_logs (endpoint);
  `);

  // Lightweight schema migration for older dev DBs.
  const existingColumns = new Set(
    db
      .prepare("PRAGMA table_info(api_logs)")
      .all()
      .map((row) => row.name)
  );

  if (!existingColumns.has("schema_pass")) {
    db.exec("ALTER TABLE api_logs ADD COLUMN schema_pass INTEGER");
  }

  return db;
}

export function insertApiLog(entry) {
  const database = getDb();

  const statement = database.prepare(
    `
      INSERT INTO api_logs (
        ts,
        endpoint,
        status_code,
        latency_ms,
        error_type,
        model_used,
        prompt_version,
        schema_pass
      ) VALUES (
        @ts,
        @endpoint,
        @status_code,
        @latency_ms,
        @error_type,
        @model_used,
        @prompt_version,
        @schema_pass
      )
    `
  );

  statement.run({
    ts: entry.ts,
    endpoint: entry.endpoint,
    status_code: entry.status_code,
    latency_ms: entry.latency_ms,
    error_type: entry.error_type || null,
    model_used: entry.model_used || null,
    prompt_version: entry.prompt_version || null,
    schema_pass:
      typeof entry.schema_pass === "boolean"
        ? entry.schema_pass
          ? 1
          : 0
        : null,
  });
}

export function getLogsSince(sinceTs) {
  const database = getDb();
  const statement = database.prepare(
    "SELECT ts, endpoint, status_code, latency_ms, error_type, model_used, prompt_version, schema_pass FROM api_logs WHERE ts >= ? ORDER BY ts DESC"
  );
  return statement.all(sinceTs);
}
