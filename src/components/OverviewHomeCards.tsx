import React from 'react';
import { ArrowRight, CreditCard as CreditCardIcon, Check } from 'lucide-react';
import {
  BankAccount,
  Category,
  CategorySpendItem,
  CreditCard,
  CreditCardSummary,
  MonthlyFinancialSummary,
  Transaction,
} from '../types/finance';
import { formatBRL, formatShortDateBR, summarizePendingBankMovements } from '../utils/financeRules';
import { calculateSharedMonthTotals } from '../utils/sharedFinanceRules';

/** Categoria padrão de moradia (seedData). */
const HOUSING_CATEGORY_ID = 'cat-moradia';

interface OverviewHomeCardsProps {
  monthlySummary: MonthlyFinancialSummary;
  pendingBills: Transaction[];
  accounts: BankAccount[];
  categories: Category[];
  cards: CreditCard[];
  cardSummaries: CreditCardSummary[];
  onToggleStatus: (txId: string) => void;
  onNavigateTab: (tab: 'transactions' | 'cards') => void;
  onNavigateToCard?: (cardId: string) => void;
  transactions: Transaction[];
  selectedMonth: string;
  categoryBreakdown: CategorySpendItem[];
}

const CARD_SHELL =
  'rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900';

const pct = (value: number, total: number) =>
  total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0;

/** Visão geral no formato do painel de referência: saldo previsto, contas a pagar e cartões. */
export const OverviewHomeCards: React.FC<OverviewHomeCardsProps> = ({
  monthlySummary,
  pendingBills,
  accounts,
  categories,
  cards,
  cardSummaries,
  onToggleStatus,
  onNavigateTab,
  onNavigateToCard,
  transactions,
  selectedMonth,
  categoryBreakdown,
}) => {
  const projected = monthlySummary.totalProjectedBalance;
  const income = monthlySummary.incomeTotal;
  const paid = monthlySummary.expenseRealized;
  const pending = monthlySummary.expensePending;
  const leftover = Math.max(0, projected);
  const barBase = Math.max(income, paid + pending + leftover, 1);

  const pendingSummary = summarizePendingBankMovements(pendingBills);
  const pendingTotal = pendingSummary.payableTotal;
  const payableBills = pendingSummary.payableItems;
  const visibleBills = payableBills.slice(0, 6);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '';
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name ?? '';

  return (
    <section aria-label="Resumo do mês" className="grid grid-cols-1 gap-4 lg:grid-cols-3 min-w-0">
      {/* Saldo previsto */}
      <article className={`${CARD_SHELL} lg:col-span-2 flex flex-col gap-6 min-w-0 self-start`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Saldo previsto</p>
            <p
              data-testid="overview-projected-balance"
              className={`mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                projected >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {formatBRL(projected)}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Valor estimado após pagar todas as contas do mês
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div
            role="img"
            aria-label={`Receitas ${formatBRL(income)}: pagas ${formatBRL(paid)}, pendentes ${formatBRL(
              pending
            )}, sobra ${formatBRL(leftover)}`}
            className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <span className="h-full bg-blue-600" style={{ width: `${pct(paid, barBase)}%` }} />
            <span className="h-full bg-blue-300" style={{ width: `${pct(pending, barBase)}%` }} />
            <span className="h-full bg-emerald-500" style={{ width: `${pct(leftover, barBase)}%` }} />
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-slate-900 dark:bg-white" aria-hidden="true" />
                Receitas
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">{formatBRL(income)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
                Pagas
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">{formatBRL(paid)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-300" aria-hidden="true" />
                Pendentes
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-slate-900 dark:text-white">{formatBRL(pending)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Sobra
              </dt>
              <dd className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBRL(leftover)}
              </dd>
            </div>
          </dl>
        </div>
      </article>

      {/* Contas a pagar */}
      <article className={`${CARD_SHELL} flex flex-col min-w-0`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Contas a pagar</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {formatBRL(pendingTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {payableBills.length} pendente(s) neste mês
            </p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800 min-h-0">
          {visibleBills.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma conta pendente neste mês.
            </li>
          )}
          {visibleBills.map((tx) => (
            <li key={tx.id} className="flex items-center gap-3 py-2.5 min-w-0">
              <button
                type="button"
                onClick={() => onToggleStatus(tx.id)}
                aria-label={`Marcar ${tx.description} como paga`}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-slate-300 text-transparent hover:border-blue-600 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-600"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{tx.description}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  Vence {formatShortDateBR(tx.date)}
                  {categoryName(tx.categoryId) ? ` · ${categoryName(tx.categoryId)}` : ''}
                  {accountName(tx.accountId) ? ` · ${accountName(tx.accountId)}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatBRL(tx.amount)}
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onNavigateTab('transactions')}
          className="mt-auto pt-3 inline-flex items-center gap-1 self-start text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400"
        >
          Ver fluxo de caixa <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </article>

      {/* Cartões */}
      <article className={`${CARD_SHELL} lg:col-span-3 min-w-0`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Cartões</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Fatura do mês e limite disponível</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('cards')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 dark:text-blue-400"
          >
            Gerenciar cartões <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {cards.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <CreditCardIcon className="h-5 w-5" aria-hidden="true" />
            Nenhum cartão cadastrado ainda.
          </div>
        ) : (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 snap-x">
            {cards.map((card) => {
              const summary = cardSummaries.find((s) => s.cardId === card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => (onNavigateToCard ? onNavigateToCard(card.id) : onNavigateTab('cards'))}
                  className="snap-start min-w-[260px] sm:min-w-[300px] rounded-2xl p-5 text-left text-white shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  style={{ background: `linear-gradient(135deg, ${card.color || '#111827'} 0%, #0f172a 100%)` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{card.name}</span>
                    <span className="text-[11px] uppercase tracking-wider opacity-80">{card.brand}</span>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="opacity-70">Fatura atual</p>
                      <p className="mt-0.5 text-base font-bold tabular-nums">
                        {formatBRL(summary?.invoiceTotal ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="opacity-70">Limite livre</p>
                      <p className="mt-0.5 text-base font-bold tabular-nums">
                        {formatBRL(summary?.availableLimit ?? card.limit)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] opacity-80">Vence dia {card.dueDay}</p>
                </button>
              );
            })}
          </div>
        )}
      </article>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:col-span-3 min-w-0">
      {/* Moradia: usa o mesmo resumo por categoria das demais telas */}
      {(() => {
        const housing = categoryBreakdown.find((item) => item.categoryId === HOUSING_CATEGORY_ID);
        const housingTotal = housing?.spent ?? 0;
        const share = pct(housingTotal, Math.max(income, 1));
        return (
          <article className={`${CARD_SHELL} min-w-0`}>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Moradia</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Quanto gastamos para morar</p>
            <p
              data-testid="overview-housing-total"
              className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white"
            >
              {formatBRL(housingTotal)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {income > 0 ? `${share.toFixed(0)}% da renda do mês` : 'Sem receita registrada no mês'}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full bg-blue-600" style={{ width: `${share}%` }} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Já pago</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatBRL(housing?.realizedSpent ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Pendente</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatBRL(housing?.pendingSpent ?? 0)}
                </dd>
              </div>
            </dl>
          </article>
        );
      })()}

      {/* Divisão da casa: mesma regra da aba Nossa casa */}
      {(() => {
        const shared = calculateSharedMonthTotals(transactions, selectedMonth);
        const total = Math.round((shared.owedToMe + shared.iOwe) * 100) / 100;
        const mine = pct(shared.owedToMe, total);
        return (
          <article className={`${CARD_SHELL} min-w-0`}>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Divisão da casa</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Acertos pendentes com a família</p>
            <p className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {formatBRL(total)}
            </p>
            {total > 0 && (
              <div
                className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="img"
                aria-label={`Te devem ${formatBRL(shared.owedToMe)}, você deve ${formatBRL(shared.iOwe)}`}
              >
                <span className="h-full bg-emerald-500" style={{ width: `${mine}%` }} />
                <span className="h-full bg-rose-400" style={{ width: `${100 - mine}%` }} />
              </div>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Te devem</dt>
                <dd
                  data-testid="overview-shared-owed-to-me"
                  className="mt-1 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
                >
                  {formatBRL(shared.owedToMe)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Você deve</dt>
                <dd
                  data-testid="overview-shared-i-owe"
                  className="mt-1 text-base font-semibold tabular-nums text-rose-700 dark:text-rose-400"
                >
                  {formatBRL(shared.iOwe)}
                </dd>
              </div>
            </dl>
            {total === 0 && (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nenhuma despesa compartilhada pendente.</p>
            )}
          </article>
        );
      })()}
      </div>
    </section>
  );
};
