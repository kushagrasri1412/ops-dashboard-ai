function mean(values) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function std(values, avg) {
  const variance =
    values.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

export function detectAnomalies(series, { window = 7, zThreshold = 2.2 } = {}) {
  const data = Array.isArray(series) ? series : [];
  const anomalies = [];

  for (let i = window; i < data.length; i += 1) {
    const baseline = data.slice(i - window, i).map((point) => point.revenue);
    const avg = mean(baseline);
    const deviation = std(baseline, avg);

    if (!deviation) continue;

    const current = data[i].revenue;
    const z = (current - avg) / deviation;

    if (Math.abs(z) >= zThreshold) {
      anomalies.push({
        date: data[i].date,
        revenue: current,
        z,
        direction: z < 0 ? "down" : "up",
        baseline_avg: Math.round(avg),
      });
    }
  }

  return anomalies.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}
