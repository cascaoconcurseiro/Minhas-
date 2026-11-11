import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, FamilyMember, Transaction } from '../types/finance';
import { SharedExpensesTab } from './SharedExpensesTab';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let originalConfirm: typeof window.confirm | null = null;
let originalClipboard: PropertyDescriptor | undefined;
let originalWindowOpen: typeof window.open;

function renderSharedExpensesTab(
  onAddFamilyMember: (member: Omit<FamilyMember, 'id'>) => void | boolean | Promise<void | boolean>,
  options: {
    familyMembers?: FamilyMember[];
    transactions?: Transaction[];
    accounts?: BankAccount[];
    onDeleteFamilyMember?: (memberId: string) => void;
    onSettleSharedTransaction?: (txId: string, accountId: string, date: string) => void;
    onAcceptFamilyInvite?: (member: FamilyMember) => void;
    onDeclineFamilyInvite?: (member: FamilyMember) => void;
    onResendFamilyInvite?: (member: FamilyMember) => void;
    onUpdateFamilyMember?: (member: FamilyMember) => void | boolean | Promise<void | boolean>;
    onReopenSharedTransaction?: (txId: string) => void;
    onSettleAllMemberInvoices?: (memberId: string, month: string, accountId: string, date: string) => void;
    onOpenNewSharedTransaction?: (memberId?: string) => void;
    userPixKey?: string;
  } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      React.createElement(SharedExpensesTab, {
        selectedMonth: '2026-11',
        transactions: options.transactions ?? [],
        familyMembers: options.familyMembers ?? [],
        accounts: options.accounts ?? [],
        cards: [],
        categories: [],
        onAddFamilyMember,
        onUpdateFamilyMember: options.onUpdateFamilyMember ?? (() => {}),
        onDeleteFamilyMember: options.onDeleteFamilyMember ?? (() => {}),
        onSettleSharedTransaction: options.onSettleSharedTransaction ?? (() => {}),
        onSettleAllMemberInvoices: options.onSettleAllMemberInvoices ?? (() => {}),
        onReopenSharedTransaction: options.onReopenSharedTransaction ?? (() => {}),
        onOpenNewSharedTransaction: options.onOpenNewSharedTransaction ?? (() => {}),
        onAcceptFamilyInvite: options.onAcceptFamilyInvite,
        onDeclineFamilyInvite: options.onDeclineFamilyInvite,
        onResendFamilyInvite: options.onResendFamilyInvite,
        userPixKey: options.userPixKey,
      })
    );
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
}

async function openFamilyInviteForm(page: HTMLElement) {
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
  return { dialog, form, nameInput, emailInput };
}

async function submitFamilyInvite(form: HTMLFormElement, nameInput: HTMLInputElement, emailInput: HTMLInputElement) {
  await act(async () => {
    setInputValue(nameInput, 'Familiar de Teste');
    setInputValue(emailInput, 'teste@exemplo.test');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

afterEach(() => {
  if (originalConfirm) window.confirm = originalConfirm;
  originalConfirm = null;
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
  originalClipboard = undefined;
  if (originalWindowOpen) window.open = originalWindowOpen;
  originalWindowOpen = undefined as unknown as typeof window.open;
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

test('family invitation modal labels form fields and names color choices', async () => {
  const page = renderSharedExpensesTab(() => {});
  const openButton = page.querySelector<HTMLButtonElement>('[data-testid="invite-family-member-btn"]');
  assert.ok(openButton);
  await act(async () => { openButton.click(); });
  for (const id of ['shared-member-name', 'shared-member-email', 'shared-member-relationship', 'shared-member-pix', 'shared-member-notes']) {
    const field = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected #${id}`);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field), `expected associated label for #${id}`);
  }
  const colorOptions = Array.from(page.querySelectorAll<HTMLButtonElement>('button[aria-label^="Cor #"]'));
  assert.ok(colorOptions.length > 0, 'color choices need accessible names');
  assert.ok(colorOptions.some((button) => button.getAttribute('aria-pressed') === 'true'));
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

test('shared settlement cannot close or save when no valid bank account is selected', async () => {
  let settlementCalls = 0;
  const member: FamilyMember = {
    id: 'fam-settlement-synthetic',
    name: 'Pessoa sintética',
    relationship: 'amigo(a)',
    color: '#059669',
    inviteStatus: 'accepted',
    direction: 'outgoing',
  };
  const transaction: Transaction = {
    id: 'tx-shared-synthetic',
    description: 'Despesa sintética',
    amount: 100,
    date: '2026-11-06',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: 'acc-missing',
    paymentMethod: 'pix',
    recurrence: 'single',
    isShared: true,
    sharedMemberId: member.id,
    sharedAmount: 50,
    sharedPaidBy: 'me',
    sharedStatus: 'pending',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member],
    transactions: [transaction],
    onSettleSharedTransaction: () => { settlementCalls += 1; },
  });
  const settleButton = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Liquidar Item'));
  assert.ok(settleButton);
  await act(async () => { settleButton.click(); });
  const dialog = page.querySelector<HTMLElement>('[role="dialog"]');
  const confirmButton = [...(dialog?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Confirmar Acerto'));
  assert.ok(confirmButton);
  await act(async () => { confirmButton.click(); });
  assert.equal(settlementCalls, 0);
  assert.ok(page.querySelector('[role="dialog"]'), 'modal remains open so the user can correct the missing account');
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /conta bancária válida/);
});

test('shared settlement rejects an empty date even when the bank account is valid', async () => {
  let settlementCalls = 0;
  const member: FamilyMember = {
    id: 'fam-date-synthetic',
    name: 'Pessoa sintética',
    relationship: 'amigo(a)',
    color: '#059669',
    inviteStatus: 'accepted',
    direction: 'outgoing',
  };
  const transaction: Transaction = {
    id: 'tx-shared-date-synthetic',
    description: 'Despesa sintética',
    amount: 100,
    date: '2026-11-06',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'paid',
    categoryId: 'cat-outros',
    accountId: 'acc-valid',
    paymentMethod: 'pix',
    recurrence: 'single',
    isShared: true,
    sharedMemberId: member.id,
    sharedAmount: 50,
    sharedPaidBy: 'me',
    sharedStatus: 'pending',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member],
    transactions: [transaction],
    accounts: [{
      id: 'acc-valid', name: 'Conta sintética', institution: 'Banco', type: 'checking',
      initialBalance: 0, color: '#059669', includeInTotal: true,
    }],
    onSettleSharedTransaction: () => { settlementCalls += 1; },
  });
  const settleButton = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Liquidar Item'));
  assert.ok(settleButton);
  await act(async () => { settleButton.click(); });
  const dateInput = page.querySelector<HTMLInputElement>('#shared-settlement-date');
  const confirmButton = [...(page.querySelector('[role="dialog"]')?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Confirmar Acerto'));
  assert.ok(dateInput && confirmButton);
  await act(async () => {
    setInputValue(dateInput, '');
    confirmButton.click();
  });
  assert.equal(settlementCalls, 0);
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /data válida/);
});

test('SharedExpensesTab creates a synthetic email invitation from the owner flow', async () => {
  const createdMembers: Array<Omit<FamilyMember, 'id'>> = [];
  const page = renderSharedExpensesTab((member) => { createdMembers.push(member); });

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
  assert.match(dialog.textContent ?? '', /convite fica registrado no app/i);
  assert.match(dialog.textContent ?? '', /nenhum e-mail é enviado/i);
  assert.match(dialog.textContent ?? '', /precisa entrar no Minhas Economias com o mesmo e-mail/i);
  assert.equal([...dialog.querySelectorAll('button')].some((button) => /enviar convite/i.test(button.textContent ?? '')), false);

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
  assert.match(page.textContent ?? '', /Convite registrado no app para teste@exemplo\.test/i);
  assert.match(page.textContent ?? '', /Nenhum e-mail foi enviado/i);
  assert.match(page.textContent ?? '', /entre no Minhas Economias com esse mesmo e-mail/i);
  assert.equal(page.querySelector('[role="dialog"]'), null, 'salvar fecha o formulário');
});

test('email invitation success closes the modal and announces only after Neon callback resolves', async () => {
  let resolveAdd!: (result: boolean) => void;
  const addPromise = new Promise<boolean>((resolve) => { resolveAdd = resolve; });
  let addCalls = 0;
  const page = renderSharedExpensesTab(() => { addCalls += 1; return addPromise; });
  const { form, nameInput, emailInput } = await openFamilyInviteForm(page);

  await submitFamilyInvite(form, nameInput, emailInput);
  assert.equal(addCalls, 1);
  assert.ok(page.querySelector('[role="dialog"]'), 'modal stays open while Neon is pending');
  assert.equal(page.textContent?.includes('Convite registrado no app para teste@exemplo.test'), false);
  assert.equal(page.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);

  await act(async () => { resolveAdd(true); await addPromise; });
  assert.equal(page.querySelector('[role="dialog"]'), null);
  assert.match(page.textContent ?? '', /Convite registrado no app para teste@exemplo\.test/i);
});

test('email invitation false result keeps the form open and shows failure without success', async () => {
  const page = renderSharedExpensesTab(async () => false);
  const { form, nameInput, emailInput } = await openFamilyInviteForm(page);

  await submitFamilyInvite(form, nameInput, emailInput);
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível registrar o convite/i);
  assert.equal(page.textContent?.includes('Convite registrado no app para teste@exemplo.test'), false);
});

test('rejected email invitation keeps the form open and shows failure without success', async () => {
  const page = renderSharedExpensesTab(async () => { throw new Error('simulated Neon failure'); });
  const { form, nameInput, emailInput } = await openFamilyInviteForm(page);

  await submitFamilyInvite(form, nameInput, emailInput);
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível registrar o convite/i);
  assert.equal(page.textContent?.includes('Convite registrado no app para teste@exemplo.test'), false);
});

test('SharedExpensesTab saves edits to a synthetic family member with normalized fields', async () => {
  const original: FamilyMember = {
    id: 'fam-edit-synthetic', name: 'Pessoa Original', relationship: 'amigo(a)', color: '#059669',
    inviteStatus: 'accepted', direction: 'outgoing', notes: 'Regra antiga',
  };
  const updated: FamilyMember[] = [];
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [original], onUpdateFamilyMember: (member) => { updated.push(member); },
  });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  const edit = page.querySelector<HTMLButtonElement>('[title="Editar pessoa / cadastrar e-mail do familiar"]');
  assert.ok(edit);
  assert.doesNotMatch(edit.title, /enviar convite|reenviar/i);
  await act(async () => { edit.click(); });
  const name = page.querySelector<HTMLInputElement>('#shared-member-name');
  const notes = page.querySelector<HTMLInputElement>('#shared-member-notes');
  const relation = page.querySelector<HTMLSelectElement>('#shared-member-relationship');
  const form = page.querySelector<HTMLFormElement>('[role="dialog"] form');
  assert.ok(name && notes && relation && form);
  await act(async () => {
    setInputValue(name, '  Pessoa Editada  ');
    setInputValue(notes, '  Divisão sintética  ');
    relation.value = 'irmão/irmã';
    relation.dispatchEvent(new window.Event('change', { bubbles: true }));
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  assert.equal(updated.length, 1);
  assert.deepEqual(updated[0], {
    ...original, name: 'Pessoa Editada', relationship: 'irmão/irmã', notes: 'Divisão sintética',
    email: undefined, inviteStatus: 'none', invitedAt: undefined, pixKey: undefined,
  });
  assert.equal(page.querySelector('[role="dialog"]'), null);
});

test('family member with an email and no invitation is labeled Sem convite', async () => {
  const member: FamilyMember = {
    id: 'fam-without-invitation', name: 'Pessoa sem vínculo', relationship: 'amigo(a)', color: '#059669',
    email: 'novo@example.test', inviteStatus: 'none', direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, { familyMembers: [member] });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  assert.match(page.textContent ?? '', /Sem convite/);
  assert.doesNotMatch(page.textContent ?? '', /Conta Vinculada/);
});

test('editing outgoing invite details waits for the Neon callback even when the email stays the same', async () => {
  const original: FamilyMember = {
    id: 'fam-same-email-update', name: 'Pessoa Original', relationship: 'amigo(a)', color: '#059669',
    email: 'same@example.test', invitationId: 'invite-same', inviteStatus: 'invited', direction: 'outgoing',
  };
  let resolveUpdate!: (result: boolean) => void;
  const updatePromise = new Promise<boolean>((resolve) => { resolveUpdate = resolve; });
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [original], onUpdateFamilyMember: () => updatePromise,
  });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Editar pessoa / cadastrar e-mail do familiar"]')?.click(); });
  const name = page.querySelector<HTMLInputElement>('#shared-member-name');
  const form = page.querySelector<HTMLFormElement>('[role="dialog"] form');
  assert.ok(name && form);

  await act(async () => {
    setInputValue(name, 'Pessoa Editada');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.equal(page.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);

  await act(async () => { resolveUpdate(true); await updatePromise; });
  assert.equal(page.querySelector('[role="dialog"]'), null);
});

test('changing a family email waits for the Neon callback before closing or showing success', async () => {
  const original: FamilyMember = {
    id: 'fam-email-change-pending', name: 'Pessoa Original', relationship: 'amigo(a)', color: '#059669',
    email: 'original@example.test', invitationId: 'invite-original', inviteStatus: 'invited', direction: 'outgoing',
  };
  let resolveUpdate!: (result: boolean) => void;
  const updatePromise = new Promise<boolean>((resolve) => { resolveUpdate = resolve; });
  const submitted: FamilyMember[] = [];
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [original],
    onUpdateFamilyMember: (member) => { submitted.push(member); return updatePromise; },
  });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  const edit = page.querySelector<HTMLButtonElement>('[title="Editar pessoa / cadastrar e-mail do familiar"]');
  assert.ok(edit);
  await act(async () => { edit.click(); });
  const email = page.querySelector<HTMLInputElement>('#shared-member-email');
  const form = page.querySelector<HTMLFormElement>('[role="dialog"] form');
  assert.ok(email && form);

  await act(async () => {
    setInputValue(email, 'novo@example.test');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  assert.equal(submitted[0]?.email, 'novo@example.test');
  assert.ok(page.querySelector('[role="dialog"]'), 'modal remains open while revocation/creation is pending');
  assert.equal(page.textContent?.includes('Vínculo atualizado para novo@example.test'), false);
  assert.equal(page.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, true);

  await act(async () => { resolveUpdate(true); await updatePromise; });
  assert.equal(page.querySelector('[role="dialog"]'), null);
});

test('email edit returning false keeps the edit form open and reports failure', async () => {
  const original: FamilyMember = {
    id: 'fam-email-change-false', name: 'Pessoa Original', relationship: 'amigo(a)', color: '#059669',
    email: 'original@example.test', invitationId: 'invite-original-false', inviteStatus: 'invited', direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [original], onUpdateFamilyMember: async () => false,
  });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Editar pessoa / cadastrar e-mail do familiar"]')?.click(); });
  const email = page.querySelector<HTMLInputElement>('#shared-member-email');
  const form = page.querySelector<HTMLFormElement>('[role="dialog"] form');
  assert.ok(email && form);
  await act(async () => {
    setInputValue(email, 'novo@example.test');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível atualizar o vínculo familiar/i);
  assert.equal(page.textContent?.includes('Vínculo atualizado para novo@example.test'), false);
});

test('rejected email edit keeps the edit form open and reports failure', async () => {
  const original: FamilyMember = {
    id: 'fam-email-change-reject', name: 'Pessoa Original', relationship: 'amigo(a)', color: '#059669',
    email: 'original@example.test', invitationId: 'invite-original-reject', inviteStatus: 'invited', direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [original], onUpdateFamilyMember: async () => { throw new Error('simulated Neon error'); },
  });
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[title="Editar pessoa / cadastrar e-mail do familiar"]')?.click(); });
  const email = page.querySelector<HTMLInputElement>('#shared-member-email');
  const form = page.querySelector<HTMLFormElement>('[role="dialog"] form');
  assert.ok(email && form);
  await act(async () => {
    setInputValue(email, 'novo@example.test');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  assert.ok(page.querySelector('[role="dialog"]'));
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Não foi possível atualizar o vínculo familiar/i);
  assert.equal(page.textContent?.includes('Vínculo atualizado para novo@example.test'), false);
});

test('incoming shared invite accept and decline are routed through synthetic callbacks', async () => {
  const incoming: FamilyMember = {
    id: 'invite-incoming-synthetic', name: 'Remetente Teste', relationship: 'amigo(a)',
    color: '#059669', email: 'sender@example.test', inviteStatus: 'invited', direction: 'incoming',
    invitedByName: 'Remetente Teste', invitedByEmail: 'sender@example.test',
  };
  const accepted: FamilyMember[] = [];
  const declined: FamilyMember[] = [];
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [incoming],
    onAcceptFamilyInvite: (member) => accepted.push(member),
    onDeclineFamilyInvite: (member) => declined.push(member),
  });
  const accept = page.querySelector<HTMLButtonElement>(`[data-testid="accept-family-invite-${incoming.id}"]`);
  const decline = page.querySelector<HTMLButtonElement>(`[data-testid="decline-family-invite-${incoming.id}"]`);
  assert.ok(accept && decline);
  await act(async () => { accept.click(); decline.click(); });
  assert.deepEqual(accepted, [incoming]);
  assert.deepEqual(declined, [incoming]);
});

test('shared member controls select a person, switch guest mirror and invoke synthetic expense callback', async () => {
  const member: FamilyMember = {
    id: 'member-controls-synthetic', name: 'Familiar UX', relationship: 'amigo(a)',
    color: '#3b82f6', inviteStatus: 'accepted', direction: 'outgoing',
  };
  const openedFor: Array<string | undefined> = [];
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member], onOpenNewSharedTransaction: (memberId) => openedFor.push(memberId),
  });
  const mirror = page.querySelector<HTMLButtonElement>('[data-testid="toggle-guest-family-mirror-btn"]');
  assert.ok(mirror);
  await act(async () => { mirror.click(); });
  assert.match(mirror.textContent ?? '', /Fechar Visão do Convidado/);
  await act(async () => { mirror.click(); });
  assert.match(mirror.textContent ?? '', /Ver Visão de Familiar/);
  const create = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Nova Despesa Compartilhada'));
  assert.ok(create);
  await act(async () => { create.click(); });
  assert.deepEqual(openedFor, [member.id]);
  const membersTab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(membersTab);
  await act(async () => { membersTab.click(); });
  assert.ok(page.textContent?.includes('Pessoas da Família & Convites'));
});

test('shared invite resend uses callback only and does not initiate external email', async () => {
  const member: FamilyMember = {
    id: 'resend-synthetic', name: 'Convidado', relationship: 'amigo(a)', color: '#059669',
    email: 'test@example.test', inviteStatus: 'invited', direction: 'outgoing',
  };
  let resent: FamilyMember | null = null;
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member], onResendFamilyInvite: (value) => { resent = value; },
  });
  const tab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(tab);
  await act(async () => { tab.click(); });
  const resend = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Atualizar convite');
  assert.ok(resend);
  assert.doesNotMatch(resend.textContent ?? '', /reenviar|e-mail/i);
  await act(async () => { resend.click(); await Promise.resolve(); });
  assert.equal(resent, member);
  assert.match(page.textContent ?? '', /Convite registrado no app para test@example\.test/i);
  assert.match(page.textContent ?? '', /Nenhum e-mail foi enviado/i);
  assert.match(page.textContent ?? '', /entre no Minhas Economias com esse mesmo e-mail/i);
});

test('failed async invite update never shows the registered success message', async () => {
  const member: FamilyMember = {
    id: 'resend-rejected-synthetic', name: 'Convidado', relationship: 'amigo(a)', color: '#059669',
    email: 'test@example.test', inviteStatus: 'invited', direction: 'outgoing',
  };
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member],
    onResendFamilyInvite: async () => { throw new Error('simulated Neon failure'); },
  });
  const tab = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoas & Convites por E-mail'));
  assert.ok(tab);
  await act(async () => { tab.click(); });
  const update = [...page.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Atualizar convite');
  assert.ok(update);

  await act(async () => { update.click(); await Promise.resolve(); });
  assert.match(page.textContent ?? '', /Não foi possível atualizar o convite no app/i);
  assert.doesNotMatch(page.textContent ?? '', /Convite registrado no app para test@example\.test/i);
});

test('valid single shared settlement forwards transaction, account and date; received item can be reopened', async () => {
  const member: FamilyMember = {
    id: 'fam-valid-settlement', name: 'Pessoa sintética', relationship: 'amigo(a)', color: '#059669',
    inviteStatus: 'accepted', direction: 'outgoing',
  };
  const transaction: Transaction = {
    id: 'tx-valid-settlement', description: 'Conta dividida sintética', amount: 80,
    date: '2026-11-06', competenceMonth: '2026-11', type: 'expense', status: 'paid',
    categoryId: 'cat-outros', accountId: 'acc-valid', paymentMethod: 'pix', recurrence: 'single',
    isShared: true, sharedMemberId: member.id, sharedAmount: 40, sharedPaidBy: 'me', sharedStatus: 'pending',
  };
  let settled: [string, string, string] | null = null;
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member], transactions: [transaction],
    accounts: [{ id: 'acc-valid', name: 'Conta teste', institution: 'Banco teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true }],
    onSettleSharedTransaction: (txId, accountId, date) => { settled = [txId, accountId, date]; },
  });
  const open = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Liquidar Item'));
  assert.ok(open);
  await act(async () => { open.click(); });
  const account = page.querySelector<HTMLSelectElement>('#shared-settlement-account');
  const date = page.querySelector<HTMLInputElement>('#shared-settlement-date');
  const confirm = [...(page.querySelector('[role="dialog"]')?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Confirmar Acerto'));
  assert.ok(account && date && confirm);
  await act(async () => {
    account.value = 'acc-valid'; account.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(date, '2026-11-07');
    confirm.click();
  });
  assert.deepEqual(settled, [transaction.id, 'acc-valid', '2026-11-07']);
  assert.equal(page.querySelector('[role="dialog"]'), null);

  const received = { ...transaction, sharedStatus: 'received' as const };
  const pageWithReceived = renderSharedExpensesTab(() => {}, {
    familyMembers: [member], transactions: [received],
    onReopenSharedTransaction: (txId) => { settled = [txId, '', '']; },
  });
  const reopen = [...pageWithReceived.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Reabrir');
  assert.ok(reopen);
  await act(async () => { reopen.click(); });
  assert.deepEqual(settled, [transaction.id, '', '']);
});

test('SharedExpensesTab switches between members and confirms compensated full settlement', async () => {
  const first: FamilyMember = {
    id: 'fam-first-summary', name: 'Pessoa Primeira', relationship: 'amigo(a)', color: '#059669',
    inviteStatus: 'accepted', direction: 'outgoing',
  };
  const second: FamilyMember = {
    id: 'fam-second-summary', name: 'Pessoa Segunda', relationship: 'irmão/irmã', color: '#3b82f6',
    inviteStatus: 'accepted', direction: 'outgoing',
  };
  const transaction: Transaction = {
    id: 'tx-second-summary', description: 'Conta compartilhada sintética', amount: 120,
    date: '2026-11-06', competenceMonth: '2026-11', type: 'expense', status: 'paid',
    categoryId: 'cat-outros', accountId: 'acc-full-settlement', paymentMethod: 'pix', recurrence: 'single',
    isShared: true, sharedMemberId: second.id, sharedAmount: 60, sharedPaidBy: 'member', sharedStatus: 'pending',
  };
  let settledAll: [string, string, string, string] | null = null;
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [first, second], transactions: [transaction],
    accounts: [{ id: 'acc-full-settlement', name: 'Conta sintética', institution: 'Banco teste', type: 'checking', initialBalance: 0, color: '#059669', includeInTotal: true }],
    onSettleAllMemberInvoices: (memberId, month, accountId, date) => { settledAll = [memberId, month, accountId, date]; },
  });
  const memberSelector = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Pessoa Segunda'));
  assert.ok(memberSelector, 'participante deve aparecer no seletor de familiares');
  await act(async () => { memberSelector.click(); });
  assert.match(page.textContent ?? '', /Pessoa Segunda/);
  const settleAll = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Liquidar este mês'));
  assert.ok(settleAll);
  await act(async () => { settleAll.click(); });
  const date = page.querySelector<HTMLInputElement>('#shared-settlement-date');
  const account = page.querySelector<HTMLSelectElement>('#shared-settlement-account');
  const confirm = [...(page.querySelector('[role="dialog"]')?.querySelectorAll('button') ?? [])].find((button) => button.textContent?.includes('Confirmar Acerto'));
  assert.ok(date && account && confirm);
  await act(async () => {
    setInputValue(date, '2026-11-07');
    account.value = 'acc-full-settlement';
    account.dispatchEvent(new window.Event('change', { bubbles: true }));
    confirm.click();
  });
  assert.deepEqual(settledAll, [second.id, '2026-11', 'acc-full-settlement', '2026-11-07']);
  assert.equal(page.querySelector('[role="dialog"]'), null);
});

test('shared invoice copy places synthetic summary and PIX key on clipboard without opening WhatsApp', async () => {
  const member: FamilyMember = {
    id: 'fam-copy', name: 'Pessoa cópia', relationship: 'amigo(a)', color: '#059669',
    inviteStatus: 'accepted', direction: 'outgoing',
  };
  const transaction: Transaction = {
    id: 'tx-copy', description: 'Almoço sintético', amount: 60, date: '2026-11-06', competenceMonth: '2026-11',
    type: 'expense', status: 'paid', categoryId: 'cat-outros', paymentMethod: 'pix', recurrence: 'single',
    isShared: true, sharedMemberId: member.id, sharedAmount: 30, sharedPaidBy: 'me', sharedStatus: 'pending',
  };
  let copied = '';
  let opens = 0;
  originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  originalWindowOpen = window.open;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied = text; } } });
  window.open = (() => { opens += 1; return null; }) as typeof window.open;
  const page = renderSharedExpensesTab(() => {}, {
    familyMembers: [member], transactions: [transaction], userPixKey: 'pix-sintetico@example.test',
  });
  const copy = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Copiar p/ WhatsApp'));
  assert.ok(copy);
  await act(async () => { copy.click(); await Promise.resolve(); });
  assert.match(copied, /Almoço sintético/);
  assert.match(copied, /Chave PIX: pix-sintetico@example\.test/);
  assert.equal(opens, 0, 'o fluxo copia o resumo e não abre WhatsApp');
});
