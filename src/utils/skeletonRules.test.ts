import test from 'node:test';
import assert from 'node:assert/strict';
import { getSkeletonItemCount, shouldDisplaySkeleton } from './skeletonRules';

test('shouldDisplaySkeleton returns true if any loading flag is active', () => {
  assert.equal(shouldDisplaySkeleton({}), false);
  assert.equal(shouldDisplaySkeleton({ isInitialLoading: true }), true);
  assert.equal(shouldDisplaySkeleton({ isMonthChanging: true }), true);
  assert.equal(shouldDisplaySkeleton({ isTabChanging: true }), true);
  assert.equal(shouldDisplaySkeleton({ isImportingBackup: true }), true);
  assert.equal(shouldDisplaySkeleton({ isTripChanging: true }), true);
  assert.equal(shouldDisplaySkeleton({ isChartProcessing: true }), true);
});

test('getSkeletonItemCount returns ergonomic counts for mobile and desktop views', () => {
  assert.equal(getSkeletonItemCount('transactions', true), 5);
  assert.equal(getSkeletonItemCount('transactions', false), 7);
  assert.equal(getSkeletonItemCount('kpis'), 4);
  assert.equal(getSkeletonItemCount('cards'), 2);
  assert.equal(getSkeletonItemCount('budgets', true), 3);
  assert.equal(getSkeletonItemCount('budgets', false), 5);
  assert.equal(getSkeletonItemCount('chartBars', true), 4);
  assert.equal(getSkeletonItemCount('chartBars', false), 7);
});
