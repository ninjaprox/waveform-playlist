import { useCallback, useEffect, useRef } from 'react';

export interface AnimationFrameLoopControls {
  animationFrameRef: React.MutableRefObject<number | null>;
  startAnimationFrameLoop: (callback: () => void) => void;
  stopAnimationFrameLoop: () => void;
}

/**
 * Shared RAF loop controller used by playlist providers.
 * Always guarantees a single in-flight animation frame.
 */
export const useAnimationFrameLoop = (): AnimationFrameLoopControls => {
  const animationFrameRef = useRef<number | null>(null);

  const stopAnimationFrameLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const startAnimationFrameLoop = useCallback((callback: () => void) => {
    stopAnimationFrameLoop();
    animationFrameRef.current = requestAnimationFrame(callback);
  }, [stopAnimationFrameLoop]);

  useEffect(() => {
    return () => {
      stopAnimationFrameLoop();
    };
  }, [stopAnimationFrameLoop]);

  return {
    animationFrameRef,
    startAnimationFrameLoop,
    stopAnimationFrameLoop,
  };
};
