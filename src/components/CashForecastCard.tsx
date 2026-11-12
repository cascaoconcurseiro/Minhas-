import React from 'react';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { formatBRL } from '../utils/financeRules';
import type { CashForecast } from '../utils/cashForecast';

interface CashForecastCardProps {
  forecast: CashForecast | null;
}

function formatDay(date: string): string {
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
}

const WIDTH = 300;
const HEIGHT = 72;

/** Previsão do saldo dos próximos dias, com aviso de saldo negativo. */
export const CashForecastCard: React.FC<CashForecastCardProps> = ({ forecast }) => {
  if (!forecast) return null;

  const balances = [forecast.startBalance, ...forecast.points.map((point) => point.balance)];
  const min = Math.min(0, ...balances);
  const max = Math.max(0, ...balances);
  const range = max - min || 1;
  const x = (index: number) => (index / Math.max(1, balances.length - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - ((value - min) / range) * HEIGHT;
  const line = balances.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const negative = forecast.firstNegative;

  return (
    <section
      aria-label="Previsão do saldo"
      data-testid="cash-forecast"
      className={`rounded-xl border p-4 sm:p-5 space-y-3 ${
        negative
          ? 'border-rose-300 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }`}
    >
      <div className="flex items-center gap-2">
        {negative ? (
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
        ) : (
          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
        )}
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Previsão do saldo · próximos {forecast.horizonDays} dias
        </h2>
      </div>

      {negative && (
        <p data-testid="cash-forecast-warning" className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          Seu saldo previsto fica negativo em {formatDay(negative.date)} ({formatBRL(negative.balance)}).
          Veja o que vence até lá.
        </p>
      )}

      <svg
        role="img"
        aria-label={`Saldo previsto de ${formatBRL(forecast.startBalance)} hoje a ${formatBRL(forecast.endBalance)} em ${formatDay(forecast.points[forecast.points.length - 1].date)}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-20"
      >
        {min < 0 && (
          <line x1="0" x2={WIDTH} y1={y(0)} y2={y(0)} stroke="currentColor" strokeDasharray="3 3" className="text-slate-300 dark:text-slate-700" />
        )}
        <polyline
          points={line}
          fill="none"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          className={negative ? 'stroke-rose-500' : 'stroke-emerald-600'}
        />
      </svg>

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Hoje</dt>
          <dd className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{formatBRL(forecast.startBalance)}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Mais baixo ({formatDay(forecast.lowPoint.date)})</dt>
          <dd className={`font-mono font-bold tabular-nums ${forecast.lowPoint.balance < 0 ? 'text-rose-700' : 'text-slate-900 dark:text-white'}`}>
            {formatBRL(forecast.lowPoint.balance)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Em {formatDay(forecast.points[forecast.points.length - 1].date)}</dt>
          <dd className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">{formatBRL(forecast.endBalance)}</dd>
        </div>
      </dl>
    </section>
  );
};
