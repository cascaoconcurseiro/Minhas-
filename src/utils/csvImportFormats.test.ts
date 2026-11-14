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

test('extrato grande: conferência de duplicidade com índice dá o mesmo resultado e é rápida', async () => {
  const { prepareReconciliationCandidates, checkItemDuplicate, buildDuplicateLookup } = await import('./ofxParser');
  const existing = Array.from({ length: 3000 }, (_, i) => ({
    id: `e${i}`, description: `Loja ${i % 200}`, amount: 10 + (i % 90), date: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`,
    competenceMonth: '2026-10', type: 'expense', status: 'paid', categoryId: 'x', accountId: 'a', recurrence: 'single', paymentMethod: 'pix',
    fitid: i % 7 === 0 ? `fit-${i}` : undefined,
  })) as unknown as Transaction[];
  const lookup = buildDuplicateLookup(existing);
  const samples = [
    { fitid: 'fit-14', date: '2026-10-03', amount: 99, description: 'qualquer', rawType: 'expense' as const },
    { fitid: 'n1', date: '2026-10-05', amount: 14, description: 'Loja 4', rawType: 'expense' as const },
    { fitid: 'n2', date: '2026-10-05', amount: 1234.5, description: 'Loja nova', rawType: 'expense' as const },
  ];
  for (const sample of samples) {
    assert.deepEqual(checkItemDuplicate(sample, existing, 'a', 'BRL', undefined, undefined, lookup), checkItemDuplicate(sample, existing, 'a'));
  }
  const items = Array.from({ length: 2000 }, (_, i) => ({ fitid: `n${i}`, date: `2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, amount: 5 + (i % 500), description: `Loja ${i % 250}`, rawType: 'expense' as const }));
  const started = performance.now();
  const result = prepareReconciliationCandidates(items, existing, [], 'a', [], {}, []);
  assert.equal(result.length, 2000);
  assert.ok(performance.now() - started < 3000, 'importar 2.000 linhas deve levar poucos segundos');
});
