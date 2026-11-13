import type { CardCommitmentMonth } from './cardCommitment';
import type { CashForecast } from './cashForecast';
import type { DataHealthIssue } from './dataHealth';
import { formatBRL, formatMonthYearPT } from './financeRules';

/** Avisos que aparecem no sininho (Notificações). Não entram na Visão Geral. */
export type AppNoticeAction = 'forecast' | 'commitment';
export type AppNoticeTone = 'danger' | 'warn' | 'info';

export interface AppNotice {
  id: string;
  tone: AppNoticeTone;
  title: string;
  detail?: string;
  action?: AppNoticeAction;
  actionLabel?: string;
}

const TONE_ORDER: Record<AppNoticeTone, number> = { danger: 0, warn: 1, info: 2 };

function formatDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

function percentText(value: number | null): string {
  return `${(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

/** Junta os avisos do sino (previsão, cartão e dados para revisar) numa lista só, do mais grave para o menos grave. */
export function buildAppNotices(input: {
  forecast?: CashForecast | null;
  dataHealthIssues?: DataHealthIssue[];
  commitmentAlerts?: CardCommitmentMonth[];
  commitmentLimitPercent?: number;
}): AppNotice[] {
  const notices: AppNotice[] = [];

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

/** Quantos avisos contam na bolinha do sino: só os que pedem atenção (os informativos aparecem na lista, sem contar). */
export function countBellNotices(notices: AppNotice[]): number {
  return notices.filter((notice) => notice.tone !== 'info').length;
}
