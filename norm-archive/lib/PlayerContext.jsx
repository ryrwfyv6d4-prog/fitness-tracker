"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const PlayerContext = createContext(null);

// Single source of truth for "what's playing" so the same underlying <video>
// element can be shared between the full-screen Player Sheet and the docked
// Mini Player without ever unmounting — that's what makes "keep browsing,
// keep listening" actually work instead of restarting playback on every
// open/close.
export function PlayerProvider({ children }) {
  const [current, setCurrent] = useState(null); // video object or null
  const [sheetOpen, setSheetOpen] = useState(false); // full sheet vs docked mini player

  const playVideo = useCallback((video, opts = {}) => {
    const { sheet = true } = opts;
    setCurrent(video);
    setSheetOpen(sheet);
  }, []);

  const closeSheet = useCallback(() => setSheetOpen(false), []); // playback continues in mini player
  const expandSheet = useCallback(() => setSheetOpen(true), []);
  const stop = useCallback(() => {
    setCurrent(null);
    setSheetOpen(false);
  }, []);

  const value = useMemo(
    () => ({ current, sheetOpen, playVideo, closeSheet, expandSheet, stop }),
    [current, sheetOpen, playVideo, closeSheet, expandSheet, stop]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
