import assert from 'node:assert/strict';
import test from 'node:test';
import { checkItemDuplicate, parseBankAmount, parseBankStatement } from './ofxParser';
import type { Transaction } from '../types/finance';

const rows = (csv: string) => parseBankStatement(csv).items.map((i) => [i.date, i.amount, i.rawType, i.description]);

test('colunas separadas de débito e crédito: débito sai e crédito entra', () => {
  assert.deepEqual(
    rows('Data;Descrição;Débito;Crédito\n21/10/2026;Padaria;12,30;\n22/10/2026;Salário;;3000,00'),
    [['2026-10-21', 12.3, 'expense', 'Padaria'], ['2026-10-22', 3000, 'income', 'Salário']]
  );
});

test('coluna D/C marca a saída de um valor sem sinal', () => {
  assert.deepEqual(
    rows('Data;Descrição;Valor;D/C\n21/10/2026;Padaria;12,30;D\n22/10/2026;Salário;3000,00;C'),
    [['2026-10-21', 12.3, 'expense', 'Padaria'], ['2026-10-22', 3000, 'income', 'Salário']]
  );
});

test('valores com R$, parênteses e sinal no fim', () => {
  assert.equal(parseBankAmount('-R$ 12,30'), -12.3);
  assert.equal(parseBankAmount('R$ 3.000,00'), 3000);
  assert.equal(parseBankAmount('(12,30)'), -12.3);
  assert.equal(parseBankAmount('12,30-'), -12.3);
});

test('histórico e descrição separados são juntados', () => {
  assert.equal(
    parseBankStatement('Data Lançamento;Histórico;Descrição;Valor\n21/10/2026;Pix enviado;JOAO;-45,90').items[0].description,
    'Pix enviado - JOAO'
  );
});

test('linhas de CSV sem ID não colidem com as de outro arquivo', () => {
  const first = parseBankStatement('Data;Descrição;Valor\n21/10/2026;Padaria;-12,30\n22/10/2026;Mercado;-50,00').items;
  const second = parseBankStatement('Data;Descrição;Valor\n25/10/2026;Farmácia;-30,00\n26/10/2026;Posto;-80,00').items;
  assert.notEqual(first[0].fitid, second[0].fitid);
  const stored = first.map((item) => ({ id: item.fitid, fitid: item.fitid, description: item.description, amount: item.amount, date: item.date, type: 'expense' })) as unknown as Transaction[];
  assert.equal(checkItemDuplicate(second[0], stored).isDuplicate, false);
  assert.equal(checkItemDuplicate(first[0], stored).isDuplicate, true);
  const legacy = [{ id: 'old', fitid: 'csv-row-1', description: 'Outra coisa', amount: 1, date: '2026-01-01', type: 'expense' }] as unknown as Transaction[];
  assert.equal(checkItemDuplicate({ ...second[0], fitid: 'csv-row-1' }, legacy).isDuplicate, false);
});
