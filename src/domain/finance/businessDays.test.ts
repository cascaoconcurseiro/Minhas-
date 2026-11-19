import test from 'node:test';
import assert from 'node:assert/strict';
import { getEasterSunday, getNextBankBusinessDay, isBankBusinessDay } from './businessDays.ts';

test('Páscoa calculada corretamente em anos conhecidos', () => {
  assert.equal(getEasterSunday(2025).toISOString().slice(0, 10), '2025-04-20');
  assert.equal(getEasterSunday(2026).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(getEasterSunday(2027).toISOString().slice(0, 10), '2027-03-28');
});

test('fim de semana e feriados bancários não são dia útil', () => {
  assert.equal(isBankBusinessDay('2026-12-04'), true, 'sexta comum');
  assert.equal(isBankBusinessDay('2026-12-05'), false, 'sábado');
  assert.equal(isBankBusinessDay('2026-12-06'), false, 'domingo');
  assert.equal(isBankBusinessDay('2026-12-25'), false, 'Natal');
  assert.equal(isBankBusinessDay('2026-11-20'), false, 'Consciência Negra (nacional desde 2024)');
  assert.equal(isBankBusinessDay('2026-02-16'), false, 'segunda de Carnaval');
  assert.equal(isBankBusinessDay('2026-02-17'), false, 'terça de Carnaval');
  assert.equal(isBankBusinessDay('2026-02-18'), true, 'quarta de cinzas tem expediente');
  assert.equal(isBankBusinessDay('2026-04-03'), false, 'Sexta-feira Santa');
  assert.equal(isBankBusinessDay('2026-06-04'), false, 'Corpus Christi');
  assert.equal(isBankBusinessDay('data-ruim'), false);
});

test('vencimento vai para o próximo dia útil, atravessando feriado emendado', () => {
  assert.equal(getNextBankBusinessDay('2026-12-04'), '2026-12-04');
  assert.equal(getNextBankBusinessDay('2026-12-05'), '2026-12-07');
  assert.equal(getNextBankBusinessDay('2026-02-14'), '2026-02-18', 'sábado antes do Carnaval vai para quarta');
  assert.equal(getNextBankBusinessDay('2026-04-03'), '2026-04-06', 'Sexta Santa vai para segunda');
  assert.equal(getNextBankBusinessDay('2026-12-31'), '2026-12-31');
  assert.equal(getNextBankBusinessDay('2027-01-01'), '2027-01-04', '1º/01/2027 é sexta; fim de semana leva para segunda');
  assert.equal(getNextBankBusinessDay('nada'), 'nada');
});
