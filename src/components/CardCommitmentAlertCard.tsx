import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CardCommitmentMonth } from '../utils/cardCommitment';
import { formatBRL, formatMonthYearPT } from '../utils/financeRules';

interface CardCommitmentAlertCardProps {
  alerts: CardCommitmentMonth[];
  limitPercent?: number;
  onOpen?: () => void;
}

function pct(value: number | null): string {
  return `${(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Aviso na Visão Geral: meses em que o cartão está perto ou acima do limite da renda. */
export const CardCommitmentAlertCard: React.FC<CardCommitmentAlertCardProps> = ({ alerts, limitPercent, onOpen }) => {
  if (alerts.length === 0) return null;
  return (
    <section
      aria-label="Cartão comprometendo a renda"
      data-testid="card-commitment-alert"
      className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-4 sm:p-5 space-y-2.5"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Cartão comprometendo a sua renda</h2>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((row) => (
          <li key={row.month} className="text-sm text-slate-800 dark:text-slate-200">
            <span className="font-semibold">{formatMonthYearPT(row.month)}:</span>{' '}
            {pct(row.cardPercent)} da renda ({formatBRL(row.cardTotal)}, parcelas {formatBRL(row.installmentTotal)}).{' '}
            <span className={row.status === 'over' ? 'font-bold text-rose-700' : 'font-semibold text-amber-700'}>
              {row.status === 'over' ? 'Acima' : 'Perto'} do seu limite de {pct(limitPercent ?? null)}.
            </span>
          </li>
        ))}
      </ul>
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 dark:bg-white px-3 text-xs font-bold text-white dark:text-slate-900"
        >
          Ver mês a mês
        </button>
      )}
    </section>
  );
};
