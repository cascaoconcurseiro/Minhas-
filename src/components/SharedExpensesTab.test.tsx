import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { FamilyMember } from '../types/finance';
import { SharedExpensesTab } from './SharedExpensesTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm | null = null;

function renderSharedExpensesTab(
  onAddFamilyMember: (member: Omit<FamilyMember, 'id'>) => void,
  options: { familyMembers?: FamilyMember[]; onDeleteFamilyMember?: (memberId: string) => void } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(SharedExpensesTab, {
        selectedMonth: '2026-11',
        transactions: [],
        familyMembers: options.familyMembers ?? [],
        accounts: [],
        cards: [],
        categories: [],
        onAddFamilyMember,
        onUpdateFamilyMember: () => {},
        onDeleteFamilyMember: options.onDeleteFamilyMember ?? (() => {}),
        onSettleSharedTransaction: () => {},
        onSettleAllMemberInvoices: () => {},
        onReopenSharedTransaction: () => {},
        onOpenNewSharedTransaction: () => {},
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
  if (originalConfirm) window.confirm = originalConfirm;
  originalConfirm = null;
  if (root) act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

test('SharedExpensesTab confirms removal before routing a family member to deletion', async () => {
  let deletedMemberId = '';
  let confirmationMessage = '';
  originalConfirm = window.confirm;
  window.confirm = (message?: string) => {
    confirmationMessage = message ?? '';
    return true;
  };
  const member: FamilyMember = {
    id: 'fam-synthetic',
    name: 'Familiar sintético',
    relationship: 'amigo(a)',
    color: '#059669',
    inviteStatus: 'invited',
    direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member],
    onDeleteFamilyMember: (memberId) => { deletedMemberId = memberId; },
  });
  const inviteTab = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Pessoas & Convites por E-mail')
  );
  assert.ok(inviteTab);
  await act(async () => { inviteTab.click(); });
  const removeButton = page.querySelector<HTMLButtonElement>('[title="Remover pessoa"]');
  assert.ok(removeButton);

  await act(async () => { removeButton.click(); });

  assert.match(confirmationMessage, /Familiar sintético/);
  assert.equal(deletedMemberId, member.id);
});

test('SharedExpensesTab does not remove a family member when confirmation is canceled', async () => {
  let deletedMemberId = '';
  originalConfirm = window.confirm;
  window.confirm = () => false;
  const member: FamilyMember = {
    id: 'fam-synthetic-cancel',
    name: 'Familiar sintético',
    relationship: 'amigo(a)',
    color: '#059669',
    inviteStatus: 'accepted',
    direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member],
    onDeleteFamilyMember: (memberId) => { deletedMemberId = memberId; },
  });
  const inviteTab = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Pessoas & Convites por E-mail')
  );
  assert.ok(inviteTab);
  await act(async () => { inviteTab.click(); });
  const removeButton = page.querySelector<HTMLButtonElement>('[title="Remover pessoa"]');
  assert.ok(removeButton);

  await act(async () => { removeButton.click(); });

  assert.equal(deletedMemberId, '');
});

test('SharedExpensesTab creates a synthetic email invitation from the owner flow', async () => {
  const createdMembers: Array<Omit<FamilyMember, 'id'>> = [];
  const page = renderSharedExpensesTab((member) => createdMembers.push(member));

  const inviteTab = [...page.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Pessoas & Convites por E-mail')
  );
  assert.ok(inviteTab);
  await act(async () => { inviteTab.click(); });

  const openInviteButton = page.querySelector<HTMLButtonElement>('[data-testid="invite-family-member-btn"]');
  assert.ok(openInviteButton);
  await act(async () => { openInviteButton.click(); });

  const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
  const form = dialog?.querySelector<HTMLFormElement>('form');
  const nameInput = dialog?.querySelector<HTMLInputElement>('input[placeholder^="ex: Mariana"]');
  const emailInput = dialog?.querySelector<HTMLInputElement>('[data-testid="family-member-email-input"]');
  assert.ok(dialog && form && nameInput && emailInput);

  await act(async () => {
    setInputValue(nameInput, '  Familiar de Teste  ');
    setInputValue(emailInput, '  TESTE@EXEMPLO.TEST  ');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });

  assert.equal(createdMembers.length, 1);
  assert.equal(createdMembers[0]?.name, 'Familiar de Teste');
  assert.equal(createdMembers[0]?.email, 'teste@exemplo.test');
  assert.equal(createdMembers[0]?.inviteStatus, 'invited');
  assert.equal(createdMembers[0]?.direction, 'outgoing');
  assert.match(createdMembers[0]?.invitedAt ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(createdMembers[0]?.relationship, 'cônjuge');
  assert.match(page.textContent ?? '', /Convite familiar enviado na nuvem/);
  assert.equal(page.querySelector('[role="dialog"]'), null, 'salvar fecha o formulário');
});
