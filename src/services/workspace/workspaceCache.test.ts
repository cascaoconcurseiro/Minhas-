import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCachedWorkspace } from './workspaceCache';

const valid = {
  accounts: [], cards: [], categories: [], transactions: [], goals: [], familyMembers: [],
  investments: [], trips: [], investmentTargets: { 'Renda Fixa': 100 }, settings: { theme: 'light' },
};

test('parseCachedWorkspace accepts a complete saved copy', () => {
  const parsed = parseCachedWorkspace(JSON.stringify(valid));
  assert.ok(parsed);
  assert.deepEqual(parsed.transactions, []);
  assert.deepEqual(parsed.investmentTargets, { 'Renda Fixa': 100 });
});

test('parseCachedWorkspace fills optional collections from older copies', () => {
  const { goals, familyMembers, investments, trips, investmentTargets, ...older } = valid;
  void goals; void familyMembers; void investments; void trips; void investmentTargets;
  const parsed = parseCachedWorkspace(JSON.stringify(older));
  assert.ok(parsed);
  assert.deepEqual(parsed.goals, []);
  assert.equal(parsed.investmentTargets, null);
});

test('parseCachedWorkspace rejects missing, corrupted or incomplete copies', () => {
  assert.equal(parseCachedWorkspace(null), null);
  assert.equal(parseCachedWorkspace(''), null);
  assert.equal(parseCachedWorkspace('{nope'), null);
  assert.equal(parseCachedWorkspace('[]'), null);
  assert.equal(parseCachedWorkspace(JSON.stringify({ ...valid, transactions: 'x' })), null);
  assert.equal(parseCachedWorkspace(JSON.stringify({ ...valid, accounts: undefined })), null);
  assert.equal(parseCachedWorkspace(JSON.stringify({ ...valid, settings: null })), null);
  assert.equal(parseCachedWorkspace(JSON.stringify({ ...valid, goals: {} })), null);
});
