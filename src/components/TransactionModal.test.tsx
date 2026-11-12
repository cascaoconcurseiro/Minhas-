import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { CascadeScope, CreateTransactionBatchInput } from '../utils/financeRules';
import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import { TransactionModal } from './TransactionModal';
import { createTransactionBatch, getLocalDateISO } from '../utils/financeRules';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderTransactionModal(
  onSaveBatch: (input: CreateTransactionBatchInput, editingId?: string, cascadeScope?: CascadeScope) => void,
  onClose: () => void,
  options: {
    accounts?: BankAccount[];
    cards?: CreditCard[];
    categories?: Category[];
    familyMembers?: FamilyMember[];
    onAddFamilyMember?: (member: Omit<FamilyMember, 'id'>) => FamilyMember | void;
    onAddSubcategory?: (categoryId: string, name: string) => string | void;
    editingTransaction?: Transaction;
    transactions?: Transaction[];
  } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const account: BankAccount = {
    id: 'account-test',
    name: 'Conta sintética',
    institution: 'Banco de teste',
    type: 'checking',
    initialBalance: 0,
    color: '#000000',
    includeInTotal: true,
  };
  const category: Category = {
    id: 'category-test',
    name: 'Alimentação',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 300,
    color: '#16a34a',
    icon: 'utensils',
    subcategories: [{ id: 'subcategory-test', name: 'Mercado' }],
  };
  const cards = options.cards ?? [];

  act(() => {
    root?.render(
      React.createElement(TransactionModal, {
        isOpen: true,
        onClose,
        onSaveBatch,
        accounts: options.accounts ?? [account],
        cards,
        categories: options.categories ?? [category],
        transactions: options.transactions ?? [],
        familyMembers: options.familyMembers ?? [],
        onAddFamilyMember: options.onAddFamilyMember,
        onAddSubcategory: options.onAddSubcategory,
        selectedMonth: '2026-11',
        editingTransaction: options.editingTransaction ?? null,
        defaultMode: 'expense',
      })
    );
  });
  return container;
}

const incomeCategory: Category = {
  id: 'income-category-test',
  name: 'Salário',
  type: 'income',
  bucket: 'financial',
  monthlyBudget: 0,
  color: '#16a34a',
  icon: 'wallet',
  subcategories: [],
};

const secondAccount: BankAccount = {
  id: 'account-destination-test',
  name: 'Conta destino sintética',
  institution: 'Banco de teste',
  type: 'savings',
  initialBalance: 0,
  color: '#000000',
  includeInTotal: true,
};

const testCard: CreditCard = {
  id: 'card-test',
  name: 'Cartão sintético',
  brand: 'Visa',
  limit: 5000,
  closingDay: 20,
  dueDay: 5,
  defaultAccountId: 'account-test',
  color: '#000000',
};

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

test('transaction modal rejects zero amount and saves a valid synthetic expense', async () => {
  const savedInputs: CreateTransactionBatchInput[] = [];
  let closeCount = 0;
  const page = renderTransactionModal(
    (input) => { savedInputs.push(input); },
    () => { closeCount += 1; }
  );

  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  const amount = page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]');
  const submit = page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]');
  assert.ok(description && amount && submit);
  assert.match(page.textContent ?? '', /Valor do Lançamento/);

  await act(async () => {
    setInputValue(description, '  Compra sintética  ');
    setInputValue(amount, '0,00');
    submit.click();
  });
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Informe um valor válido maior que zero/);
  assert.equal(savedInputs.length, 0);
  assert.equal(closeCount, 0);

  await act(async () => {
    setInputValue(amount, '12,34');
    submit.click();
  });

  assert.equal(savedInputs.length, 1);
  const saved = savedInputs[0];
  assert.equal(saved.description, 'Compra sintética');
  assert.equal(saved.amount, 12.34);
  assert.equal(saved.type, 'expense');
  assert.equal(saved.status, 'paid');
  assert.equal(saved.categoryId, 'category-test');
  assert.equal(saved.subcategoryId, 'subcategory-test');
  assert.equal(saved.accountId, 'account-test');
  assert.equal(saved.paymentMethod, 'pix');
  assert.equal(closeCount, 1);
});

test('transaction modal refuses to save an international expense with excess currency precision', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const transaction: Transaction = {
    id: 'foreign-expense-edit', description: 'Compra internacional', amount: 5,
    date: '2026-11-10', competenceMonth: '2026-11', type: 'expense', status: 'paid',
    categoryId: 'category-test', accountId: 'account-test', paymentMethod: 'cash', recurrence: 'single',
    originalCurrency: 'JPY', originalAmount: 4, exchangeRate: 1.25, currencyRegime: 'cash_fx',
  };
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { editingTransaction: transaction });
  const foreignAmount = page.querySelector<HTMLInputElement>('[data-testid="tx-foreign-amount-input"]');
  const submit = page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]');
  assert.ok(foreignAmount && submit);

  await act(async () => {
    setInputValue(foreignAmount, '1,5');
    submit.click();
  });

  assert.equal(saved.length, 0);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /valor válido em JPY/);
  assert.equal(foreignAmount.value, '1,5');
});

test('expense category, subcategory and account selectors have associated labels', () => {
  const page = renderTransactionModal(() => {}, () => {});
  for (const id of ['tx-category-select', 'tx-subcategory-select', 'tx-payment-source-select']) {
    const field = page.querySelector<HTMLElement>(`#${id}`);
    assert.ok(field, `expected field #${id}`);
    assert.ok(Array.from(page.querySelectorAll('label')).some((label) => label.control === field), `expected an associated label for #${id}`);
  }
});

test('creates and selects a subcategory without leaving the transaction form', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const created: Array<{ categoryId: string; name: string }> = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, {
    onAddSubcategory: (categoryId, name) => {
      created.push({ categoryId, name });
      return 'subcategory-quick-test';
    },
  });

  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="open-quick-add-subcategory"]')?.click(); });
  const input = page.querySelector<HTMLInputElement>('[data-testid="quick-add-subcategory-name"]');
  assert.ok(input);
  await act(async () => {
    setInputValue(input, 'Lojas online');
    page.querySelector<HTMLButtonElement>('[data-testid="save-quick-add-subcategory"]')?.click();
  });
  assert.deepEqual(created, [{ categoryId: 'category-test', name: 'Lojas online' }]);
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Amazon');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '12,55');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved[0]?.subcategoryId, 'subcategory-quick-test');
});

test('automatic category suggestions update same-category subcategories and clear stale cross-category ids', async () => {
  const categories: Category[] = [
    {
      id: 'cat-assinaturas', name: 'Assinaturas & Streaming', type: 'expense',
      bucket: 'lifestyle', monthlyBudget: 0, color: '#6366f1', icon: 'tv',
      subcategories: [
        { id: 'sub-ass-stream', name: 'Streaming & Música' },
        { id: 'sub-ass-soft', name: 'Apps & Nuvem' },
      ],
    },
    {
      id: 'cat-moradia', name: 'Moradia', type: 'expense', bucket: 'essential',
      monthlyBudget: 0, color: '#0f172a', icon: 'home', subcategories: [],
    },
  ];
  const history: Transaction[] = [
    {
      id: 'history-netflix', description: 'Netflix', amount: 20, date: '2026-10-01',
      competenceMonth: '2026-10', type: 'expense', status: 'paid', categoryId: 'cat-assinaturas',
      subcategoryId: 'sub-ass-stream', paymentMethod: 'credit_card', recurrence: 'single',
    },
    {
      id: 'history-google-one', description: 'Google One', amount: 10, date: '2026-10-02',
      competenceMonth: '2026-10', type: 'expense', status: 'paid', categoryId: 'cat-assinaturas',
      subcategoryId: 'sub-ass-soft', paymentMethod: 'credit_card', recurrence: 'single',
    },
  ];
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { categories, transactions: history });
  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  const category = page.querySelector<HTMLSelectElement>('#tx-category-select');
  const subcategory = page.querySelector<HTMLSelectElement>('#tx-subcategory-select');
  assert.ok(description && category && subcategory);

  await act(async () => {
    setInputValue(description, 'Netflix');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(category.value, 'cat-assinaturas');
  assert.equal(subcategory.value, 'sub-ass-stream');

  await act(async () => {
    setInputValue(description, 'Google One');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(category.value, 'cat-assinaturas');
  assert.equal(subcategory.value, 'sub-ass-soft', 'a sugestão deve atualizar subcategoria sem trocar categoria');

  await act(async () => {
    setInputValue(description, 'Conta Enel');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(category.value, 'cat-moradia');
  assert.equal(page.querySelector('#tx-subcategory-select'), null, 'a categoria sem subcategorias não deve manter um seletor antigo');
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '25,00');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved[0]?.categoryId, 'cat-moradia');
  assert.equal(saved[0]?.subcategoryId, undefined, 'o ID da subcategoria anterior não pode ser salvo sob outra categoria');
});

test('applying a suggestion ignores a historical subcategory id removed from its category', async () => {
  const categories: Category[] = [
    {
      id: 'cat-moradia', name: 'Moradia', type: 'expense', bucket: 'essential',
      monthlyBudget: 0, color: '#0f172a', icon: 'home', subcategories: [],
    },
    {
      id: 'cat-assinaturas', name: 'Assinaturas & Streaming', type: 'expense',
      bucket: 'lifestyle', monthlyBudget: 0, color: '#6366f1', icon: 'tv',
      subcategories: [{ id: 'sub-ass-stream', name: 'Streaming & Música' }],
    },
  ];
  const history: Transaction[] = [{
    id: 'history-deleted-subcategory', description: 'Netflix', amount: 20, date: '2026-10-01',
    competenceMonth: '2026-10', type: 'expense', status: 'paid', categoryId: 'cat-assinaturas',
    subcategoryId: 'deleted-subcategory', paymentMethod: 'credit_card', recurrence: 'single',
  }];
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { categories, transactions: history });
  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  const category = page.querySelector<HTMLSelectElement>('#tx-category-select');
  assert.ok(description && category);

  await act(async () => {
    setInputValue(description, 'Netflix');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(category, 'cat-moradia');
    category.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  const suggestion = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Sugerir:'));
  assert.ok(suggestion);
  await act(async () => { suggestion.click(); });

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '20,00');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved[0]?.categoryId, 'cat-assinaturas');
  assert.equal(saved[0]?.subcategoryId, undefined, 'ID removido do histórico não pode ser aplicado');
});

test('learns the habit: typing a usual establishment applies the split with the same person and offers undo', async () => {
  const fran: FamilyMember = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as FamilyMember;
  const mercado: Category = {
    id: 'cat-mercado', name: 'Supermercado', type: 'expense', bucket: 'essential',
    monthlyBudget: 0, color: '#059669', icon: 'shopping-cart', subcategories: [],
  };
  const sharedApolo = (id: string, date: string): Transaction => ({
    id, description: 'apolo', amount: 100, date, competenceMonth: '2026-11', type: 'expense', status: 'pending',
    categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', isShared: true,
    sharedMemberId: 'fam-fran', sharedAmount: 50, sharedPaidBy: 'me', sharedSplitMode: 'half', sharedStatus: 'pending',
  });
  const page = renderTransactionModal(() => {}, () => {}, {
    categories: [mercado], familyMembers: [fran],
    transactions: [sharedApolo('h1', '2026-11-01'), sharedApolo('h2', '2026-11-05'), sharedApolo('h3', '2026-11-09')],
  });
  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  assert.ok(description);
  assert.equal(page.querySelector('[data-testid="auto-sharing-notice"]'), null);

  await act(async () => {
    setInputValue(description, 'Apolo');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.ok(page.querySelector('[data-testid="family-split-panel"]'), 'a divisão é aplicada sozinha');
  const notice = page.querySelector('[data-testid="auto-sharing-notice"]');
  assert.match(notice?.textContent ?? '', /Dividido com FRAN \(metade, você pagou\)/);

  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="auto-sharing-undo"]')?.click(); });
  assert.equal(page.querySelector('[data-testid="family-split-panel"]'), null, 'desfazer remove a divisão');
  assert.equal(page.querySelector('[data-testid="auto-sharing-notice"]'), null);

  await act(async () => {
    setInputValue(description, 'Apolo Mercado');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(page.querySelector('[data-testid="family-split-panel"]'), null, 'depois de desfazer não reaplica sozinho');
});

test('an unknown establishment does not trigger any automatic split', async () => {
  const fran: FamilyMember = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as FamilyMember;
  const page = renderTransactionModal(() => {}, () => {}, { familyMembers: [fran] });
  const description = page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]');
  assert.ok(description);
  await act(async () => {
    setInputValue(description, 'Padaria nova');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  assert.equal(page.querySelector('[data-testid="family-split-panel"]'), null);
  assert.equal(page.querySelector('[data-testid="auto-sharing-notice"]'), null);
});

test('inline family quick-add with email stays open and routes the user to Shared tab without invoking callback', async () => {
  const existing: FamilyMember = {
    id: 'existing-family-test', name: 'Familiar existente', relationship: 'amigo(a)',
    color: '#059669', inviteStatus: 'accepted',
  };
  let addCalls = 0;
  let closeCalls = 0;
  const page = renderTransactionModal(() => {}, () => { closeCalls += 1; }, {
    familyMembers: [existing],
    onAddFamilyMember: () => { addCalls += 1; return undefined; },
  });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-shared-switch"]')?.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-inline-family-member-form"]')?.click(); });
  const name = page.querySelector<HTMLInputElement>('[data-testid="inline-family-member-name"]');
  const email = page.querySelector<HTMLInputElement>('[data-testid="inline-family-member-email"]');
  const submit = page.querySelector<HTMLButtonElement>('[data-testid="inline-family-member-submit"]');
  assert.ok(name && email && submit);

  await act(async () => {
    setInputValue(name, 'Novo familiar');
    setInputValue(email, 'novo@example.test');
    submit.click();
  });

  assert.equal(addCalls, 0);
  assert.match(page.querySelector('[data-testid="inline-family-member-error"]')?.textContent ?? '', /use a aba Compartilhado/i);
  assert.equal(name.value, 'Novo familiar');
  assert.equal(email.value, 'novo@example.test');
  assert.ok(page.querySelector('[data-testid="inline-family-member-submit"]'), 'quick-add remains open');
  assert.equal(page.querySelector('[data-testid="toggle-shared-switch"]')?.getAttribute('aria-checked'), 'true');
  assert.equal(page.querySelector('[role="dialog"]') !== null, true);
  assert.equal(closeCalls, 0);
});

test('inline family quick-add without email still adds a local contact and closes the quick-add form', async () => {
  const existing: FamilyMember = {
    id: 'existing-family-local-test', name: 'Familiar existente', relationship: 'amigo(a)',
    color: '#059669', inviteStatus: 'accepted',
  };
  const created: FamilyMember = {
    id: 'local-family-test', name: 'Novo familiar', relationship: 'amigo(a)',
    color: '#3b82f6', inviteStatus: 'none',
  };
  const added: Array<Omit<FamilyMember, 'id'>> = [];
  const page = renderTransactionModal(() => {}, () => {}, {
    familyMembers: [existing],
    onAddFamilyMember: (member) => { added.push(member); return created; },
  });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-shared-switch"]')?.click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-inline-family-member-form"]')?.click(); });
  const name = page.querySelector<HTMLInputElement>('[data-testid="inline-family-member-name"]');
  const email = page.querySelector<HTMLInputElement>('[data-testid="inline-family-member-email"]');
  const submit = page.querySelector<HTMLButtonElement>('[data-testid="inline-family-member-submit"]');
  assert.ok(name && email && submit);

  await act(async () => {
    setInputValue(name, 'Novo familiar');
    submit.click();
  });

  assert.ok(added[0]);
  assert.equal(added[0].email, undefined);
  assert.equal(added[0].inviteStatus, 'none');
  assert.equal(page.querySelector('[role="alert"]'), null);
  assert.equal(page.querySelector('[data-testid="inline-family-member-submit"]'), null, 'quick-add closes after local contact creation');
  assert.equal(page.querySelector('[data-testid="toggle-shared-switch"]')?.getAttribute('aria-checked'), 'true');
});

test('transaction modal submits the date selected in the date control', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {});
  const date = page.querySelector<HTMLInputElement>('[data-testid="tx-date-input"]');
  assert.ok(date);
  assert.equal(date.value, getLocalDateISO());

  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Compra com data sintética');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '5,00');
    setInputValue(date, '2026-11-07');
    assert.equal(date.value, '2026-11-07');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].date, '2026-11-07');
  assert.equal(saved[0].competenceMonth, '2026-11');
});

test('income mode persists the selected category, pending status and fixed-month schedule', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, {
    categories: [
      {
        id: 'category-test', name: 'Alimentação', type: 'expense', bucket: 'essential',
        monthlyBudget: 300, color: '#16a34a', icon: 'utensils', subcategories: [],
      },
      incomeCategory,
    ],
    accounts: [
      {
        id: 'account-test', name: 'Conta sintética', institution: 'Banco de teste',
        type: 'checking', initialBalance: 0, color: '#000000', includeInTotal: true,
      },
    ],
  });

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="mode-income-btn"]')?.click();
    page.querySelector<HTMLButtonElement>('[data-testid="recurrence-fixed-btn"]')?.click();
  });
  const months = page.querySelector<HTMLSelectElement>('[data-testid="main-recurrence-selector"] select');
  assert.ok(months);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(months, '12');
    months.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Salário sintético');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '2500,00');
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('A Receber'))?.click();
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'income');
  assert.equal(saved[0].categoryId, incomeCategory.id);
  assert.equal(saved[0].amount, 2500);
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].recurrence, 'fixed');
  assert.equal(saved[0].fixedMonthsCount, 12);
  assert.equal(saved[0].accountId, 'account-test');
});

test('credit-card purchase creates pending installments tied to the chosen card', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { cards: [testCard] });
  assert.equal(page.querySelector('[data-testid="mode-credit-card-btn"]'), null);
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="payment-method-card"]')?.click(); });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="recurrence-installment-btn"]')?.click();
  });
  const selects = [...page.querySelectorAll<HTMLSelectElement>('select')];
  const installmentCount = selects.find((select) => [...select.options].some((option) => option.value === '3'));
  assert.ok(installmentCount);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(installmentCount, '3');
    installmentCount.dispatchEvent(new window.Event('change', { bubbles: true }));
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Notebook sintético');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '3.000,00');
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'expense');
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].creditCardId, testCard.id);
  assert.equal(saved[0].paymentMethod, 'credit_card');
  assert.equal(saved[0].recurrence, 'installment');
  assert.equal(saved[0].installmentTotal, 3);
  assert.equal(saved[0].installmentPurchaseTotal, 3000);
  assert.equal(saved[0].accountId, undefined);
});

test('budget warning follows invoice competence instead of the month open behind the modal', async () => {
  const base: Transaction = {
    id: 'nov-budget', description: 'Synthetic existing expense', amount: 290,
    date: '2026-11-01', competenceMonth: '2026-11', type: 'expense', status: 'pending',
    categoryId: 'category-test', recurrence: 'single', paymentMethod: 'pix',
  };
  const page = renderTransactionModal(() => {}, () => {}, {
    cards: [testCard], transactions: [base, { ...base, id: 'dec-budget', amount: 40, competenceMonth: '2026-12' }],
  });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="payment-method-card"]')?.click(); });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-date-input"]')!, '2026-11-11');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '50,00');
  });
  assert.match(page.textContent ?? '', /Teto de Alimentação \(Dezembro de 2026\)/);
  assert.match(page.textContent ?? '', /90,00/);
  assert.doesNotMatch(page.textContent ?? '', /340,00/);
});

test('editing shared installments loads the total custom share and previews only the selected installment', () => {
  const base: Transaction = { id: 'shared-1', description: 'Shared synthetic', amount: 100, date: '2026-11-11', competenceMonth: '2026-11',
    type: 'expense', status: 'pending', categoryId: 'category-test', creditCardId: testCard.id, paymentMethod: 'credit_card',
    recurrence: 'installment', installmentTotal: 3, installmentNumber: 1, installmentGroupId: 'shared-series', installmentPurchaseTotal: 300,
    isShared: true, sharedAmount: 20, sharedSplitMode: 'custom', sharedMemberId: 'member', sharedPaidBy: 'me' };
  const rows = [base, { ...base, id: 'shared-2', installmentNumber: 2, date: '2026-12-11', competenceMonth: '2026-12' },
    { ...base, id: 'shared-3', installmentNumber: 3, date: '2027-01-11', competenceMonth: '2027-01' }];
  const page = renderTransactionModal(() => {}, () => {}, { cards: [testCard], editingTransaction: base, transactions: rows,
    familyMembers: [{ id: 'member', name: 'Synthetic member', relationship: 'amigo(a)', color: '#000000', inviteStatus: 'accepted' }] });
  const custom = page.querySelector<HTMLInputElement>('[data-testid="shared-total-amount-input"]');
  assert.ok(custom);
  assert.match(custom.value, /60,00/);
  assert.match(page.textContent ?? '', /Cota total na compra/);
});

test('updates card invoice competence from the closing day without requiring manual month selection', async () => {
  const page = renderTransactionModal(() => {}, () => {}, { cards: [testCard] });
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="payment-method-card"]')?.click(); });
  await act(async () => {
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-date-input"]')!, '2026-11-21');
  });
  assert.equal(page.querySelector('[data-testid="auto-invoice-month"]'), null);
  assert.equal(page.querySelector('[data-testid="invoice-month-override"]'), null);
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-invoice-month-override"]')?.click(); });
  assert.equal(page.querySelector<HTMLSelectElement>('[data-testid="invoice-month-override"]')?.value, '2027-01');
});

test('recalculates invoice due month when editing a credit-card purchase date', async () => {
  const transaction: Transaction = {
    id: 'card-purchase-edit-test',
    description: 'Compra de cartão sintética',
    amount: 100,
    date: '2026-11-11',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'category-test',
    creditCardId: testCard.id,
    paymentMethod: 'credit_card',
    recurrence: 'single',
  };
  const page = renderTransactionModal(() => {}, () => {}, {
    cards: [testCard],
    editingTransaction: transaction,
  });
  assert.equal(page.querySelector('[data-testid="auto-invoice-month"]'), null);
  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="toggle-invoice-month-override"]')?.click(); });
  assert.equal(page.querySelector<HTMLSelectElement>('[data-testid="invoice-month-override"]')?.value, '2026-12');
});

test('editing an installment series passes the selected cascade scope and transaction id', async () => {
  let saved: CreateTransactionBatchInput | undefined;
  let savedId: string | undefined;
  let savedScope: CascadeScope | undefined;
  const installment: Transaction = {
    id: 'installment-test-2',
    description: 'Notebook sintético',
    amount: 1000,
    date: '2026-11-07',
    competenceMonth: '2026-11',
    type: 'expense',
    status: 'pending',
    categoryId: 'category-test',
    creditCardId: testCard.id,
    paymentMethod: 'credit_card',
    recurrence: 'installment',
    installmentGroupId: 'series-test',
    installmentNumber: 2,
    installmentTotal: 4,
    installmentPurchaseTotal: 4000,
  };
  const page = renderTransactionModal(
    (input, id, scope) => {
      saved = input;
      savedId = id;
      savedScope = scope;
    },
    () => {},
    { cards: [testCard], editingTransaction: installment }
  );

  assert.ok(page.textContent?.includes('Escopo da Alteração na Série (2/4 meses)'));
  await act(async () => {
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Toda a série (passados e futuros)'))
      ?.click();
  });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });

  assert.equal(savedId, installment.id);
  assert.equal(savedScope, 'all_series');
  assert.equal(saved?.description, installment.description);
  assert.equal(saved?.recurrence, 'installment');
  assert.equal(saved?.installmentTotal, 4);
});

test('editing an installment exposes and saves the full original purchase total', async () => {
  const batch = createTransactionBatch({
    description: 'Notebook sintético', amount: 900, amountMode: 'total_divided',
    date: '2026-11-10', competenceMonth: '2026-12', type: 'expense', status: 'pending',
    categoryId: 'category-test', creditCardId: testCard.id, paymentMethod: 'credit_card',
    recurrence: 'installment', installmentTotal: 3,
  });
  const saved: Array<{ input: CreateTransactionBatchInput; id?: string; scope?: CascadeScope }> = [];
  const page = renderTransactionModal(
    (input, id, scope) => saved.push({ input, id, scope }),
    () => {},
    { cards: [testCard], editingTransaction: batch[1], transactions: batch }
  );
  const amount = page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]');
  assert.ok(amount);
  assert.equal(amount.value, '900,00', 'o formulário deve mostrar o preço integral, não a parcela');

  await act(async () => {
    setInputValue(amount, '1.200,00');
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, batch[1].id);
  assert.equal(saved[0].input.amount, 1200);
  assert.equal(saved[0].input.installmentPurchaseTotal, 1200);
  assert.equal(saved[0].input.installmentTotal, 3);
  assert.equal(saved[0].input.amountMode, 'total_divided');
  assert.equal(saved[0].scope, 'this_and_future');
});

test('editing an incomplete legacy installment split does not infer a false purchase total', async () => {
  const series = [
    {
      id: 'legacy-partial-paid', description: 'Compra antiga', amount: 40,
      date: '2026-10-10', competenceMonth: '2026-10', type: 'expense' as const,
      status: 'paid' as const, categoryId: 'category-test', creditCardId: testCard.id,
      paymentMethod: 'credit_card' as const, recurrence: 'installment' as const,
      installmentGroupId: 'legacy-series', installmentNumber: 1, installmentTotal: 3,
      partialSplitOriginalId: 'legacy-installment-1',
    },
    {
      id: 'legacy-installment-1', description: 'Compra antiga', amount: 60,
      date: '2026-10-10', competenceMonth: '2026-10', type: 'expense' as const,
      status: 'pending' as const, categoryId: 'category-test', creditCardId: testCard.id,
      paymentMethod: 'credit_card' as const, recurrence: 'installment' as const,
      installmentGroupId: 'legacy-series', installmentNumber: 1, installmentTotal: 3,
    },
    {
      id: 'legacy-installment-2', description: 'Compra antiga', amount: 100,
      date: '2026-11-10', competenceMonth: '2026-11', type: 'expense' as const,
      status: 'pending' as const, categoryId: 'category-test', creditCardId: testCard.id,
      paymentMethod: 'credit_card' as const, recurrence: 'installment' as const,
      installmentGroupId: 'legacy-series', installmentNumber: 2, installmentTotal: 3,
    },
  ];
  let saved: { input: CreateTransactionBatchInput; id?: string; scope?: CascadeScope } | undefined;
  const page = renderTransactionModal(
    (input, id, scope) => { saved = { input, id, scope }; },
    () => {},
    { cards: [testCard], editingTransaction: series[2], transactions: series }
  );
  const amount = page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]');
  assert.ok(amount);
  assert.equal(amount.value, '100,00', 'mostra a parcela selecionada, não uma soma incompleta como total');
  assert.ok(page.querySelector('[data-testid="legacy-installment-total-warning"]'));
  const cascadeButtons = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .filter((button) => button.textContent?.includes('Cascata: Este + próximos') || button.textContent?.includes('Toda a série'));
  assert.equal(cascadeButtons.length, 2);
  assert.ok(cascadeButtons.every((button) => button.disabled));

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved?.id, series[2].id);
  assert.equal(saved?.scope, 'single');
  assert.equal(saved?.input.installmentPurchaseTotal, undefined);
});

test('bank transfer rejects same source and destination, then submits both distinct accounts', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const accounts = [
    {
      id: 'account-test', name: 'Conta origem sintética', institution: 'Banco teste',
      type: 'checking' as const, initialBalance: 0, color: '#000000', includeInTotal: true,
    },
    secondAccount,
  ];
  const page = renderTransactionModal((input) => saved.push(input), () => {}, { accounts });
  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="mode-transfer-btn"]')?.click();
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-description-input"]')!, 'Transferência sintética');
    setInputValue(page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]')!, '50,00');
    const destination = page.querySelector<HTMLSelectElement>('#tx-transfer-destination-select');
    assert.ok(destination);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(destination, 'account-test');
    destination.dispatchEvent(new window.Event('change', { bubbles: true }));
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /contas de origem e destino diferentes/);
  assert.equal(saved.length, 0);

  await act(async () => {
    const destination = page.querySelector<HTMLSelectElement>('#tx-transfer-destination-select');
    assert.ok(destination);
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(destination, secondAccount.id);
    destination.dispatchEvent(new window.Event('change', { bubbles: true }));
    page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click();
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].type, 'transfer');
  assert.equal(saved[0].accountId, 'account-test');
  assert.equal(saved[0].destinationAccountId, secondAccount.id);
  assert.equal(saved[0].paymentMethod, 'transfer');
});

test('card bill payment selects the invoice month separately from the bank payment date', async () => {
  const saved: CreateTransactionBatchInput[] = [];
  const purchase: Transaction = {
    id: 'purchase-october', description: 'Compra do cartão', amount: 75,
    date: '2026-10-18', competenceMonth: '2026-10', type: 'expense', status: 'pending',
    categoryId: 'category-test', creditCardId: testCard.id, paymentMethod: 'credit_card',
    recurrence: 'single',
  };
  const page = renderTransactionModal((input) => saved.push(input), () => {}, {
    cards: [testCard], transactions: [purchase],
  });

  await act(async () => {
    page.querySelector<HTMLButtonElement>('[data-testid="mode-transfer-btn"]')?.click();
  });
  const billMode = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Pagamento de Fatura'));
  assert.ok(billMode);
  await act(async () => { billMode.click(); });

  const monthSelect = page.querySelector<HTMLSelectElement>('[data-testid="bill-invoice-month-select"]');
  const amount = page.querySelector<HTMLInputElement>('[data-testid="tx-amount-input"]');
  assert.ok(monthSelect && amount);
  await act(async () => {
    monthSelect.value = '2026-10';
    monthSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(amount.value, '75,00');
  assert.match(page.textContent ?? '', /Em aberto nesta fatura: R\$\s?75,00/);

  await act(async () => { page.querySelector<HTMLButtonElement>('[data-testid="tx-submit-btn"]')?.click(); });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].isInvoicePayment, true);
  assert.equal(saved[0].settledCardId, testCard.id);
  assert.equal(saved[0].competenceMonth, '2026-10');
  assert.equal(saved[0].amount, 75);
});
