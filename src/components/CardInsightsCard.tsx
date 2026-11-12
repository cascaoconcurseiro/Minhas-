import React from 'react';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import { formatBRL } from '../utils/financeRules';
import type { CardInsight, CardRecommendation } from '../utils/cardIntelligence';

interface CardInsightsCardProps {
  insights: CardInsight[];
  recommendation: CardRecommendation | null;
}

function formatDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

/** Por cartão: como a fatura aberta deve fechar e o melhor dia de compra. */
export const CardInsightsCard: React.FC<CardInsightsCardProps> = ({ insights, recommendation }) => {
  if (insights.length === 0) return null;

  return (
    <section
      aria-label="Cartões"
      data-testid="card-insights"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center gap-2">
        <CreditCardIcon className="h-4 w-4 text-indigo-600 shrink-0" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cartões</h2>
      </div>

      {recommendation && (
        <p data-testid="card-recommendation" className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Para comprar hoje, use o {recommendation.cardName}: você paga só em {formatDay(recommendation.dueDate)} ({recommendation.daysToPay} dias).
        </p>
      )}

      <ul className="space-y-2.5">
        {insights.map((item) => (
          <li key={item.cardId} data-testid={`card-insight-${item.cardId}`} className="text-sm text-slate-700 dark:text-slate-300 space-y-0.5">
            <p className="font-bold text-slate-900 dark:text-white">{item.cardName}</p>
            <p>
              Fatura com vencimento em {formatDay(item.dueDateIfBoughtToday)}: {formatBRL(item.openInvoiceTotal)} até agora
              {item.historyMonths > 0 && item.projectedInvoiceTotal > item.openInvoiceTotal
                ? `, deve fechar perto de ${formatBRL(item.projectedInvoiceTotal)} (média das últimas faturas).`
                : '.'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Melhor dia de compra: dia {item.bestPurchaseDay}, quando abre a fatura nova. Limite livre: {formatBRL(item.availableLimit)}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};
