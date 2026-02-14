import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

export interface ScrollViewport {
  scrollLeft: number;
  containerWidth: number;
  visibleStart: number;
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

    setViewport({
      scrollLeft,
      containerWidth,
      visibleStart: Math.max(0, scrollLeft - buffer),
      visibleEnd: scrollLeft + containerWidth + buffer,
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

  return (
    <ScrollViewportContext.Provider value={viewport}>
      {children}
    </ScrollViewportContext.Provider>
  );
};

export const useScrollViewport = (): ScrollViewport | null =>
  useContext(ScrollViewportContext);
