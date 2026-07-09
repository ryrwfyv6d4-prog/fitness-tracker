"use client";

import { useEffect, useState } from "react";
import { scrollToTop } from "../lib/useLibrary";

const SHOW_AFTER_PX = 600;

// A long, un-paginated grid (hundreds of clips) has no other way back to
// the top — iOS's tap-the-status-bar gesture only scrolls the document
// body, and isn't something every visitor knows about or gets reliably in
// every browsing mode. A visible button works everywhere.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      data-testid="scroll-top-button"
      className="fixed bottom-[max(env(safe-area-inset-bottom),16px)] right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-ink-800/90 text-accent-400 shadow-lg ring-1 ring-ink-700 backdrop-blur-md transition active:scale-90"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
