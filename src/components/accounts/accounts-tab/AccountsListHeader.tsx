/** Cabeçalho da lista de contas e atalhos. Parte de AccountsTab (ver AccountsTab.tsx). */
import { ArrowLeftRight, FileCheck2, Globe, Plus } from 'lucide-react';
import type { AccountsTabContext } from './accountsTabContext';

export function AccountsListHeader({ form }: { form: AccountsTabContext }) {
  const {
    onOpenNewTransaction,
    onOpenReconciliation,
    openNewAccountForm,
  } = form;
  return (
    <>
<div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Suas Contas Bancárias, Contas Internacionais (Wise / Nomad) e Carteiras
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique em qualquer conta abaixo para entrar na página exclusiva da conta. Suas contas internacionais (EUR, USD, GBP...) são independentes e não precisam ficar vinculadas a uma viagem.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewTransaction('transfer')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-slate-600" />
                  <span>Transferir entre Contas</span>
                </button>
                <button
                  type="button"
                  data-testid="open-new-intl-account-btn"
                  onClick={() => openNewAccountForm('international')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-sky-700" />
                  <span>+ Conta Internacional (Wise / Nomad)</span>
                </button>
                {onOpenReconciliation && (
                  <button
                    type="button"
                    onClick={() => onOpenReconciliation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors"
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Importar Extrato / OFX</span>
                  </button>
                )}
                <button
                  type="button"
                  data-testid="open-new-account-btn"
                  onClick={() => openNewAccountForm('checking')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nova Conta / Carteira</span>
                </button>
              </div>
            </div>
    </>
  );
}
