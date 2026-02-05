import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

import { getActivityRows, getRevenueSeries } from "../../../lib/data";
import { getCacheTtlMs, getDataMode } from "../../../lib/dataModes";
import { deriveRevenueSeriesFromActivity, getLiveActivityRows } from "../../../lib/liveActivity";
import { buildForecast } from "../../../lib/forecast";
import { detectAnomalies } from "../../../lib/anomalies";
import { COPILOT_JSON_SCHEMA, validateCopilotResponse } from "../../../lib/schema";
import { checkRateLimit } from "../../../lib/rateLimit";
import { logApiRequest } from "../../../lib/logging";

export const runtime = "nodejs";

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function isComplexQuery(query) {
  const q = query.toLowerCase();
  return (
    q.includes("why") ||
    q.includes("root cause") ||
    q.includes("cause") ||
    q.includes("action plan") ||
    q.includes("what should") ||
    q.includes("recommend") ||
    q.includes("anomal") ||
    query.length > 120
  );
}

function loadPrompt(promptVersion) {
  const filename =
    promptVersion === "v2" ? "copilot_v2.md" : "copilot_v1.md";
  const promptPath = path.join(process.cwd(), "prompts", filename);
  return fs.readFileSync(promptPath, "utf8");
}

function normalizeExtraDataPoints(rawPoints) {
  const points = Array.isArray(rawPoints) ? rawPoints : [];

  return points
    .filter((point) => typeof point === "string")
    .map((point) => point.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((point) => (point.length > 240 ? `${point.slice(0, 237)}…` : point));
}

function buildDataContext({
  series,
  forecast,
  anomalies,
  promptVersion,
  extraDataPoints,
}) {
  const last = series[series.length - 1];
  const last7 = series.slice(-7).map((p) => p.revenue);
  const prev7 = series.slice(-14, -7).map((p) => p.revenue);

  const sum = (values) => values.reduce((acc, value) => acc + value, 0);
  const pct = (a, b) => (b ? (a - b) / b : 0);

  const last7Sum = sum(last7);
  const prev7Sum = sum(prev7);
  const weekChange = pct(last7Sum, prev7Sum);

  const topAnomaly = anomalies[0];

  const dataPoints = [
    `Latest date: ${last.date} revenue ${last.revenue}`,
    `Last 7 days total revenue: ${last7Sum}`,
    `Previous 7 days total revenue: ${prev7Sum}`,
    `Week-over-week change: ${(weekChange * 100).toFixed(1)}%`,
  ];

  if (topAnomaly) {
    dataPoints.push(
      `Top anomaly: ${topAnomaly.date} revenue ${topAnomaly.revenue} (z=${topAnomaly.z.toFixed(
        2
      )}, baseline ${topAnomaly.baseline_avg})`
    );
  }

  anomalies.slice(0, 4).forEach((anomaly, index) => {
    dataPoints.push(
      `Anomaly ${index + 1}: ${anomaly.date} revenue ${anomaly.revenue} (z=${anomaly.z.toFixed(
        2
      )})`
    );
  });

  const forecastSummary = forecast
    .slice(0, 7)
    .map((point) => `${point.date}: ${point.revenue}`)
    .join(", ");
  dataPoints.push(`7-day forecast: ${forecastSummary}`);

  // Include prompt version as a reference string so it can be echoed in used_data_points.
  dataPoints.push(`prompt_version: ${promptVersion}`);

  const prefix = normalizeExtraDataPoints(extraDataPoints);

  return {
    dataPoints: prefix.length ? [...prefix, ...dataPoints] : dataPoints,
    summary: {
      lastDate: last.date,
      lastRevenue: last.revenue,
      weekOverWeek: weekChange,
      topAnomaly: topAnomaly
        ? {
            date: topAnomaly.date,
            revenue: topAnomaly.revenue,
            z: topAnomaly.z,
            direction: topAnomaly.direction,
          }
        : null,
    },
  };
}

function pickUsedDataPoints(dataPoints, maxItems) {
  const points = Array.isArray(dataPoints) ? dataPoints.filter(Boolean) : [];
  const selected = points.slice(0, Math.min(points.length, maxItems));

  // Ensure the prompt version marker is present (it is included in AVAILABLE_DATA_POINTS).
  const promptLine = points.find((point) =>
    String(point).startsWith("prompt_version:")
  );
  if (promptLine && !selected.includes(promptLine) && selected.length < maxItems) {
    selected.push(promptLine);
  }

  return selected.length ? selected : ["prompt_version: v1"];
}

function clamp(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value));
}

function computeActivityStats(activityRows) {
  const rows = Array.isArray(activityRows) ? activityRows : [];
  const nowMs = Date.now();
  const cutoffMs = nowMs - 30 * 24 * 60 * 60 * 1000;

  const recent = rows.filter((row) => {
    const ts = new Date(row.timestamp).getTime();
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  const total = recent.length;
  const completed = recent.filter(
    (row) => String(row?.status || "").toLowerCase() === "completed"
  ).length;
  const pending = total - completed;

  const completionRate = total ? completed / total : null;

  return { total_30d: total, completed_30d: completed, pending_30d: pending, completionRate };
}

async function getActivityRowsForMode(mode, ttlMs) {
  if (mode === "demo") {
    return { rows: getActivityRows({ count: 120 }), source: "demo" };
  }

  const live = await getLiveActivityRows({ ttlMs, maxItems: 220 });
  if (live.rows) return { rows: live.rows, source: live.source };

  return { rows: getActivityRows({ count: 120 }), source: "demo_fallback" };
}

function buildDeterministicCopilotResponse({
  context,
  anomalies,
  activityStats,
  openaiEnabled,
  promptVersion,
  fallbackReason,
}) {
  const weekChange = context?.summary?.weekOverWeek;
  const weekChangePct =
    typeof weekChange === "number" && Number.isFinite(weekChange) ? weekChange : 0;

  const anomalyList = Array.isArray(anomalies) ? anomalies : [];
  const totalAnomalies = anomalyList.length;
  const downAnomalies = anomalyList.filter((a) => a && a.direction === "down").length;
  const upAnomalies = totalAnomalies - downAnomalies;

  const topAnomaly = anomalyList[0] || null;

  const pendingRatio =
    activityStats?.total_30d ? activityStats.pending_30d / activityStats.total_30d : null;

  const completionRate =
    typeof activityStats?.completionRate === "number" && Number.isFinite(activityStats.completionRate)
      ? activityStats.completionRate
      : null;

  const confidenceBase = openaiEnabled ? 0.42 : 0.34;
  const confidence = clamp(
    confidenceBase +
      (totalAnomalies ? 0.06 : 0) +
      (activityStats?.total_30d ? 0.05 : 0) +
      (pendingRatio != null && pendingRatio > 0.25 ? 0.04 : 0),
    0.25,
    0.65
  );

  const summaryParts = [];
  if (!openaiEnabled) {
    summaryParts.push("Demo Copilot mode (no OpenAI key).");
  }
  summaryParts.push(
    `Week-over-week revenue is ${(weekChangePct * 100).toFixed(1)}%.`
  );
  summaryParts.push(
    `Detected ${totalAnomalies} anomaly${totalAnomalies === 1 ? "" : "ies"} (${downAnomalies} down, ${upAnomalies} up).`
  );
  if (activityStats?.total_30d) {
    summaryParts.push(
      `Activity shows ${(completionRate != null ? (completionRate * 100).toFixed(0) : "—")}% completed and ${activityStats.pending_30d} pending items over the last 30 days.`
    );
  } else {
    summaryParts.push("Activity status ratios are unavailable for this run.");
  }

  const summary = summaryParts.slice(0, 3).join(" ");

  const drivers = [
    `Week-over-week change: ${(weekChangePct * 100).toFixed(1)}% (last 7 days vs previous 7).`,
    `Anomalies flagged: ${totalAnomalies} total (down: ${downAnomalies}, up: ${upAnomalies}).`,
  ];

  if (topAnomaly) {
    drivers.push(
      `Top anomaly: ${topAnomaly.date} z=${typeof topAnomaly.z === "number" ? topAnomaly.z.toFixed(2) : "—"} (${topAnomaly.direction}).`
    );
  }

  if (activityStats?.total_30d) {
    drivers.push(
      `Activity completion (30d): ${activityStats.completed_30d} completed / ${activityStats.pending_30d} pending.`
    );
  }

  if (pendingRatio != null && pendingRatio > 0.25) {
    drivers.push("Pending activity volume is elevated, increasing operational risk.");
  }

  const keyDrivers = drivers.filter(Boolean);
  if (keyDrivers.length < 3) {
    keyDrivers.push("Forecast and anomaly signals were used to generate recommendations.");
  }
  if (keyDrivers.length < 3) {
    keyDrivers.push("Activity status ratios were incorporated when available.");
  }

  const key_drivers = keyDrivers.slice(0, 6);

  const actions = [];

  if (weekChangePct < -0.03 || downAnomalies > 0) {
    actions.push({
      action: "Audit channel health and menu availability on key partners",
      reason:
        "Negative anomalies and a revenue dip often correlate with outages, hours/menu drift, or fulfillment constraints on delivery platforms.",
      priority: "high",
    });
  }

  if (pendingRatio != null && pendingRatio > 0.25) {
    actions.push({
      action: "Clear the highest-impact pending operational items",
      reason:
        "A high pending ratio suggests backlog in refunds, hours updates, promos, or partner tasks that can suppress demand and SLA performance.",
      priority: "high",
    });
  }

  actions.push({
    action: "Review anomaly dates against promos, staffing, and partner incidents",
    reason:
      "Use anomaly timestamps to triage what changed and validate whether the underlying driver is known and repeatable.",
    priority: "medium",
  });

  actions.push({
    action: "Set a daily check for order flow and cancellation rate",
    reason:
      "A lightweight daily check catches revenue-impacting issues (pricing, outages, SLA drift) before they become multi-day dips.",
    priority: "medium",
  });

  if (actions.length < 3) {
    actions.push({
      action: "Confirm staffing and catering capacity aligns with demand signals",
      reason:
        "Even without a staffing system, aligning shifts and prep plans with forecast direction reduces SLA misses and missed revenue.",
      priority: "medium",
    });
  }

  const recommended_actions = actions.slice(0, 6);

  const activityPoint =
    activityStats?.total_30d != null
      ? `Activity (30d): total ${activityStats.total_30d}, completed ${activityStats.completed_30d}, pending ${activityStats.pending_30d}, completion_rate ${(completionRate != null ? (completionRate * 100).toFixed(1) : "—")}%`
      : null;

  const used_data_points = pickUsedDataPoints(
    [...(activityPoint ? [activityPoint] : []), ...(context?.dataPoints || [])],
    12
  );

  return {
    summary,
    key_drivers,
    recommended_actions,
    confidence,
    used_data_points,
    meta: {
      mode: openaiEnabled ? "live" : "demo",
      fallback_reason: fallbackReason || "none",
      prompt_version: promptVersion,
    },
  };
}

async function getRevenueSeriesForMode(mode, ttlMs) {
  if (mode !== "live") {
    // demo + mixed use deterministic demo revenue.
    return {
      series: getRevenueSeries({ days: 30 }),
      source: mode === "mixed" ? "demo_revenue" : "demo",
    };
  }

  const live = await getLiveActivityRows({ ttlMs, maxItems: 220 });
  const derived = live.rows
    ? deriveRevenueSeriesFromActivity(live.rows, {
        days: 30,
        endDate: live.fetchedAtMs ? new Date(live.fetchedAtMs) : new Date(),
      })
    : null;

  if (derived) {
    return { series: derived, source: `activity_${live.source}` };
  }

  return { series: getRevenueSeries({ days: 30 }), source: "demo_fallback" };
}

async function callCopilotModel({
  apiKey,
  model,
  systemPrompt,
  query,
  dataPoints,
  maxOutputTokens,
  extraInstruction,
}) {
  const imported = await import("openai");
  const OpenAI = imported?.default;
  if (!OpenAI) {
    throw new Error("OpenAI SDK import failed.");
  }

  const client = new OpenAI({ apiKey });

  const composedSystem =
    systemPrompt +
    (extraInstruction ? `\n\nSTRICT MODE:\n${extraInstruction}` : "");

  const input = [
    {
      role: "system",
      content: composedSystem,
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `USER_QUESTION:\n${query}\n\nAVAILABLE_DATA_POINTS (cite these verbatim in used_data_points):\n` +
            dataPoints.map((point) => `- ${point}`).join("\n"),
        },
      ],
    },
  ];

  const response = await client.responses.create({
    model,
    input,
    max_output_tokens: maxOutputTokens,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ops_copilot_response",
        schema: COPILOT_JSON_SCHEMA,
        strict: true,
      },
    },
  });

  // Try multiple response shapes (SDK versions differ).
  const maybeParsed =
    response?.output?.[0]?.content?.[0]?.parsed ||
    response?.output?.[0]?.content?.[0]?.json;
  if (maybeParsed) return maybeParsed;

  const outputText = response?.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return JSON.parse(outputText);
  }

  const text = response?.output?.[0]?.content?.[0]?.text;
  if (typeof text === "string" && text.trim()) {
    return JSON.parse(text);
  }

  throw new Error("Unable to parse copilot response.");
}

export async function POST(request) {
  const startedAt = Date.now();
  let statusCode = 200;
  let errorType = null;
  let modelUsed = null;
  let promptVersion = "v1";
  let schemaPass = null;
  let openaiMode = "demo";
  let fallbackReason = "none";

  try {
    const configuredKey = process.env.COPILOT_API_KEY || "dev_local_key";
    const providedKey = request.headers.get("x-api-key") || "";

    if (providedKey !== configuredKey) {
      statusCode = 401;
      errorType = "unauthorized";
      return NextResponse.json(
        { error: "Invalid x-api-key." },
        { status: statusCode }
      );
    }

    const ip = getClientIp(request);
    const rate = checkRateLimit({
      key: `copilot:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      statusCode = 429;
      errorType = "rate_limited";
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again soon." },
        {
          status: statusCode,
          headers: {
            "x-ratelimit-reset": String(rate.resetAt),
          },
        }
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      statusCode = 400;
      errorType = "invalid_json";
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: statusCode }
      );
    }

    const query = typeof payload?.query === "string" ? payload.query.trim() : "";
    promptVersion = payload?.prompt_version === "v2" ? "v2" : "v1";
    const extraDataPoints = payload?.extra_data_points;

    if (!query) {
      statusCode = 400;
      errorType = "empty_query";
      return NextResponse.json(
        { error: "Query is required." },
        { status: statusCode }
      );
    }

    if (query.length > 600) {
      statusCode = 400;
      errorType = "query_too_long";
      return NextResponse.json(
        { error: "Query too long (max 600 characters)." },
        { status: statusCode }
      );
    }

    const mode = getDataMode();
    const ttlMs = getCacheTtlMs();

    const revenue = await getRevenueSeriesForMode(mode, ttlMs);
    const series = revenue.series;
    const forecast = buildForecast(series, { days: 7 });
    const anomalies = detectAnomalies(series, { window: 7, zThreshold: 2.2 });

    const activity = await getActivityRowsForMode(mode, ttlMs);
    const activityStats = computeActivityStats(activity.rows);

    const context = buildDataContext({
      series,
      forecast,
      anomalies,
      promptVersion,
      extraDataPoints,
    });

    const openaiEnabled = Boolean(process.env.OPENAI_API_KEY);
    if (!openaiEnabled) {
      statusCode = 200;
      errorType = "demo_mode";
      openaiMode = "demo";
      fallbackReason = "demo_mode";
      schemaPass = true;

      const demoResponse = buildDeterministicCopilotResponse({
        context,
        anomalies,
        activityStats,
        openaiEnabled,
        promptVersion,
        fallbackReason,
      });

      return NextResponse.json(
        demoResponse,
        {
          status: statusCode,
          headers: {
            "x-openai-mode": openaiMode,
            "x-copilot-fallback": fallbackReason,
            "x-prompt-version": promptVersion,
          },
        }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const cheapModel = process.env.COPILOT_MODEL_CHEAP || "gpt-4o-mini";
    const qualityModel = process.env.COPILOT_MODEL_QUALITY || "gpt-4o";

    openaiMode = "live";
    modelUsed = isComplexQuery(query) ? qualityModel : cheapModel;

    const maxOutputTokens = 700;

    let result;
    let validated;

    try {
      const promptText = loadPrompt(promptVersion);
      result = await callCopilotModel({
        apiKey,
        model: modelUsed,
        systemPrompt: promptText,
        query,
        dataPoints: context.dataPoints,
        maxOutputTokens,
      });

      validated = validateCopilotResponse(result);

      if (!validated.ok) {
        // Retry once with stricter instruction.
        result = await callCopilotModel({
          apiKey,
          model: modelUsed,
          systemPrompt: promptText,
          query,
          dataPoints: context.dataPoints,
          maxOutputTokens,
          extraInstruction:
            "Return ONLY valid JSON that matches the schema exactly. Do not add keys. Ensure key_drivers and recommended_actions have the required item counts.",
        });

        validated = validateCopilotResponse(result);
      }
    } catch (error) {
      // Keep the UX reliable: return a schema-valid fallback instead of a hard failure.
      statusCode = 200;
      errorType = "openai_error";
      fallbackReason = "openai_error";
      schemaPass = true;
      return NextResponse.json(
        buildDeterministicCopilotResponse({
          context,
          anomalies,
          activityStats,
          openaiEnabled,
          promptVersion,
          fallbackReason,
        }),
        {
          status: statusCode,
          headers: {
            "x-openai-mode": openaiMode,
            "x-copilot-fallback": fallbackReason,
            "x-model-used": modelUsed || "",
            "x-prompt-version": promptVersion,
          },
        }
      );
    }

    if (!validated?.ok) {
      statusCode = 200;
      errorType = "schema_invalid";
      fallbackReason = "schema_invalid";
      schemaPass = false;
      return NextResponse.json(
        buildDeterministicCopilotResponse({
          context,
          anomalies,
          activityStats,
          openaiEnabled,
          promptVersion,
          fallbackReason,
        }),
        {
          status: statusCode,
          headers: {
            "x-openai-mode": openaiMode,
            "x-copilot-fallback": fallbackReason,
            "x-model-used": modelUsed || "",
            "x-prompt-version": promptVersion,
          },
        }
      );
    }

    schemaPass = true;
    fallbackReason = "none";
    return NextResponse.json(
      {
        ...validated.data,
        meta: {
          mode: "live",
          fallback_reason: "none",
          prompt_version: promptVersion,
        },
      },
      {
      headers: {
        "x-openai-mode": openaiMode,
        "x-copilot-fallback": fallbackReason,
        "x-model-used": modelUsed,
        "x-prompt-version": promptVersion,
      },
      }
    );
  } catch (error) {
    statusCode = 500;
    errorType = "server_error";
    return NextResponse.json(
      { error: "Copilot request failed." },
      { status: statusCode }
    );
  } finally {
    logApiRequest({
      ts: Date.now(),
      endpoint: "/api/copilot",
      status_code: statusCode,
      latency_ms: Date.now() - startedAt,
      error_type: errorType,
      model_used: modelUsed,
      prompt_version: promptVersion,
      schema_pass: schemaPass,
    });
  }
}
