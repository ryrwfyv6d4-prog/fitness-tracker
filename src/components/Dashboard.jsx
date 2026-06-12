import { formatDate, shiftDate, todayStr } from "../api.js";

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function Dashboard({
  log,
  date,
  setDate,
  onAddFood,
  onAddExercise,
  onDeleteEntry,
  onDeleteExercise,
  onCopyYesterday,
  onSaveFavorite,
}) {
  return (
    <div className="screen">
      <header className="date-stepper">
        <button onClick={() => setDate(shiftDate(date, -1))}>◀</button>
        <h2>{formatDate(date)}</h2>
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= todayStr()}
        >
          ▶
        </button>
      </header>

      {!log ? (
        <div className="center-screen">Loading…</div>
      ) : (
        <>
          <Hero log={log} />
          <MacroBars totals={log.totals} targets={log.targets} />

          {Object.entries(log.meals).map(([meal, data]) => (
            <MealCard
              key={meal}
              title={MEAL_LABELS[meal]}
              kcal={data.subtotal_kcal}
              onAdd={() => onAddFood(meal)}
            >
              {data.entries.map((e) => (
                <EntryRow key={e.id} entry={e} onDelete={() => onDeleteEntry(e.id)} />
              ))}
              <div className="meal-actions">
                {data.entries.length === 0 && (
                  <button className="link" onClick={() => onCopyYesterday(meal)}>
                    Copy from yesterday
                  </button>
                )}
                {data.entries.length > 0 && (
                  <button className="link" onClick={() => onSaveFavorite(meal)}>
                    ☆ Save as favorite
                  </button>
                )}
              </div>
            </MealCard>
          ))}

          <MealCard
            title="Exercise"
            kcal={-log.exercise.subtotal_kcal}
            onAdd={onAddExercise}
          >
            {log.exercise.entries.map((e) => (
              <div className="entry-row" key={e.id}>
                <div className="entry-main">
                  <span>{e.name}</span>
                  <small>{Math.round(e.duration_min)} min</small>
                </div>
                <span className="entry-kcal">−{Math.round(e.kcal_burned)}</span>
                <button className="entry-delete" onClick={() => onDeleteExercise(e.id)}>
                  ✕
                </button>
              </div>
            ))}
          </MealCard>
        </>
      )}
    </div>
  );
}

function Hero({ log }) {
  const t = log.totals;
  const remaining = Math.round(t.remaining_kcal);
  return (
    <section className={`hero ${remaining < 0 ? "over" : ""}`}>
      <div className="hero-number">{remaining.toLocaleString()}</div>
      <div className="hero-label">{remaining < 0 ? "kcal over budget" : "kcal remaining"}</div>
      <div className="hero-equation">
        <span>
          <b>{Math.round(log.targets.calorie_budget).toLocaleString()}</b>
          <small>Goal</small>
        </span>
        <span className="op">−</span>
        <span>
          <b>{Math.round(t.food_kcal).toLocaleString()}</b>
          <small>Food</small>
        </span>
        <span className="op">＋</span>
        <span>
          <b>{Math.round(t.exercise_kcal).toLocaleString()}</b>
          <small>Exercise</small>
        </span>
      </div>
    </section>
  );
}

function MacroBars({ totals, targets }) {
  const macros = [
    { label: "Protein", eaten: totals.protein_g, target: targets.protein_g, cls: "protein" },
    { label: "Carbs", eaten: totals.carbs_g, target: targets.carbs_g, cls: "carbs" },
    { label: "Fat", eaten: totals.fat_g, target: targets.fat_g, cls: "fat" },
  ];
  return (
    <section className="card macro-bars">
      {macros.map((m) => (
        <div className="macro-row" key={m.label}>
          <span className="macro-label">{m.label}</span>
          <div className="bar">
            <div
              className={`fill ${m.cls}`}
              style={{ width: `${Math.min(100, (m.eaten / m.target) * 100)}%` }}
            />
          </div>
          <span className="macro-nums">
            {m.eaten.toFixed(0)} / {m.target.toFixed(0)} g
          </span>
        </div>
      ))}
    </section>
  );
}

function MealCard({ title, kcal, onAdd, children }) {
  return (
    <section className="card meal-card">
      <header>
        <h3>{title}</h3>
        <span className="meal-kcal">{Math.round(kcal).toLocaleString()}</span>
        <button className="add-btn" onClick={onAdd}>
          ＋
        </button>
      </header>
      {children}
    </section>
  );
}

function EntryRow({ entry, onDelete }) {
  return (
    <div className="entry-row">
      <div className="entry-main">
        <span>{entry.food.name}</span>
        <small>
          {entry.serving
            ? `${entry.quantity} × ${entry.serving.label}`
            : `${entry.grams_total} g`}
          {entry.food.brand ? ` · ${entry.food.brand}` : ""}
        </small>
      </div>
      <span className="entry-kcal">{Math.round(entry.kcal)}</span>
      <button className="entry-delete" onClick={onDelete}>
        ✕
      </button>
    </div>
  );
}
