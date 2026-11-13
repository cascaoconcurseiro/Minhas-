import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, Info } from 'lucide-react';
import type { CardCommitmentMonth } from '../utils/cardCommitment';
import type { CashForecast } from '../utils/cashForecast';
import type { DataHealthIssue } from '../utils/dataHealth';
import { formatBRL, formatMonthYearPT } from '../utils/financeRules';

export type OverviewNoticeTone = 'danger' | 'warn' | 'info';

export interface OverviewNotice {
  id: string;
  tone: OverviewNoticeTone;
  title: string;
  detail?: string;
  action?: 'forecast' | 'commitment';
  actionLabel?: string;
}

const TONE_ORDER: Record<OverviewNoticeTone, number> = { danger: 0, warn: 1, info: 2 };

function formatDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function percentText(value: number | null): string {
  return `${(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Junta os avisos da Visão Geral numa lista só, do mais grave para o menos grave. */
export function buildOverviewNotices(input: {
  forecast?: CashForecast | null;
  dataHealthIssues?: DataHealthIssue[];
  commitmentAlerts?: CardCommitmentMonth[];
  commitmentLimitPercent?: number;
}): OverviewNotice[] {
  const notices: OverviewNotice[] = [];

  const negative = input.forecast?.firstNegative;
  if (negative) {
    notices.push({
      id: 'forecast-negative',
      tone: 'danger',
      title: `Saldo previsto fica negativo em ${formatDay(negative.date)} (${formatBRL(negative.balance)})`,
      detail: 'Veja o que vence até lá.',
      action: 'forecast',
      actionLabel: 'Ver previsão',
    });
  }

  for (const row of input.commitmentAlerts ?? []) {
    const over = row.status === 'over';
    notices.push({
      id: `commitment-${row.month}`,
      tone: over ? 'danger' : 'warn',
      title: `Cartão em ${percentText(row.cardPercent)} da renda em ${formatMonthYearPT(row.month)}`,
      detail: `${formatBRL(row.cardTotal)} no cartão, ${over ? 'acima' : 'perto'} do seu limite de ${percentText(input.commitmentLimitPercent ?? null)}.`,
      action: 'commitment',
      actionLabel: 'Ver mês a mês',
    });
  }

  for (const issue of input.dataHealthIssues ?? []) {
    notices.push({
      id: `health-${issue.id}`,
      tone: issue.severity === 'warn' ? 'warn' : 'info',
      title: issue.title,
      detail: issue.detail,
    });
  }

  return notices.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

interface OverviewNoticesProps {
  notices: OverviewNotice[];
  onOpenCommitment?: () => void;
  /** Quantos avisos aparecem antes de "Ver todos". */
  initialVisible?: number;
}

const TONE_STYLES: Record<OverviewNoticeTone, { icon: string; accent: string }> = {
  danger: { icon: 'text-rose-600', accent: 'border-l-rose-500' },
  warn: { icon: 'text-amber-600', accent: 'border-l-amber-500' },
  info: { icon: 'text-slate-400', accent: 'border-l-slate-300 dark:border-l-slate-600' },
};

function scrollToForecast() {
  document.getElementById('overview-cash-forecast')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Avisos da Visão Geral num bloco só, compacto e no mesmo padrão dos outros cartões do painel.
 * Fica dentro do cabeçalho, então não muda a posição dos demais cartões da grade.
 */
export const OverviewNotices: React.FC<OverviewNoticesProps> = ({ notices, onOpenCommitment, initialVisible = 3 }) => {
  const [showAll, setShowAll] = useState(false);
  if (notices.length === 0) return null;

  const worst = notices[0].tone;
  const visible = showAll ? notices : notices.slice(0, initialVisible);
  const hidden = notices.length - initialVisible;

  return (
    <section
      aria-label="Avisos"
      data-testid="overview-notices"
      className={`min-w-0 rounded-xl border border-l-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${TONE_STYLES[worst].accent}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <AlertTriangle className={`h-3.5 w-3.5 ${TONE_STYLES[worst].icon}`} />
          Avisos
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
            {notices.length}
          </span>
        </h2>
      </div>

      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((notice) => {
          const handler =
            notice.action === 'forecast' ? scrollToForecast : notice.action === 'commitment' ? onOpenCommitment : undefined;
          return (
            <li
              key={notice.id}
              data-testid={`overview-notice-${notice.id}`}
              className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                {notice.tone === 'info' ? (
                  <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE_STYLES[notice.tone].icon}`} />
                ) : (
                  <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${TONE_STYLES[notice.tone].icon}`} />
                )}
                <p className="min-w-0 text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-semibold">{notice.title}</span>
                  {notice.detail && (
                    <span className="text-slate-500 dark:text-slate-400"> · {notice.detail}</span>
                  )}
                </p>
              </div>
              {handler && notice.actionLabel && (
                <button
                  type="button"
                  onClick={handler}
                  className="inline-flex min-h-9 shrink-0 items-center self-end rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 sm:self-auto"
                >
                  {notice.actionLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          data-testid="overview-notices-toggle"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? 'Mostrar menos' : `Ver todos os ${notices.length} avisos`}
        </button>
      )}
    </section>
  );
};
