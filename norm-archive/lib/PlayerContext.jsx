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
  const [queue, setQueue] = useState([]); // upcoming videos, consumed front-to-back
  const [autoplay, setAutoplay] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false); // full sheet vs docked mini player
  const [channelActive, setChannelActive] = useState(false); // Channel Mode is driving playback
  const [channelPool, setChannelPool] = useState(null); // videos Channel Mode picks from, for reshuffling on "next"

  const playVideo = useCallback((video, opts = {}) => {
    const { queue: newQueue, sheet = true, channel = false, pool = null } = opts;
    setCurrent(video);
    if (newQueue) setQueue(newQueue);
    setSheetOpen(sheet);
    setChannelActive(channel);
    if (channel) setChannelPool(pool);
  }, []);

  const enqueueNext = useCallback((video) => {
    setQueue((prev) => [video, ...prev.filter((v) => v.id !== video.id)]);
  }, []);

  const playNext = useCallback(() => {
    setQueue((prev) => {
      if (prev.length) {
        setCurrent(prev[0]);
        return prev.slice(1);
      }
      if (channelActive && channelPool?.length) {
        const pick = channelPool[Math.floor(Math.random() * channelPool.length)];
        setCurrent(pick);
      }
      return prev;
    });
  }, [channelActive, channelPool]);

  const closeSheet = useCallback(() => setSheetOpen(false), []); // playback continues in mini player
  const expandSheet = useCallback(() => setSheetOpen(true), []);
  const stop = useCallback(() => {
    setCurrent(null);
    setQueue([]);
    setSheetOpen(false);
    setChannelActive(false);
    setChannelPool(null);
  }, []);

  const value = useMemo(
    () => ({
      current,
      queue,
      autoplay,
      sheetOpen,
      channelActive,
      setAutoplay,
      playVideo,
      enqueueNext,
      playNext,
      closeSheet,
      expandSheet,
      stop,
    }),
    [current, queue, autoplay, sheetOpen, channelActive, playVideo, enqueueNext, playNext, closeSheet, expandSheet, stop]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within a PlayerProvider");
  return ctx;
}
