/** Saldos por conta e contas a pagar. Parte de OverviewTab (ver OverviewTab.tsx). */
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { formatBRL, formatShortDateBR } from '../../../domain/finance/financeRules';
import { CheckCircle2, CreditCard as CreditCardIcon, Plus } from 'lucide-react';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewAccountsAndBills({ form }: { form: OverviewTabContext }) {
  const {
    accMap,
    accountBalances,
    accounts,
    billsFilterMode,
    billsLimit,
    catMap,
    monthlySummary,
    onNavigateTab,
    onNavigateToAccount,
    onNavigateToCard,
    onOpenNewTransaction,
    onToggleAccountInTotal,
    onToggleStatus,
    paidBankBills,
    pendingBills,
    pendingCount,
    pendingInvoices,
    selectedMonth,
    setBillsFilterMode,
    setBillsLimit,
    todayMonth,
  } = form;
  return (
    <>
{/* Row 2: Accounts & Pending Bills (2-Column Split) */}
      <div data-testid="overview-accounts-bills-row" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
        {/* Left: Contas & Carteiras */}
        <section data-testid="overview-account-balances" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 break-words sm:truncate">Saldos por Conta e Carteira</h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                  Controle 100% manual sem vínculo bancário automático
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('accounts')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0 max-sm:min-h-10 max-sm:inline-flex max-sm:items-center"
              >
                Gerenciar contas
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {accounts.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Nenhuma conta bancária ou carteira global cadastrada ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('accounts')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                  >
                    + Cadastrar Primeira Conta
                  </button>
                </div>
              ) : (
                accounts.map((acc) => {
                  const bal = accountBalances.find((b) => b.accountId === acc.id);
                  const current = bal?.currentBalance ?? acc.initialBalance;
                  const typeLabel =
                    acc.type === 'checking'
                      ? 'Conta Corrente'
                      : acc.type === 'cash'
                      ? 'Dinheiro'
                      : acc.type === 'investment'
                      ? 'Reserva / Investimento'
                      : acc.type === 'international'
                      ? `Conta Global (${acc.currency || 'EUR'})`
                      : 'Poupança';

                  return (
                    <div
                      key={acc.id}
                      onClick={() =>
                        onNavigateToAccount
                          ? onNavigateToAccount(acc.id)
                          : onNavigateTab('accounts')
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onNavigateToAccount) {
                            onNavigateToAccount(acc.id);
                          } else {
                            onNavigateTab('accounts');
                          }
                        }
                      }}
                      className="group cursor-pointer flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 hover:bg-emerald-50/50 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3 pr-2">
                        <InstitutionMark institution={acc.institution} accountName={acc.name} color={acc.color} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors break-words sm:truncate">
                            {acc.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                            <span>{acc.institution}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{typeLabel}</span>
                            <span aria-hidden="true"> · </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleAccountInTotal(acc.id);
                              }}
                              className="text-slate-600 underline hover:text-slate-900 max-sm:-my-2.5 max-sm:px-1 max-sm:py-2.5"
                            >
                              {acc.includeInTotal ? 'No giro mensal' : 'Fora do giro'}
                            </button>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold font-mono tabular-nums ${
                            current >= 0 ? 'text-slate-900' : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(current)}
                        </p>
                        <p className="text-xs font-mono tabular-nums text-emerald-700 font-medium">
                          Ver extrato →
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs font-medium text-slate-600">
              Resultado líquido projetado no mês
            </span>
            <span
              className={`text-sm font-bold font-mono tabular-nums ${
                monthlySummary.netResultProjected >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {monthlySummary.netResultProjected >= 0 ? '+' : ''}
              {formatBRL(monthlySummary.netResultProjected)} ({monthlySummary.savingsRateProjected}% da renda)
            </span>
          </div>
        </section>

        {/* Right: Contas a Pagar e a Receber Pendentes (Baixa Rápida & Reversão) */}
        <section data-testid="overview-pending-bills" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 break-words sm:truncate">
                  Contas a Pagar e a Receber
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                  {billsFilterMode === 'pending'
                    ? 'Clique em Efetivar ao pagar/receber — ou alterne para Efetivados se marcou errado'
                    : 'Marcou como pago por engano? Clique em Reverter p/ Pendente para voltar ao que era'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => { setBillsFilterMode('pending'); setBillsLimit(20); }}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      billsFilterMode === 'pending'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pendentes ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBillsFilterMode('paid'); setBillsLimit(20); }}
                    className={`rounded-md px-2.5 py-1 transition-all ${
                      billsFilterMode === 'paid'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Efetivados ({paidBankBills.length})
                  </button>
                </div>
              </div>
            </div>

            {billsFilterMode === 'pending' ? (
              pendingCount === 0 ? (
                <div className="px-4 sm:px-6 py-12 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-900">
                    Não há contas a pagar ou receber pendentes neste período.
                  </p>
                  {paidBankBills.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Se você efetivou alguma conta por engano, alterne para a aba &ldquo;Efetivados ({paidBankBills.length})&rdquo; acima.
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => onOpenNewTransaction('expense')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agendar Nova Conta
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                  {pendingInvoices.map((inv) => (
                    <div
                      key={`invoice-${inv.cardId}-${inv.invoiceMonth}`}
                      data-testid="pending-card-invoice"
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                          <CreditCardIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 break-words sm:truncate">
                            Fatura {inv.cardName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                            <span className="font-mono tabular-nums">Vence {formatShortDateBR(inv.dueDate)}</span>
                            {inv.isOverdue && (
                              <span className="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-700">
                                Atrasada
                              </span>
                            )}
                            <span aria-hidden="true"> · </span>
                            <span>Cartão de crédito</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                        <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-rose-700">
                          -{formatBRL(inv.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => (onNavigateToCard ? onNavigateToCard(inv.cardId) : onNavigateTab('cards'))}
                          aria-label={`Pagar fatura ${inv.cardName}`}
                          className="rounded-lg border border-violet-600/30 bg-violet-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          Pagar fatura
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingBills.slice(0, billsLimit).map((tx) => {
                    const cat = catMap.get(tx.categoryId);
                    const catName = cat?.name || 'Geral';
                    const accName = accMap.get(tx.accountId || '') || 'Conta';
                    return (
                      <div
                        key={tx.id}
                        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                          <CategoryIconBadge
                            icon={cat?.icon}
                            color={cat?.color}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 break-words sm:truncate">
                              {tx.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                              <span className="font-mono tabular-nums">
                                Vence {formatShortDateBR(tx.date)}
                              </span>
                              {selectedMonth === todayMonth && tx.competenceMonth < selectedMonth && (
                                <span className="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[10px] font-bold text-rose-700">
                                  Atrasada
                                </span>
                              )}
                              <span aria-hidden="true"> · </span>
                              <span>
                                {catName}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span>{accName}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                          <span
                            className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                              tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatBRL(tx.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(tx.id)}
                            aria-label={`Efetivar ${tx.description}`}
                            className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            Efetivar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {pendingBills.length > billsLimit && (
                    <button
                      type="button"
                      data-testid="bills-show-more"
                      onClick={() => setBillsLimit((limit) => limit + 40)}
                      className="w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50"
                    >
                      Mostrar mais ({pendingBills.length - billsLimit})
                    </button>
                  )}
                </div>
              )
            ) : paidBankBills.length === 0 ? (
              <div className="px-4 sm:px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  Nenhum lançamento bancário efetivado neste mês ainda.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto custom-scrollbar">
                {paidBankBills.slice(0, billsLimit).map((tx) => {
                  const cat = catMap.get(tx.categoryId);
                  const catName = cat?.name || 'Geral';
                  const accName = accMap.get(tx.accountId || '') || 'Conta';
                  return (
                    <div
                      key={tx.id}
                      className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-6 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto sm:flex-1">
                        <CategoryIconBadge
                          icon={cat?.icon}
                          color={cat?.color}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-slate-900 break-words sm:truncate">
                              {tx.description}
                            </p>
                            {tx.isInvoicePayment && (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 shrink-0">
                                Baixa de Fatura
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                            <span className="font-mono tabular-nums">
                              Pago em {formatShortDateBR(tx.date)}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span>{catName}</span>
                            <span aria-hidden="true"> · </span>
                            <span>{accName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono tabular-nums ${
                            tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatBRL(tx.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(tx.id)}
                          aria-label={`Reverter ${tx.description} para pendente`}
                          className="rounded-lg border border-amber-500/40 bg-amber-50 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500 hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          {tx.isInvoicePayment ? '↩ Estornar Fatura' : '↩ Voltar p/ Pendente'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {paidBankBills.length > billsLimit && (
                  <button
                    type="button"
                    data-testid="bills-show-more"
                    onClick={() => setBillsLimit((limit) => limit + 40)}
                    className="w-full px-4 py-3 text-xs font-bold text-blue-700 hover:bg-slate-50"
                  >
                    Mostrar mais ({paidBankBills.length - billsLimit})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600">
              {pendingCount} lançamento(s) aguardando baixa
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('transactions')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0 max-sm:min-h-10 max-sm:inline-flex max-sm:items-center"
            >
              Ver extrato completo
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
