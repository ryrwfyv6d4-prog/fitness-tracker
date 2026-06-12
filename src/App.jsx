import { useCallback, useEffect, useState } from "react";
import { api, todayStr, shiftDate } from "./api.js";
import Onboarding from "./components/Onboarding.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Trends from "./components/Trends.jsx";
import Profile from "./components/Profile.jsx";
import AddFoodSheet from "./components/AddFoodSheet.jsx";
import AddExerciseSheet from "./components/AddExerciseSheet.jsx";

export default function App() {
  const [profile, setProfile] = useState(undefined); // undefined=loading, null=needs setup
  const [tab, setTab] = useState("diary");
  const [date, setDate] = useState(todayStr());
  const [log, setLog] = useState(null);
  const [sheet, setSheet] = useState(null); // {type:'food', meal} | {type:'exercise'}
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getProfile()
      .then(setProfile)
      .catch((e) => {
        if (e.status === 404) setProfile(null);
        else setError(e.message);
      });
  }, []);

  const refreshLog = useCallback(() => {
    if (!profile) return;
    api.getDiary(date).then(setLog).catch((e) => setError(e.message));
  }, [profile, date]);

  useEffect(() => {
    setLog(null);
    refreshLog();
  }, [refreshLog]);

  if (error) {
    return (
      <div className="center-screen">
        <p className="error">{error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
  if (profile === undefined) return <div className="center-screen">Loading…</div>;
  if (profile === null) {
    return (
      <Onboarding
        onDone={(p) => {
          setProfile(p);
          setTab("diary");
        }}
      />
    );
  }

  const handleDeleteEntry = async (id) => setLog(await api.deleteEntry(id));
  const handleDeleteExercise = async (id) => setLog(await api.deleteExerciseLog(id));

  const handleCopyYesterday = async (meal) => {
    try {
      setLog(await api.copyDiary(date, { from_date: shiftDate(date, -1), meal }));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSaveFavorite = async (meal) => {
    const name = prompt("Name this favorite meal:");
    if (!name) return;
    try {
      await api.saveFavoriteFromDiary({ date, meal, name });
      alert(`Saved "${name}" to favorites`);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="app">
      {tab === "diary" && (
        <Dashboard
          log={log}
          date={date}
          setDate={setDate}
          onAddFood={(meal) => setSheet({ type: "food", meal })}
          onAddExercise={() => setSheet({ type: "exercise" })}
          onDeleteEntry={handleDeleteEntry}
          onDeleteExercise={handleDeleteExercise}
          onCopyYesterday={handleCopyYesterday}
          onSaveFavorite={handleSaveFavorite}
        />
      )}
      {tab === "trends" && <Trends />}
      {tab === "profile" && <Profile profile={profile} onSaved={setProfile} />}

      {sheet?.type === "food" && (
        <AddFoodSheet
          date={date}
          meal={sheet.meal}
          onClose={() => setSheet(null)}
          onLogged={(newLog) => {
            setLog(newLog);
            setSheet(null);
          }}
        />
      )}
      {sheet?.type === "exercise" && (
        <AddExerciseSheet
          date={date}
          weightKg={profile.weight_kg}
          onClose={() => setSheet(null)}
          onLogged={(newLog) => {
            setLog(newLog);
            setSheet(null);
          }}
        />
      )}

      <nav className="bottom-nav">
        <button className={tab === "diary" ? "active" : ""} onClick={() => setTab("diary")}>
          Diary
        </button>
        <button className="nav-add" onClick={() => setSheet({ type: "food", meal: suggestMeal() })}>
          ＋
        </button>
        <button className={tab === "trends" ? "active" : ""} onClick={() => setTab("trends")}>
          Trends
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          Profile
        </button>
      </nav>
    </div>
  );
}

function suggestMeal() {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h < 17) return "snacks";
  return "dinner";
}
