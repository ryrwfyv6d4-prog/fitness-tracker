import { useState } from "react";
import { api, todayStr } from "../api.js";
import { ProfileForm } from "./Onboarding.jsx";

export default function Profile({ profile, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState("");
  const [msg, setMsg] = useState(null);
  const c = profile.computed;

  const logWeight = async () => {
    const w = parseFloat(weight);
    if (!(w > 0)) return;
    const res = await api.logWeight(todayStr(), w);
    setMsg(`Logged ${w} kg — budget is now ${Math.round(res.computed.calorie_budget)} kcal`);
    setWeight("");
    onSaved(await api.getProfile());
  };

  return (
    <div className="screen">
      <h2>Profile</h2>

      <section className="card stats">
        <div>
          <b>{Math.round(c.bmr)}</b>
          <small>BMR</small>
        </div>
        <div>
          <b>{Math.round(c.tdee)}</b>
          <small>TDEE</small>
        </div>
        <div>
          <b>{Math.round(c.calorie_budget)}</b>
          <small>Daily budget</small>
        </div>
      </section>
      <section className="card stats">
        <div>
          <b>{Math.round(c.protein_g)}g</b>
          <small>Protein</small>
        </div>
        <div>
          <b>{Math.round(c.carbs_g)}g</b>
          <small>Carbs</small>
        </div>
        <div>
          <b>{Math.round(c.fat_g)}g</b>
          <small>Fat</small>
        </div>
      </section>

      <section className="card">
        <h3>Log today's weight</h3>
        <div className="inline-form">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder={`${profile.weight_kg} kg`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <button onClick={logWeight} disabled={!(parseFloat(weight) > 0)}>
            Log
          </button>
        </div>
        {msg && <p className="hint">{msg}</p>}
      </section>

      <section className="card">
        <header className="row-between">
          <h3>Settings</h3>
          <button className="link" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </button>
        </header>
        {editing && (
          <ProfileForm
            initial={profile}
            submitLabel="Save changes"
            onSave={(p) => {
              onSaved(p);
              setEditing(false);
            }}
          />
        )}
      </section>
    </div>
  );
}
