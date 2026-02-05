function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function buildForecast(series, { days = 7 } = {}) {
  const data = Array.isArray(series) ? series : [];
  if (data.length === 0) return [];

  const revenues = data.map((point) => point.revenue);

  const last7 = revenues.slice(-7);
  const prev7 = revenues.slice(-14, -7);

  const lastAvg = avg(last7);
  const prevAvg = prev7.length ? avg(prev7) : lastAvg;

  const slope = (lastAvg - prevAvg) / 7;

  const lastDate = new Date(data[data.length - 1].date);

  const forecast = [];
  for (let i = 1; i <= days; i += 1) {
    const date = new Date(lastDate);
    date.setDate(lastDate.getDate() + i);

    const estimate = Math.max(0, Math.round(lastAvg + slope * i));

    forecast.push({
      date: toISODate(date),
      revenue: estimate,
    });
  }

  return forecast;
}
