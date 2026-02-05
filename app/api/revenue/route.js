import { NextResponse } from "next/server";
import { getKpis, getRevenueSeries } from "../../../lib/data";
import { getCacheTtlMs, getDataMode } from "../../../lib/dataModes";
import { deriveRevenueSeriesFromActivity, getLiveActivityRows } from "../../../lib/liveActivity";
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
    let dataSource = "demo";

    if (mode === "live") {
      const live = await getLiveActivityRows({ ttlMs, maxItems: 220 });
      const derived = live.rows
        ? deriveRevenueSeriesFromActivity(live.rows, {
            days: 30,
            endDate: live.fetchedAtMs ? new Date(live.fetchedAtMs) : new Date(),
          })
        : null;

      if (derived) {
        series = derived;
        dataSource = `activity_${live.source}`;
      } else {
        series = getRevenueSeries({ days: 30 });
        dataSource = "demo_fallback";
      }
    } else {
      // demo + mixed use deterministic demo revenue series.
      series = getRevenueSeries({ days: 30 });
      dataSource = mode === "mixed" ? "demo_revenue" : "demo";
    }

    const kpis = getKpis(series);

    return NextResponse.json({ series, kpis, data_mode: mode, data_source: dataSource });
  } catch (error) {
    statusCode = 500;
    errorType = "server_error";
    return NextResponse.json(
      { error: "Failed to generate revenue." },
      { status: statusCode }
    );
  } finally {
    logApiRequest({
      ts: Date.now(),
      endpoint: "/api/revenue",
      status_code: statusCode,
      latency_ms: Date.now() - startedAt,
      error_type: errorType,
      model_used: null,
      prompt_version: null,
    });
  }
}
