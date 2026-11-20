/** Projeção de parcelas dos próximos meses. Parte de CreditCardsTab (ver CreditCardsTab.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import type { CardPageContext } from './creditCardsTabContext';

export function InstallmentProjectionSection({ form }: { form: CardPageContext }) {
  const {
    futureProjections,
  } = form;
  return (
    <>
{/* Right: 6-Month Installment Projection */}
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-200 px-4 sm:px-6 py-4">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Projeção de Parcelas Futuras
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprometimento já contratado nos próximos 6 meses neste cartão
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {futureProjections.map((proj) => (
                <div
                  key={proj.month}
                  className="flex items-center justify-between px-4 sm:px-6 py-3.5"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">{proj.label}</p>
                    <p className="text-[11px] sm:text-xs text-slate-500">
                      <span>{proj.count} lançamento(s)</span>
                      <span aria-hidden="true"> · </span>
                      <span>{proj.isPaid ? 'Paga' : 'Prevista'}</span>
                    </p>
                  </div>
                  <p className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900">
                    {formatBRL(proj.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-3.5 bg-slate-50/60 rounded-b-xl">
            <p className="text-xs text-slate-600">
              Dica: Compras parceladas reduzem o limite total disponível até a quitação de cada parcela mensal.
            </p>
          </div>
        </section>
    </>
  );
}
