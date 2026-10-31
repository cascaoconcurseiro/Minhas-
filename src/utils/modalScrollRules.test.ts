import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTargetScrollTopForExpansion,
  computeModalScrollState,
} from './modalScrollRules';

test('computeModalScrollState detects non-scrollable vs scrollable modal content and shadow states', () => {
  const shortContent = computeModalScrollState(0, 500, 480);
  assert.equal(shortContent.isScrollable, false);
  assert.equal(shortContent.showTopShadow, false);
  assert.equal(shortContent.showBottomShadow, false);
  assert.equal(shortContent.scrollProgressPercent, 100);

  const atTop = computeModalScrollState(0, 400, 750);
  assert.equal(atTop.isScrollable, true);
  assert.equal(atTop.isAtTop, true);
  assert.equal(atTop.isAtBottom, false);
  assert.equal(atTop.showTopShadow, false);
  assert.equal(atTop.showBottomShadow, true);

  const midScroll = computeModalScrollState(175, 400, 750);
  assert.equal(midScroll.isScrollable, true);
  assert.equal(midScroll.showTopShadow, true);
  assert.equal(midScroll.showBottomShadow, true);
  assert.equal(midScroll.scrollProgressPercent, 50);

  const atBottom = computeModalScrollState(350, 400, 750);
  assert.equal(atBottom.isAtBottom, true);
  assert.equal(atBottom.showTopShadow, true);
  assert.equal(atBottom.showBottomShadow, false);
  assert.equal(atBottom.scrollProgressPercent, 100);
});

test('calculateTargetScrollTopForExpansion scrolls down when expanded section exceeds visible area', () => {
  // Container is 400px tall, currently at scrollTop=0. Section is at top=320, height=180.
  const nextScroll = calculateTargetScrollTopForExpansion(0, 400, 320, 180, 20);
  assert.equal(nextScroll, 120);

  // Already visible section does not jump
  const unchanged = calculateTargetScrollTopForExpansion(50, 400, 100, 120, 20);
  assert.equal(unchanged, 50);
});
