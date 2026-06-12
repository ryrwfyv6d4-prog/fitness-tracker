import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
const FRACTIONS = [0.25, 0.5, 0.75, 1, 1.5, 2];

export default function AddFoodSheet({ date, meal: initialMeal, onClose, onLogged }) {
  const [tab, setTab] = useState("search");
  const [meal, setMeal] = useState(initialMeal);
  const [selected, setSelected] = useState(null); // food detail incl. servings
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pickFood = async (foodId) => {
    setError(null);
    try {
      setSelected(await api.getFood(foodId));
    } catch (e) {
      setError(e.message);
    }
  };

  const logEntry = async ({ serving_id, quantity }) => {
    setBusy(true);
    setError(null);
    try {
      const newLog = await api.addEntry(date, {
        meal,
        food_id: selected.id,
        serving_id,
        quantity,
      });
      onLogged(newLog);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <select value={meal} onChange={(e) => setMeal(e.target.value)}>
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
          <button className="close" onClick={onClose}>
            ✕
          </button>
        </header>

        {error && <p className="error">{error}</p>}

        {selected ? (
          <QuantityPicker
            food={selected}
            busy={busy}
            onBack={() => setSelected(null)}
            onConfirm={logEntry}
          />
        ) : (
          <>
            <div className="tabs">
              {["search", "barcode", "favorites"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {tab === "search" && <SearchTab onPick={pickFood} />}
            {tab === "barcode" && <BarcodeTab onPick={pickFood} setError={setError} />}
            {tab === "favorites" && (
              <FavoritesTab date={date} meal={meal} onLogged={onLogged} setError={setError} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchTab({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [mode, setMode] = useState("recent");
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api
        .searchFoods(q)
        .then((r) => {
          setResults(r.foods);
          setMode(r.mode);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="tab-body">
      <input
        autoFocus
        type="search"
        placeholder="Search foods…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {mode === "recent" && results.length > 0 && (
        <p className="hint">Recent foods</p>
      )}
      <ul className="result-list">
        {results.map((f) => (
          <li key={f.id} onClick={() => onPick(f.id)}>
            <div>
              <span>{f.name}</span>
              {f.brand && <small> · {f.brand}</small>}
            </div>
            <small>
              {Math.round(f.kcal_per_100)} kcal / 100{f.base_unit}
            </small>
          </li>
        ))}
        {results.length === 0 && q && <li className="empty">No matches</li>}
      </ul>
    </div>
  );
}

function BarcodeTab({ onPick, setError }) {
  const [code, setCode] = useState("");
  const [miss, setMiss] = useState(null);
  const [busy, setBusy] = useState(false);

  const lookup = async () => {
    setError(null);
    setMiss(null);
    setBusy(true);
    try {
      const food = await api.barcode(code);
      onPick(food.id);
    } catch (e) {
      if (e.status === 404 && e.data?.suggest_import) setMiss(e.data.barcode);
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const food = await api.importBarcode(miss);
      onPick(food.id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="tab-body">
      <input
        type="text"
        inputMode="numeric"
        placeholder="Enter barcode digits…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button disabled={!code || busy} onClick={lookup}>
        Look up
      </button>
      {miss && (
        <div className="import-offer">
          <p>Not in your database.</p>
          <button disabled={busy} onClick={doImport}>
            Import from Open Food Facts
          </button>
        </div>
      )}
    </div>
  );
}

function FavoritesTab({ date, meal, onLogged, setError }) {
  const [favorites, setFavorites] = useState(null);

  useEffect(() => {
    api
      .getFavorites()
      .then((r) => setFavorites(r.favorites))
      .catch((e) => setError(e.message));
  }, [setError]);

  const apply = async (fav) => {
    try {
      onLogged(await api.applyFavorite(fav.id, { date, meal }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (!favorites) return <div className="tab-body">Loading…</div>;
  return (
    <div className="tab-body">
      <ul className="result-list">
        {favorites.map((f) => (
          <li key={f.id} onClick={() => apply(f)}>
            <div>
              <span>{f.name}</span>
              <small> · {f.items.length} items</small>
            </div>
            <small>tap to add</small>
          </li>
        ))}
        {favorites.length === 0 && (
          <li className="empty">
            No favorites yet — log a meal, then "Save as favorite".
          </li>
        )}
      </ul>
    </div>
  );
}

function QuantityPicker({ food, busy, onBack, onConfirm }) {
  const servings = food.servings || [];
  const defaultServing = servings.find((s) => s.is_default) || servings[0] || null;
  const [servingId, setServingId] = useState(defaultServing?.id ?? "");
  const [qty, setQty] = useState(servingId ? "1" : "100");

  const serving = servings.find((s) => s.id === servingId) || null;
  const quantity = parseFloat(qty) || 0;
  const grams = serving ? quantity * serving.grams : quantity;
  const kcal = (food.kcal_per_100 * grams) / 100;

  return (
    <div className="tab-body">
      <button className="link" onClick={onBack}>
        ← back to search
      </button>
      <h3>
        {food.name}
        {food.brand && <small> · {food.brand}</small>}
      </h3>

      <label>
        Serving
        <select
          value={servingId}
          onChange={(e) => {
            setServingId(e.target.value);
            setQty(e.target.value ? "1" : "100");
          }}
        >
          {servings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
          <option value="">{food.base_unit} (raw amount)</option>
        </select>
      </label>

      <label>
        Quantity
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      {serving && (
        <div className="fraction-chips">
          {FRACTIONS.map((f) => (
            <button key={f} className="chip" onClick={() => setQty(String(f))}>
              {f}
            </button>
          ))}
        </div>
      )}

      <p className="preview">
        = {Math.round(grams)} {food.base_unit} · <b>{Math.round(kcal)} kcal</b> ·{" "}
        {(((food.protein_g ?? 0) * grams) / 100).toFixed(1)}P /{" "}
        {(((food.carbs_g ?? 0) * grams) / 100).toFixed(1)}C /{" "}
        {(((food.fat_g ?? 0) * grams) / 100).toFixed(1)}F
      </p>

      <button
        className="primary"
        disabled={busy || !(quantity > 0)}
        onClick={() => onConfirm({ serving_id: servingId || null, quantity })}
      >
        Add to diary
      </button>
    </div>
  );
}
