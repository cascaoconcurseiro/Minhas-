import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';
import { BankReconciliationModal } from './BankReconciliationModal';

const { createRoot } = await import('react-dom/client');

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const account: BankAccount = {
  id: 'account-dom-synthetic',
  name: 'Conta sintética',
  institution: 'Banco sintético',
  type: 'checking',
  initialBalance: 0,
  color: '#059669',
  includeInTotal: true,
};

function renderModal(
  onCommitImport: (transactions: Transaction[], accountId: string) => void,
  options: { accounts?: BankAccount[]; cards?: CreditCard[]; existingTransactions?: Transaction[]; familyMembers?: FamilyMember[]; categories?: Category[] } = {}
) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(React.createElement(BankReconciliationModal, {
      isOpen: true,
      onClose: () => {},
      accounts: options.accounts ?? [account],
      cards: options.cards ?? [],
      categories: options.categories ?? [],
      familyMembers: options.familyMembers ?? [],
      existingTransactions: options.existingTransactions ?? [],
      onCommitImport,
      defaultAccountId: options.accounts?.[0]?.id ?? account.id,
    }));
  });
  return container;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
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

test('bank reconciliation warns about discarded invalid CSV rows and imports only valid rows', async () => {
  let imported: Transaction[] = [];
  let importedAccountId = '';
  const page = renderModal((transactions, accountId) => {
    imported = transactions;
    importedAccountId = accountId;
  });

  const pasteModeButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Colar Texto Manual'));
  assert.ok(pasteModeButton);
  await act(async () => { pasteModeButton.click(); });

  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  await act(async () => {
    setTextareaValue(textarea, 'Data;Descrição;Valor\n31/02/2026;Data inválida;12,00\n06/11/2026;Compra válida;-10,50');
  });
  const parseButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Processar Linhas Coladas'));
  assert.ok(parseButton);
  await act(async () => { parseButton.click(); });

  assert.match(page.querySelector('[role="status"]')?.textContent ?? '', /1 linha\(s\) inválida\(s\) foram ignoradas/);
  const commitButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Confirmar e Importar'));
  assert.ok(commitButton);
  await act(async () => { commitButton.click(); });

  assert.equal(importedAccountId, account.id);
  assert.equal(imported.length, 1);
  assert.equal(imported[0]?.date, '2026-11-06');
  assert.equal(imported[0]?.amount, 10.5);
  assert.equal(imported[0]?.description, 'Compra válida');
  assert.match(page.textContent ?? '', /1 lançamento\(s\) foram importados/);
});

test('changing the target account recalculates duplicate detection before import', async () => {
  const secondAccount: BankAccount = { ...account, id: 'account-second', name: 'Outra conta' };
  const existing: Transaction = {
    id: 'existing-synthetic', description: 'Compra mercado', amount: 20,
    date: '2026-11-06', competenceMonth: '2026-11', type: 'expense',
    status: 'paid', categoryId: 'cat-outros', accountId: secondAccount.id,
    paymentMethod: 'pix', recurrence: 'single',
  };
  let imported: Transaction[] = [];
  let importedAccountId = '';
  const page = renderModal((transactions, accountId) => {
    imported = transactions;
    importedAccountId = accountId;
  }, { accounts: [account, secondAccount], existingTransactions: [existing] });

  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Colar Texto Manual'))!.click();
  });
  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  await act(async () => {
    setTextareaValue(textarea, 'Data;Descrição;Valor\n06/11/2026;Compra mercado;-20,00');
  });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Processar Linhas Coladas'))!.click();
  });

  let candidateCheckbox = page.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Selecionar Compra mercado"]');
  assert.ok(candidateCheckbox);
  assert.equal(candidateCheckbox.checked, true, 'the row is new for the initially selected account');

  const accountSelect = page.querySelector<HTMLSelectElement>('select');
  assert.ok(accountSelect);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(accountSelect, secondAccount.id);
    accountSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });

  candidateCheckbox = page.querySelector<HTMLInputElement>('input[type="checkbox"][aria-label="Selecionar Compra mercado"]');
  assert.ok(candidateCheckbox);
  assert.equal(candidateCheckbox.checked, false, 'the row becomes a duplicate for the new target account');
  assert.match(page.textContent ?? '', /Mesma data/);

  const commitButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Confirmar e Importar'));
  assert.ok(commitButton);
  assert.equal(commitButton.disabled, true);
  await act(async () => { commitButton.click(); });
  assert.deepEqual(imported, []);
  assert.equal(importedAccountId, '');
});

test('bank reconciliation converts foreign rows and preserves original currency and rate', async () => {
  const usdAccount: BankAccount = {
    ...account, id: 'account-usd', name: 'Conta USD', type: 'international',
    currency: 'USD', initialBalanceForeign: 0, includeInTotal: false,
  };
  let imported: Transaction[] = [];
  let importedAccountId = '';
  const page = renderModal((transactions, accountId) => {
    imported = transactions;
    importedAccountId = accountId;
  }, {
    accounts: [account, usdAccount],
  });

  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Colar Texto Manual'))!.click();
  });
  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  const usdOfx = `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD</CURDEF><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261106120000</DTPOSTED><TRNAMT>-12.50</TRNAMT><FITID>USD-1</FITID><NAME>Compra teste</NAME></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  await act(async () => { setTextareaValue(textarea, usdOfx); });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Processar Linhas Coladas'))!.click();
  });

  const commitButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Confirmar e Importar'));
  assert.ok(commitButton);
  assert.equal(commitButton.disabled, true);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /extrato está em USD.*conta selecionada usa BRL/);

  const accountSelect = page.querySelector<HTMLSelectElement>('select');
  assert.ok(accountSelect);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set?.call(accountSelect, usdAccount.id);
    accountSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  assert.equal(commitButton.disabled, true);
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /Informe a taxa de conversão em BRL por 1 USD/);
  const rateInput = page.querySelector<HTMLInputElement>('[aria-label="Taxa de conversão USD para BRL"]');
  assert.ok(rateInput);
  await act(async () => { setInputValue(rateInput, '5,20'); });
  assert.equal(commitButton.disabled, false);
  assert.match(page.textContent ?? '', /US\$\s?12,50.*R\$\s?65,00/);
  await act(async () => { commitButton.click(); });
  assert.equal(imported.length, 1);
  assert.equal(importedAccountId, usdAccount.id);
  assert.equal(imported[0]?.amount, 65);
  assert.equal(imported[0]?.originalAmount, 12.5);
  assert.equal(imported[0]?.originalCurrency, 'USD');
  assert.equal(imported[0]?.exchangeRate, 5.2);
  assert.equal(imported[0]?.effectiveExchangeRate, 5.2);
  assert.equal(imported[0]?.currencyRegime, 'global_account');
});

test('bank reconciliation blocks statement fractions unsupported by the foreign currency precision', async () => {
  const jpyAccount: BankAccount = {
    ...account, id: 'account-jpy', name: 'Conta JPY', type: 'international',
    currency: 'JPY', initialBalanceForeign: 0, includeInTotal: false,
  };
  const page = renderModal(() => {}, { accounts: [jpyAccount] });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Colar Texto Manual'))!.click();
  });
  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  const jpyOfx = `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>JPY</CURDEF><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261106120000</DTPOSTED><TRNAMT>-12.50</TRNAMT><FITID>JPY-1</FITID><NAME>Compra teste</NAME></STMTTRN></BANKTRANLIST></STMTRNRS></BANKMSGSRSV1></OFX>`;
  await act(async () => { setTextareaValue(textarea, jpyOfx); });
  await act(async () => {
    [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Processar Linhas Coladas'))!.click();
  });
  assert.match(page.querySelector('[role="alert"]')?.textContent ?? '', /precisão inválida para JPY/);
  const commitButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Confirmar e Importar'));
  assert.ok(commitButton);
  assert.equal(commitButton.disabled, true);
});

test('bank reconciliation imports a uniquely matched card bill as a linked settlement', async () => {
  const card: CreditCard = {
    id: 'card-import-test', name: 'Cartão teste', brand: 'Visa', limit: 1000,
    closingDay: 20, dueDay: 28, defaultAccountId: account.id, color: '#123456',
  };
  const purchase: Transaction = {
    id: 'purchase-import-test', description: 'Compra no cartão', amount: 100,
    date: '2026-10-10', competenceMonth: '2026-10', type: 'expense',
    status: 'pending', categoryId: 'cat-outros', creditCardId: card.id,
    paymentMethod: 'credit_card', recurrence: 'single',
  };
  let imported: Transaction[] = [];
  const page = renderModal((transactions) => { imported = transactions; }, {
    cards: [card], existingTransactions: [purchase],
  });

  const pasteModeButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Colar Texto Manual'));
  assert.ok(pasteModeButton);
  await act(async () => { pasteModeButton.click(); });
  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  await act(async () => {
    setTextareaValue(textarea, 'Data;Descrição;Valor\n28/10/2026;PAGAMENTO FATURA CARTAO;-100,00');
  });
  const parseButton = [...page.querySelectorAll('button')]
    .find((button) => button.textContent?.includes('Processar Linhas Coladas'));
  assert.ok(parseButton);
  await act(async () => { parseButton.click(); });

  const billType = page.querySelector<HTMLSelectElement>('select[aria-label="Tipo de lançamento de PAGAMENTO FATURA CARTAO"]');
  assert.equal(billType?.value, 'invoice');
  assert.match(page.textContent ?? '', /Pagamento de fatura reconhecido/);
  const commitButton = [...page.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes('Confirmar e Importar'));
  assert.ok(commitButton);
  assert.equal(commitButton.disabled, false);
  await act(async () => { commitButton.click(); });

  assert.equal(imported.length, 1);
  assert.equal(imported[0]?.isInvoicePayment, true);
  assert.equal(imported[0]?.settledCardId, card.id);
  assert.equal(imported[0]?.settledInvoiceMonth, '2026-10');
});

test('statement import settles the matching pending bill and applies the usual split, saying so on each row', async () => {
  const mercado: Category = { id: 'cat-mercado', name: 'Supermercado e Feira', type: 'expense', bucket: 'essential', monthlyBudget: 0, color: '#059669', icon: 'shopping-cart' };
  const fran = { id: 'fam-fran', name: 'FRAN', color: '#ec4899', relationship: 'cônjuge' } as FamilyMember;
  const past = (id: string, date: string): Transaction => ({
    id, description: 'Padaria Doce', amount: 40, date, competenceMonth: '2026-10', type: 'expense', status: 'paid',
    categoryId: 'cat-mercado', paymentMethod: 'pix', recurrence: 'single', accountId: account.id, isShared: true,
    sharedMemberId: 'fam-fran', sharedAmount: 20, sharedPaidBy: 'me', sharedSplitMode: 'half', sharedStatus: 'pending',
  });
  const pendingBill: Transaction = {
    id: 'pending-luz', description: 'Conta de luz', amount: 180, date: '2026-11-08', competenceMonth: '2026-11', type: 'expense',
    status: 'pending', categoryId: 'cat-mercado', paymentMethod: 'boleto', recurrence: 'single', accountId: account.id,
  };
  let imported: Transaction[] = [];
  const page = renderModal((transactions) => { imported = transactions; }, {
    categories: [mercado], familyMembers: [fran], existingTransactions: [past('h1', '2026-10-01'), past('h2', '2026-10-05'), pendingBill],
  });
  const pasteModeButton = [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Colar Texto Manual'));
  assert.ok(pasteModeButton);
  await act(async () => { pasteModeButton.click(); });
  const textarea = page.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(textarea);
  await act(async () => {
    setTextareaValue(textarea, 'Data;Descrição;Valor\n10/11/2026;ENEL ENERGIA LUZ;-180,00\n11/11/2026;Padaria Doce;-55,00');
  });
  await act(async () => { [...page.querySelectorAll('button')].find((button) => button.textContent?.includes('Processar Linhas Coladas'))?.click(); });

  assert.match(page.textContent ?? '', /Quita a conta pendente "Conta de luz"/);
  assert.match(page.textContent ?? '', /Dividido com FRAN \(metade\) como nas últimas vezes/);
  assert.match(page.textContent ?? '', /Categoria pelo seu histórico/);

  await act(async () => { [...page.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Confirmar e Importar'))?.click(); });
  const settle = imported.find((tx) => tx.settlesPendingTransactionId === 'pending-luz');
  const shared = imported.find((tx) => tx.description === 'Padaria Doce');
  assert.ok(settle, 'a linha da luz quita a pendente');
  assert.equal(shared?.isShared, true);
  assert.equal(shared?.sharedAmount, 27.5);
});
