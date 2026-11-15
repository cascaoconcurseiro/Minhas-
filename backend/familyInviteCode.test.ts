import test from 'node:test';
import assert from 'node:assert/strict';

process.env.AUTH_SESSION_SECRET = 'test-session-secret-with-more-than-32-chars';
const { deriveFamilyInviteCode, isFamilyInviteCodeValid, normalizeFamilyInviteCode } = await import('./authSession.ts');

const created = '2026-11-08T02:11:24.136Z';

test('o código é estável, tem 8 letras/números sem confusão e é mostrado em dois blocos', () => {
  const code = deriveFamilyInviteCode('inv-1', created);
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(deriveFamilyInviteCode('inv-1', created), code);
  assert.equal(deriveFamilyInviteCode('inv-1', new Date(created)), code, 'data como texto ou como Date dá o mesmo código');
});

test('cada convite tem um código diferente', () => {
  assert.notEqual(deriveFamilyInviteCode('inv-1', created), deriveFamilyInviteCode('inv-2', created));
  assert.notEqual(deriveFamilyInviteCode('inv-1', created), deriveFamilyInviteCode('inv-1', '2026-11-09T00:00:00.000Z'));
});

test('aceita o código com ou sem hífen, em qualquer caixa, com espaços', () => {
  const code = deriveFamilyInviteCode('inv-1', created);
  const compact = code.replace('-', '');
  for (const typed of [code, compact, code.toLowerCase(), ` ${compact.toLowerCase()} `, `${compact.slice(0, 4)} ${compact.slice(4)}`]) {
    assert.equal(isFamilyInviteCodeValid(typed, 'inv-1', created), true, typed);
  }
});

test('recusa código errado, vazio, de outro convite e valores que não são texto', () => {
  const other = deriveFamilyInviteCode('inv-2', created);
  for (const typed of ['AAAA-AAAA', '', '   ', other, 12345678, null, undefined, {}, ['ABCD-EFGH']]) {
    assert.equal(isFamilyInviteCodeValid(typed, 'inv-1', created), false, String(typed));
  }
});

test('normalização tira o que não é letra ou número e põe em maiúsculas', () => {
  assert.equal(normalizeFamilyInviteCode(' ab-cd 23!'), 'ABCD23');
  assert.equal(normalizeFamilyInviteCode(42), '');
});
