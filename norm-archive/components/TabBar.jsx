"use client";

import { HomeIcon, TimelineIcon, LibraryIcon } from "./icons";

const TABS = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "timeline", label: "Timeline", Icon: TimelineIcon },
  { id: "library", label: "Library", Icon: LibraryIcon },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-ink-700/60 bg-ink-900/88 px-2 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur-xl backdrop-saturate-150"
      aria-label="Primary"
      data-testid="tab-bar"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-[48px] min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[10px] font-bold ${
              isActive ? "text-accent-400" : "text-ink-400"
            }`}
            data-testid={`tab-${id}`}
          >
            <Icon className="h-[22px] w-[22px]" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
