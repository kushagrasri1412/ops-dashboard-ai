import { NextResponse } from "next/server";
import { getLogsSince } from "../../../lib/storage";
import { logApiRequest } from "../../../lib/logging";
import { getCacheTtlMs, getDataMode } from "../../../lib/dataModes";

export const runtime = "nodejs";

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx];
}

export async function GET() {
  const startedAt = Date.now();
  let statusCode = 200;
  let errorType = null;

  try {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const logs = getLogsSince(since);

    const latencies = logs.map((row) => row.latency_ms).filter(Number.isFinite);
    const total = logs.length;
    const errors = logs.filter((row) => row.status_code >= 400).length;
    const copilotLogs = logs.filter((row) => row.endpoint === "/api/copilot");
    const copilotRequests = copilotLogs.length;
    const schemaPassCount = copilotLogs.filter((row) => row.schema_pass === 1).length;

    const p95Latency = total ? percentile(latencies, 0.95) : 0;
    const errorRate = total ? errors / total : 0;
    const schemaCompliance = copilotRequests
      ? schemaPassCount / copilotRequests
      : null;

    const ttlMs = getCacheTtlMs();
    const liveUrl = process.env.LIVE_ACTIVITY_URL || "";

    return NextResponse.json({
      p95_latency_ms_24h: p95Latency,
      error_rate_24h: errorRate,
      copilot_requests_24h: copilotRequests,
      copilot_schema_pass_rate_24h: schemaCompliance,
      // Back-compat for earlier UI versions.
      ai_requests_24h: copilotRequests,
      total_requests_24h: total,
      data_mode: getDataMode(),
      data_cache_ttl_seconds: Math.round(ttlMs / 1000),
      live_activity_url: liveUrl,
      openai_configured: Boolean(process.env.OPENAI_API_KEY),
    });
  } catch (error) {
    statusCode = 500;
    errorType = "server_error";
    return NextResponse.json(
      { error: "Failed to compute metrics." },
      { status: statusCode }
    );
  } finally {
    logApiRequest({
      ts: Date.now(),
      endpoint: "/api/metrics",
      status_code: statusCode,
      latency_ms: Date.now() - startedAt,
      error_type: errorType,
      model_used: null,
      prompt_version: null,
    });
  }
}
