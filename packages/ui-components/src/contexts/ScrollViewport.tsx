import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';

export interface ScrollViewport {
  scrollLeft: number;
  containerWidth: number;
  /** Left edge of the rendering window in pixels. Includes a 1.5× container-width over-scan buffer to the left of the visible area. */
  visibleStart: number;
  /** Right edge of the rendering window in pixels. Includes a 1.5× container-width over-scan buffer to the right of the visible area. */
  visibleEnd: number;
}

const ScrollViewportContext = createContext<ScrollViewport | null>(null);

type ScrollViewportProviderProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
};

export const ScrollViewportProvider = ({
  containerRef,
  children,
}: ScrollViewportProviderProps) => {
  const [viewport, setViewport] = useState<ScrollViewport | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    const containerWidth = el.clientWidth;
    const buffer = containerWidth * 1.5;
    const visibleStart = Math.max(0, scrollLeft - buffer);
    const visibleEnd = scrollLeft + containerWidth + buffer;

    // Skip update if scroll hasn't moved enough to matter for chunk visibility.
    // Canvas chunks are 1000px wide, and the 1.5× buffer covers well beyond the
    // viewport edges, so small scroll deltas don't change which chunks are visible.
    setViewport((prev) => {
      if (
        prev &&
        prev.containerWidth === containerWidth &&
        Math.abs(prev.scrollLeft - scrollLeft) < 100
      ) {
        return prev; // Same reference — React skips re-render of consumers
      }
      return { scrollLeft, containerWidth, visibleStart, visibleEnd };
    });
  }, [containerRef]);

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Initial measurement
    measure();

    // Scroll listener throttled via requestAnimationFrame
    el.addEventListener('scroll', scheduleUpdate, { passive: true });

    // ResizeObserver for container width changes
    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', scheduleUpdate);
      resizeObserver.disconnect();
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [containerRef, measure, scheduleUpdate]);

  const contextValue = useMemo(() => viewport, [viewport]);

  return (
    <ScrollViewportContext.Provider value={contextValue}>
      {children}
    </ScrollViewportContext.Provider>
  );
};

export const useScrollViewport = (): ScrollViewport | null =>
  useContext(ScrollViewportContext);
