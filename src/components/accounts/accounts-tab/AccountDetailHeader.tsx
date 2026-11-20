/** Cabeçalho da conta aberta. Parte de AccountsTab (ver AccountsTab.tsx). */
import { ArrowLeft } from 'lucide-react';
import { InstitutionMark } from '../InstitutionMark';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountDetailHeader({ form }: { form: AccountDetailContext }) {
  const {
    accounts,
    activeAccount,
    getAccountTypeLabel,
    setActiveViewAccountId,
    setIsAdjustingInitial,
    setSelectedAccountId,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <button
              type="button"
              data-testid="back-to-accounts-list-btn"
              onClick={() => setActiveViewAccountId(null)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar para Todas as Contas ({accounts.length})</span>
            </button>

            <div className="flex min-w-0 items-center gap-2.5">
              <InstitutionMark
                institution={activeAccount.institution}
                accountName={activeAccount.name}
                color={activeAccount.color}
                size="sm"
              />
              <div className="min-w-0">
                <p className="break-words sm:truncate text-xs font-bold text-slate-900">
                  {activeAccount.name}
                </p>
                <p className="break-words sm:truncate text-[10px] text-slate-500">
                  {activeAccount.institution} · {getAccountTypeLabel(activeAccount.type, activeAccount.currency)}
                </p>
              </div>
            </div>

            {accounts.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">
                  Alternar conta:
                </span>
                {accounts.map((acc) => {
                  const isCurrent = acc.id === activeAccount.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveViewAccountId(acc.id);
                        setIsAdjustingInitial(false);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isCurrent
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: isCurrent ? '#ffffff' : acc.color || '#059669' }}
                      />
                      <span>{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
    </>
  );
}
