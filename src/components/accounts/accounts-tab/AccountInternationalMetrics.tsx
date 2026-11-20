/** Métricas de conta internacional. Parte de AccountsTab (ver AccountsTab.tsx). */
import { CURRENCY_CATALOG, formatForeignCurrency } from '../../../domain/trips/travelRules';
import type { AccountDetailContext } from './accountsTabContext';

export function AccountInternationalMetrics({ form }: { form: AccountDetailContext }) {
  const {
    activeAccount,
    getInternationalAccountForeignMetrics,
  } = form;
  return (
    <>
{activeAccount && activeAccount.type === 'international' && (() => {
            const intlMetrics = getInternationalAccountForeignMetrics(activeAccount);
            return (
              <div
                data-testid="intl-account-dedicated-banner"
                className="rounded-xl border border-sky-200 bg-sky-50/90 p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {CURRENCY_CATALOG[intlMetrics.currency].flag}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-sky-900">
                        Conta Internacional em {intlMetrics.currency}{activeAccount.institution ? ` (${activeAccount.institution})` : ''}
                      </span>
                    </div>
                    <p className="text-xs text-sky-800 mt-0.5">
                      Saldo em Moeda Estrangeira:{' '}
                      <strong className="font-mono">
                        {formatForeignCurrency(
                          intlMetrics.currentForeignBalance,
                          intlMetrics.currency
                        )}
                      </strong>{' '}
                      · Lotes de câmbio creditados:{' '}
                      <strong className="font-mono">
                        +{formatForeignCurrency(intlMetrics.purchasedLotsForeign, intlMetrics.currency)}
                      </strong>{' '}
                      · Gastos realizados:{' '}
                      <strong className="font-mono">
                        -{formatForeignCurrency(intlMetrics.spentForeign, intlMetrics.currency)}
                      </strong>
                      {' '}· Depósitos realizados: <strong className="font-mono">
                        +{formatForeignCurrency(intlMetrics.receivedForeign, intlMetrics.currency)}
                      </strong>
                      {(intlMetrics.pendingForeign > 0 || intlMetrics.pendingIncomeForeign > 0) && (
                        <>
                          {' '}· Despesas pendentes: <strong className="font-mono">
                            -{formatForeignCurrency(intlMetrics.pendingForeign, intlMetrics.currency)}
                          </strong>{' '}· Receitas pendentes: <strong className="font-mono">
                            +{formatForeignCurrency(intlMetrics.pendingIncomeForeign, intlMetrics.currency)}
                          </strong>{' '}· Saldo previsto: <strong className="font-mono">
                            {formatForeignCurrency(intlMetrics.projectedForeignBalance, intlMetrics.currency)}
                          </strong>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
    </>
  );
}
