

export interface FixedIncomeSimulationResult {
  months: number;
  totalInvested: number;
  grossBalanceCdi: number;
  irRatePercent: number;
  irTaxAmount: number;
  netBalanceCdi: number;
  netYieldCdi: number;
  poupancaBalance: number;
  advantageOverPoupanca: number;
}

/** Alíquota regressiva do IR sobre renda fixa pelo tempo que o dinheiro ficou aplicado, em dias (1 ano = 365 dias). */
export function getBrazilianIrRateForDays(days: number): number {
  if (days <= 180) return 22.5;
  if (days <= 360) return 20.0;
  if (days <= 720) return 17.5;
  return 15.0;
}

export function getBrazilianIrRate(months: number): number {
  return getBrazilianIrRateForDays(Math.round((months * 365) / 12));
}

export function simulateFixedIncomeBR(params: {
  initialAmount: number;
  monthlyContribution: number;
  months: number;
  cdiAnnualRatePercent: number;
  cdiMultiplierPercent: number;
  isTaxExempt?: boolean;
}): FixedIncomeSimulationResult {
  const {
    initialAmount,
    monthlyContribution,
    months,
    cdiAnnualRatePercent,
    cdiMultiplierPercent,
    isTaxExempt = false,
  } = params;

  const safeMonths = Math.max(1, Math.min(360, Math.floor(months)));
  const effectiveAnnualRate = (cdiAnnualRatePercent / 100) * (cdiMultiplierPercent / 100);
  const monthlyRateCdi = Math.pow(1 + effectiveAnnualRate, 1 / 12) - 1;
  const monthlyRatePoupanca = 0.0057;

  let grossCdi = initialAmount;
  let poupanca = initialAmount;

  for (let m = 0; m < safeMonths; m++) {
    grossCdi = grossCdi * (1 + monthlyRateCdi) + monthlyContribution;
    poupanca = poupanca * (1 + monthlyRatePoupanca) + monthlyContribution;
  }

  const totalInvested = Math.round((initialAmount + monthlyContribution * safeMonths) * 100) / 100;
  const grossYield = Math.max(0, grossCdi - totalInvested);
  // O IR é cobrado por aplicação: o valor inicial e cada aporte mensal têm o seu próprio tempo (e alíquota).
  let irTaxRaw = 0;
  if (!isTaxExempt) {
    const lotTax = (principal: number, monthsInvested: number) => {
      const lotYield = principal * (Math.pow(1 + monthlyRateCdi, monthsInvested) - 1);
      return Math.max(0, lotYield) * (getBrazilianIrRateForDays(Math.round((monthsInvested * 365) / 12)) / 100);
    };
    irTaxRaw += lotTax(initialAmount, safeMonths);
    for (let m = 0; m < safeMonths; m++) irTaxRaw += lotTax(monthlyContribution, safeMonths - 1 - m);
  }
  const irTaxAmount = Math.round(irTaxRaw * 100) / 100;
  // Alíquota média efetiva (para mostrar); sem rendimento, usa a da faixa do prazo total
  const irRatePercent = isTaxExempt
    ? 0
    : grossYield > 0
    ? Math.round((irTaxRaw / grossYield) * 1000) / 10
    : getBrazilianIrRate(safeMonths);
  const netBalanceCdi = Math.round((grossCdi - irTaxAmount) * 100) / 100;
  const netYieldCdi = Math.round((netBalanceCdi - totalInvested) * 100) / 100;
  const poupancaBalance = Math.round(poupanca * 100) / 100;

  return {
    months: safeMonths,
    totalInvested,
    grossBalanceCdi: Math.round(grossCdi * 100) / 100,
    irRatePercent,
    irTaxAmount,
    netBalanceCdi,
    netYieldCdi,
    poupancaBalance,
    advantageOverPoupanca: Math.round((netBalanceCdi - poupancaBalance) * 100) / 100,
  };
}
