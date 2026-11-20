/** Lista de contas e carteiras. Parte de AccountsTab (ver AccountsTab.tsx). */
import { ChevronRight, Edit3, Globe, Plus, Trash2, Wallet } from 'lucide-react';
import { InstitutionMark } from '../InstitutionMark';
import { CURRENCY_CATALOG, formatForeignCurrency } from '../../../domain/trips/travelRules';
import { formatBRL } from '../../../domain/finance/financeRules';
import type { AccountsTabContext } from './accountsTabContext';

export function AccountsListSection({ form }: { form: AccountsTabContext }) {
  const {
    accountBalances,
    accounts,
    getAccountTypeLabel,
    getInternationalAccountForeignMetrics,
    onDeleteAccount,
    onToggleAccountInTotal,
    openEditAccountForm,
    openNewAccountForm,
    setActiveViewAccountId,
    setIsAdjustingInitial,
    setSelectedAccountId,
    trips,
  } = form;
  return (
    <>
{accounts.length === 0 ? (
              <div
                data-testid="accounts-empty-state"
                className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center space-y-3"
              >
                <Wallet className="mx-auto h-9 w-9 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Nenhuma conta cadastrada ainda
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Sem dados fictícios (mock): cadastre apenas as suas contas reais (Itaú, Nubank, Inter, Caixa) ou contas internacionais (Wise, Nomad, Avenue, C6 Global).
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openNewAccountForm('checking')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Cadastrar Conta Nacional (R$)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewAccountForm('international')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
                  >
                    <Globe className="h-3.5 w-3.5 text-sky-700" />
                    <span>Cadastrar Conta Internacional (Wise / Nomad)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Clean Grid of Account Cards — Click any card to enter its dedicated page */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc) => {
                  const bal = accountBalances.find((b) => b.accountId === acc.id);
                  const current = bal?.currentBalance ?? acc.initialBalance;
                  const projected = bal?.projectedBalance ?? acc.initialBalance;
                  const isIntl = acc.type === 'international';
                  const intlMetrics = isIntl
                    ? getInternationalAccountForeignMetrics(acc)
                    : null;

                  return (
                    <div
                      key={acc.id}
                      data-testid={`account-card-${acc.id}`}
                      onClick={() => {
                        setSelectedAccountId(acc.id);
                        setActiveViewAccountId(acc.id);
                        setIsAdjustingInitial(false);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedAccountId(acc.id);
                          setActiveViewAccountId(acc.id);
                        }
                      }}
                      className={`group rounded-2xl border p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                        isIntl
                          ? 'border-sky-200 bg-gradient-to-br from-white to-sky-50/40 hover:border-sky-500 hover:shadow-md'
                          : 'border-slate-200 bg-white hover:border-blue-500 hover:shadow-md'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="shrink-0"
                            >
                              <InstitutionMark
                                institution={acc.institution}
                                accountName={acc.name}
                                color={acc.color}
                                size="sm"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 block break-words sm:truncate group-hover:text-emerald-700 transition-colors">
                                  {acc.name}
                                </span>
                                {isIntl && intlMetrics && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-900 border border-sky-200">
                                    {CURRENCY_CATALOG[intlMetrics.currency].flag}{' '}
                                    {intlMetrics.currency}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 break-words sm:truncate">
                                {acc.institution} · {getAccountTypeLabel(acc.type, acc.currency)}
                              </p>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEditAccountForm(acc)}
                              aria-label={`Editar conta ${acc.name}`}
                              title="Editar conta"
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:h-auto sm:w-auto sm:p-1.5"
                            >
                              <Edit3 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </button>
                            {onDeleteAccount && (
                              <button
                                type="button"
                                onClick={() => {
                                  const tripNames = trips
                                    .filter((trip) =>
                                      trip.linkedAccountId === acc.id ||
                                      trip.exchangeLots.some((lot) => lot.accountId === acc.id)
                                    )
                                    .map((trip) => trip.name);
                                  if (tripNames.length > 0) {
                                    window.alert(
                                      `Não é possível excluir a conta enquanto estiver vinculada às viagens: ${[...new Set(tripNames)].join(', ')}. Remova ou troque o vínculo e as referências de câmbio da viagem primeiro.`
                                    );
                                    return;
                                  }
                                  const confirmed = window.confirm(
                                    `Excluir a conta "${acc.name}"? Cartões e lançamentos serão transferidos para outra conta cadastrada quando possível; transferências que ficarem sem origem ou destino válido poderão ser removidas. Esta ação não pode ser desfeita.`
                                  );
                                  if (confirmed) onDeleteAccount(acc.id);
                                }}
                                aria-label={`Excluir conta ${acc.name}`}
                                title="Excluir conta"
                                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 sm:h-auto sm:w-auto sm:p-1.5"
                              >
                                <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {isIntl && intlMetrics ? (
                          <div>
                            <p className="text-[11px] font-medium text-sky-800">
                              Saldo na Moeda ({intlMetrics.currency})
                            </p>
                            <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
                              {formatForeignCurrency(
                                intlMetrics.currentForeignBalance,
                                intlMetrics.currency
                              )}
                            </p>
                            <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-0.5">
                              Equiv. câmbio médio: {formatBRL(intlMetrics.estimatedBrlValue)}
                            </p>
                            {(intlMetrics.pendingForeign > 0 || intlMetrics.pendingIncomeForeign > 0) && (
                              <p className="text-[11px] font-mono tabular-nums text-amber-700 mt-0.5">
                                Após pendências: {formatForeignCurrency(intlMetrics.projectedForeignBalance, intlMetrics.currency)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-[11px] font-medium text-slate-500">
                                Saldo Atual em Conta
                              </p>
                              <p
                                className={`text-xl font-extrabold font-mono tabular-nums ${
                                  current >= 0 ? 'text-slate-900' : 'text-rose-700'
                                }`}
                              >
                                {formatBRL(current)}
                              </p>
                            </div>

                            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <span className="font-mono tabular-nums text-slate-500">
                                Previsto mês: {formatBRL(projected)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleAccountInTotal(acc.id);
                                }}
                                className={`font-semibold underline max-sm:-my-2.5 max-sm:px-1 max-sm:py-2.5 ${
                                  acc.includeInTotal ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                {acc.includeInTotal ? 'No giro' : 'Reserva'}
                              </button>
                            </div>
                          </>
                        )}

                        <div className="pt-2 flex items-center justify-between text-xs font-bold text-emerald-700 group-hover:text-emerald-800">
                          <span>Abrir página e extrato da conta</span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
    </>
  );
}
