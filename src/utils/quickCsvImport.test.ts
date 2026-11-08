import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickCsvLines } from './quickCsvImport';

test('reconhece despesa em todos os formatos de sinal', () => {
  for (const v of ['-34,90', 'R$ -34,90', 'R$-34,90', '-R$ 34,90', '34,90-', '(34,90)']) {
    const { valid } = parseQuickCsvLines(`2026-10-22;Padaria;${v}`);
    assert.equal(valid.length, 1, v);
    assert.equal(valid[0].isNegative, true, v);
    assert.equal(valid[0].amount, 34.9, v);
  }
});

test('valor positivo continua receita', () => {
  const { valid } = parseQuickCsvLines('2026-10-22;Freela;R$ 1.234,56');
  assert.equal(valid[0].isNegative, false);
  assert.equal(valid[0].amount, 1234.56);
});

test('lote misto separa linhas rejeitadas', () => {
  const { valid, rejected } = parseQuickCsvLines(
    '2026-10-22;Padaria;-34,90\n22/10/2026;Data ruim;-10,00\n2026-02-30;Dia inexistente;5,00\nsem separador'
  );
  assert.equal(valid.length, 1);
  assert.deepEqual(rejected, ['22/10/2026;Data ruim;-10,00', '2026-02-30;Dia inexistente;5,00', 'sem separador']);
});
