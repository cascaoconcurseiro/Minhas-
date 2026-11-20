/** Escolha da conta, câmbio, arquivo ou texto colado. Parte de BankReconciliationModal (ver BankReconciliationModal.tsx). */
import { getAccountLabelWithBank } from '../../../domain/finance/accountLabels';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { FileText } from 'lucide-react';
import type { BankReconciliationModalContext } from './bankReconciliationContext';

export function ReconciliationControls({ form }: { form: BankReconciliationModalContext }) {
  const {
    accounts,
    currentAccount,
    handleAccountChange,
    onAddAccount,
    pasteMode,
    selectedAccountId,
    setPasteMode,
    setSelectedAccountId,
    statementMeta,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Conta Vinculada:
            </span>
            {accounts.length > 0 ? (
              <>
                <select
                  value={selectedAccountId}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {getAccountLabelWithBank(acc, accounts)}
                    </option>
                  ))}
                </select>
                {currentAccount && (
                  <>
                    <InstitutionMark
                      institution={currentAccount.institution}
                      accountName={currentAccount.name}
                      color={currentAccount.color}
                      size="xs"
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: currentAccount.color }}
                      title={`Cor da conta: ${currentAccount.name}`}
                    />
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (onAddAccount) {
                    const created = onAddAccount({
                      name: statementMeta.bankId === '260' ? 'Nubank Principal' : 'Conta Corrente',
                      institution: statementMeta.bankId === '260' ? 'Nubank' : 'Banco',
                      type: 'checking',
                      initialBalance: 0,
                      color: statementMeta.bankId === '260' ? '#7c3aed' : '#059669',
                      includeInTotal: true,
                    });
                    if (created) setSelectedAccountId(created.id);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
              >
                + Criar Conta Automática
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPasteMode(!pasteMode)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <FileText className="h-3.5 w-3.5" />
              {pasteMode ? 'Ocultar Colagem' : 'Colar Texto Manual'}
            </button>
          </div>
        </div>
    </>
  );
}
