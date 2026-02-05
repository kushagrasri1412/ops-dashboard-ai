import { NextResponse } from "next/server";
import { getRevenueSeries } from "../../../lib/data";
import { getCacheTtlMs, getDataMode } from "../../../lib/dataModes";
import { deriveRevenueSeriesFromActivity, getLiveActivityRows } from "../../../lib/liveActivity";
import { detectAnomalies } from "../../../lib/anomalies";
import { logApiRequest } from "../../../lib/logging";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  let statusCode = 200;
  let errorType = null;

  try {
    const mode = getDataMode();
    const ttlMs = getCacheTtlMs();

    let series = null;

    if (mode === "live") {
      const live = await getLiveActivityRows({ ttlMs, maxItems: 220 });
      series = live.rows
        ? deriveRevenueSeriesFromActivity(live.rows, {
            days: 30,
            endDate: live.fetchedAtMs ? new Date(live.fetchedAtMs) : new Date(),
          })
        : null;
    }

    if (!series) {
      series = getRevenueSeries({ days: 30 });
    }
    const anomalies = detectAnomalies(series, { window: 7, zThreshold: 2.2 });

    return NextResponse.json({ anomalies, data_mode: mode });
  } catch (error) {
    statusCode = 500;
    errorType = "server_error";
    return NextResponse.json(
      { error: "Failed to detect anomalies." },
      { status: statusCode }
    );
  } finally {
    logApiRequest({
      ts: Date.now(),
      endpoint: "/api/anomalies",
      status_code: statusCode,
      latency_ms: Date.now() - startedAt,
      error_type: errorType,
      model_used: null,
      prompt_version: null,
    });
  }
}
