import { NextResponse } from "next/server";
import { getActivityRows } from "../../../lib/data";
import { getCacheTtlMs, getDataMode } from "../../../lib/dataModes";
import { getLiveActivityRows } from "../../../lib/liveActivity";
import { sortByKey } from "../../../lib/sort";
import { logApiRequest } from "../../../lib/logging";

export const runtime = "nodejs";

const SORT_KEYS = new Set([
  "timestamp",
  "store",
  "channel",
  "status",
  "revenue_delta",
]);

export async function GET(request) {
  const startedAt = Date.now();
  let statusCode = 200;
  let errorType = null;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

    const safePageSize = [10, 20, 50].includes(pageSize) ? pageSize : 10;

    const sortBy = searchParams.get("sortBy") || "timestamp";
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    if (!SORT_KEYS.has(sortBy)) {
      statusCode = 400;
      errorType = "invalid_sort";
      return NextResponse.json(
        { error: "Invalid sortBy parameter." },
        { status: statusCode }
      );
    }

    const mode = getDataMode();
    const ttlMs = getCacheTtlMs();

    let rows = null;
    let dataSource = "demo";

    if (mode === "demo") {
      rows = getActivityRows({ count: 84 });
    } else {
      const live = await getLiveActivityRows({ ttlMs, maxItems: 220 });
      if (live.rows) {
        rows = live.rows;
        dataSource = live.source;
      } else {
        rows = getActivityRows({ count: 84 });
        dataSource = "demo_fallback";
      }
    }

    const sorted = sortByKey(rows, sortBy, sortDir);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const safePage = Math.min(page, totalPages);

    const start = (safePage - 1) * safePageSize;
    const sliced = sorted.slice(start, start + safePageSize);

    return NextResponse.json({
      rows: sliced,
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
      data_mode: mode,
      data_source: dataSource,
    });
  } catch (error) {
    statusCode = 500;
    errorType = "server_error";
    return NextResponse.json(
      { error: "Failed to generate activity." },
      { status: statusCode }
    );
  } finally {
    logApiRequest({
      ts: Date.now(),
      endpoint: "/api/activity",
      status_code: statusCode,
      latency_ms: Date.now() - startedAt,
      error_type: errorType,
      model_used: null,
      prompt_version: null,
    });
  }
}
