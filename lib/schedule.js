function stableHash(input) {
  const str = String(input ?? "");
  let hash = 2166136261;

  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return function next() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function parseISODate(value) {
  const raw = String(value ?? "");
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  return new Date(value);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function avg(values) {
  const nums = Array.isArray(values) ? values.filter(Number.isFinite) : [];
  if (!nums.length) return 0;
  return nums.reduce((acc, value) => acc + value, 0) / nums.length;
}

function getDayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function buildRiskTags({ dateKey, baselineAvg, expectedRevenue, anomalies }) {
  const tags = [];

  const anomalyList = Array.isArray(anomalies) ? anomalies.filter(Boolean) : [];
  const downAnomalies = anomalyList.filter((a) => a.direction === "down");

  const prevWeek = addDays(parseISODate(dateKey), -7);
  const prevWeekKey = toISODate(prevWeek);
  const hadPrevWeekDown = downAnomalies.some((a) => a.date === prevWeekKey);

  const hasDownToday = downAnomalies.some((a) => a.date === dateKey);

  if (hasDownToday) tags.push("Underperformance risk");
  if (!hasDownToday && hadPrevWeekDown) tags.push("Recurring underperformance risk");

  if (baselineAvg > 0 && expectedRevenue < baselineAvg * 0.9) {
    tags.push("Forecast drop risk");
  }

  if (baselineAvg > 0 && expectedRevenue > baselineAvg * 1.1) {
    tags.push("High demand risk");
  }

  return tags;
}

function computeRiskMeta({ dateKey, baselineAvg, expectedRevenue, anomalies }) {
  const anomalyList = Array.isArray(anomalies) ? anomalies.filter(Boolean) : [];
  const today = anomalyList.find((a) => a.date === dateKey) || null;

  let score = 0;
  if (today?.direction === "down") score += 2;
  if (today?.direction === "up") score += 1;

  if (baselineAvg > 0 && expectedRevenue < baselineAvg * 0.9) score += 1;
  if (baselineAvg > 0 && expectedRevenue > baselineAvg * 1.1) score += 1;

  const risk_level = score >= 2 ? "high" : score === 1 ? "medium" : "low";
  return { risk_level, risk_score: score, anomaly: today };
}

function suggestedActionForRisk(riskTags) {
  if (riskTags.includes("High demand risk")) {
    return "Add +1 line staff 11–2 and prep for higher order volume.";
  }
  if (
    riskTags.includes("Underperformance risk") ||
    riskTags.includes("Forecast drop risk") ||
    riskTags.includes("Recurring underperformance risk")
  ) {
    return "Check channel health, menu availability, and delivery partner status.";
  }
  return "Maintain staffing plan and monitor pickup/delivery SLA.";
}

export function buildSchedule({
  clients,
  revenueSeries,
  forecast,
  anomalies,
  anchorDate,
} = {}) {
  const clientList = Array.isArray(clients) ? clients.filter(Boolean) : [];

  const series = Array.isArray(revenueSeries) ? revenueSeries : [];
  const forecastSeries = Array.isArray(forecast) ? forecast : [];

  const lastSeriesDate = series.length ? parseISODate(series[series.length - 1].date) : null;
  const parsedAnchor = anchorDate ? parseISODate(anchorDate) : null;
  const baseDate =
    parsedAnchor && !Number.isNaN(parsedAnchor.getTime())
      ? parsedAnchor
      : lastSeriesDate && !Number.isNaN(lastSeriesDate.getTime())
        ? lastSeriesDate
        : new Date();

  const baselineAvg = avg(series.slice(-7).map((p) => p.revenue));
  const forecastMap = new Map(forecastSeries.map((p) => [p.date, p.revenue]));
  const seriesMap = new Map(series.map((p) => [p.date, p.revenue]));

  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(baseDate, i);
    const key = toISODate(date);

    const expectedRevenue =
      forecastMap.get(key) ??
      seriesMap.get(key) ??
      0;

    const riskMeta = computeRiskMeta({
      dateKey: key,
      baselineAvg,
      expectedRevenue,
      anomalies,
    });

    days.push({
      date: key,
      day_name: getDayName(date),
      expected_revenue: expectedRevenue,
      risk_tags: buildRiskTags({
        dateKey: key,
        baselineAvg,
        expectedRevenue,
        anomalies,
      }),
      risk_level: riskMeta.risk_level,
      risk_score: riskMeta.risk_score,
      items: [],
    });
  }

  const schedulesByClient = {};

  clientList.forEach((client) => {
    const name = typeof client === "string" ? client : client?.client || client?.name || "";
    const clientName = String(name || "").trim();
    if (!clientName) return;

    const seed = stableHash(`${clientName}:${toISODate(baseDate)}`);
    const rand = createSeededRandom(seed);

    const cateringDays = new Set();
    const first = Math.floor(rand() * 7);
    cateringDays.add(first);
    if (rand() > 0.65) cateringDays.add((first + 3) % 7);

    const scheduleDays = days.map((day, dayIndex) => {
      const dateObj = parseISODate(day.date);
      const weekday = dateObj.getDay();

      const includeMorning = weekday >= 1 && weekday <= 5;

      const shifts = [
        includeMorning
          ? {
              label: "Morning shift",
              start: "07:00",
              end: "11:00",
            }
          : null,
        {
          label: "Lunch shift",
          start: "11:00",
          end: "15:00",
        },
        {
          label: "Dinner shift",
          start: "15:00",
          end: "20:00",
        },
      ].filter(Boolean);

      const riskTags = day.risk_tags;
      const suggestedAction = suggestedActionForRisk(riskTags);

      const items = shifts.map((shift, idx) => ({
        id: `${clientName}-${day.date}-shift-${idx}`,
        type: "shift",
        store: clientName,
        date: day.date,
        start: shift.start,
        end: shift.end,
        title: shift.label,
        risk_level: day.risk_level,
        risk_tags: riskTags,
        suggested_action: suggestedAction,
      }));

      if (cateringDays.has(dayIndex)) {
        const cateringSize = rand() > 0.55 ? "Large" : "Standard";
        items.push({
          id: `${clientName}-${day.date}-catering`,
          type: "catering",
          store: clientName,
          date: day.date,
          start: "10:30",
          end: "12:30",
          title: `Catering (${cateringSize})`,
          risk_level: day.risk_level,
          risk_tags: riskTags,
          suggested_action:
            cateringSize === "Large"
              ? "Confirm headcount and prep list; stage packaging by 10am."
              : "Confirm order details and staging plan.",
        });
      }

      return {
        ...day,
        store: clientName,
        items,
      };
    });

    schedulesByClient[clientName] = scheduleDays;
  });

  return {
    anchor_date: toISODate(baseDate),
    days,
    schedules_by_client: schedulesByClient,
    baseline_revenue_avg_7d: baselineAvg,
  };
}
