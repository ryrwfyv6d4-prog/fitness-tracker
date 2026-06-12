const BASE = "/api/v1";

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || res.statusText);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

export const api = {
  getProfile: () => req("/me"),
  saveProfile: (p) => req("/me", { method: "PUT", body: p }),
  logWeight: (date, weight_kg) =>
    req("/me/weight", { method: "POST", body: { date, weight_kg } }),
  getWeights: (from, to) => req(`/me/weight?from=${from}&to=${to}`),

  searchFoods: (q) => req(`/foods?q=${encodeURIComponent(q)}`),
  getFood: (id) => req(`/foods/${id}`),
  barcode: (code) => req(`/foods/barcode/${encodeURIComponent(code)}`),
  importBarcode: (code) =>
    req(`/foods/barcode/${encodeURIComponent(code)}/import`, { method: "POST" }),

  getDiary: (date) => req(`/me/diary/${date}`),
  addEntry: (date, body) => req(`/me/diary/${date}/entries`, { method: "POST", body }),
  deleteEntry: (id) => req(`/me/diary/entries/${id}`, { method: "DELETE" }),
  copyDiary: (date, body) => req(`/me/diary/${date}/copy`, { method: "POST", body }),

  searchExercises: (q) => req(`/exercises?q=${encodeURIComponent(q)}`),
  addExerciseLog: (body) => req("/me/exercise-logs", { method: "POST", body }),
  deleteExerciseLog: (id) => req(`/me/exercise-logs/${id}`, { method: "DELETE" }),

  getFavorites: () => req("/me/favorites"),
  saveFavoriteFromDiary: (body) =>
    req("/me/favorites/from-diary", { method: "POST", body }),
  applyFavorite: (id, body) =>
    req(`/me/favorites/${id}/apply`, { method: "POST", body }),

  reportCalories: (from, to) => req(`/me/reports/calories?from=${from}&to=${to}`),
  reportMacros: (from, to) => req(`/me/reports/macros?from=${from}&to=${to}`),
};

// Local-date helpers (the client owns "what day is it" — spec §8)
export const todayStr = () => new Date().toLocaleDateString("en-CA");

export function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function formatDate(dateStr) {
  if (dateStr === todayStr()) return "Today";
  if (dateStr === shiftDate(todayStr(), -1)) return "Yesterday";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
