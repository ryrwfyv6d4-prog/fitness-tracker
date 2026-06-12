import { useState } from "react";
import { api } from "../api.js";

export const ACTIVITY_OPTIONS = [
  ["sedentary", "Sedentary — desk job, little exercise"],
  ["light", "Light — exercise 1–3 days/week"],
  ["moderate", "Moderate — exercise 3–5 days/week"],
  ["active", "Active — hard exercise 6–7 days/week"],
  ["very_active", "Very active — physical job + training"],
];

export function ProfileForm({ initial = {}, submitLabel, onSave }) {
  const initialRate = Math.abs(initial.goal_rate_kg_per_week ?? 0.5);
  const [form, setForm] = useState({
    sex: initial.sex ?? "male",
    birth_date: initial.birth_date ?? "1990-01-01",
    height_cm: initial.height_cm ?? "",
    weight_kg: initial.weight_kg ?? "",
    activity_level: initial.activity_level ?? "sedentary",
    goal_type: initial.goal_type ?? "maintain",
    rate: initialRate || 0.5,
    exercise_credit_enabled: initial.exercise_credit_enabled ?? 1,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? (e.target.checked ? 1 : 0) : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const rate = parseFloat(form.rate) || 0;
    try {
      const profile = await api.saveProfile({
        sex: form.sex,
        birth_date: form.birth_date,
        height_cm: parseFloat(form.height_cm),
        weight_kg: parseFloat(form.weight_kg),
        activity_level: form.activity_level,
        goal_type: form.goal_type,
        goal_rate_kg_per_week:
          form.goal_type === "lose" ? -rate : form.goal_type === "gain" ? rate : 0,
        exercise_credit_enabled: form.exercise_credit_enabled,
      });
      onSave(profile);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={submit}>
      {error && <p className="error">{error}</p>}

      <label>
        Sex (for BMR)
        <select value={form.sex} onChange={set("sex")}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label>
        Date of birth
        <input type="date" required value={form.birth_date} onChange={set("birth_date")} />
      </label>
      <label>
        Height (cm)
        <input type="number" required min="100" max="250" step="any" value={form.height_cm} onChange={set("height_cm")} />
      </label>
      <label>
        Weight (kg)
        <input type="number" required min="30" max="300" step="any" value={form.weight_kg} onChange={set("weight_kg")} />
      </label>
      <label>
        Day-to-day activity (excluding workouts you'll log)
        <select value={form.activity_level} onChange={set("activity_level")}>
          {ACTIVITY_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Goal
        <select value={form.goal_type} onChange={set("goal_type")}>
          <option value="lose">Lose weight</option>
          <option value="maintain">Maintain</option>
          <option value="gain">Gain weight</option>
        </select>
      </label>
      {form.goal_type !== "maintain" && (
        <label>
          Rate (kg per week)
          <select value={form.rate} onChange={set("rate")}>
            <option value="0.25">0.25 kg/week</option>
            <option value="0.5">0.5 kg/week</option>
            {form.goal_type === "lose" && <option value="0.75">0.75 kg/week</option>}
            {form.goal_type === "lose" && <option value="1">1 kg/week</option>}
          </select>
        </label>
      )}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!form.exercise_credit_enabled}
          onChange={set("exercise_credit_enabled")}
        />
        Add exercise calories back to my daily budget
      </label>

      <button className="primary" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

export default function Onboarding({ onDone }) {
  return (
    <div className="screen onboarding">
      <h1>Set up your profile</h1>
      <p className="hint">
        Used to calculate your BMR (Mifflin-St Jeor), daily energy needs and
        calorie budget. All data stays in your own database.
      </p>
      <ProfileForm submitLabel="Calculate my budget" onSave={onDone} />
    </div>
  );
}
