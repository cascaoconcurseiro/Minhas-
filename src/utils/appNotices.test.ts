import assert from 'node:assert/strict';
import test from 'node:test';
import type { CardCommitmentMonth } from './cardCommitment';
import type { CashForecast } from './cashForecast';
import type { DataHealthIssue } from './dataHealth';
import { buildAppNotices, countBellNotices } from './appNotices';

const forecast = (negative: boolean): CashForecast => ({
  points: [{ date: '2026-12-05', balance: -649.59, delta: -649.59 }], startBalance: 0, endBalance: -649.59,
  lowPoint: { date: '2026-12-05', balance: -649.59 },
  firstNegative: negative ? { date: '2026-12-05', balance: -649.59 } : null, horizonDays: 45,
});
const health: DataHealthIssue[] = [
  { id: 'account_without_balance', severity: 'info', title: 'Contas sem saldo e sem movimento', detail: 'Conta corrente: informe o saldo inicial.', count: 1 },
  { id: 'uncategorized', severity: 'warn', title: 'Lançamentos sem categoria', detail: '2 lançamentos estão sem categoria válida.', count: 2 },
];
const commitment = (month: string, status: 'warning' | 'over'): CardCommitmentMonth => ({
  month, income: 5000, cardTotal: 2000, installmentTotal: 800, otherTotal: 1200, cardPercent: 40, installmentPercent: 16, status,
});

test('sem nada a avisar a lista é vazia', () => {
  assert.deepEqual(buildAppNotices({ forecast: forecast(false), dataHealthIssues: [], commitmentAlerts: [] }), []);
});

test('junta previsão, cartão e dados para revisar numa lista só, do mais grave para o menos grave', () => {
  const notices = buildAppNotices({
    forecast: forecast(true), dataHealthIssues: health,
    commitmentAlerts: [commitment('2026-12', 'over'), commitment('2027-01', 'warning')], commitmentLimitPercent: 30,
  });
  assert.deepEqual(notices.map((n) => n.id), [
    'forecast-negative', 'commitment-2026-12', 'commitment-2027-01', 'health-uncategorized', 'health-account_without_balance',
  ]);
  assert.deepEqual(notices.map((n) => n.tone), ['danger', 'danger', 'warn', 'warn', 'info']);
  assert.match(notices[0].title, /negativo em 05\/12/);
  assert.match(notices[1].title, /Cartão em 40% da renda em dezembro de 2026/i);
  assert.match(notices[1].detail ?? '', /acima do seu limite de 30%/);
  assert.match(notices[2].detail ?? '', /perto do seu limite de 30%/);
});

test('a bolinha do sino conta só os avisos que pedem atenção, não os informativos', () => {
  const notices = buildAppNotices({ forecast: forecast(true), dataHealthIssues: health });
  assert.equal(notices.length, 3);
  assert.equal(countBellNotices(notices), 2);
});
