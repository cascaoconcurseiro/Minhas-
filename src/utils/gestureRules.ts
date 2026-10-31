/**
 * Pure helper functions for swipe thresholds, drag state, and press-and-hold math.
 */

export interface SwipeState {
  offset: number; // in pixels (negative = left, positive = right)
  isOpenLeft: boolean;
  isOpenRight: boolean;
}

export const SWIPE_THRESHOLDS = {
  ACTIONS_WIDTH_LEFT: 180, // width needed to display [Edit, Duplicate, Delete]
  ACTIONS_WIDTH_RIGHT: 90, // width needed to display [Toggle Status]
  TRIGGER_OPEN_LEFT: 70, // offset needed to latch open left actions
  TRIGGER_OPEN_RIGHT: 60, // offset needed to latch open right action
  MAX_DRAG_LEFT: 220, // max drag resistance left
  MAX_DRAG_RIGHT: 120, // max drag resistance right
};

/**
 * Calculates constrained drag offset with elastic resistance beyond action boundaries.
 */
export function calculateDragOffset(deltaX: number): number {
  if (deltaX < 0) {
    // Dragging left (reveals actions on the right side)
    const abs = Math.abs(deltaX);
    if (abs <= SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT) {
      return deltaX;
    }
    const excess = abs - SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT;
    const damped = SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT + excess * 0.35;
    return -Math.min(damped, SWIPE_THRESHOLDS.MAX_DRAG_LEFT);
  }

  // Dragging right (reveals status toggle)
  if (deltaX <= SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT) {
    return deltaX;
  }
  const excess = deltaX - SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT;
  const damped = SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT + excess * 0.35;
  return Math.min(damped, SWIPE_THRESHOLDS.MAX_DRAG_RIGHT);
}

/**
 * Resolves final snap offset when touch/drag ends.
 */
export function resolveSnapOffset(currentOffset: number, velocityX = 0): {
  targetOffset: number;
  isOpenLeft: boolean;
  isOpenRight: boolean;
  autoTriggerRight: boolean;
} {
  // If moving right with positive offset
  if (currentOffset > 0 || velocityX > 300) {
    if (currentOffset >= SWIPE_THRESHOLDS.TRIGGER_OPEN_RIGHT || velocityX > 400) {
      return {
        targetOffset: SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT,
        isOpenLeft: false,
        isOpenRight: true,
        autoTriggerRight: currentOffset >= SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT * 0.9,
      };
    }
    return {
      targetOffset: 0,
      isOpenLeft: false,
      isOpenRight: false,
      autoTriggerRight: false,
    };
  }

  // If moving left with negative offset
  if (currentOffset < 0 || velocityX < -300) {
    const abs = Math.abs(currentOffset);
    if (abs >= SWIPE_THRESHOLDS.TRIGGER_OPEN_LEFT || velocityX < -400) {
      return {
        targetOffset: -SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT,
        isOpenLeft: true,
        isOpenRight: false,
        autoTriggerRight: false,
      };
    }
    return {
      targetOffset: 0,
      isOpenLeft: false,
      isOpenRight: false,
      autoTriggerRight: false,
    };
  }

  return {
    targetOffset: 0,
    isOpenLeft: false,
    isOpenRight: false,
    autoTriggerRight: false,
  };
}

/**
 * Checks if a movement exceeds touch slop (canceling press-and-hold).
 */
export function shouldCancelLongPress(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  touchSlop = 10
): boolean {
  const dx = currentX - startX;
  const dy = currentY - startY;
  return Math.sqrt(dx * dx + dy * dy) > touchSlop;
}
