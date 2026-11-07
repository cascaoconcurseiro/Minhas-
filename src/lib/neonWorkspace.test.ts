import assert from 'node:assert/strict';
import test from 'node:test';
import {NeonWorkspaceError, parseNeonWorkspaceSnapshot} from './neonWorkspace';

const validSnapshot = {
  payload: {
    uid: 'vault_uid_test-12345',
    updatedAt: '2026-11-07T15:00:00.000Z',
    accountsJson: '[]',
    cardsJson: '[]',
    categoriesJson: '[]',
    transactionsJson: '[]',
    goalsJson: '[]',
    investmentsJson: '[]',
  },
  revision: 1,
  updatedAt: '2026-11-07T15:00:00.000Z',
};

test('accepts an empty workspace only when Neon returns its core collections and revision', () => {
  assert.deepEqual(parseNeonWorkspaceSnapshot(validSnapshot), validSnapshot);
});

test('rejects a 200-style response with an absent or empty payload before it can unlock hydration', () => {
  for (const incomplete of [
    {revision: 1, updatedAt: validSnapshot.updatedAt},
    {payload: {}, revision: 1, updatedAt: validSnapshot.updatedAt},
    {
      payload: {...validSnapshot.payload, goalsJson: undefined},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, investmentsJson: null},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, uid: ''},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
    {
      payload: {...validSnapshot.payload, updatedAt: undefined},
      revision: 1,
      updatedAt: validSnapshot.updatedAt,
    },
  ]) {
    assert.throws(
      () => parseNeonWorkspaceSnapshot(incomplete),
      (error: unknown) => error instanceof NeonWorkspaceError && error.status === 502
    );
  }
});

test('rejects missing revision metadata instead of treating an unversioned response as saved', () => {
  assert.throws(
    () => parseNeonWorkspaceSnapshot({...validSnapshot, revision: 0}),
    (error: unknown) => error instanceof NeonWorkspaceError && error.status === 502
  );
});
