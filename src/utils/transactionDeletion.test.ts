import '../test-utils/domEnvironment';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { confirmTransactionDeletion, getTransactionDeletionMessage } from './transactionDeletion';

const originalConfirm = window.confirm;
afterEach(() => { window.confirm = originalConfirm; });

test('deletion messages differ for single, series and invoice payment', () => {
  assert.equal(getTransactionDeletionMessage({ description: 'Aluguel' }), 'Excluir o lançamento "Aluguel"?');
  assert.equal(getTransactionDeletionMessage({ description: 'TV' }, true), 'Excluir este lançamento e todas as parcelas da série "TV"?');
  assert.equal(
    getTransactionDeletionMessage({ description: 'Fatura', isInvoicePayment: true }, true),
    'Excluir o pagamento da fatura e refazer o efeito cascata?'
  );
});

test('confirmation follows the user answer and ignores unknown transactions', () => {
  window.confirm = () => false;
  assert.equal(confirmTransactionDeletion({ description: 'Aluguel' }), false);
  window.confirm = () => true;
  assert.equal(confirmTransactionDeletion({ description: 'Aluguel' }), true);
  assert.equal(confirmTransactionDeletion(undefined), false);
});
