/** Viagem e câmbio, dividir com familiar e observações. Parte de TransactionModal (ver TransactionModal.tsx). */
import { TransactionNotesCard } from './TransactionNotesCard';
import { TransactionSharedCard } from './TransactionSharedCard';
import { TransactionTripCard } from './TransactionTripCard';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionExtrasSection({ form }: { form: TransactionFormContext }) {
  const {
    entryMode,
  } = form;
  return (
    <>
{/* Zone 2.2: Advanced Progressive Disclosure Cards (Viagem, Familiar & Notas via Botões Liga/Desliga) */}
            {entryMode !== 'transfer' && (
              <div
                data-testid="advanced-options-container"
                className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800"
              >
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vínculos & Rateios Opcionais
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Ative abaixo apenas se desejar vincular a um roteiro ou dividir despesas
                  </p>
                </div>

                <TransactionTripCard form={form} />

                <TransactionSharedCard form={form} />

                <TransactionNotesCard form={form} />
              </div>
            )}
    </>
  );
}
