/** Período e indicadores do relatório. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { FileText } from 'lucide-react';
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsPeriodSummary({ form }: { form: ReportsAndDataTabContext }) {
  const {
    customEndMonth,
    customStartMonth,
    handleExportPdf,
    isExportingPdf,
    periodPreset,
    periodReport,
    selectedMonth,
    setCustomEndMonth,
    setCustomStartMonth,
    setPeriodPreset,
  } = form;
  return (
    <>
{/* Period Selector & Summary KPIs */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Relatórios Visuais e Análise Comparativa de Períodos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Gráficos de pizza, barras e linhas detalhando gastos por categoria, receitas por fonte e evolução do saldo geral
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col items-start gap-2.5">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              aria-label="Exportar relatório financeiro do mês em PDF imprimível"
              title="Gerar e baixar relatório executivo em PDF com saldos e gráfico de categorias"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 transition-colors shrink-0"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isExportingPdf ? 'Gerando...' : `Exportar PDF (${formatMonthYearPT(selectedMonth).split(' ')[0]})`}</span>
            </button>

            <div className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-3 xl:flex xl:flex-wrap">
            <button
              type="button"
              onClick={() => setPeriodPreset('monthly')}
              className={`min-w-0 px-2.5 py-2.5 sm:py-1.5 text-xs sm:text-[11px] leading-tight text-center font-semibold rounded-md transition-colors whitespace-normal ${
                periodPreset === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensal ({formatMonthYearPT(selectedMonth).split(' ')[0]})
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('quarterly')}
              className={`min-w-0 px-2.5 py-2.5 sm:py-1.5 text-xs sm:text-[11px] leading-tight text-center font-semibold rounded-md transition-colors whitespace-normal ${
                periodPreset === 'quarterly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trimestral (3m)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('semiannual')}
              className={`min-w-0 px-2.5 py-2.5 sm:py-1.5 text-xs sm:text-[11px] leading-tight text-center font-semibold rounded-md transition-colors whitespace-normal ${
                periodPreset === 'semiannual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semestral (6m)
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('annual')}
              className={`min-w-0 px-2.5 py-2.5 sm:py-1.5 text-xs sm:text-[11px] leading-tight text-center font-semibold rounded-md transition-colors whitespace-normal ${
                periodPreset === 'annual'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anual ({selectedMonth.slice(0, 4)})
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('custom')}
              className={`min-w-0 px-2.5 py-2.5 sm:py-1.5 text-xs sm:text-[11px] leading-tight text-center font-semibold rounded-md transition-colors whitespace-normal ${
                periodPreset === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Personalizado
            </button>
          </div>
        </div>
      </div>

        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-3.5 text-xs">
            <span className="font-semibold text-slate-700">Intervalo Personalizado:</span>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">De:</span>
              <input
                type="month"
                aria-label="Mês inicial do relatório"
                value={customStartMonth}
                onChange={(e) => setCustomStartMonth(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono tabular-nums text-slate-900"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-600">Até:</span>
              <input
                type="month"
                aria-label="Mês final do relatório"
                value={customEndMonth}
                onChange={(e) => setCustomEndMonth(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2.5 py-1 font-mono tabular-nums text-slate-900"
              />
            </label>
          </div>
        )}

        {/* 4 Summary Metrics for Selected Period (2x2 on Mobile) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 pt-1">
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">
              Receitas ({periodReport.monthsCount}{' '}
              {periodReport.monthsCount === 1 ? 'mês' : 'meses'})
            </p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-emerald-700">
              {formatBRL(periodReport.totalIncome)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Média: {formatBRL(periodReport.averageMonthlyIncome)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Despesas no Período</p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-rose-700">
              {formatBRL(periodReport.totalExpense)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Média: {formatBRL(periodReport.averageMonthlyExpense)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Economia Líquida</p>
            <p
              className={`mt-1 text-base sm:text-xl font-bold font-mono tabular-nums ${
                periodReport.netSavings >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {periodReport.netSavings >= 0 ? '+' : ''}
              {formatBRL(periodReport.netSavings)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              Poupança: {periodReport.savingsRate}%
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 sm:border-0 sm:bg-transparent sm:p-0">
            <p className="text-[11px] sm:text-xs font-medium text-slate-500">Saldo Final</p>
            <p className="mt-1 text-base sm:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatBRL(periodReport.endingBalance)}
            </p>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">
              {formatMonthYearPT(periodReport.startMonth).split(' ')[0]}–
              {formatMonthYearPT(periodReport.endMonth)}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
