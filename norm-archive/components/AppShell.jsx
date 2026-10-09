"use client";

import { useEffect, useState } from "react";
import { useLibrary, useFavorites, useWatchLater, useManualWatched, usePositions, isWatched } from "../lib/useLibrary";
import { PlayerProvider, usePlayer } from "../lib/PlayerContext";
import TabBar from "./TabBar";
import PlayerHost from "./PlayerHost";
import CardMenu from "./CardMenu";
import ScrollToTopButton from "./ScrollToTopButton";
import HomeTab from "./HomeTab";
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
      <div className="mx-auto max-w-7xl px-4 pt-[max(env(safe-area-inset-top),24px)] sm:px-6 lg:px-8" data-testid="loading">
        <Wordmark />
        <p className="mt-1.5 text-[13px] text-ink-400">Pulling the archive from the Internet Archive…</p>
        <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="aspect-video rounded-xl bg-ink-800" />
              <div className="mt-2 h-3 w-11/12 rounded bg-ink-800" />
              <div className="mt-1.5 h-2.5 w-1/2 rounded bg-ink-800" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),24px)]" data-testid="error">
        <Wordmark />
        <div className="mt-8 rounded-2xl bg-ink-800 p-6 text-center ring-1 ring-ink-700">
          <p className="text-sm font-semibold text-white">Couldn&apos;t reach the Internet Archive</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-400">
            archive.org may be down or slow right now — every clip streams from there. ({String(error?.message || error)})
          </p>
          <button type="button" onClick={() => location.reload()} className="mt-5 h-10 rounded-full bg-accent-400 px-6 text-xs font-bold text-black">
            Try again
          </button>
        </div>
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

function Wordmark() {
  return (
    <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
      Norm<span className="text-accent-400">Tube</span>
    </p>
  );
}

function AppShellReady({ data, favs, toggleFav, watchLater, toggleWatchLater, manualWatched, setManualWatched, positions, savePosition, clearPosition }) {
  const { current, sheetOpen, playVideo } = usePlayer();
  const [tab, setTab] = useState("home");
  // Where the Library tab should open: a category, a search typed on Home.
  // `n` remounts it so the same destination can be requested twice.
  const [libraryNav, setLibraryNav] = useState({ category: "All", query: "", focus: false, n: 0 });
  const [menuVideo, setMenuVideo] = useState(null);
  const miniVisible = current && !sheetOpen;

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
    if (nextTab === "library") {
      setLibraryNav((prev) => ({ category: opts.category || "All", query: opts.query || "", focus: !!opts.focus, n: prev.n + 1 }));
    }
    setTab(nextTab);
    window.scrollTo(0, 0);
  };

  const playRandom = () => {
    const pick = data.videos[Math.floor(Math.random() * data.videos.length)];
    playVideo(pick);
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
    // Bottom padding clears the tab bar, plus the mini player when it's
    // docked — otherwise the last row and the footer sit permanently
    // underneath it.
    <div className={miniVisible ? "pb-[calc(64px+76px+env(safe-area-inset-bottom))]" : "pb-[calc(64px+env(safe-area-inset-bottom))]"}>
      {tab === "home" && <HomeTab {...sharedTabProps} onNavigate={goTo} onPlayRandom={playRandom} />}
      {tab === "timeline" && <TimelineTab {...sharedTabProps} />}
      {tab === "library" && (
        <LibraryTab
          {...sharedTabProps}
          key={libraryNav.n}
          initialCategory={libraryNav.category}
          initialQuery={libraryNav.query}
          focusSearch={libraryNav.focus}
        />
      )}

      <PlayerHost
        videos={data.videos}
        positions={positions}
        manualWatched={manualWatched}
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

      <ScrollToTopButton raised={miniVisible} />
      <TabBar
        active={tab}
        onChange={(t) => {
          if (t === "library" && tab !== "library") setLibraryNav((prev) => ({ category: "All", query: "", focus: false, n: prev.n + 1 }));
          if (t === tab) window.scrollTo({ top: 0, behavior: "smooth" });
          else window.scrollTo(0, 0);
          setTab(t);
        }}
      />
    </div>
  );
}

function resumeAtFor(positions, v) {
  const p = positions[v.id];
  return p && p.t > 10 && (!p.d || p.t / p.d < 0.95) ? p.t : null;
}
