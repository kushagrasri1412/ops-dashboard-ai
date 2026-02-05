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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

export function getRevenueSeries({ days = 30, endDate = new Date() } = {}) {
  const seed = Number(toISODate(endDate).replace(/-/g, ""));
  const rand = createSeededRandom(seed);

  const series = [];
  const base = 12800 + rand() * 600;
  const trend = 22 + rand() * 8;

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - i);

    const dayOfWeek = date.getDay();
    const weekendLift = dayOfWeek === 5 || dayOfWeek === 6 ? 1.14 : 1.0;
    const mondayDip = dayOfWeek === 1 ? 0.92 : 1.0;

    const seasonal = weekendLift * mondayDip;
    const noise = (rand() - 0.5) * 1200;

    let revenue = (base + trend * (days - i)) * seasonal + noise;

    // Inject occasional anomalies for demo realism.
    if (i === 9) revenue *= 0.82;
    if (i === 17) revenue *= 1.23;

    revenue = clamp(Math.round(revenue), 6800, 24000);

    series.push({
      date: toISODate(date),
      revenue,
    });
  }

  return series;
}

export function getKpis(revenueSeries) {
  const revenueValues = (revenueSeries || []).map((item) => item.revenue);
  const totalRevenue = sum(revenueValues);

  return {
    total_revenue_30d: totalRevenue,
    active_stores: 42,
    upcoming_catering_orders: 14,
    on_time_pickup_rate: 0.93,
    deltas: {
      total_revenue_30d: 4.2,
      active_stores: 0.0,
      upcoming_catering_orders: -6.4,
      on_time_pickup_rate: 1.1,
    },
  };
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

const ACTION_TEMPLATES = [
  "Menu sync completed",
  "Promo pushed to {channel}",
  "Photo audit completed",
  "Store hours updated",
  "Refund workflow reviewed",
  "Delivery radius adjusted",
  "Catering request confirmed",
  "Outage alert acknowledged",
  "Payment provider reconciliation",
  "Customer review response sent",
];

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

export function getActivityRows({ count = 84, endDate = new Date() } = {}) {
  const seed = Number(toISODate(endDate).replace(/-/g, "")) + 99;
  const rand = createSeededRandom(seed);

  const rows = [];

  for (let i = 0; i < count; i += 1) {
    const timestamp = new Date(endDate);
    timestamp.setMinutes(endDate.getMinutes() - i * (12 + Math.floor(rand() * 14)));

    const channel = pick(rand, CHANNELS);
    const store = pick(rand, STORES);
    const rawAction = pick(rand, ACTION_TEMPLATES);

    const action = rawAction.replace("{channel}", channel);
    const status = rand() > 0.22 ? "Completed" : "Pending";

    const revenue_delta = Math.round(((rand() - 0.35) * 850) / 10) * 10;

    rows.push({
      id: `act_${toISODate(timestamp)}_${i}`,
      timestamp: timestamp.toISOString(),
      store,
      channel,
      action,
      status,
      revenue_delta,
    });
  }

  return rows;
}
