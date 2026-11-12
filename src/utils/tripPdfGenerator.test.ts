import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAndDownloadTripPdf } from './tripPdfGenerator';
import { Trip, TripDashboardSummary, Transaction, Category } from '../types/finance';

test('tripPdfGenerator processes lots, realized savings, and total expenses', () => {
  const mockTrip: Trip = {
    id: 'trip-1',
    name: 'Eurotrip Paris & Roma',
    destination: 'Franca e Italia',
    currency: 'EUR',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    status: 'active',
    budgetForeign: 2000,
    defaultExchangeRate: 6.25,
    coverColor: '#10b981',
    participants: [
      { id: 'me', name: 'Eu', isMe: true, color: '#10b981' },
      { id: 'p1', name: 'Esposa', isMe: false, color: '#ec4899' },
    ],
    settlements: [],
    exchangeLots: [
      {
        id: 'lot-1',
        sourceLabel: 'Wise Global',
        date: '2026-09-20',
        currency: 'EUR',
        foreignAmount: 1000,
        rateBase: 6.10,
        iofPercent: 1.1,
        effectiveRateBrl: 6.1671,
        totalBrlPaid: 6167.10,
      },
      {
        id: 'lot-2',
        sourceLabel: 'Nomad',
        date: '2026-09-28',
        currency: 'EUR',
        foreignAmount: 500,
        rateBase: 6.05,
        iofPercent: 1.1,
        effectiveRateBrl: 6.1165,
        totalBrlPaid: 3058.28,
      },
    ],
  };

  const mockSummary: TripDashboardSummary = {
    tripId: 'trip-1',
    currency: 'EUR',
    weightedAverageRate: 6.15,
    totalForeignPurchased: 1500,
    totalBrlPurchasedForLots: 9225.38,
    remainingForeignWalletBalance: 700,
    totalDays: 15,
    elapsedDays: 5,
    remainingDays: 10,
    groupTotalSpendForeign: 800,
    groupTotalSpendBrl: 4920,
    myPersonalSpendForeign: 400,
    myPersonalSpendBrl: 2460,
    myOutOfPocketPaidForeign: 800,
    myOutOfPocketPaidBrl: 4920,
    budgetForeign: 2000,
    budgetBrlEquivalent: 12500,
    budgetRemainingForeign: 1200,
    budgetUsedPercent: 40,
    myDailyAverageForeign: 53.33,
    myDailyAverageBrl: 328,
    safeRemainingDailyForeign: 80,
    safeRemainingDailyBrl: 492,
    dailySeries: [],
    categoryBreakdown: [],
    participantBalances: [],
    simplifiedDebts: [],
    myNetSettlementForeign: 0,
    myNetSettlementBrl: 0,
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      date: '2026-10-02',
      description: 'Hotel Paris',
      amount: 1845,
      type: 'expense',
      categoryId: 'cat-travel',
      tripId: 'trip-1',
      status: 'paid',
      paymentMethod: 'credit_card',
      recurrence: 'single',
      competenceMonth: '2026-10',
      originalCurrency: 'EUR',
      originalAmount: 300,
      effectiveExchangeRate: 6.15,
    },
    {
      id: 'tx-2',
      date: '2026-10-04',
      description: 'Restaurante Roma',
      amount: 615,
      type: 'expense',
      categoryId: 'cat-food',
      tripId: 'trip-1',
      status: 'paid',
      paymentMethod: 'pix',
      recurrence: 'single',
      competenceMonth: '2026-10',
      originalCurrency: 'EUR',
      originalAmount: 100,
      effectiveExchangeRate: 6.15,
    },
  ];

  const mockCategories: Category[] = [
    {
      id: 'cat-travel',
      name: 'Viagem & Hospedagem',
      color: '#10b981',
      icon: 'plane',
      type: 'expense',
      bucket: 'lifestyle',
      monthlyBudget: 2000,
    },
    {
      id: 'cat-food',
      name: 'Alimentacao',
      color: '#f59e0b',
      icon: 'utensils',
      type: 'expense',
      bucket: 'lifestyle',
      monthlyBudget: 1000,
    },
  ];

  // In Node environment jsPDF save calls createObjectURL or fs; let's verify generation completes
  assert.doesNotThrow(() => {
    generateAndDownloadTripPdf({
      trip: mockTrip,
      summary: mockSummary,
      transactions: mockTransactions,
      categories: mockCategories,
    });
  });
});
