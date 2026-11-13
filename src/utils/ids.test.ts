import assert from 'node:assert/strict';
import test from 'node:test';
import { newEntityId } from './ids';

test('entity ids keep their prefix and never repeat, even created in the same millisecond', () => {
  const ids = Array.from({ length: 2000 }, () => newEntityId('acc'));
  assert.ok(ids.every((id) => id.startsWith('acc-')));
  assert.equal(new Set(ids).size, ids.length);
});
