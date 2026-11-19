/** Categoria, conta/cartão, transferência, fatura, data e repetição. Parte de TransactionModal (ver TransactionModal.tsx). */
import { TransactionCategoryAccountFields } from './TransactionCategoryAccountFields';
import { TransactionRecurrenceFields } from './TransactionRecurrenceFields';
import { TransactionTransferFields } from './TransactionTransferFields';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionCoreFields({ form }: { form: TransactionFormContext }) {
  const {
    entryMode,
  } = form;
  return (
    <>
{/* Core Unified Configuration Grid: Category, Account/Card, Transfer/Invoice Sub-Selector, Date & Recurrence */}
            {entryMode === 'transfer' ? (
              <div className="space-y-4">
                <TransactionTransferFields form={form} />
              </div>
            ) : (
              <div className="space-y-3">
                <TransactionCategoryAccountFields form={form} />

                <TransactionRecurrenceFields form={form} />
              </div>
            )}
    </>
  );
}
