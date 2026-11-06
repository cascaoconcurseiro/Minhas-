import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateConvertedBrlAmount,
  calculateExchangeSavingsAnalysis,
  calculateTripDashboardSummary,
  calculateTripExpenseSplit,
  calculateTripWeightedAverageRate,
  convertSmartCurrency,
  formatForeignCurrency,
  getLatestExchangeRateInfo,
  parseLiveExchangeRateFromText,
  compareLiveRateWithTripVet,
  isLegacyMockRecord,
  stripLegacyMockRecords,
  runFinancialIntegrityAudit,
  sanitizeAndRepairFinancialState,
  validateTripExpenseSplitInputs,
} from './travelRules';
import { Trip, Transaction, TripParticipant } from '../types/finance';

describe('travelRules — Multi-Currency, TravelSpend & Splitwise Engine', () => {
  it('detects explicit mock markers without deleting legitimate matching descriptions or names', () => {
    const legitimateRecords = [
      { id: 'acc-1700000000000', name: 'Nubank Principal', institution: 'Nubank', initialBalance: 0, color: '#7c3aed' },
      { id: 'acc-nubank', name: 'Nubank', institution: 'Nubank', initialBalance: 123.45 },
      { id: 'acc-itau', name: 'Itaú', institution: 'Itaú', initialBalance: 0 },
      { id: 'card-nubank', name: 'Nubank', institution: 'Nubank' },
      { id: 'card-itau', name: 'Itaú', institution: 'Itaú' },
      { id: 'trip-eurotrip', name: 'Eurotrip Roma 2026' },
      { id: 'tx-1700000000006', description: 'Salário', fitid: 'NUBANK-SAL-2026-11' },
      { id: 'tx-1700000000001', description: 'Pão de Açúcar supermercado' },
      { id: 'fam-1700000000002', name: 'Mariana Oliveira', email: 'mariana.oliveira@gmail.com' },
      { id: 'trip-1700000000003', name: 'Eurotrip Roma 2026' },
    ];
    for (const record of legitimateRecords) {
      assert.equal(isLegacyMockRecord(record), false);
    }

    assert.equal(isLegacyMockRecord({ id: 'mock-import-1' }), true);
    assert.equal(isLegacyMockRecord({ id: 'row-1700000000004', isDemo: true }), true);
    assert.equal(isLegacyMockRecord({ id: 'tx-1700000000005', fitid: 'DEMO-ROW-1' }), true);

    assert.deepEqual(
      stripLegacyMockRecords([
        { id: 'tx-real-1', description: 'Conta de luz' },
        { id: 'mock-test-1', description: 'Lançamento de demonstração' },
        { id: '', description: 'Registro inválido' },
      ]),
      [{ id: 'tx-real-1', description: 'Conta de luz' }]
    );
  });

  it('calculates converted BRL amount with 3.38% credit card IOF and 1.1% Wise IOF accurately', () => {
    // Cartão de Crédito: US$ 100.00 @ R$ 5.80 + 3.38% IOF
    const cardRes = calculateConvertedBrlAmount(100, 5.8, 3.38);
    assert.equal(cardRes.baseBrlAmount, 580);
    assert.equal(cardRes.totalBrl, 599.6);
    assert.equal(cardRes.iofBrlAmount, 19.6);
    assert.equal(cardRes.effectiveRate, 5.996);

    // Conta Global (Wise/Nomad): € 250.00 @ R$ 6.15 + 1.1% IOF
    const wiseRes = calculateConvertedBrlAmount(250, 6.15, 1.1);
    assert.equal(wiseRes.baseBrlAmount, 1537.5);
    assert.equal(wiseRes.totalBrl, 1554.41);
    assert.equal(wiseRes.iofBrlAmount, 16.91);
  });

  it('computes weighted average exchange rate (VET médio) across multiple exchange lots', () => {
    const res = calculateTripWeightedAverageRate(
      [
        {
          id: 'lot-1',
          date: '2026-10-01',
          currency: 'EUR',
          foreignAmount: 1000,
          rateBase: 6.03,
          iofPercent: 1.1,
          effectiveRateBrl: 6.1,
          totalBrlPaid: 6100,
          sourceLabel: 'Wise Remessa 1',
        },
        {
          id: 'lot-2',
          date: '2026-10-05',
          currency: 'EUR',
          foreignAmount: 500,
          rateBase: 6.33,
          iofPercent: 1.1,
          effectiveRateBrl: 6.4,
          totalBrlPaid: 3200,
          sourceLabel: 'Wise Remessa 2',
        },
      ],
      6.2
    );

    assert.equal(res.totalForeignPurchased, 1500);
    assert.equal(res.totalBrlPaid, 9300);
    assert.equal(res.weightedAverageRate, 6.2);
  });

  it('splits expenses across equal, exact, percentage, and shares modes without cent drift', () => {
    const participants: TripParticipant[] = [
      { id: 'me', name: 'Você', isMe: true, color: '#059669' },
      { id: 'ana', name: 'Ana', color: '#ec4899' },
      { id: 'carlos', name: 'Carlos', color: '#3b82f6' },
    ];

    // 1. Equal split of € 100.00 (R$ 620.00) among 3 people
    const equalShares = calculateTripExpenseSplit(
      100,
      620,
      participants,
      ['me', 'ana', 'carlos'],
      'equal'
    );
    assert.equal(equalShares.length, 3);
    const sumEqualForeign = equalShares.reduce((s, x) => s + x.foreignShare, 0);
    const sumEqualBrl = equalShares.reduce((s, x) => s + x.brlShare, 0);
    assert.equal(Math.round(sumEqualForeign * 100) / 100, 100);
    assert.equal(Math.round(sumEqualBrl * 100) / 100, 620);

    // 2. Exact split: € 50, € 30, € 20
    const exactShares = calculateTripExpenseSplit(
      100,
      620,
      participants,
      ['me', 'ana', 'carlos'],
      'exact',
      [
        { participantId: 'me', exactForeign: 50 },
        { participantId: 'ana', exactForeign: 30 },
        { participantId: 'carlos', exactForeign: 20 },
      ]
    );
    assert.equal(exactShares[0].foreignShare, 50);
    assert.equal(exactShares[0].brlShare, 310);
    assert.equal(exactShares[1].foreignShare, 30);
    assert.equal(exactShares[2].foreignShare, 20);

    // 3. Shares weight split: Casal (2 cotas) vs Solteiro (1 cota) on € 90 (R$ 558)
    const weightShares = calculateTripExpenseSplit(
      90,
      558,
      participants,
      ['me', 'carlos'],
      'shares',
      [
        { participantId: 'me', sharesWeight: 2 },
        { participantId: 'carlos', sharesWeight: 1 },
      ]
    );
    assert.equal(weightShares[0].foreignShare, 60);
    assert.equal(weightShares[0].brlShare, 372);
    assert.equal(weightShares[1].foreignShare, 30);
    assert.equal(weightShares[1].brlShare, 186);
  });

  it('blocks exact and percentage splits that would be silently renormalized', () => {
    const participants: TripParticipant[] = [
      { id: 'me', name: 'Você', isMe: true, color: '#059669' },
      { id: 'ana', name: 'Ana', color: '#ec4899' },
    ];

    assert.match(
      validateTripExpenseSplitInputs(
        100,
        participants,
        ['me', 'ana'],
        'exact',
        [
          { participantId: 'me', exactForeign: 50 },
          { participantId: 'ana', exactForeign: 30 },
        ]
      ) || '',
      /fechar o total/
    );
    assert.deepEqual(
      calculateTripExpenseSplit(
        100,
        620,
        participants,
        ['me', 'ana'],
        'exact',
        [
          { participantId: 'me', exactForeign: 50 },
          { participantId: 'ana', exactForeign: 30 },
        ]
      ),
      []
    );
    assert.equal(
      validateTripExpenseSplitInputs(
        100,
        participants,
        ['me', 'ana'],
        'exact',
        [
          { participantId: 'me', exactForeign: 50 },
          { participantId: 'ana', exactForeign: 50 },
        ]
      ),
      null
    );
    assert.match(
      validateTripExpenseSplitInputs(
        100,
        participants,
        ['me', 'ana'],
        'percentage',
        [
          { participantId: 'me', percentage: 70 },
          { participantId: 'ana', percentage: 20 },
        ]
      ) || '',
      /exatamente 100%/
    );
  });

  it('assigns the whole trip expense to the only participant in exact or percentage mode', () => {
    const onlyParticipant: TripParticipant[] = [
      { id: 'me', name: 'Você', isMe: true, color: '#059669' },
    ];

    for (const method of ['exact', 'percentage'] as const) {
      const shares = calculateTripExpenseSplit(
        100,
        620,
        onlyParticipant,
        ['me'],
        method
      );
      assert.equal(shares.length, 1);
      assert.equal(shares[0].foreignShare, 100);
      assert.equal(shares[0].brlShare, 620);
    }
  });

  it('computes TravelSpend daily pace, personal vs group totals, and simplifies multi-payer debts with settlements', () => {
    const trip: Trip = {
      id: 'trip-euro',
      name: 'Eurotrip Lisboa & Paris',
      destination: 'Portugal & França',
      startDate: '2026-10-10',
      endDate: '2026-10-14', // 5 days
      status: 'active',
      currency: 'EUR',
      defaultExchangeRate: 6.2,
      budgetForeign: 1000, // € 1.000 personal budget
      coverColor: '#0284c7',
      participants: [
        { id: 'me', name: 'Você', isMe: true, color: '#059669' },
        { id: 'carlos', name: 'Carlos', color: '#3b82f6' },
      ],
      exchangeLots: [
        {
          id: 'lot-1',
          date: '2026-10-08',
          currency: 'EUR',
          foreignAmount: 1000,
          rateBase: 6.13,
          iofPercent: 1.1,
          effectiveRateBrl: 6.2,
          totalBrlPaid: 6200,
          sourceLabel: 'Wise Euro',
        },
      ],
      settlements: [
        {
          id: 'st-1',
          date: '2026-10-12',
          fromParticipantId: 'carlos',
          toParticipantId: 'me',
          currencySettled: 'BRL',
          foreignAmountEquivalent: 40,
          brlAmountSettled: 248,
          exchangeRateUsed: 6.2,
          method: 'pix_brl',
          notes: 'PIX parcial do jantar',
        },
      ],
    };

    const txs: Transaction[] = [
      // Expense 1: You paid € 200 (R$ 1240) split 50/50 with Carlos (€ 100 each)
      {
        id: 'tx-1',
        description: 'Jantar em Lisboa',
        amount: 1240,
        date: '2026-10-10',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-restaurantes',
        paymentMethod: 'debit_card',
        recurrence: 'single',
        tripId: 'trip-euro',
        originalCurrency: 'EUR',
        originalAmount: 200,
        exchangeRate: 6.13,
        iofPercent: 1.1,
        effectiveExchangeRate: 6.2,
        currencyRegime: 'global_account',
        paidByParticipantId: 'me',
        tripSplitMethod: 'equal',
        tripShares: [
          { participantId: 'me', foreignShare: 100, brlShare: 620 },
          { participantId: 'carlos', foreignShare: 100, brlShare: 620 },
        ],
      },
      // Expense 2: Carlos paid € 60 (R$ 372) for Museum tickets split 50/50 (€ 30 each)
      {
        id: 'tx-2',
        description: 'Ingressos Museu do Louvre',
        amount: 372,
        date: '2026-10-11',
        competenceMonth: '2026-10',
        type: 'expense',
        status: 'paid',
        categoryId: 'cat-lazer',
        paymentMethod: 'credit_card',
        recurrence: 'single',
        tripId: 'trip-euro',
        originalCurrency: 'EUR',
        originalAmount: 60,
        exchangeRate: 6.0,
        iofPercent: 3.38,
        effectiveExchangeRate: 6.2,
        currencyRegime: 'credit_card_intl',
        paidByParticipantId: 'carlos',
        isCompanionOnlyExpense: true,
        tripSplitMethod: 'equal',
        tripShares: [
          { participantId: 'me', foreignShare: 30, brlShare: 186 },
          { participantId: 'carlos', foreignShare: 30, brlShare: 186 },
        ],
      },
    ];

    const summary = calculateTripDashboardSummary(trip, txs, [], '2026-10-11');

    // Group spent € 260 (R$ 1612), but your personal share is € 100 + € 30 = € 130 (R$ 806)
    assert.equal(summary.groupTotalSpendForeign, 260);
    assert.equal(summary.groupTotalSpendBrl, 1612);
    assert.equal(summary.myPersonalSpendForeign, 130);
    assert.equal(summary.myPersonalSpendBrl, 806);

    // Remaining Wise wallet: € 1000 purchased - € 200 spent by you = € 800
    assert.equal(summary.remainingForeignWalletBalance, 800);

    // Settlement math:
    // You paid € 200, consumed € 130 -> net +€ 70 before settlement.
    // Carlos already sent € 40 via PIX -> remaining debt from Carlos to You = € 30 (R$ 186)!
    assert.equal(summary.myNetSettlementForeign, 30);
    assert.equal(summary.myNetSettlementBrl, 186);
    assert.equal(summary.simplifiedDebts.length, 1);
    assert.equal(summary.simplifiedDebts[0].fromParticipantId, 'carlos');
    assert.equal(summary.simplifiedDebts[0].toParticipantId, 'me');
    assert.equal(summary.simplifiedDebts[0].amountForeign, 30);
    assert.equal(summary.simplifiedDebts[0].amountBrlEffective, 186);

    // Format helper check
    assert.equal(formatForeignCurrency(130, 'EUR'), '€ 130,00');

    // Audit check
    const audit = runFinancialIntegrityAudit({
      accountsCount: 3,
      cardsCount: 2,
      transactions: txs,
      trips: [trip],
    });
    assert.equal(audit.isAllHealthy, true);
  });

  it('calculates exchange savings vs commercial benchmark rate by lot and by month', () => {
    const lots = [
      {
        id: 'lot-1',
        date: '2026-09-20',
        currency: 'EUR' as const,
        foreignAmount: 1000,
        rateBase: 6.10,
        iofPercent: 1.1,
        effectiveRateBrl: 6.1671,
        totalBrlPaid: 6167.1,
        sourceLabel: 'Wise Lote 1',
      },
      {
        id: 'lot-2',
        date: '2026-10-05',
        currency: 'EUR' as const,
        foreignAmount: 500,
        rateBase: 6.25,
        iofPercent: 1.1,
        effectiveRateBrl: 6.3188,
        totalBrlPaid: 3159.4,
        sourceLabel: 'Wise Lote 2',
      },
    ];

    // Reference commercial benchmark: R$ 6.35
    const analysis = calculateExchangeSavingsAnalysis(lots, 'EUR', 6.35);

    assert.equal(analysis.lotCount, 2);
    assert.equal(analysis.totalForeignPurchased, 1500);
    assert.equal(analysis.totalBrlPaid, 9326.5);
    // Benchmark would cost: 1500 * 6.35 = 9525.0
    assert.equal(analysis.totalBenchmarkBrl, 9525);
    // Total savings: 9525 - 9326.5 = 198.5
    assert.equal(analysis.totalSavingsBrl, 198.5);

    // Lot 1 saved: 1000 * (6.35 - 6.1671) = 182.9
    assert.equal(analysis.lotSeries[0].savingsTotalBrl, 182.9);
    assert.equal(analysis.lotSeries[0].isEconomy, true);

    // Monthly aggregation
    assert.equal(analysis.monthlySeries.length, 2);
    assert.equal(analysis.monthlySeries[0].month, '2026-09');
    assert.equal(analysis.monthlySeries[0].foreignAmount, 1000);
    assert.equal(analysis.monthlySeries[1].month, '2026-10');
    assert.equal(analysis.monthlySeries[1].foreignAmount, 500);
  });

  it('identifies the latest exchange lot rate and performs smart bidirectional conversion', () => {
    const lots = [
      {
        id: 'lot-1',
        date: '2026-09-20',
        currency: 'EUR' as const,
        foreignAmount: 1000,
        rateBase: 6.10,
        iofPercent: 1.1,
        effectiveRateBrl: 6.15,
        totalBrlPaid: 6150,
        sourceLabel: 'Lote Antigo',
      },
      {
        id: 'lot-2',
        date: '2026-10-10',
        currency: 'EUR' as const,
        foreignAmount: 500,
        rateBase: 6.25,
        iofPercent: 1.1,
        effectiveRateBrl: 6.30,
        totalBrlPaid: 3150,
        sourceLabel: 'Lote Mais Recente',
      },
    ];

    const latest = getLatestExchangeRateInfo(lots, 6.22);
    assert.equal(latest.rate, 6.30);
    assert.equal(latest.sourceType, 'latest_lot');
    assert.equal(latest.sourceLabel, 'Lote Mais Recente');

    // Foreign to BRL: € 50.00 @ 6.30 = R$ 315.00
    const toBrl = convertSmartCurrency({
      amount: 50,
      direction: 'foreign_to_brl',
      rate: latest.rate,
    });
    assert.equal(toBrl.foreignAmount, 50);
    assert.equal(toBrl.brlAmount, 315);

    // BRL to Foreign: R$ 315.00 @ 6.30 = € 50.00
    const toForeign = convertSmartCurrency({
      amount: 315,
      direction: 'brl_to_foreign',
      rate: latest.rate,
    });
    assert.equal(toForeign.foreignAmount, 50);
    assert.equal(toForeign.brlAmount, 315);
  });

  it('parses real-time exchange rate from Gemini Google Search grounding output and compares with trip VET', () => {
    const sampleOutput =
      'TAXA_COMERCIAL_BRL: 6.1845\nA cotação comercial atual de 1 EUR está em R$ 6,1845 hoje.';
    const parsed = parseLiveExchangeRateFromText(sampleOutput);
    assert.equal(parsed, 6.1845);

    const fallbackOutput = 'No fechamento atual, 1 USD = R$ 5,7420 no câmbio comercial.';
    assert.equal(parseLiveExchangeRateFromText(fallbackOutput), 5.742);

    const cmp = compareLiveRateWithTripVet(6.2, 6.12, 1.1);
    assert.equal(cmp.liveCommercialRate, 6.2);
    assert.equal(cmp.liveEstimatedWiseVet, 6.2682);
    assert.equal(cmp.isTripLotCheaper, true);
    assert.equal(cmp.diffPerUnitBrl, 0.1482);
  });

  it('audits financial integrity and auto-repairs orphan links, companion expenses, and mock items', () => {
    const dirtyAudit = runFinancialIntegrityAudit({
      accountsCount: 1,
      cardsCount: 0,
      accounts: [
        {
          id: 'acc-1730000000001',
          name: 'Wise Global',
          institution: 'Wise',
          type: 'international',
          initialBalance: 0,
          color: '#059669',
          includeInTotal: true,
          currency: 'BRL', // Invalid for international account
        },
      ],
      transactions: [
        {
          id: 'tx-1730000000002',
          description: 'Jantar Pago por Amigo',
          amount: 200,
          date: '2026-10-15',
          competenceMonth: '', // Missing competence month
          type: 'expense',
          status: 'paid',
          categoryId: 'cat-lazer',
          accountId: 'acc-1730000000001',
          paymentMethod: 'debit_card',
          recurrence: 'single',
          paidByParticipantId: 'friend-1',
          isCompanionOnlyExpense: false, // Should be isolated
        },
      ],
      trips: [],
    });

    assert.equal(dirtyAudit.isAllHealthy, false);
    assert.ok(dirtyAudit.totalIssuesFound >= 3);

    const repaired = sanitizeAndRepairFinancialState({
      accounts: [
        {
          id: 'acc-1730000000001',
          name: 'Wise Global',
          institution: 'Wise',
          type: 'international',
          initialBalance: 0,
          color: '#059669',
          includeInTotal: true,
          currency: 'BRL',
        },
      ],
      cards: [],
      categories: [],
      transactions: [
        {
          id: 'tx-1730000000002',
          description: 'Jantar Pago por Amigo',
          amount: 200,
          date: '2026-10-15',
          competenceMonth: '',
          type: 'expense',
          status: 'paid',
          categoryId: 'cat-lazer',
          accountId: 'acc-1730000000001',
          paymentMethod: 'debit_card',
          recurrence: 'single',
          paidByParticipantId: 'friend-1',
          isCompanionOnlyExpense: false,
        },
      ],
      goals: [],
      investments: [],
      trips: [],
    });

    assert.ok(repaired.repairedCount >= 2);
    assert.equal(repaired.accounts[0].currency, 'EUR');
    assert.equal(repaired.transactions[0].competenceMonth, '2026-10');
    assert.equal(repaired.transactions[0].isCompanionOnlyExpense, true);

    const cleanAudit = runFinancialIntegrityAudit({
      accountsCount: repaired.accounts.length,
      cardsCount: 0,
      accounts: repaired.accounts,
      transactions: repaired.transactions,
      trips: repaired.trips,
    });
    assert.equal(cleanAudit.isAllHealthy, true);
    assert.equal(cleanAudit.totalIssuesFound, 0);

    // Remove explicit demo records while keeping their descriptions/names safe for real records.
    const mockPurge = sanitizeAndRepairFinancialState({
      accounts: [
        {
          id: 'mock-wise-sample',
          name: 'Wise Conta Global Euro',
          institution: 'Wise',
          type: 'international',
          initialBalance: 7464,
          color: '#059669',
          includeInTotal: true,
          currency: 'EUR',
        },
      ],
      cards: [],
      categories: [],
      transactions: [],
      goals: [],
      investments: [],
      trips: [
        {
          id: 'demo-trip-eurotrip',
          name: 'Eurotrip Roma 2026',
          destination: 'Itália',
          startDate: '2026-10-10',
          endDate: '2026-10-20',
          status: 'active',
          currency: 'EUR',
          defaultExchangeRate: 6.2,
          budgetForeign: 3000,
          coverColor: '#0284c7',
          participants: [],
          exchangeLots: [],
          settlements: [],
        },
      ],
    });
    assert.equal(mockPurge.accounts.length, 0);
    assert.equal(mockPurge.trips.length, 0);

    // Direct investment transfer with targetInvestmentAssetId passes audit 100%
    const invTransferAudit = runFinancialIntegrityAudit({
      accountsCount: 1,
      cardsCount: 0,
      accounts: [
        {
          id: 'acc-real-1',
          name: 'Conta Itaú',
          institution: 'Itaú',
          type: 'checking',
          initialBalance: 3000,
          color: '#0f172a',
          includeInTotal: true,
        },
      ],
      investments: [
        {
          id: 'inv-real-1',
          ticker: 'TESOURO SELIC 2029',
          name: 'Tesouro Selic',
          assetClass: 'renda_fixa_pos',
          institution: 'BTG Pactual',
          quantity: 1,
          averagePrice: 1500,
          currentPrice: 1550,
          indexerLabel: '100% SELIC',
          liquidity: 'D+0 (Liquidez Diária)',
          monthlyYieldPercent: 0.85,
          isTaxExempt: false,
        },
      ],
      transactions: [
        {
          id: 'tx-inv-transfer-1',
          description: 'Aporte Direto Tesouro Selic',
          amount: 500,
          date: '2026-10-15',
          competenceMonth: '2026-10',
          type: 'transfer',
          status: 'paid',
          categoryId: 'cat-aportes',
          accountId: 'acc-real-1',
          targetInvestmentAssetId: 'inv-real-1',
          paymentMethod: 'transfer',
          recurrence: 'single',
        },
      ],
      trips: [],
    });
    assert.equal(invTransferAudit.isAllHealthy, true);
    assert.equal(invTransferAudit.totalIssuesFound, 0);
  });
});



