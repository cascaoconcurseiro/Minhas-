import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('keeps every React hook above the empty-card early return', () => {
  const source = readFileSync(new URL('./CreditCardsTab.tsx', import.meta.url), 'utf8');
  const emptyStateReturn = source.indexOf('if (!activeCard || !activeSummary) {');

  assert.notEqual(emptyStateReturn, -1, 'expected the empty-card state guard');
  assert.doesNotMatch(
    source.slice(emptyStateReturn),
    /\buse(?:State|Effect|Memo|Callback|Ref|Reducer|Id|Context|ImperativeHandle|LayoutEffect|InsertionEffect)\s*\(/,
    'hooks after the guard change hook order when the first card is added'
  );
});
