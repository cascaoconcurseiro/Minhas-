import React, { useMemo, useState } from 'react';
import { CreditCard as CreditCardIcon, ChevronDown, Settings } from 'lucide-react';
import type { Transaction } from '../types/finance';
import {
  calculateCardCommitmentByMonth,
  listCardCommitmentItems,
  normalizeCommitmentLimit,
  type CardCommitmentMonth,
  type CardCommitmentStatus,
} from '../utils/cardCommitment';
import { formatBRL } from '../utils/financeRules';

interface CardCommitmentSectionProps {
  transactions: Transaction[];
  /** Mês de hoje (YYYY-MM): a lista começa nele e segue para a frente (mês atual + 11). */
  referenceMonth: string;
  limitPercent?: number;
  warnPercent?: number;
  onOpenSettings?: () => void;
}

/** Quantos meses aparecem de início; os demais abrem no botão "Ver os outros meses". */
const VISIBLE_MONTHS = 6;

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  return `${MONTH_SHORT[Number(m) - 1]}/${year.slice(2)}`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

const BAR_COLORS: Record<CardCommitmentStatus, string> = {
  ok: 'bg-emerald-600',
  warning: 'bg-amber-500',
  over: 'bg-rose-600',
  no_limit: 'bg-blue-600',
  no_income: 'bg-slate-300',
};

const TEXT_COLORS: Record<CardCommitmentStatus, string> = {
  ok: 'text-emerald-700',
  warning: 'text-amber-700',
  over: 'text-rose-700',
  no_limit: 'text-slate-900',
  no_income: 'text-slate-500',
};

function statusNote(row: CardCommitmentMonth, limit: number | null): string {
  if (row.status === 'no_income') return 'sem renda lançada';
  if (row.status === 'over') return `acima do limite de ${formatPercent(limit ?? 0)}`;
  if (row.status === 'warning') return `perto do limite de ${formatPercent(limit ?? 0)}`;
  if (row.status === 'ok') return `dentro do limite de ${formatPercent(limit ?? 0)}`;
  return '';
}

/** Quanto da renda de cada mês está comprometido com o cartão, com a parte de parcelas separada. */
export const CardCommitmentSection: React.FC<CardCommitmentSectionProps> = ({
  transactions,
  referenceMonth,
  limitPercent,
  warnPercent,
  onOpenSettings,
}) => {
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const limit = normalizeCommitmentLimit(limitPercent);
  const rows = useMemo(
    () => calculateCardCommitmentByMonth({ transactions, referenceMonth, limitPercent: limit, warnPercent }),
    [transactions, referenceMonth, limit, warnPercent]
  );
  const items = useMemo(
    () => (openMonth ? listCardCommitmentItems(transactions, openMonth) : []),
    [transactions, openMonth]
  );

  const visibleRows = showAll ? rows : rows.slice(0, VISIBLE_MONTHS);
  const hiddenCount = rows.length - VISIBLE_MONTHS;
  const hasAnyCard = rows.some((row) => row.cardTotal > 0);
  const scaleMax = Math.max(10, limit ? limit * 1.5 : 0, ...rows.map((row) => row.cardPercent ?? 0));

  return (
    <section
      aria-label="Comprometimento do cartão mês a mês"
      data-testid="card-commitment"
      className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CreditCardIcon className="h-4 w-4 text-indigo-600 shrink-0" />
            Comprometimento do cartão mês a mês
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Quanto da renda do mês vai para o cartão (compras à vista, parceladas e fixas). A renda é só o que está
            lançado ou previsto no mês.
          </p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            data-testid="card-commitment-settings-btn"
            onClick={onOpenSettings}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-3.5 w-3.5" />
            {limit ? `Limite: ${formatPercent(limit)} da renda · alterar` : 'Definir limite'}
          </button>
        )}
      </div>

      {!hasAnyCard && (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-600" data-testid="card-commitment-empty">
          Nenhuma compra no cartão nos próximos meses. Quando você lançar compras no cartão, elas aparecem aqui.
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {visibleRows.map((row) => {
          const isOpen = openMonth === row.month;
          const isCurrent = row.month === referenceMonth;
          const barWidth = row.cardPercent === null ? 0 : Math.min(100, (row.cardPercent / scaleMax) * 100);
          const limitMarker = limit ? Math.min(100, (limit / scaleMax) * 100) : null;
          return (
            <li key={row.month} data-testid={`card-commitment-${row.month}`}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenMonth(isOpen ? null : row.month)}
                className="w-full min-h-14 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-14 shrink-0 text-xs font-bold uppercase ${
                      isCurrent ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {monthLabel(row.month)}
                    {isCurrent && <span className="block text-[9px] font-semibold normal-case text-blue-600">este mês</span>}
                  </span>
                  <span className="relative h-2.5 min-w-0 flex-1 rounded-full bg-slate-100">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${BAR_COLORS[row.status]}`}
                      style={{ width: `${barWidth}%` }}
                    />
                    {limitMarker !== null && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-slate-900/70"
                        style={{ left: `${limitMarker}%` }}
                      />
                    )}
                  </span>
                  <span className="w-24 shrink-0 text-right">
                    <span className={`block font-mono text-sm font-bold tabular-nums ${TEXT_COLORS[row.status]}`}>
                      {row.cardPercent === null ? '—' : formatPercent(row.cardPercent)}
                    </span>
                    <span className="block font-mono text-[11px] tabular-nums text-slate-600">
                      {formatBRL(row.cardTotal)}
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
                <p className="mt-1 pl-[68px] text-[11px] text-slate-500">
                  {row.cardTotal > 0
                    ? `Parcelas ${formatBRL(row.installmentTotal)}${
                        row.installmentPercent !== null ? ` (${formatPercent(row.installmentPercent)})` : ''
                      }`
                    : 'Sem compras no cartão'}
                  {row.income > 0 ? ` · renda ${formatBRL(row.income)}` : ''}
                  {statusNote(row, limit) ? ` · ${statusNote(row, limit)}` : ''}
                </p>
              </button>

              {isOpen && (
                <div className="mb-3 rounded-lg bg-slate-50 p-3 text-xs" data-testid="card-commitment-detail">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Total no cartão</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">{formatBRL(row.cardTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Parcelas</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">{formatBRL(row.installmentTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">À vista e fixas</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">{formatBRL(row.otherTotal)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Renda do mês</dt>
                      <dd className="font-mono font-bold tabular-nums text-slate-900">
                        {row.income > 0 ? formatBRL(row.income) : 'sem renda lançada'}
                      </dd>
                    </div>
                  </dl>
                  {items.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-2.5">
                      {items.slice(0, 12).map((item) => (
                        <li key={item.id} className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 break-words text-slate-800">
                            {item.description}
                            {item.installmentLabel && (
                              <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                {item.installmentLabel}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-slate-900">{formatBRL(item.amount)}</span>
                        </li>
                      ))}
                      {items.length > 12 && (
                        <li className="text-[11px] text-slate-500">e mais {items.length - 12} compra(s)</li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          data-testid="card-commitment-toggle"
          aria-expanded={showAll}
          onClick={() => {
            setShowAll((value) => !value);
            setOpenMonth(null);
          }}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          {showAll ? `Mostrar só os próximos ${VISIBLE_MONTHS} meses` : `Ver os outros ${hiddenCount} meses`}
        </button>
      )}
    </section>
  );
};
