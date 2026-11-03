import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkspaceArray, parseWorkspaceObject } from './workspacePayload';

test('accepts empty and valid persisted workspace collections', () => {
  assert.deepEqual(parseWorkspaceArray('[]', [{ id: 'fallback' }], 'accountsJson'), []);
  assert.deepEqual(
    parseWorkspaceArray('[{"id":"acc-1"}]', [], 'accountsJson'),
    [{ id: 'acc-1' }]
  );
});

test('uses defaults only when optional persisted collections are absent', () => {
  const fallback = [{ id: 'default' }];
  assert.equal(parseWorkspaceArray(undefined, fallback, 'accountsJson'), fallback);
  assert.equal(parseWorkspaceArray(null, fallback, 'accountsJson'), fallback);
});

test('rejects malformed JSON and malformed collection entries instead of dropping data', () => {
  assert.throws(() => parseWorkspaceArray('{', [], 'transactionsJson'), /JSON inválido/);
  assert.throws(() => parseWorkspaceArray('{"id":"not-an-array"}', [], 'accountsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray('[null]', [], 'accountsJson'), /coleção inválida/);
  assert.throws(() => parseWorkspaceArray('[{"id":" "}]', [], 'accountsJson'), /coleção inválida/);
});

test('merges defaults with a valid persisted object and rejects damaged objects', () => {
  assert.deepEqual(
    parseWorkspaceObject('{"theme":"dark"}', { theme: 'light', density: 'comfortable' }, 'settingsJson'),
    { theme: 'dark', density: 'comfortable' }
  );
  assert.throws(() => parseWorkspaceObject('{', {}, 'settingsJson'), /JSON inválido/);
  assert.throws(() => parseWorkspaceObject('[]', {}, 'settingsJson'), /objeto inválido/);
});
