export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionStatus = 'paid' | 'pending';

export type PaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'boleto'
  | 'cash'
  | 'transfer';

export type RecurrenceType = 'single' | 'installment' | 'fixed';

export type BudgetBucket = 'essential' | 'lifestyle' | 'financial';

export type CategoryIconName =
  | 'home'
  | 'shopping-cart'
  | 'zap'
  | 'car'
  | 'heart-pulse'
  | 'graduation-cap'
  | 'utensils'
  | 'plane'
  | 'shopping-bag'
  | 'tv'
  | 'piggy-bank'
  | 'file-text'
  | 'wallet'
  | 'briefcase'
  | 'trending-up'
  | 'gift'
  | 'wrench'
  | 'coffee'
  | 'smartphone'
  | 'baby'
  | 'paw-print'
  | 'dumbbell'
  | 'shirt'
  | 'sofa'
  | 'scissors'
  | 'umbrella'
  | 'landmark'
  | 'receipt'
  | 'hand-heart'
  | 'pill'
  | 'stethoscope'
  | 'gamepad'
  | 'church'
  | 'banknote'
  | 'tag';

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'international';

export interface BankAccount {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  initialBalance: number;
  color: string;
  includeInTotal: boolean;
  currency?: CurrencyCode; // 'BRL' for domestic accounts; 'USD' | 'EUR' | 'GBP' | etc. for international accounts (Wise, Nomad, Avenue, C6 Global, Inter Global)
  initialBalanceForeign?: number; // Initial balance in foreign currency when type === 'international'
}

export interface CreditCard {
  id: string;
  name: string;
  brand: 'Mastercard' | 'Visa' | 'Elo';
  limit: number;
  closingDay: number;
  dueDay: number;
  defaultAccountId: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  bucket: BudgetBucket;
  monthlyBudget: number;
  color: string;
  icon: CategoryIconName;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: 'cônjuge' | 'filho(a)' | 'pai/mãe' | 'irmão/irmã' | 'amigo(a)' | 'outro';
  color: string;
  email?: string;
  invitationId?: string;
  inviteStatus?: 'none' | 'invited' | 'accepted';
  invitedAt?: string;
  invitedByEmail?: string;
  invitedByName?: string;
  direction?: 'outgoing' | 'incoming';
  pixKey?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  competenceMonth: string; // YYYY-MM (bank transaction month; credit-card invoice due month)
  type: TransactionType;
  status: TransactionStatus;
  categoryId: string;
  accountId?: string; // BankAccount id (for income, bank expense, or transfer source)
  destinationAccountId?: string; // For transfer destination
  creditCardId?: string; // If paid via credit card
  paymentMethod: PaymentMethod;
  recurrence: RecurrenceType;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  installmentPurchaseTotal?: number; // Original price of the purchase, repeated across its scheduled invoice rows
  notes?: string;
  /** Custom user-defined tags for granular expense/income categorization beyond standard categories (e.g. ['reembolsavel', 'imposto-renda', 'projeto-x']) */
  tags?: string[];
  isInvoicePayment?: boolean; // True when this bank expense pays off a credit card invoice
  settledCardId?: string; // CreditCard ID whose invoice was settled by this payment
  settledInvoiceMonth?: string; // Invoice month settled; competenceMonth remains the bank cash-out month
  invoicePaymentId?: string; // Invoice payment that settled this card purchase row
  partialSplitOriginalId?: string; // Original card transaction ID when split by partial invoice payment
  // Installment anticipation metadata (allows 1-click reversal of anticipated installments)
  isAnticipated?: boolean;
  originalCompetenceMonth?: string;
  originalDateBeforeAnticipation?: string;
  originalAmountBeforeDiscount?: number;
  // Shared expenses with family members
  isShared?: boolean;
  sharedMemberId?: string;
  sharedAmount?: number; // How much this person owes you (or you owe them when sharedPaidBy === 'member')
  sharedPaidBy?: 'me' | 'member'; // 'me' = Eu paguei (familiar me deve); 'member' = Familiar pagou (eu devo ao familiar)
  sharedSplitMode?: 'full' | 'half' | 'custom';
  sharedStatus?: 'pending' | 'received';
  sharedSettledDate?: string;
  sharedSettledAccountId?: string;
  sharedSettlementId?: string;
  sharedRemoteStatus?: 'pending' | 'received';
  sharedRemoteSettledDate?: string;
  sharedSyncId?: string; // Correlation ID shared between linked family accounts
  sharedOriginEmail?: string; // Email of the user who originally created the shared transaction
  sharedTargetEmail?: string; // Email of the linked family member
  targetInvestmentAssetId?: string; // Optional link when a transfer/expense is a direct investment contribution
  // Transferência com conta em moeda estrangeira: `amount` segue em reais; estes campos guardam a perna estrangeira
  transferFromAmount?: number; // Valor que saiu da conta de origem, na moeda da origem (só quando a origem é internacional)
  transferToAmount?: number; // Valor que entrou na conta de destino, na moeda do destino (só quando o destino é internacional)
  transferExchangeRate?: number; // Cotação efetiva da transferência (R$ por 1 unidade da moeda estrangeira)
  // Travel & Multi-Currency (TravelSpend + Splitwise)
  tripId?: string;
  originalCurrency?: CurrencyCode;
  originalAmount?: number;
  exchangeRate?: number; // Base exchange rate before IOF (e.g. 5.85 BRL/USD)
  iofPercent?: number; // e.g. 0 (Cash), 1.1 (Wise/Nomad), 3.38 (Intl Credit Card)
  effectiveExchangeRate?: number; // Final rate with IOF included (BRL per 1 foreign unit)
  currencyRegime?: CurrencyPaymentRegime;
  paidByParticipantId?: string; // 'me' or companion participant ID
  tripSplitMethod?: TripSplitMethod;
  tripShares?: TripExpenseShare[];
  myPersonalShareBrl?: number;
  myPersonalShareForeign?: number;
  isCompanionOnlyExpense?: boolean; // True when paid by another trip participant (does not debit user's own bank account)
  // Bank reconciliation / OFX import metadata
  fitid?: string; // Financial Institution Transaction ID from OFX
  importBatchId?: string; // Batch identifier from bank statement import
  reconciled?: boolean; // Indicates transaction has been reconciled against a bank statement
  /** Transitório da importação de extrato: quita esta conta pendente em vez de criar um lançamento novo. */
  settlesPendingTransactionId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD
  monthlyContribution: number;
  indexer: 'CDI_100' | 'CDI_110' | 'TESOURO_SELIC' | 'LCI_92' | 'POUPANCA';
  category: string;
  color?: string;
  notes?: string;
  linkedAssetId?: string; // Optional InvestmentAsset ID whose market value syncs with this goal
}

export interface AccountBalanceSummary {
  accountId: string;
  currentBalance: number; // Realized (paid) up to end of selected month
  projectedBalance: number; // Including pending transactions in the selected month
  monthIncome: number;
  monthExpense: number;
}

export interface CreditCardSummary {
  cardId: string;
  invoiceMonth: string;
  invoiceTotal: number;
  invoicePaidAmount: number;
  invoicePendingAmount: number;
  isInvoicePaid: boolean;
  usedLimit: number; // All unpaid transactions across all months
  availableLimit: number;
  usagePercent: number;
  transactions: Transaction[];
}

export interface MonthlyFinancialSummary {
  month: string; // YYYY-MM
  totalCurrentBalance: number;
  totalProjectedBalance: number;
  incomeRealized: number;
  incomePending: number;
  incomeTotal: number;
  expenseRealized: number;
  expensePending: number;
  expenseTotal: number;
  creditCardMonthTotal: number;
  netResultProjected: number;
  netResultRealized: number;
  savingsRateProjected: number;
}

export interface CategorySpendItem {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: CategoryIconName;
  bucket: BudgetBucket;
  spent: number;
  realizedSpent: number;
  pendingSpent: number;
  budget: number;
  percentOfBudget: number;
  percentOfTotalExpense: number;
  status: 'ok' | 'warning' | 'over';
}

export interface DailyCashFlowPoint {
  day: number;
  date: string;
  income: number;
  expense: number;
  cumulativeBalance: number;
  projectedBalance: number;
  /** Explicação das saídas de fatura/compartilhadas do dia (para o aviso ao passar o mouse). Ausente quando não há. */
  expenseNotes?: string[];
}

export interface MonthlyComparisonRow {
  month: string; // YYYY-MM
  label: string;
  shortLabel: string;
  income: number;
  expense: number;
  netSavings: number;
  savingsRate: number;
  cumulativeBalance: number;
  expenseDeltaPercent: number | null; // vs previous month in series
  incomeDeltaPercent: number | null;
}

export interface ReportDistributionSlice {
  id: string;
  name: string;
  color: string;
  icon: CategoryIconName;
  amount: number;
  percent: number;
  count: number;
}

export interface PeriodReportSummary {
  startMonth: string;
  endMonth: string;
  monthsCount: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  savingsRate: number;
  endingBalance: number;
  expensesByCategory: ReportDistributionSlice[];
  incomesBySource: ReportDistributionSlice[];
  monthlySeries: MonthlyComparisonRow[];
}

export type ReminderUrgency = 'overdue' | 'due_today' | 'due_soon' | 'upcoming';

export type ReminderItemType =
  | 'invoice_due'
  | 'pending_bill'
  | 'recurring_check'
  | 'shared_pending';

export interface ReminderItem {
  id: string;
  type: ReminderItemType;
  title: string;
  description: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  urgency: ReminderUrgency;
  daysRemaining: number; // Negative = overdue, 0 = today, positive = in N days
  cardId?: string;
  transactionId?: string;
  memberId?: string;
  categoryName?: string;
  accountName?: string;
  isFixedRecurring?: boolean;
}

export type ReminderRecurrence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'weekdays'
  | 'urgent_only';

export interface SmtpCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}

export type SmtpConfigSettings = Omit<SmtpCredentials, 'pass'> & {
  pass?: string;
};

export interface ReminderSettings {
  enabled: boolean;
  preferredTime: string; // e.g. "09:00", "12:00", "18:00"
  recurrence?: ReminderRecurrence; // Recorrência dos alertas no navegador
  daysBeforeInvoiceDue: number; // 1, 2, 3, 5, 7 days
  notifyPendingBills: boolean; // despesas e boletos pendentes
  notifyInvoiceDue: boolean; // faturas de cartão de crédito
  notifyRecurringEntries: boolean; // conferir lançamentos fixos recorrentes
  notifySharedReimbursements: boolean; // rateios com familiares a receber
  browserNotificationsEnabled: boolean; // permissão Web Notification API
  lastNotifiedDate?: string; // YYYY-MM-DD
  // Notificações por E-mail
  emailNotificationsEnabled?: boolean;
  notificationEmail?: string;
  emailPreferredTime?: string; // e.g. "08:00", "09:00", "12:00", "18:00", "20:00"
  emailRecurrence?: ReminderRecurrence;
  lastEmailNotifiedDate?: string; // YYYY-MM-DD
  // Credenciais SMTP Próprias do Usuário
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  smtpConfig?: SmtpConfigSettings;
}

export interface CategorySharingRule {
  memberId: string;
  paidBy: 'me' | 'member';
  splitMode: 'half' | 'percentage';
  /** Percentual do familiar quando `splitMode` é 'percentage' (1 a 99). */
  percentage?: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  privacyMode: boolean;
  showOverviewAlerts: boolean;
  alertsExpandedByDefault: boolean;
  budgetWarningPercent: number; // e.g. 70, 80, 85, 90
  /** Limite do cartão: porcentagem máxima da renda do mês comprometida com o cartão (vazio = sem limite). */
  cardCommitmentLimitPercent?: number;
  /** Avisar ao chegar em X% desse limite (padrão 80). */
  cardCommitmentWarnPercent?: number;
  /** Divisão automática por categoria: ao escolher a categoria, o lançamento já vem dividido com a pessoa. */
  categorySharingRules?: Record<string, CategorySharingRule>;
  userName: string;
  userPixKey: string;
  financialMonthStartDay?: number; // 1 to 28
  defaultCascadeMode?: 'single' | 'this_and_future' | 'all_series';
  defaultForeignCurrency?: CurrencyCode;
  autoConvertTripExpenses?: boolean;
  viewClarityMode?: 'complete' | 'essential';
  reminders?: ReminderSettings;
  /** Versão do catálogo de categorias já aplicada a este workspace (ver `mergeCategoryCatalog`). */
  categoryCatalogVersion?: number;
  /** Gastos que se repetem que a pessoa pediu para não sugerir de novo (chave do estabelecimento). */
  dismissedRecurringKeys?: string[];
}

export type InvestmentAssetClass =
  | 'renda_fixa_pos'
  | 'renda_fixa_ipca'
  | 'fiis'
  | 'acoes_br'
  | 'exterior_etf';

export type InvestmentLiquidity =
  | 'D+0 (Liquidez Diária)'
  | 'D+1'
  | 'D+2 (Bolsa B3)'
  | 'No Vencimento';

export interface InvestmentAsset {
  id: string;
  ticker: string;
  name: string;
  assetClass: InvestmentAssetClass;
  institution: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  indexerLabel: string;
  liquidity: InvestmentLiquidity;
  maturityDate?: string;
  monthlyYieldPercent: number; // Monthly dividend yield or interest rate (%)
  isTaxExempt: boolean;
  notes?: string;
  lastQuoteSyncAt?: string; // ISO timestamp of last Google Finance sync
  dailyChangePercent?: number; // Variação diária (%) no Google Finance
  quoteSourceUri?: string; // Link de origem Google Finance / B3
}

export type InvestmentTargetMap = Record<InvestmentAssetClass, number>;

export type CurrencyCode =
  | 'BRL'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'ARS'
  | 'CLP'
  | 'JPY'
  | 'CAD'
  | 'CHF';

export type CurrencyPaymentRegime =
  | 'global_account' // Conta Global (Wise, Nomad, C6 Global, Inter) - IOF 1.1% ou Câmbio Médio do Bolso
  | 'credit_card_intl' // Cartão de Crédito Brasileiro no Exterior - IOF 3.38% + Spread
  | 'cash_fx' // Papel Moeda / Espécie comprada em Casa de Câmbio
  | 'brl_direct'; // Pago diretamente em R$ (PIX, Passagem Aérea Nacional, Booking em R$)

export type TripSplitMethod =
  | 'equal' // Divisão igualitária (ex: 50/50 ou 1/N entre participantes marcados)
  | 'exact' // Valores exatos na moeda da compra (ex: restaurante onde cada um pediu pratos diferentes)
  | 'percentage' // Porcentagem (ex: 60% / 40%)
  | 'shares' // Cotas / Pesos (ex: Casal = 2 cotas, Solteiro = 1 cota)
  | 'individual'; // 100% de uma única pessoa (sem rateio ou adiantamento integral para outra pessoa)

export interface TripParticipant {
  id: string;
  name: string;
  isMe?: boolean;
  color: string;
  email?: string;
  familyMemberId?: string;
  inviteStatus?: 'none' | 'invited' | 'accepted';
  pixKey?: string;
}

export interface TripExchangeLot {
  id: string;
  date: string; // YYYY-MM-DD
  currency: CurrencyCode;
  foreignAmount: number; // Quantidade comprada na moeda estrangeira (ex: € 1.000,00)
  rateBase: number; // Cotação comercial/turismo antes do IOF (ex: 6.12)
  iofPercent: number; // Ex: 1.1% (Wise/Nomad) ou 1.1% / 0%
  effectiveRateBrl: number; // VET (Valor Efetivo Total) em R$ por 1 unidade estrangeira
  totalBrlPaid: number; // Custo total em R$ saído da conta bancária
  sourceLabel: string; // Ex: "Wise — Remessa 1", "Nomad Global", "Espécie Confidence Câmbio"
  accountId?: string; // Conta internacional (na moeda do lote) onde a moeda comprada entra
  debitAccountId?: string; // Conta em reais de onde saiu o dinheiro da compra
}

export interface TripExpenseShare {
  participantId: string;
  foreignShare: number;
  brlShare: number;
  percentage?: number;
  sharesWeight?: number;
}

export type TripSettlementMethod =
  | 'pix_brl' // Acerto em Reais via PIX/Transferência Bancária (pela cotação efetiva ou combinada)
  | 'wise_foreign' // Transferência em moeda estrangeira (ex: Wise para Wise em EUR/USD)
  | 'cash_foreign' // Entrega em papel moeda estrangeira (ex: notas de Euro/Dólar em mãos)
  | 'offset'; // Abatimento cruzado de contas

export interface TripSettlement {
  id: string;
  date: string; // YYYY-MM-DD
  fromParticipantId: string; // Quem pagou o acerto (devedor)
  toParticipantId: string; // Quem recebeu o acerto (credor)
  currencySettled: CurrencyCode; // Moeda usada no pagamento (BRL ou moeda da viagem)
  foreignAmountEquivalent: number; // Valor abatido na moeda base da viagem
  brlAmountSettled: number; // Valor correspondente em R$
  exchangeRateUsed: number; // Câmbio considerado no acerto
  method: TripSettlementMethod;
  linkedTransactionId?: string; // Opcional: ID da transação gerada no extrato bancário
  notes?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'planning' | 'active' | 'completed';
  currency: CurrencyCode;
  defaultExchangeRate: number; // Câmbio referência padrão caso não haja lotes comprados
  budgetForeign: number; // Meta de orçamento pessoal na moeda da viagem
  participants: TripParticipant[];
  exchangeLots: TripExchangeLot[];
  settlements: TripSettlement[];
  coverColor: string;
  notes?: string;
  isArchived?: boolean;
  linkedAccountId?: string; // ID of the International BankAccount (Wise, Nomad, etc.) in the exact currency of the trip
}

export interface TripParticipantBalance {
  participantId: string;
  participantName: string;
  isMe: boolean;
  color: string;
  pixKey?: string;
  paidForeign: number;
  paidBrl: number;
  consumedForeign: number;
  consumedBrl: number;
  settledSentForeign: number;
  settledReceivedForeign: number;
  settledSentBrl: number;
  settledReceivedBrl: number;
  netBalanceForeign: number; // Positivo = tem a receber; Negativo = deve ao grupo
  netBalanceBrl: number; // Positivo = tem a receber em R$; Negativo = deve em R$
}

export interface TripDebtTransfer {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amountForeign: number;
  amountBrlEffective: number; // Valor em R$ já considerando IOF/spread efetivo das despesas
  impliedEffectiveRate: number;
}

export interface TripDailySpendPoint {
  date: string;
  dayLabel: string;
  mySpendForeign: number;
  mySpendBrl: number;
  groupSpendForeign: number;
  groupSpendBrl: number;
}

export interface TripCategorySpendPoint {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  mySpendForeign: number;
  mySpendBrl: number;
  groupSpendForeign: number;
  groupSpendBrl: number;
  percentOfMySpend: number;
}

export interface TripDashboardSummary {
  tripId: string;
  currency: CurrencyCode;
  weightedAverageRate: number;
  totalForeignPurchased: number;
  totalBrlPurchasedForLots: number;
  remainingForeignWalletBalance: number;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  // Totals
  groupTotalSpendForeign: number;
  groupTotalSpendBrl: number;
  myPersonalSpendForeign: number;
  myPersonalSpendBrl: number;
  myOutOfPocketPaidForeign: number;
  myOutOfPocketPaidBrl: number;
  // Budget & Pace (TravelSpend style)
  budgetForeign: number;
  budgetBrlEquivalent: number;
  budgetRemainingForeign: number;
  budgetUsedPercent: number;
  myDailyAverageForeign: number;
  myDailyAverageBrl: number;
  safeRemainingDailyForeign: number;
  safeRemainingDailyBrl: number;
  // Breakdowns & Splits
  dailySeries: TripDailySpendPoint[];
  categoryBreakdown: TripCategorySpendPoint[];
  participantBalances: TripParticipantBalance[];
  simplifiedDebts: TripDebtTransfer[];
  myNetSettlementForeign: number;
  myNetSettlementBrl: number;
}



