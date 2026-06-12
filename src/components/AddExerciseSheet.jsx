import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function AddExerciseSheet({ date, weightKg, onClose, onLogged }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState("30");
  const [kcalOverride, setKcalOverride] = useState("");
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .searchExercises(q)
        .then((r) => setResults(r.exercises))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const durationMin = parseFloat(duration) || 0;
  const autoKcal = selected
    ? selected.met * weightKg * (durationMin / 60)
    : 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { date, duration_min: durationMin };
      if (quickAdd) {
        body.kcal_burned = parseFloat(kcalOverride);
        body.notes = quickName || "Quick add";
      } else {
        body.exercise_id = selected.id;
        if (kcalOverride !== "") body.kcal_burned = parseFloat(kcalOverride);
      }
      onLogged(await api.addExerciseLog(body));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <h3>Log exercise</h3>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        <div className="tabs">
          <button className={!quickAdd ? "active" : ""} onClick={() => setQuickAdd(false)}>
            Search
          </button>
          <button className={quickAdd ? "active" : ""} onClick={() => setQuickAdd(true)}>
            Quick add
          </button>
        </div>

        {!quickAdd && !selected && (
          <div className="tab-body">
            <input
              autoFocus
              type="search"
              placeholder="Search exercises…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <ul className="result-list">
              {results.map((ex) => (
                <li key={ex.id} onClick={() => setSelected(ex)}>
                  <div>
                    <span>{ex.name}</span>
                  </div>
                  <small>{ex.met} MET</small>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!quickAdd && selected && (
          <div className="tab-body">
            <button className="link" onClick={() => setSelected(null)}>
              ← back
            </button>
            <h3>{selected.name}</h3>
            <label>
              Duration (minutes)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label>
              Calories burned (auto: {Math.round(autoKcal)})
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={Math.round(autoKcal)}
                value={kcalOverride}
                onChange={(e) => setKcalOverride(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy || !(durationMin > 0)} onClick={submit}>
              Log exercise
            </button>
          </div>
        )}

        {quickAdd && (
          <div className="tab-body">
            <label>
              Name
              <input
                type="text"
                placeholder="e.g. 5-a-side football"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
            <label>
              Calories burned
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={kcalOverride}
                onChange={(e) => setKcalOverride(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy || !(durationMin > 0) || !(parseFloat(kcalOverride) >= 0)}
              onClick={submit}
            >
              Log exercise
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
