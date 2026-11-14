import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, InvestmentAsset, SavingsGoal } from '../types/finance';
import { formatBRL, getLocalDateISO, simulateFixedIncomeBR } from '../utils/financeRules';
import { GoalsAndSimulatorTab } from './GoalsAndSimulatorTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const existingGoal: SavingsGoal = {
  id: 'goal-synthetic',
  name: 'Reserva sintética',
  targetAmount: 5000,
  currentAmount: 1500,
  deadline: '2027-06-30',
  monthlyContribution: 75,
  indexer: 'CDI_100',
  category: 'Segurança',
};

function renderGoalsTab(options: {
  goals?: SavingsGoal[];
  onAddGoal?: (goal: Omit<SavingsGoal, 'id'>) => void;
  onUpdateGoal?: (goal: SavingsGoal) => void;
  onDeleteGoal?: (goalId: string) => void;
  accounts?: BankAccount[];
  investments?: InvestmentAsset[];
  onContributeGoal?: (goalId: string, amount: number, debitAccountId?: string, date?: string) => void;
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(GoalsAndSimulatorTab, {
        goals: options.goals ?? [],
        investments: options.investments ?? [],
        accounts: options.accounts ?? [],
        onContributeGoal: options.onContributeGoal ?? (() => {}),
        onAddGoal: options.onAddGoal ?? (() => {}),
        onUpdateGoal: options.onUpdateGoal ?? (() => {}),
        onDeleteGoal: options.onDeleteGoal ?? (() => {}),
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('GoalsAndSimulatorTab rejects invalid goals and creates one with parsed BRL values', async () => {
  const createdGoals: Array<Omit<SavingsGoal, 'id'>> = [];
  const page = renderGoalsTab({ onAddGoal: (goal) => { createdGoals.push(goal); } });
  const openFormButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === 'Nova Meta');
  assert.ok(openFormButton);

  await act(async () => { openFormButton.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  const nameInput = page.querySelector<HTMLInputElement>('#goal-name');
  const targetInput = page.querySelector<HTMLInputElement>('#goal-target');
  const monthlyInput = page.querySelector<HTMLInputElement>('#goal-monthly');
  assert.ok(form && nameInput && targetInput && monthlyInput);

  await act(async () => {
    setInputValue(nameInput, 'Meta sem alvo');
    setInputValue(targetInput, '0');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(createdGoals.length, 0, 'alvo igual a zero não deve criar uma meta');

  await act(async () => {
    setInputValue(nameInput, '  Viagem Teste  ');
    setInputValue(targetInput, '1.234,56');
    setInputValue(monthlyInput, '100,00');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(createdGoals.length, 1);
  const createdGoal = createdGoals[0]!;
  assert.equal(createdGoal.name, 'Viagem Teste');
  assert.equal(createdGoal.targetAmount, 1234.56);
  assert.equal(createdGoal.currentAmount, 0);
  assert.equal(createdGoal.monthlyContribution, 100);
  assert.equal(createdGoal.indexer, 'TESOURO_SELIC');
  assert.equal(createdGoal.category, 'Sonhos & Patrimônio');
  assert.match(createdGoal.deadline, /^\d{4}-\d{2}-\d{2}$/);
});

test('goal money inputs keep digits as typed (grouped) and finalize two decimal places on blur', async () => {
  const page = renderGoalsTab({});
  const openFormButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === 'Nova Meta');
  assert.ok(openFormButton);
  await act(async () => { openFormButton.click(); });

  const amountInput = page.querySelector<HTMLInputElement>('#goal-target');
  assert.ok(amountInput);
  await act(async () => {
    amountInput.focus();
    setInputValue(amountInput, '1000');
  });
  assert.equal(amountInput.value, '1.000');

  await act(async () => { amountInput.blur(); });
  assert.equal(amountInput.value, '1.000,00');
});

test('GoalsAndSimulatorTab edits an existing synthetic goal and preserves its id', async () => {
  const updatedGoals: SavingsGoal[] = [];
  const page = renderGoalsTab({
    goals: [existingGoal],
    onUpdateGoal: (goal) => { updatedGoals.push(goal); },
  });
  const editButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Editar meta ${existingGoal.name}"]`
  );
  assert.ok(editButton);

  await act(async () => { editButton.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  const nameInput = page.querySelector<HTMLInputElement>('#goal-name');
  const targetInput = page.querySelector<HTMLInputElement>('#goal-target');
  assert.ok(form && nameInput && targetInput);

  await act(async () => {
    setInputValue(nameInput, 'Reserva atualizada');
    setInputValue(targetInput, '6.000,00');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(updatedGoals.length, 1);
  const updatedGoal = updatedGoals[0]!;
  assert.equal(updatedGoal.id, existingGoal.id);
  assert.equal(updatedGoal.name, 'Reserva atualizada');
  assert.equal(updatedGoal.targetAmount, 6000);
  assert.equal(updatedGoal.currentAmount, existingGoal.currentAmount);
});

test('GoalsAndSimulatorTab routes deletion of a synthetic goal to its callback', async () => {
  let deletedGoalId = '';
  const page = renderGoalsTab({
    goals: [existingGoal],
    onDeleteGoal: (goalId) => { deletedGoalId = goalId; },
  });
  const deleteButton = page.querySelector<HTMLButtonElement>(
    `[aria-label="Excluir meta ${existingGoal.name}"]`
  );
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });

  assert.equal(deletedGoalId, existingGoal.id);
});

test('new goal form closes and cancels without calling the create callback', async () => {
  let addCalls = 0;
  const page = renderGoalsTab({ onAddGoal: () => { addCalls += 1; } });
  const toggleButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.trim() === 'Nova Meta');
  assert.ok(toggleButton);

  await act(async () => { toggleButton.click(); });
  assert.ok(page.querySelector('form'));
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar')?.click();
  });
  assert.equal(page.querySelector('form'), null);
  assert.equal(addCalls, 0);

  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Nova Meta')?.click();
  });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Fechar Formulário')?.click();
  });
  assert.equal(page.querySelector('form'), null);
  assert.equal(addCalls, 0);
});

test('linked investment controls the saved goal balance and is included on create', async () => {
  const investment: InvestmentAsset = {
    id: 'asset-synthetic', ticker: 'QA1', name: 'Ativo sintético', assetClass: 'acoes_br',
    institution: 'Corretora de teste', quantity: 2.5, averagePrice: 100, currentPrice: 123.456,
    indexerLabel: 'Ação', liquidity: 'D+2 (Bolsa B3)', monthlyYieldPercent: 0,
    isTaxExempt: false,
  };
  const createdGoals: Array<Omit<SavingsGoal, 'id'>> = [];
  const page = renderGoalsTab({ investments: [investment], onAddGoal: (goal) => createdGoals.push(goal) });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Nova Meta')?.click();
  });

  const nameInput = page.querySelector<HTMLInputElement>('#goal-name');
  const targetInput = page.querySelector<HTMLInputElement>('#goal-target');
  const currentInput = page.querySelector<HTMLInputElement>('#goal-current');
  const assetSelect = page.querySelector<HTMLSelectElement>('#goal-linked-asset');
  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(nameInput && targetInput && currentInput && assetSelect && form);

  await act(async () => {
    setInputValue(nameInput, 'Meta vinculada');
    setInputValue(targetInput, '1.000,00');
    assetSelect.value = investment.id;
    assetSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(currentInput.disabled, true);
  assert.equal(currentInput.value, '308,64');

  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(createdGoals.length, 1);
  assert.equal(createdGoals[0]?.currentAmount, 308.64);
  assert.equal(createdGoals[0]?.linkedAssetId, investment.id);
});

test('goal contribution sends the edited amount and selected account', async () => {
  const account: BankAccount = { id: 'goal-account', name: 'Conta sintética', institution: 'Teste', type: 'checking', initialBalance: 0, color: '#000', includeInTotal: true };
  const calls: Array<[string, number, string?, string?]> = [];
  const page = renderGoalsTab({ goals: [{ ...existingGoal, linkedAssetId: 'asset' }], accounts: [account], onContributeGoal: (...args) => calls.push(args) });
  await act(async () => { [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Registrar Aporte'))!.click(); });
  await act(async () => { setInputValue(page.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-10-08'); });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>(`[aria-label="Valor do aporte para ${existingGoal.name}"]`)!, '250,75');
    page.querySelector<HTMLSelectElement>('[aria-label="Conta para debitar o aporte"]')!.value = account.id;
    page.querySelector<HTMLSelectElement>('[aria-label="Conta para debitar o aporte"]')!.dispatchEvent(new window.Event('change', { bubbles: true }));
    [...page.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Confirmar')!.click();
  });
  assert.deepEqual(calls, [[existingGoal.id, 250.75, account.id, '2026-10-08']]);
});

test('unlinked goal reserves existing money without offering a bank debit', async () => {
  const account: BankAccount = { id: 'bank', name: 'Banco', institution: 'Teste', type: 'checking', initialBalance: 1000, color: '#000', includeInTotal: true };
  const calls: Array<[string, number, string?, string?]> = [];
  const page = renderGoalsTab({ goals: [existingGoal], accounts: [account], onContributeGoal: (...args) => calls.push(args) });
  await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.includes('Registrar Aporte'))!.click(); });
  assert.equal(page.querySelector('[aria-label="Conta para debitar o aporte"]'), null);
  assert.match(page.textContent!, /Reserva do dinheiro existente/);
  await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Confirmar')!.click(); });
  assert.deepEqual(calls, [[existingGoal.id, 75, undefined, getLocalDateISO()]]);
});

test('goal contribution keeps the editor open and reports an invalid date', async () => {
  let calls = 0;
  const page = renderGoalsTab({ goals: [{ ...existingGoal, linkedAssetId: 'asset' }], onContributeGoal: () => { calls++; } });
  await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.includes('Registrar Aporte'))!.click(); });
  await act(async () => { setInputValue(page.querySelector<HTMLInputElement>('input[type="date"]')!, ''); });
  await act(async () => { [...page.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Confirmar')!.click(); });
  assert.equal(calls, 0);
  assert.match(page.querySelector('[role="alert"]')!.textContent!, /data válida/);
  assert.ok(page.querySelector('input[type="date"]'));
});

test('goal contribution rejects nonpositive or unparseable values and closes the editor', async () => {
  const calls: Array<[string, number, string?, string?]> = [];
  const page = renderGoalsTab({ goals: [existingGoal], onContributeGoal: (...args) => calls.push(args) });
  const openContribution = () => [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Registrar Aporte'));

  await act(async () => { openContribution()?.click(); });
  const amountInput = page.querySelector<HTMLInputElement>(`[aria-label="Valor do aporte para ${existingGoal.name}"]`);
  assert.ok(amountInput);
  await act(async () => {
    setInputValue(amountInput, '0,00');
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Confirmar')?.click();
  });
  assert.equal(calls.length, 0);
  assert.equal(page.querySelector(`[aria-label="Valor do aporte para ${existingGoal.name}"]`), null);

  await act(async () => { openContribution()?.click(); });
  const invalidAmountInput = page.querySelector<HTMLInputElement>(`[aria-label="Valor do aporte para ${existingGoal.name}"]`);
  assert.ok(invalidAmountInput);
  await act(async () => {
    setInputValue(invalidAmountInput, 'texto inválido');
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Confirmar')?.click();
  });
  assert.equal(calls.length, 0);
  assert.equal(page.querySelector(`[aria-label="Valor do aporte para ${existingGoal.name}"]`), null);
});

test('goal contribution can be cancelled without calling the contribution callback', async () => {
  let contributionCalls = 0;
  const page = renderGoalsTab({ goals: [existingGoal], onContributeGoal: () => { contributionCalls += 1; } });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Registrar Aporte'))?.click();
  });
  assert.ok(page.querySelector(`[aria-label="Valor do aporte para ${existingGoal.name}"]`));

  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar')?.click();
  });
  assert.equal(contributionCalls, 0);
  assert.equal(page.querySelector(`[aria-label="Valor do aporte para ${existingGoal.name}"]`), null);
});

test('goal cards show progress alerts and completed-state messaging', () => {
  const completedGoal: SavingsGoal = {
    ...existingGoal,
    id: 'goal-completed',
    name: 'Meta completa sintética',
    targetAmount: 1500,
    currentAmount: 1500,
  };
  const nearGoal: SavingsGoal = {
    ...existingGoal,
    id: 'goal-near-complete',
    name: 'Meta quase completa sintética',
    currentAmount: 4200,
  };
  const page = renderGoalsTab({ goals: [nearGoal, completedGoal] });

  assert.match(page.textContent ?? '', /Alerta de Progresso: Reta final \(84% concluído\)/);
  assert.match(page.textContent ?? '', /faltam apenas R\$\s*800,00/);
  assert.match(page.textContent ?? '', /Meta 100% atingida!/);
});

test('simulator controls update the estimate when amount, term, and tax exemption change', async () => {
  const page = renderGoalsTab({});
  const initialEstimate = page.textContent?.match(/Saldo Líquido Estimado[\s\S]{0,120}/)?.[0];
  assert.ok(initialEstimate);
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#sim-initial')!, '10.000,00');
    setInputValue(page.querySelector<HTMLInputElement>('#sim-monthly')!, '500,00');
    const term = page.querySelector<HTMLSelectElement>('#sim-months')!;
    term.value = '60';
    term.dispatchEvent(new window.Event('change', { bubbles: true }));
    const exempt = [...page.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) => input.parentElement?.textContent?.includes('Isento de IR'))!;
    exempt.click();
  });
  assert.notEqual(page.textContent?.match(/Saldo Líquido Estimado[\s\S]{0,120}/)?.[0], initialEstimate);
  assert.match(page.textContent ?? '', /60 meses/);
});

test('simulator annual rate and CDI multiplier each recalculate the displayed estimate', async () => {
  const page = renderGoalsTab({});
  const initialEstimate = page.querySelector('.text-2xl.font-bold')?.textContent;
  assert.ok(initialEstimate);

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#sim-initial')!, '10.000,00');
    setInputValue(page.querySelector<HTMLInputElement>('#sim-cdi-rate')!, '5,00');
  });
  const lowerRateEstimate = page.querySelector('.text-2xl.font-bold')?.textContent;
  assert.ok(lowerRateEstimate);
  assert.notEqual(lowerRateEstimate, initialEstimate);

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#sim-cdi-mult')!, '110');
  });
  const higherMultiplierEstimate = page.querySelector('.text-2xl.font-bold')?.textContent;
  assert.ok(higherMultiplierEstimate);
  assert.notEqual(higherMultiplierEstimate, lowerRateEstimate);
});

test('simulator DOM displays the computed net balance, invested total, and IR rate', async () => {
  const page = renderGoalsTab({});
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('#sim-initial')!, '10.000,00');
    setInputValue(page.querySelector<HTMLInputElement>('#sim-monthly')!, '500,00');
    const term = page.querySelector<HTMLSelectElement>('#sim-months')!;
    term.value = '12';
    term.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('#sim-cdi-rate')!, '11,25');
    setInputValue(page.querySelector<HTMLInputElement>('#sim-cdi-mult')!, '100');
  });

  const expected = simulateFixedIncomeBR({
    initialAmount: 10000,
    monthlyContribution: 500,
    months: 12,
    cdiAnnualRatePercent: 11.25,
    cdiMultiplierPercent: 100,
    isTaxExempt: false,
  });
  assert.equal(page.querySelector('.text-2xl.font-bold')?.textContent, formatBRL(expected.netBalanceCdi));
  assert.ok(page.textContent?.includes(formatBRL(expected.totalInvested)));
  assert.ok(page.textContent?.includes(`${expected.irRatePercent}% (${formatBRL(expected.irTaxAmount)})`));
});
