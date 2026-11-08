import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { Transaction, Trip, TripSettlement } from '../types/finance';
import { TripsTab } from './TripsTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTripsTab(options: {
  trips?: Trip[];
  onAddTrip?: (trip: Trip) => void;
  onUpdateTrip?: (trip: Trip) => void;
  onDeleteTrip?: (tripId: string) => void;
  transactions?: Transaction[];
  onRecordSettlement?: (tripId: string, settlement: TripSettlement) => void;
}) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(TripsTab, {
        getAuthToken: async () => 'synthetic-auth-token',
        trips: options.trips ?? [],
        transactions: options.transactions ?? [],
        categories: [],
        accounts: [],
        familyMembers: [],
        onAddTrip: options.onAddTrip ?? (() => {}),
        onUpdateTrip: options.onUpdateTrip ?? (() => {}),
        onDeleteTrip: options.onDeleteTrip ?? (() => {}),
        onAddExchangeLot: () => {},
        onDeleteExchangeLot: () => {},
        onRecordSettlement: options.onRecordSettlement ?? (() => {}),
        onOpenNewTripExpense: () => {},
        onEditTransaction: () => {},
        onDeleteTransaction: () => {},
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function createSyntheticTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-synthetic',
    name: 'Viagem sintética',
    destination: 'Lisboa',
    startDate: '2026-12-01',
    endDate: '2026-12-10',
    status: 'active',
    currency: 'EUR',
    defaultExchangeRate: 6.2,
    budgetForeign: 1500,
    participants: [
      { id: 'me', name: 'Você', isMe: true, color: '#059669' },
      { id: 'participant-synthetic', name: 'Acompanhante', color: '#ec4899' },
    ],
    exchangeLots: [],
    settlements: [],
    coverColor: '#0284c7',
    ...overrides,
  };
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('TripsTab validates and creates a synthetic trip with companions and currency details', async () => {
  const created: Trip[] = [];
  const page = renderTripsTab({ onAddTrip: (trip) => created.push(trip) });
  const openButton = page.querySelector<HTMLButtonElement>('[data-testid="create-first-trip-btn"]');
  assert.ok(openButton);

  await act(async () => { openButton.click(); });
  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(form);
  const textInputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
  assert.equal(textInputs.length, 5, 'the create form exposes name, destination, budget, rate, and companions');

  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(created.length, 0, 'an empty trip name must not create a trip');
  assert.ok(page.querySelector('[data-testid="create-first-trip-btn"]'), 'invalid submission leaves the form open');

  await act(async () => {
    setInputValue(textInputs[0]!, '  Viagem QA Sintética  ');
    setInputValue(textInputs[1]!, '  Porto  ');
    setInputValue(textInputs[2]!, '1.500,00');
    assert.equal(textInputs[2]?.value, '1.500,00', 'the selected foreign currency keeps grouped thousands while editing');
    setInputValue(textInputs[3]!, '6,30');
    setInputValue(textInputs[4]!, 'Ana, Bruno');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(created.length, 1);
  assert.equal(created[0]?.name, 'Viagem QA Sintética');
  assert.equal(created[0]?.destination, 'Porto');
  assert.equal(created[0]?.currency, 'EUR');
  assert.equal(created[0]?.budgetForeign, 1500);
  assert.equal(created[0]?.defaultExchangeRate, 6.3);
  assert.deepEqual(created[0]?.participants.map((person) => person.name), ['Você', 'Ana', 'Bruno']);
  assert.equal(created[0]?.participants[0]?.isMe, true);
  assert.equal(created[0]?.exchangeLots.length, 0);
  assert.equal(page.querySelector('form'), null, 'successful creation closes the modal');
});

test('new trip form labels focus and name all corresponding controls', async () => {
  const page = renderTripsTab({});
  const openButton = page.querySelector<HTMLButtonElement>('[data-testid="create-first-trip-btn"]');
  assert.ok(openButton);
  await act(async () => { openButton.click(); });

  const form = page.querySelector('form');
  assert.ok(form);
  for (const id of ['trip-form-name', 'trip-form-destination', 'trip-form-currency', 'trip-form-start-date', 'trip-form-end-date', 'trip-form-budget', 'trip-form-exchange-rate', 'trip-form-companions']) {
    const field: HTMLElement | null = form.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    const label = Array.from(form.querySelectorAll('label')).find((candidate) => candidate.control === field);
    assert.ok(label, `expected an associated label for #${id}`);
    field.focus();
    assert.equal(document.activeElement, field, `#${id} should be keyboard-focusable`);
  }
});

test('TripsTab edits a synthetic trip and reports the selected archive state', async () => {
  const original = createSyntheticTrip();
  const updated: Trip[] = [];
  const page = renderTripsTab({ trips: [original], onUpdateTrip: (trip) => updated.push(trip) });

  const card = page.querySelector<HTMLElement>('[data-testid="trip-card-trip-synthetic"]');
  assert.ok(card);
  await act(async () => { card.click(); });
  const editButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Editar Roteiro'));
  assert.ok(editButton);
  await act(async () => { editButton.click(); });

  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(form);
  const textInputs = form.querySelectorAll<HTMLInputElement>('input[type="text"]');
  assert.equal(textInputs.length, 5);
  const archiveToggle = form.querySelector<HTMLInputElement>('input[type="checkbox"]');
  assert.ok(archiveToggle);

  await act(async () => {
    setInputValue(textInputs[0]!, 'Viagem editada');
    setInputValue(textInputs[1]!, 'Coimbra');
    setInputValue(textInputs[4]!, 'Acompanhante, Carla');
    archiveToggle.click();
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0]?.id, original.id);
  assert.equal(updated[0]?.name, 'Viagem editada');
  assert.equal(updated[0]?.destination, 'Coimbra');
  assert.equal(updated[0]?.isArchived, true);
  assert.deepEqual(updated[0]?.participants.map((person) => person.name), ['Você', 'Acompanhante', 'Carla']);
});

test('TripsTab routes deletion of a synthetic trip through its callback', async () => {
  const trip = createSyntheticTrip();
  const deleted: string[] = [];
  const page = renderTripsTab({ trips: [trip], onDeleteTrip: (tripId) => deleted.push(tripId) });
  const deleteButton = page.querySelector<HTMLButtonElement>('[aria-label="Excluir viagem Viagem sintética"]');
  assert.ok(deleteButton);

  await act(async () => { deleteButton.click(); });
  assert.deepEqual(deleted, [trip.id]);
});

test('zero partial settlement is rejected instead of silently settling the full debt', async () => {
  const trip = createSyntheticTrip();
  const transaction: Transaction = {
    id: 'tx-trip-shared',
    description: 'Despesa compartilhada',
    amount: 620,
    date: '2026-12-02',
    competenceMonth: '2026-12',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-lazer',
    paymentMethod: 'debit_card',
    recurrence: 'single',
    tripId: trip.id,
    originalCurrency: 'EUR',
    originalAmount: 100,
    paidByParticipantId: 'me',
    tripShares: [
      { participantId: 'me', foreignShare: 50, brlShare: 310 },
      { participantId: 'participant-synthetic', foreignShare: 50, brlShare: 310 },
    ],
  };
  const recorded: TripSettlement[] = [];
  const page = renderTripsTab({
    trips: [trip],
    transactions: [transaction],
    onRecordSettlement: (_tripId, settlement) => recorded.push(settlement),
  });

  await act(async () => {
    page.querySelector<HTMLElement>('[data-testid="trip-card-trip-synthetic"]')?.click();
  });
  await act(async () => {
    Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('2. Divisão & Quem Deve'))?.click();
  });
  const settleButton = Array.from(page.querySelectorAll('button')).find((button) => button.textContent?.includes('Liquidar / Receber'));
  assert.ok(settleButton);
  await act(async () => { settleButton.click(); });

  const form = page.querySelector<HTMLFormElement>('form');
  assert.ok(form);
  const amountInput = form.querySelector<HTMLInputElement>('input[type="text"]');
  assert.ok(amountInput);
  await act(async () => {
    setInputValue(amountInput, '0');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(recorded.length, 0);
  assert.ok(page.querySelector('[role="dialog"]'), 'invalid amount keeps the settlement form open');
  assert.match(page.querySelector('[role="alert"]')?.textContent || '', /maior que zero/);
});
