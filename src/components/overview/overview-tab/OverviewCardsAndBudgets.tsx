/** Cartões, faturas e orçamentos do mês. Parte de OverviewTab (ver OverviewTab.tsx). */
import { CreditCardFace } from '../../cards/CreditCardFace';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import { CardNetworkMark } from '../../cards/CardNetworkMark';
import { formatBRL } from '../../../domain/finance/financeRules';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import type { OverviewTabContext } from './overviewTabContext';

export function OverviewCardsAndBudgets({ form }: { form: OverviewTabContext }) {
  const {
    cardSummaries,
    cards,
    monthlySummary,
    onNavigateTab,
    onNavigateToCard,
    topCategories,
  } = form;
  return (
    <>
{/* Row 3: Credit Cards & Budget Thermometer */}
      <div data-testid="overview-cards-budgets-row" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch min-w-0">
        {/* Credit Cards Summary */}
        <section data-testid="overview-credit-card-summary" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 break-words sm:truncate">Faturas de Cartão de Crédito</h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                  Controle de parcelamentos e limite comprometido
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('cards')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar faturas
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {cards.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Nenhum cartão de crédito cadastrado ainda.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('cards')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    + Cadastrar Cartão de Crédito
                  </button>
                </div>
              ) : null}
              {cards.map((card) => {
                const summary = cardSummaries.find((s) => s.cardId === card.id);
                if (!summary) return null;
                return (
                  <div
                    key={card.id}
                    onClick={() =>
                      onNavigateToCard
                        ? onNavigateToCard(card.id)
                        : onNavigateTab('cards')
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onNavigateToCard) {
                          onNavigateToCard(card.id);
                        } else {
                          onNavigateTab('cards');
                        }
                      }
                    }}
                    className="group cursor-pointer p-4 sm:p-6 space-y-3 hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <CreditCardFace card={card} size="compact" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <CreditCardIcon className="h-4 w-4 text-slate-700 group-hover:text-blue-700 shrink-0" />
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors break-words sm:truncate">
                              {card.name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                            <CardNetworkMark brand={card.brand} />
                            <span aria-hidden="true"> · </span>
                            <span>Fecha dia {card.closingDay}</span>
                            <span aria-hidden="true"> · </span>
                            <span>Vence dia {card.dueDay}</span>
                            <span aria-hidden="true"> · </span>
                            <span className={summary.isInvoicePaid ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                              {summary.isInvoicePaid ? 'Fatura Paga' : 'Fatura Aberta'}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">Fatura do mês</p>
                        <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                          {formatBRL(summary.invoiceTotal)}
                        </p>
                        <p className="text-[11px] font-semibold text-blue-700">
                          Abrir fatura →
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600 font-mono tabular-nums mb-1">
                        <span>Tomado: {formatBRL(summary.usedLimit)}</span>
                        <span>Disponível: {formatBRL(summary.availableLimit)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all ${
                            summary.usagePercent > 80 ? 'bg-rose-600' : 'bg-slate-800'
                          }`}
                          style={{ width: `${Math.min(100, summary.usagePercent)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              Total em faturas neste mês: {formatBRL(monthlySummary.creditCardMonthTotal)}
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('cards')}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Ver detalhes dos cartões
            </button>
          </div>
        </section>

        {/* Budget Thermometer */}
        <section data-testid="overview-category-budgets" className="lg:col-span-6 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 sm:px-6 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900 break-words sm:truncate">
                  Teto de Gastos por Categoria
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 break-words sm:truncate">
                  Progresso frente ao orçamento mensal com alertas de limite
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('budgets')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar metas
              </button>
            </div>

            {/* Mobile Lateral Swipeable Cards (< sm screens) */}
            <div className="block sm:hidden p-4 min-w-0 overflow-hidden">
              <div className="swipe-x flex w-full gap-3 snap-x snap-mandatory no-scrollbar pb-1">
                {topCategories.map((item) => {
                  const barColor =
                    item.status === 'over'
                      ? 'bg-rose-600'
                      : item.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-600';
                  return (
                    <div
                      key={item.categoryId}
                      onClick={() => onNavigateTab('budgets')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onNavigateTab('budgets');
                      }}
                      className="w-[72vw] max-w-[260px] shrink-0 snap-start rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/60 dark:bg-slate-800/40 space-y-2 cursor-pointer active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <CategoryIconBadge
                            icon={item.categoryIcon}
                            color={item.categoryColor}
                            size="sm"
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-white break-words sm:truncate">
                            {item.categoryName}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-xs font-bold shrink-0 ${
                            item.status === 'over'
                              ? 'text-rose-700'
                              : item.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {item.percentOfBudget}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        <span>Gasto: <strong>{formatBRL(item.spent)}</strong></span>
                        <span>Teto: {formatBRL(item.budget)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 text-center">
                ← Deslize lateralmente para ver mais categorias →
              </p>
            </div>

            {/* Desktop Progress Bars (>= sm screens) */}
            <div className="hidden sm:block p-6 space-y-4">
              {topCategories.map((item) => {
                const barColor =
                  item.status === 'over'
                    ? 'bg-rose-600'
                    : item.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-600';
                const statusLabel =
                  item.status === 'over'
                    ? 'Orçamento Excedido!'
                    : item.status === 'warning'
                    ? 'Alerta: Próximo do Limite (>80%)'
                    : 'Dentro da meta';

                return (
                  <div key={item.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-900 min-w-0">
                        <CategoryIconBadge
                          icon={item.categoryIcon}
                          color={item.categoryColor}
                          size="sm"
                        />
                        <span className="break-words sm:truncate">{item.categoryName}</span>
                        <span className="text-slate-400 shrink-0" aria-hidden="true"> · </span>
                        <span
                          className={`break-words sm:truncate ${
                            item.status === 'over'
                              ? 'font-bold text-rose-700'
                              : item.status === 'warning'
                              ? 'font-semibold text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-slate-700 shrink-0">
                        <span className="font-semibold">{formatBRL(item.spent)}</span>
                        <span className="text-slate-400"> / {formatBRL(item.budget)}</span>
                        <span className="ml-1.5 text-slate-500">({item.percentOfBudget}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3.5 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2 rounded-b-xl">
            <span className="text-xs text-slate-600">
              Inclui gastos à vista no PIX/Boleto e parcelas do cartão no mês
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0"
            >
              Ver gráficos & relatórios
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
