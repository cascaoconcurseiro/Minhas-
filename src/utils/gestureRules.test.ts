import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDragOffset,
  resolveSnapOffset,
  shouldCancelLongPress,
  SWIPE_THRESHOLDS,
} from './gestureRules';

test('calculateDragOffset damps movement beyond action boundaries', () => {
  // Within bounds
  assert.equal(calculateDragOffset(-100), -100);
  assert.equal(calculateDragOffset(60), 60);

  // Beyond left bounds (180 + 100 * 0.35 = 215)
  const dampedLeft = calculateDragOffset(-280);
  assert.equal(dampedLeft < -180, true);
  assert.equal(dampedLeft >= -SWIPE_THRESHOLDS.MAX_DRAG_LEFT, true);

  // Beyond right bounds (90 + 50 * 0.35 = 107.5)
  const dampedRight = calculateDragOffset(140);
  assert.equal(dampedRight > 90, true);
  assert.equal(dampedRight <= SWIPE_THRESHOLDS.MAX_DRAG_RIGHT, true);
});

test('resolveSnapOffset snaps open or resets depending on swipe threshold', () => {
  // Swipe left past trigger threshold snaps to open
  const openLeft = resolveSnapOffset(-120);
  assert.equal(openLeft.targetOffset, -SWIPE_THRESHOLDS.ACTIONS_WIDTH_LEFT);
  assert.equal(openLeft.isOpenLeft, true);
  assert.equal(openLeft.isOpenRight, false);

  // Insufficient swipe left resets to 0
  const resetLeft = resolveSnapOffset(-30);
  assert.equal(resetLeft.targetOffset, 0);
  assert.equal(resetLeft.isOpenLeft, false);

  // Swipe right past trigger threshold snaps to open and triggers toggle
  const openRight = resolveSnapOffset(85);
  assert.equal(openRight.targetOffset, SWIPE_THRESHOLDS.ACTIONS_WIDTH_RIGHT);
  assert.equal(openRight.isOpenRight, true);
  assert.equal(openRight.autoTriggerRight, true);
});

test('shouldCancelLongPress detects movement outside touch slop', () => {
  // Stationary touch
  assert.equal(shouldCancelLongPress(100, 100, 103, 104, 10), false);

  // Scrolling finger exceeds 10px slop
  assert.equal(shouldCancelLongPress(100, 100, 120, 105, 10), true);
  assert.equal(shouldCancelLongPress(100, 100, 102, 130, 10), true);
});
