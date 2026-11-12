import { createContext, ReactNode, useContext, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

// A page's area in the smallest window the app allows, which pages are laid out for: the
// 1472 x 862 minimum (tauri.rs), less the navigation rail (88 px, Navigation.tsx) and the main
// area's padding (80 px each side, 32 px top and bottom, App.tsx).
const BASE_WIDTH = 1472 - 88 - 2 * 80;
const BASE_HEIGHT = 862 - 2 * 32;

const ZoomContext = createContext(1);

/** The page's zoom, for parts drawn outside the page, such as dialogs. 1 outside a zoomed page. */
export const usePageZoom = () => useContext(ZoomContext);

/**
 * Zooms a page to fill a bigger window, so text, pictures and controls grow with the window
 * instead of leaving it half empty. The zoom follows whichever side has grown less, so the page
 * always fits; its layout stretches to fill the other side.
 */
export default function ZoomToFill({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const area = ref.current?.parentElement;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      // Applied in the same frame as the resize, so the page doesn't wobble while the window is dragged.
      flushSync(() => setZoom(Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT))));
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  return (
    <ZoomContext value={zoom}>
      <div ref={ref} className={className} style={{ zoom }}>
        {children}
      </div>
    </ZoomContext>
  );
}
