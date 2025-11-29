/**
 * Hook for configuring @dnd-kit sensors for clip dragging
 *
 * Provides consistent drag activation behavior across all examples.
 * Supports both desktop (immediate feedback) and mobile (delay-based) interactions.
 */

import { useSensor, useSensors, PointerSensor, TouchSensor, MouseSensor } from '@dnd-kit/core';

export interface DragSensorOptions {
  /**
   * Enable mobile-optimized touch handling with delay-based activation.
   * When true, uses TouchSensor with 250ms delay to distinguish drag from scroll.
   * When false (default), uses PointerSensor with 1px activation for immediate feedback.
   */
  touchOptimized?: boolean;
  /**
   * Delay in milliseconds before touch drag activates (only when touchOptimized is true).
   * Default: 250ms - long enough to distinguish from scroll intent
   */
  touchDelay?: number;
  /**
   * Distance tolerance during touch delay (only when touchOptimized is true).
   * If finger moves more than this during delay, drag is cancelled.
   * Default: 5px - allows slight finger movement
   */
  touchTolerance?: number;
  /**
   * Distance in pixels before mouse drag activates.
   * Default: 1px for immediate feedback on desktop
   */
  mouseDistance?: number;
}

/**
 * Returns configured sensors for @dnd-kit drag operations
 *
 * @param options - Configuration options for drag sensors
 * @returns Configured sensors appropriate for the interaction mode
 *
 * @example
 * // Desktop-optimized (default)
 * const sensors = useDragSensors();
 *
 * @example
 * // Mobile-optimized with touch delay
 * const sensors = useDragSensors({ touchOptimized: true });
 *
 * @example
 * // Custom touch settings
 * const sensors = useDragSensors({
 *   touchOptimized: true,
 *   touchDelay: 300,
 *   touchTolerance: 8
 * });
 */
export function useDragSensors(options: DragSensorOptions = {}) {
  const {
    touchOptimized = false,
    touchDelay = 250,
    touchTolerance = 5,
    mouseDistance = 1,
  } = options;

  // Touch-optimized: Use separate MouseSensor and TouchSensor
  // This allows different activation constraints for each input type
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: mouseDistance,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: touchOptimized
      ? {
          // Delay-based activation for mobile - wait before starting drag
          // This allows users to scroll without accidentally triggering drag
          delay: touchDelay,
          tolerance: touchTolerance,
        }
      : {
          // Distance-based activation for non-optimized mode
          distance: mouseDistance,
        },
  });

  // Non-optimized: Use PointerSensor for unified handling (original behavior)
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: mouseDistance,
    },
  });

  // When touch-optimized, use separate sensors for better control
  // Otherwise, use unified PointerSensor for backwards compatibility
  return useSensors(
    ...(touchOptimized ? [mouseSensor, touchSensor] : [pointerSensor])
  );
}
