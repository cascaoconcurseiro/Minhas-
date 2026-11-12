import assert from 'node:assert/strict';
import test from 'node:test';
import type { CreditCard, Transaction } from '../types/finance';
import { analyzeCard, bestPurchaseDayFor, recommendCardForPurchase, analyzeCards } from './cardIntelligence';

const card = (over: Partial<CreditCard> = {}): CreditCard => ({
  id: 'c1', name: 'Nubank', brand: 'Mastercard', limit: 5000, closingDay: 20, dueDay: 28,
  defaultAccountId: 'a1', color: '#000', ...over,
});

const purchase = (id: string, date: string, amount: number, cardId = 'c1'): Transaction => ({
  id, date, description: id, amount, type: 'expense', status: 'pending', paymentMethod: 'credit_card',
  accountId: 'a1', categoryId: 'cat', creditCardId: cardId, competenceMonth: date.slice(0, 7), recurrence: 'single',
} as Transaction);

test('melhor dia de compra é o dia seguinte ao fechamento', () => {
  assert.equal(bestPurchaseDayFor(card({ closingDay: 20 })), 21);
  assert.equal(bestPurchaseDayFor(card({ closingDay: 30 })), 1);
});

test('compra de hoje antes do fechamento vence no mesmo mês e conta os dias', () => {
  const info = analyzeCard(card(), [], '2026-11-12');
  assert.equal(info.dueDateIfBoughtToday, '2026-11-28');
  assert.equal(info.daysToPayIfBoughtToday, 16);
  assert.equal(info.bestPurchaseDay, 21);
});

test('compra de hoje depois do fechamento vai para a fatura seguinte', () => {
  const info = analyzeCard(card(), [], '2026-11-25');
  assert.equal(info.dueDateIfBoughtToday, '2026-12-28');
  assert.equal(info.daysToPayIfBoughtToday, 33);
});

test('projeção usa a média das faturas anteriores quando a atual está abaixo', () => {
  const txs = [
    purchase('a', '2026-08-10', 1000), purchase('b', '2026-09-10', 2000), purchase('c', '2026-10-10', 3000),
    purchase('d', '2026-11-05', 500),
  ];
  const info = analyzeCard(card({ dueDay: 28 }), txs, '2026-11-12');
  assert.equal(info.openInvoiceTotal, 500);
  assert.equal(info.historyMonths, 3);
  assert.equal(info.projectedInvoiceTotal, 2000);
});

test('projeção mantém o valor atual quando já passou da média e sem histórico', () => {
  const info = analyzeCard(card(), [purchase('d', '2026-11-05', 700)], '2026-11-12');
  assert.equal(info.historyMonths, 0);
  assert.equal(info.projectedInvoiceTotal, 700);
});

test('recomenda o cartão com mais dias até pagar e que tem limite', () => {
  const insights = analyzeCards(
    [card(), card({ id: 'c2', name: 'Inter', closingDay: 5, dueDay: 12, limit: 3000 })],
    [],
    '2026-11-12'
  );
  const rec = recommendCardForPurchase(insights);
  assert.equal(rec?.cardName, 'Inter');
  assert.equal(rec?.daysToPay, 30);
  assert.equal(recommendCardForPurchase(insights, 4000)?.cardName, 'Nubank');
  assert.equal(recommendCardForPurchase(insights, 9000), null);
});

test('sem recomendação com um único cartão', () => {
  assert.equal(recommendCardForPurchase(analyzeCards([card()], [], '2026-11-12')), null);
});
