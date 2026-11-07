import '../test-utils/domEnvironment';
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import type { BankAccount, Transaction } from '../types/finance';
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

function renderModal(onCommitImport: (transactions: Transaction[], accountId: string) => void) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(React.createElement(BankReconciliationModal, {
      isOpen: true,
      onClose: () => {},
      accounts: [account],
      categories: [],
      existingTransactions: [],
      onCommitImport,
      defaultAccountId: account.id,
    }));
  });
  return container;
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set?.call(textarea, value);
  textarea.dispatchEvent(new window.Event('input', { bubbles: true }));
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
