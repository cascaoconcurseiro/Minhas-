import React from 'react';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rounded = 'md',
}) => {
  const roundedClass =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === '2xl'
      ? 'rounded-2xl'
      : rounded === 'xl'
      ? 'rounded-xl'
      : rounded === 'lg'
      ? 'rounded-lg'
      : rounded === 'sm'
      ? 'rounded-sm'
      : 'rounded-md';

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${roundedClass} ${className}`}
    />
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-modal-in" aria-label="Carregando visão geral financeira...">
      {/* 4 Primary KPI Metrics Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-5" rounded="full" />
            </div>
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </section>

      {/* Budget Alerts Horizontal Carousel / Banner */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" rounded="lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <Skeleton className="h-7 w-28" rounded="lg" />
        </div>

        {/* Carousel Cards */}
        <div className="p-4 sm:p-5 flex sm:grid overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 gap-3.5 no-scrollbar">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[76vw] max-w-[280px] sm:w-auto shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 bg-slate-50/40 dark:bg-slate-800/20"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7" rounded="md" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
                <Skeleton className="h-4 w-12" rounded="sm" />
              </div>
              <Skeleton className="h-2 w-full" rounded="full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accounts (left 5 cols) & Pending Bills (right 7 cols) Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Accounts Skeleton */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>

          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" rounded="lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-4 w-24 ml-auto" />
                  <Skeleton className="h-3 w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Pending Bills Skeleton */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>

          <div className="space-y-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" rounded="lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 text-right">
                    <Skeleton className="h-4 w-20 ml-auto" />
                    <Skeleton className="h-3 w-14 ml-auto" />
                  </div>
                  <Skeleton className="h-7 w-16" rounded="lg" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Row 3: Credit Cards & Thermometer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-2 w-full" rounded="full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </section>

        <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5" rounded="full" />
                  <Skeleton className="h-3.5 w-28" />
                </div>
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-2 w-full" rounded="full" />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export const TransactionsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-modal-in" aria-label="Carregando extrato de lançamentos...">
      {/* Top View Mode Switcher Skeleton */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <Skeleton className="h-8 w-28" rounded="md" />
            <Skeleton className="h-8 w-28" rounded="md" />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Skeleton className="h-8 w-32" rounded="lg" />
            <Skeleton className="h-8 w-36" rounded="lg" />
            <Skeleton className="h-8 w-24" rounded="lg" />
          </div>
        </div>
      </section>

      {/* Filter & Search Toolbar Skeleton */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-36" rounded="md" />
          <Skeleton className="h-8 w-28" rounded="md" />
          <Skeleton className="h-8 w-28" rounded="md" />
          <Skeleton className="h-8 w-24" rounded="md" />
        </div>
        <Skeleton className="h-10 w-full" rounded="lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-9 w-full" rounded="lg" />
          <Skeleton className="h-9 w-full" rounded="lg" />
          <Skeleton className="h-9 w-full" rounded="lg" />
        </div>
      </section>

      {/* Ledger Table & Cards Skeleton */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Metrics Summary Strip */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <Skeleton className="h-3.5 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>

        {/* Mobile View: Swipeable Cards Skeleton */}
        <div className="block sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Skeleton className="h-10 w-10 shrink-0" rounded="xl" />
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="text-right space-y-1 shrink-0">
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-3 w-14 ml-auto" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-5 w-20" rounded="full" />
                <Skeleton className="h-4 w-6" rounded="sm" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table Rows Skeleton */}
        <div className="hidden sm:block">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4 w-1/2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-8 w-8 shrink-0" rounded="lg" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <div className="flex items-center justify-between w-1/2 pl-6">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-6 w-20" rounded="full" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex items-center gap-1.5">
                    <Skeleton className="h-7 w-7" rounded="md" />
                    <Skeleton className="h-7 w-7" rounded="md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export const CreditCardsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-modal-in" aria-label="Carregando cartões de crédito...">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10" rounded="xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-6 w-24" rounded="full" />
            </div>
            <div className="space-y-1 pt-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-36" />
            </div>
            <Skeleton className="h-2 w-full" rounded="full" />
            <div className="flex items-center justify-between pt-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-28" rounded="lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BudgetsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-modal-in" aria-label="Carregando orçamentos...">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <Skeleton className="h-5 w-48" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7" rounded="md" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-2 w-full" rounded="full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ReportsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-modal-in" aria-label="Carregando relatórios...">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
        <Skeleton className="h-8 w-44" rounded="lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" rounded="lg" />
          <Skeleton className="h-8 w-28" rounded="lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-56 w-full" rounded="xl" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-56 w-full" rounded="xl" />
        </div>
      </div>
    </div>
  );
};

export const TripSavingsChartSkeleton: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  return (
    <div
      data-testid="trip-savings-chart-skeleton"
      aria-label="Processando e renderizando gráfico de economia cambial..."
      className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4 animate-pulse ${className}`}
    >
      {/* Top Header & Controls Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-4 w-4" rounded="sm" />
            <Skeleton className="h-4 w-60 sm:w-72" />
            <Skeleton className="h-5 w-36 sm:w-44" rounded="md" />
          </div>
          <Skeleton className="h-3 w-72 sm:w-96 max-w-full" />
        </div>

        {/* Controls: Period Switcher & Zoom */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Skeleton className="h-7 w-36 sm:w-44" rounded="xl" />
          <Skeleton className="h-7 w-20 sm:w-24" rounded="xl" />
          <Skeleton className="h-7 w-7" rounded="xl" />
        </div>
      </div>

      {/* Chart Canvas Stage Skeleton */}
      <div className="rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>

        {/* Simulated Shimmering Bar Columns with heights matching typical savings distribution */}
        <div className="flex items-end justify-around gap-2 sm:gap-3 h-44 pt-4 px-2 border-b border-dashed border-slate-200 dark:border-slate-700/60 pb-2">
          {[
            { height: 'h-24', pct: 'w-10' },
            { height: 'h-36', pct: 'w-12' },
            { height: 'h-16', pct: 'w-10' },
            { height: 'h-32', pct: 'w-11' },
            { height: 'h-28', pct: 'w-10' },
            { height: 'h-20', pct: 'w-9' },
            { height: 'h-36', pct: 'w-12' },
          ].map((bar, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
              <Skeleton className="h-2.5 w-8 sm:w-10" />
              <div
                className={`w-full max-w-[52px] rounded-t-lg skeleton-shimmer ${bar.height}`}
              />
              <Skeleton className="h-2.5 w-10 sm:w-12" />
              <Skeleton className="h-2 w-7 sm:w-8" />
            </div>
          ))}
        </div>
      </div>

      {/* Summary KPI Footer Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 p-3 space-y-1.5"
          >
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
};

