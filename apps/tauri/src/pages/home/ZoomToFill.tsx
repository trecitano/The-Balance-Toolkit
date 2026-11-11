import { createContext, ReactNode, useContext, useLayoutEffect, useRef, useState } from "react";

// The welcome page's area in the smallest window the app allows (1472 x 862, set in tauri.rs).
// The page is laid out for this size.
const BASE_WIDTH = 1224;
const BASE_HEIGHT = 798;

const ZoomContext = createContext(1);

/** The welcome page's zoom, for parts drawn outside the page, such as dialogs. */
export const usePageZoom = () => useContext(ZoomContext);

/**
 * Zooms the welcome page to fill a bigger window, so text, pictures and tiles grow with the
 * window instead of leaving the cards half empty. The zoom follows whichever side has grown less,
 * so the page always fits; the cards stretch to fill the other side.
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
      setZoom(Math.max(1, Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)));
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
