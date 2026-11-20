/** Dados dos gráficos de barras e de linha. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { useMemo } from 'react';
import type { ReportsDerivedApi } from './useReportsDerived';

export function useReportsChartData(ctx: ReportsDerivedApi) {
  const {
    periodReport,
  } = ctx;
  // Max value for Bar chart scaling
  const maxBarValue = useMemo(() => {
    let maxVal = 1000;
    for (const row of periodReport.monthlySeries) {
      if (row.income > maxVal) maxVal = row.income;
      if (row.expense > maxVal) maxVal = row.expense;
    }
    return maxVal * 1.1;
  }, [periodReport.monthlySeries]);

  // Min and Max for Line Chart scaling (General Balance & Net Result)
  const lineChartGeometry = useMemo(() => {
    const series = periodReport.monthlySeries;
    if (series.length === 0) return null;

    const values = series.flatMap((s) => [s.cumulativeBalance, s.netSavings]);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(1000, ...values);
    const span = Math.max(1, maxVal - minVal);

    const width = 620;
    const height = 200;
    const padX = 44;
    const padY = 24;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const getX = (idx: number) =>
      series.length === 1 ? width / 2 : padX + (idx / (series.length - 1)) * plotW;
    const getY = (val: number) =>
      padY + plotH - ((val - minVal) / span) * plotH;

    const balancePoints = series.map((s, i) => ({
      x: getX(i),
      y: getY(s.cumulativeBalance),
      label: s.shortLabel,
      balance: s.cumulativeBalance,
      net: s.netSavings,
    }));

    const netPoints = series.map((s, i) => ({
      x: getX(i),
      y: getY(s.netSavings),
    }));

    const balancePolyline = balancePoints.map((p) => `${p.x},${p.y}`).join(' ');
    const netPolyline = netPoints.map((p) => `${p.x},${p.y}`).join(' ');

    return {
      width,
      height,
      balancePoints,
      netPoints,
      balancePolyline,
      netPolyline,
      zeroY: getY(0),
    };
  }, [periodReport.monthlySeries]);

  return {
    lineChartGeometry,
  };
}

export type ReportsChartDataApi = ReturnType<typeof useReportsChartData>;
