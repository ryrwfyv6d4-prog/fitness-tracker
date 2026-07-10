"use client";

import { useEffect, useState } from "react";
import { useLibrary, useFavorites, useWatchLater, useManualWatched, usePositions, isWatched } from "../lib/useLibrary";
import { PlayerProvider, usePlayer } from "../lib/PlayerContext";
import TabBar from "./TabBar";
import PlayerHost from "./PlayerHost";
import CardMenu from "./CardMenu";
import ScrollToTopButton from "./ScrollToTopButton";
import HomeTab from "./HomeTab";
import ChannelTab from "./ChannelTab";
import TimelineTab from "./TimelineTab";
import LibraryTab from "./LibraryTab";

export default function AppShell() {
  const { status, data, error } = useLibrary();
  const [favs, toggleFav] = useFavorites();
  const [watchLater, toggleWatchLater] = useWatchLater();
  const [manualWatched, setManualWatched] = useManualWatched();
  const [positions, savePosition, clearPosition] = usePositions();

  if (status === "loading") {
    return (
      <div className="px-4 pt-10 sm:px-6 lg:px-8" data-testid="loading">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-xl bg-ink-800" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-4 mt-10 rounded-xl bg-ink-800 p-6 text-center ring-1 ring-ink-700 sm:mx-auto sm:max-w-md" data-testid="error">
        <p className="text-sm font-medium text-white">Couldn&apos;t reach the Internet Archive.</p>
        <p className="mt-2 text-xs text-ink-400">{String(error?.message || error)}</p>
        <button type="button" onClick={() => location.reload()} className="mt-4 rounded-lg bg-accent-400 px-5 py-2 text-xs font-bold text-black">
          Retry
        </button>
      </div>
    );
  }

  return (
    <PlayerProvider>
      <AppShellReady
        data={data}
        favs={favs}
        toggleFav={toggleFav}
        watchLater={watchLater}
        toggleWatchLater={toggleWatchLater}
        manualWatched={manualWatched}
        setManualWatched={setManualWatched}
        positions={positions}
        savePosition={savePosition}
        clearPosition={clearPosition}
      />
    </PlayerProvider>
  );
}

function AppShellReady({ data, favs, toggleFav, watchLater, toggleWatchLater, manualWatched, setManualWatched, positions, savePosition, clearPosition }) {
  const { current, playVideo } = usePlayer();
  const [tab, setTab] = useState("home");
  const [libraryCategory, setLibraryCategory] = useState("All");
  const [menuVideo, setMenuVideo] = useState(null);

  // Deep link: /#v=<id> opens straight to that clip (for sharing). Checked
  // on initial load AND on 'hashchange' for same-document navigations.
  useEffect(() => {
    const openFromHash = () => {
      const id = location.hash.match(/^#v=(.+)$/)?.[1];
      if (!id) return;
      const v = data.videos.find((x) => x.id === decodeURIComponent(id));
      if (v) playVideo(v);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const goTo = (nextTab, opts = {}) => {
    if (nextTab === "library" && opts.category) setLibraryCategory(opts.category);
    setTab(nextTab);
  };

  const playChannel = (pool) => {
    const source = pool && pool.length ? pool : data.videos;
    const pick = source[Math.floor(Math.random() * source.length)];
    playVideo(pick, { sheet: true, channel: true, pool: source, queue: [] });
  };

  const sharedTabProps = {
    data,
    favs,
    toggleFav,
    watchLater,
    toggleWatchLater,
    manualWatched,
    positions,
    onLongPress: setMenuVideo,
  };

  return (
    <div className="pb-[max(env(safe-area-inset-bottom),64px)]">
      {tab === "home" && <HomeTab {...sharedTabProps} onNavigate={goTo} onPlayChannel={() => playChannel(null)} />}
      {tab === "channel" && <ChannelTab data={data} onPlayChannel={playChannel} />}
      {tab === "timeline" && <TimelineTab {...sharedTabProps} />}
      {tab === "library" && <LibraryTab {...sharedTabProps} key={libraryCategory} initialCategory={libraryCategory} />}

      <PlayerHost
        isFav={current ? favs.has(current.id) : false}
        onToggleFav={toggleFav}
        isWatchLater={current ? watchLater.has(current.id) : false}
        onToggleWatchLater={toggleWatchLater}
        watched={current ? isWatched(positions, manualWatched, current.id) : false}
        onSetWatched={setManualWatched}
        resumeAt={current ? resumeAtFor(positions, current) : null}
        onProgress={savePosition}
      />

      {menuVideo && (
        <CardMenu
          video={menuVideo}
          isFav={favs.has(menuVideo.id)}
          onToggleFav={toggleFav}
          isWatchLater={watchLater.has(menuVideo.id)}
          onToggleWatchLater={toggleWatchLater}
          watched={isWatched(positions, manualWatched, menuVideo.id)}
          onSetWatched={setManualWatched}
          hasProgress={!!positions[menuVideo.id]}
          onRemoveFromContinueWatching={clearPosition}
          onPlay={playVideo}
          onClose={() => setMenuVideo(null)}
        />
      )}

      <ScrollToTopButton />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}

function resumeAtFor(positions, v) {
  const p = positions[v.id];
  return p && p.t > 10 && (!p.d || p.t / p.d < 0.95) ? p.t : null;
}
