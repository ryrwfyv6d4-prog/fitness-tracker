import { useEffect, useState } from "react";
import { api, shiftDate, todayStr } from "../api.js";

export default function Trends() {
  const [calories, setCalories] = useState(null);
  const [weights, setWeights] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const to = todayStr();
    Promise.all([
      api.reportCalories(shiftDate(to, -13), to),
      api.getWeights(shiftDate(to, -89), to),
    ])
      .then(([cal, w]) => {
        setCalories(cal);
        setWeights(w.weights);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="screen"><p className="error">{error}</p></div>;
  if (!calories || !weights) return <div className="center-screen">Loading…</div>;

  return (
    <div className="screen">
      <h2>Trends</h2>
      <section className="card">
        <h3>Net calories — last 14 days</h3>
        <CalorieChart days={calories.days} />
      </section>
      <section className="card">
        <h3>Weight — last 90 days</h3>
        {weights.length < 2 ? (
          <p className="hint">Log your weight a few times to see a trend.</p>
        ) : (
          <WeightChart weights={weights} />
        )}
      </section>
    </div>
  );
}

function CalorieChart({ days }) {
  const to = todayStr();
  // Fill the full 14-day window so gaps show as empty days
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = shiftDate(to, i - 13);
    return byDate[date] || { date, net_kcal: 0, budget: days[0]?.budget ?? 2000 };
  });
  const budget = series[series.length - 1].budget;
  const max = Math.max(budget, ...series.map((d) => d.net_kcal)) * 1.15 || 1;
  const W = 280;
  const H = 120;
  const bw = W / 14 - 4;
  const y = (v) => H - (v / max) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="chart">
      {series.map((d, i) => (
        <rect
          key={d.date}
          x={i * (W / 14) + 2}
          y={y(d.net_kcal)}
          width={bw}
          height={H - y(d.net_kcal)}
          className={d.net_kcal > budget ? "bar over" : "bar"}
          rx="2"
        />
      ))}
      <line x1="0" x2={W} y1={y(budget)} y2={y(budget)} className="budget-line" />
      <text x={W} y={y(budget) - 3} textAnchor="end" className="chart-label">
        budget {Math.round(budget)}
      </text>
      <text x="0" y={H + 12} className="chart-label">
        {series[0].date.slice(5)}
      </text>
      <text x={W} y={H + 12} textAnchor="end" className="chart-label">
        today
      </text>
    </svg>
  );
}

function WeightChart({ weights }) {
  const W = 280;
  const H = 120;
  const vals = weights.map((w) => w.weight_kg);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const x = (i) => (i / (weights.length - 1)) * W;
  const y = (v) => H - ((v - min) / (max - min)) * H;
  const points = weights.map((w, i) => `${x(i)},${y(w.weight_kg)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="chart">
      <polyline points={points} className="weight-line" fill="none" />
      {weights.map((w, i) => (
        <circle key={w.date} cx={x(i)} cy={y(w.weight_kg)} r="2.5" className="weight-dot" />
      ))}
      <text x="0" y={H + 12} className="chart-label">
        {weights[0].date.slice(5)} · {vals[0]} kg
      </text>
      <text x={W} y={H + 12} textAnchor="end" className="chart-label">
        {weights.at(-1).date.slice(5)} · {vals.at(-1)} kg
      </text>
    </svg>
  );
}
