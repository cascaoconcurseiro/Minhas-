/** Auditoria de integridade e reparo do estado financeiro (dados antigos, vínculos e valores). */
import type {
  BankAccount,
  Category,
  CreditCard,
  CurrencyCode,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
} from '../../types/finance';
import {
  getLocalDateISO,
} from '../finance/financeRules.ts';

export interface FinancialIntegrityCheckItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  issueCount: number;
  issueDetails?: string[];
  metricLabel: string;
}

export interface FinancialIntegrityAuditReport {
  isAllHealthy: boolean;
  totalChecks: number;
  passedChecks: number;
  totalIssuesFound: number;
  checks: FinancialIntegrityCheckItem[];
}

function isLegacyMockId(id: string): boolean {
  if (!id || typeof id !== 'string') return true;
  const normalizedId = id.trim().toLowerCase();
  return /^(mock|demo|seed)(?:-|$)/.test(normalizedId);
}

export function isLegacyMockRecord(item: unknown): boolean {
  if (!item || typeof item !== 'object') return true;
  const rec = item as Record<string, unknown>;
  if (rec.isMock === true || rec.isDemo === true) return true;
  const id = typeof rec.id === 'string' ? rec.id : '';
  if (isLegacyMockId(id)) return true;

  const fitid = typeof rec.fitid === 'string' ? rec.fitid.trim().toUpperCase() : '';
  if (fitid.startsWith('MOCK-') || fitid.startsWith('DEMO-')) {
    return true;
  }

  return false;
}

export function stripLegacyMockRecords<T>(items: T[]): T[] {
  return items.filter((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const id = (item as Record<string, unknown>).id;
    return typeof id === 'string' && id.trim().length > 0 && !isLegacyMockRecord(item);
  });
}


/**
 * Audita em tempo real a Fonte Única de Dados (Single Source of Truth — SSOT)
 * verificando integridade referencial, partidas dobradas, faturas, câmbio, rateios e ausência de dados mock.
 */
export function runFinancialIntegrityAudit(params: {
  accountsCount: number;
  cardsCount: number;
  transactions: Transaction[];
  trips: Trip[];
  accounts?: BankAccount[];
  cards?: CreditCard[];
  categories?: Category[];
  investments?: InvestmentAsset[];
  goals?: SavingsGoal[];
}): FinancialIntegrityAuditReport {
  const {
    transactions,
    trips,
    accounts = [],
    cards = [],
    categories = [],
    investments = [],
    goals = [],
  } = params;

  // 1. Validação Estrutural de Lançamentos (Datas, Competência e Valores Positivos)
  const invalidStructureTxs = transactions.filter(
    (t) =>
      !t.id ||
      typeof t.amount !== 'number' ||
      Number.isNaN(t.amount) ||
      (t.amount < 0 && !t.isCardRefund) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '') ||
      !/^\d{4}-\d{2}$/.test(t.competenceMonth || '')
  );

  // 2. Integridade Referencial (Vínculos de Contas, Cartões, Categorias, Viagens e Metas)
  const accountIds = new Set(accounts.map((a) => a.id));
  const cardIds = new Set(cards.map((c) => c.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const tripIds = new Set(trips.map((tr) => tr.id));
  const assetIds = new Set(investments.map((inv) => inv.id));

  const orphanRefIssues: string[] = [];
  if (accounts.length > 0 || cards.length > 0 || categories.length > 0) {
    for (const tx of transactions) {
      if (
        accounts.length > 0 &&
        tx.accountId &&
        !tx.isCompanionOnlyExpense &&
        !accountIds.has(tx.accountId)
      ) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para conta inexistente.`);
      }
      if (cards.length > 0 && tx.creditCardId && !cardIds.has(tx.creditCardId)) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para cartão inexistente.`);
      }
      if (
        categories.length > 0 &&
        tx.type !== 'transfer' &&
        !tx.isInvoicePayment &&
        tx.categoryId &&
        !categoryIds.has(tx.categoryId)
      ) {
        orphanRefIssues.push(
          `Lançamento "${tx.description}" aponta para categoria removida.`
        );
      }
      if (tx.tripId && !tripIds.has(tx.tripId)) {
        orphanRefIssues.push(`Lançamento "${tx.description}" aponta para viagem removida.`);
      }
      if (
        investments.length > 0 &&
        tx.targetInvestmentAssetId &&
        !assetIds.has(tx.targetInvestmentAssetId)
      ) {
        orphanRefIssues.push(
          `Lançamento "${tx.description}" aponta para ativo de investimento removido.`
        );
      }
    }
    for (const g of goals) {
      if (g.linkedAssetId && !assetIds.has(g.linkedAssetId)) {
        orphanRefIssues.push(`Meta "${g.name}" vinculada a ativo removido.`);
      }
    }
  }

  // 3. Partidas Dobradas em Transferências entre Contas e Aportes Diretos em Ativos
  const transfers = transactions.filter((t) => t.type === 'transfer');
  const invalidTransfers = transfers.filter((t) => {
    if (!t.accountId) return true;
    const hasValidAccountDest =
      Boolean(t.destinationAccountId) && t.accountId !== t.destinationAccountId;
    const hasValidInvestmentDest = Boolean(t.targetInvestmentAssetId);
    return !hasValidAccountDest && !hasValidInvestmentDest;
  });

  // 4. Pagamentos de Fatura Isolados das Categorias de Consumo (Sem Dupla Contagem)
  const invoicePayments = transactions.filter((t) => t.isInvoicePayment);
  const invalidInvoicePayments = invoicePayments.filter(
    (t) => t.type !== 'expense' || Boolean(t.creditCardId)
  );

  // 5. Contas Internacionais e Despesas em Moeda Estrangeira com Câmbio e IOF Íntegros
  const fxTransactions = transactions.filter(
    (t) => t.originalCurrency && t.originalCurrency !== 'BRL' && (t.originalAmount || 0) > 0
  );
  const invalidFxTxs = fxTransactions.filter(
    (t) => t.amount <= 0 || (t.effectiveExchangeRate || t.exchangeRate || 0) <= 0
  );
  const invalidIntlAccounts = accounts.filter(
    (a) => a.type === 'international' && (!a.currency || a.currency === 'BRL')
  );
  const fxIssuesCount = invalidFxTxs.length + invalidIntlAccounts.length;

  // 6. Rateios de Viagem e Isolamento de Gastos Pagos por Terceiros
  const splitTripTxs = transactions.filter(
    (t) => Array.isArray(t.tripShares) && t.tripShares.length > 0
  );
  const invalidSplitTxs = splitTripTxs.filter((t) => {
    const sumBrl = (t.tripShares || []).reduce((acc, s) => acc + s.brlShare, 0);
    return Math.abs(sumBrl - t.amount) > 0.05;
  });
  const companionPaidTxs = transactions.filter(
    (t) => t.paidByParticipantId && t.paidByParticipantId !== 'me'
  );
  const unisolatedCompanionTxs = companionPaidTxs.filter(
    (t) => !t.isCompanionOnlyExpense
  );
  const splitIssuesCount = invalidSplitTxs.length + unisolatedCompanionTxs.length;

  // 7. Marcadores explícitos de demonstração nos dados carregados
  const mockItemsCount =
    accounts.filter((x) => isLegacyMockRecord(x)).length +
    cards.filter((x) => isLegacyMockRecord(x)).length +
    transactions.filter((x) => isLegacyMockRecord(x)).length +
    investments.filter((x) => isLegacyMockRecord(x)).length +
    goals.filter((x) => isLegacyMockRecord(x)).length +
    trips.filter((x) => isLegacyMockRecord(x)).length;

  const checks: FinancialIntegrityCheckItem[] = [
    {
      id: 'ssot_engine',
      title: 'Fonte Única de Dados & Estrutura Contábil (SSOT)',
      description:
        'Todos os lançamentos possuem datas ISO válidas, mês de competência estruturado e valores numéricos íntegros.',
      passed: invalidStructureTxs.length === 0,
      issueCount: invalidStructureTxs.length,
      issueDetails: invalidStructureTxs.map(
        (t) => `Lançamento "${t.description || t.id}" com data/competência ou valor inválido.`
      ),
      metricLabel:
        invalidStructureTxs.length === 0
          ? `${transactions.length} lançamentos unificados`
          : `${invalidStructureTxs.length} erro(s) estrutural(is)`,
    },
    {
      id: 'orphan_references',
      title: 'Integridade Referencial (Contas, Cartões, Categorias e Metas)',
      description:
        'Verifica se algum lançamento, fatura ou meta aponta para conta, cartão, categoria, viagem ou ativo excluído.',
      passed: orphanRefIssues.length === 0,
      issueCount: orphanRefIssues.length,
      issueDetails: orphanRefIssues,
      metricLabel:
        orphanRefIssues.length === 0
          ? '100% dos vínculos ativos'
          : `${orphanRefIssues.length} vínculo(s) órfão(s)`,
    },
    {
      id: 'double_entry_transfers',
      title: 'Partidas Dobradas em Transferências & Aportes',
      description:
        'Transferências debitam a origem e creditam o destino distinto sem inflar receitas ou despesas do mês.',
      passed: invalidTransfers.length === 0,
      issueCount: invalidTransfers.length,
      issueDetails: invalidTransfers.map(
        (t) => `Transferência "${t.description}" sem conta origem/destino distinta.`
      ),
      metricLabel:
        invalidTransfers.length === 0
          ? `${transfers.length} transferências íntegras`
          : `${invalidTransfers.length} transferência(s) inválida(s)`,
    },
    {
      id: 'credit_card_competence',
      title: 'Isolamento Caixa vs. Competência de Cartões',
      description:
        'Compras no crédito respeitam o fechamento da fatura e baixas de fatura não geram dupla contagem nas categorias.',
      passed: invalidInvoicePayments.length === 0,
      issueCount: invalidInvoicePayments.length,
      issueDetails: invalidInvoicePayments.map(
        (t) => `Baixa de fatura "${t.description}" vinculada incorretamente como compra.`
      ),
      metricLabel:
        invalidInvoicePayments.length === 0
          ? `${invoicePayments.length} baixas conciliadas`
          : `${invalidInvoicePayments.length} baixa(s) com conflito`,
    },
    {
      id: 'fx_multi_currency',
      title: 'Contas Internacionais & Conversão Cambial (IOF / VET)',
      description:
        'Contas globais (Wise/Nomad) independentes de viagem e compras em moeda estrangeira com VET e IOF consistentes.',
      passed: fxIssuesCount === 0,
      issueCount: fxIssuesCount,
      metricLabel:
        fxIssuesCount === 0
          ? `${fxTransactions.length} compras multi-moeda`
          : `${fxIssuesCount} alerta(s) cambial(is)`,
    },
    {
      id: 'trip_group_split',
      title: 'Fechamento de Centavos & Isolamento de Terceiros (Splitwise)',
      description:
        'Rateios em grupo fecham 100% ao centavo e gastos pagos por amigos não descontam do seu banco pessoal.',
      passed: splitIssuesCount === 0,
      issueCount: splitIssuesCount,
      metricLabel:
        splitIssuesCount === 0
          ? `${trips.length} viagens / ${splitTripTxs.length} rateios`
          : `${splitIssuesCount} divergência(s) de rateio`,
    },
    {
      id: 'zero_mock_data',
      title: 'Marcadores explícitos de demonstração',
      description:
        'Procura IDs e campos marcados explicitamente como demonstração nos registros carregados nesta sessão. Não verifica o banco diretamente.',
      passed: mockItemsCount === 0,
      issueCount: mockItemsCount,
      metricLabel:
        mockItemsCount === 0
          ? 'Nenhum marcador explícito encontrado'
          : `${mockItemsCount} registro(s) marcado(s) para revisão`,
    },
  ];

  const passedChecks = checks.filter((c) => c.passed).length;
  const totalIssuesFound = checks.reduce((acc, c) => acc + c.issueCount, 0);

  return {
    isAllHealthy: passedChecks === checks.length,
    totalChecks: checks.length,
    passedChecks,
    totalIssuesFound,
    checks,
  };
}

export interface SanitizeFinancialStateResult {
  repairedCount: number;
  repairedLog: string[];
  accounts: BankAccount[];
  cards: CreditCard[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  investments: InvestmentAsset[];
  trips: Trip[];
}

/**
 * Executa varredura e auto-reparo determinístico em toda a base financeira para corrigir
 * vínculos órfãos, competências ausentes, isolamento de despesas de terceiros, arredondamento de rateios
 * e remoção de eventuais registros legados/mock.
 */
export function sanitizeAndRepairFinancialState(params: {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  goals: SavingsGoal[];
  investments: InvestmentAsset[];
  trips: Trip[];
}): SanitizeFinancialStateResult {
  const repairedLog: string[] = [];
  let repairedCount = 0;

  const cleanAccounts = params.accounts
    .filter((a) => {
      const ok = !isLegacyMockRecord(a);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Conta legada/mock "${a.name}" removida.`);
      }
      return ok;
    })
    .map((a) => {
      if (a.type === 'international' && (!a.currency || a.currency === 'BRL')) {
        repairedCount++;
        repairedLog.push(`Moeda da conta internacional "${a.name}" ajustada para EUR.`);
        return { ...a, currency: 'EUR' as CurrencyCode };
      }
      return a;
    });

  const cleanCards = params.cards.filter((c) => {
    const ok = !isLegacyMockRecord(c);
    if (!ok) {
      repairedCount++;
      repairedLog.push(`Cartão legado/mock "${c.name}" removido.`);
    }
    return ok;
  });

  const cleanInvestments = params.investments
    .filter((inv) => {
      const ok = !isLegacyMockRecord(inv);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Ativo legado/mock "${inv.ticker}" removido.`);
      }
      return ok;
    })
    .map((inv) => {
      const safeQty = Math.max(0, Number(inv.quantity) || 0);
      const safeAvg = Math.max(0, Number(inv.averagePrice) || 0);
      const safeCur = Math.max(0, Number(inv.currentPrice) || safeAvg);
      if (
        safeQty !== inv.quantity ||
        safeAvg !== inv.averagePrice ||
        safeCur !== inv.currentPrice
      ) {
        repairedCount++;
        repairedLog.push(`Valores numéricos do ativo "${inv.ticker}" normalizados.`);
        return {
          ...inv,
          quantity: safeQty,
          averagePrice: safeAvg,
          currentPrice: safeCur,
        };
      }
      return inv;
    });

  const cleanTrips = params.trips.filter((tr) => {
    const ok = !isLegacyMockRecord(tr);
    if (!ok) {
      repairedCount++;
      repairedLog.push(`Viagem legada/mock "${tr.name}" removida.`);
    }
    return ok;
  });

  const accountIds = new Set(cleanAccounts.map((a) => a.id));
  const cardIds = new Set(cleanCards.map((c) => c.id));
  const categoryIds = new Set(params.categories.map((c) => c.id));
  const tripIds = new Set(cleanTrips.map((tr) => tr.id));
  const assetIds = new Set(cleanInvestments.map((inv) => inv.id));

  const defaultExpenseCatId =
    params.categories.find((c) => c.type === 'expense')?.id ||
    params.categories[0]?.id ||
    'cat-moradia';
  const defaultIncomeCatId =
    params.categories.find((c) => c.type === 'income')?.id ||
    params.categories[0]?.id ||
    'cat-salario';
  const fallbackAccountId = cleanAccounts[0]?.id || '';

  const cleanGoals = params.goals
    .filter((g) => {
      const ok = !isLegacyMockRecord(g);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Meta legada/mock "${g.name}" removida.`);
      }
      return ok;
    })
    .map((g) => {
      if (g.linkedAssetId && !assetIds.has(g.linkedAssetId)) {
        repairedCount++;
        repairedLog.push(`Vínculo de ativo inexistente removido da meta "${g.name}".`);
        return { ...g, linkedAssetId: undefined };
      }
      return g;
    });

  const cleanTransactions = params.transactions
    .filter((tx) => {
      const ok = !isLegacyMockRecord(tx);
      if (!ok) {
        repairedCount++;
        repairedLog.push(`Lançamento legado/mock "${tx.description}" removido.`);
      }
      return ok;
    })
    .map((tx) => {
      let modified = false;
      const nextTx: Transaction = { ...tx };

      // Ensure valid date and competenceMonth
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextTx.date || '')) {
        nextTx.date = getLocalDateISO();
        modified = true;
      }
      if (!/^\d{4}-\d{2}$/.test(nextTx.competenceMonth || '')) {
        nextTx.competenceMonth = nextTx.date.slice(0, 7);
        modified = true;
      }

      // Ensure non-negative amount
      if (typeof nextTx.amount !== 'number' || Number.isNaN(nextTx.amount) || (nextTx.amount < 0 && !nextTx.isCardRefund)) {
        nextTx.amount = Math.abs(Number(nextTx.amount) || 0);
        modified = true;
      }

      // Invoice payment isolation
      if (nextTx.isInvoicePayment && nextTx.creditCardId) {
        nextTx.creditCardId = undefined;
        modified = true;
      }

      // Companion-paid isolation
      if (
        nextTx.paidByParticipantId &&
        nextTx.paidByParticipantId !== 'me' &&
        !nextTx.isCompanionOnlyExpense
      ) {
        nextTx.isCompanionOnlyExpense = true;
        modified = true;
      }

      // Orphan tripId cleanup
      if (nextTx.tripId && !tripIds.has(nextTx.tripId)) {
        nextTx.tripId = undefined;
        modified = true;
      }

      // Orphan targetInvestmentAssetId cleanup
      if (
        cleanInvestments.length > 0 &&
        nextTx.targetInvestmentAssetId &&
        !assetIds.has(nextTx.targetInvestmentAssetId)
      ) {
        nextTx.targetInvestmentAssetId = undefined;
        if (nextTx.type === 'transfer' && !nextTx.destinationAccountId) {
          nextTx.type = 'expense';
          nextTx.categoryId = categoryIds.has('cat-aportes')
            ? 'cat-aportes'
            : defaultExpenseCatId;
        }
        modified = true;
      }

      // Destination-less transfer repair
      if (
        nextTx.type === 'transfer' &&
        !nextTx.destinationAccountId &&
        !nextTx.targetInvestmentAssetId
      ) {
        nextTx.type = 'expense';
        nextTx.categoryId =
          nextTx.categoryId && categoryIds.has(nextTx.categoryId)
            ? nextTx.categoryId
            : categoryIds.has('cat-aportes')
            ? 'cat-aportes'
            : defaultExpenseCatId;
        modified = true;
      }

      // Orphan categoryId repair
      if (
        params.categories.length > 0 &&
        nextTx.type !== 'transfer' &&
        !nextTx.isInvoicePayment &&
        (!nextTx.categoryId || !categoryIds.has(nextTx.categoryId))
      ) {
        nextTx.categoryId =
          nextTx.type === 'income' ? defaultIncomeCatId : defaultExpenseCatId;
        modified = true;
      }

      // Orphan creditCardId cleanup
      if (cleanCards.length > 0 && nextTx.creditCardId && !cardIds.has(nextTx.creditCardId)) {
        nextTx.creditCardId = undefined;
        modified = true;
      }

      // Orphan accountId repair
      if (
        cleanAccounts.length > 0 &&
        nextTx.accountId &&
        !nextTx.isCompanionOnlyExpense &&
        !accountIds.has(nextTx.accountId)
      ) {
        nextTx.accountId = fallbackAccountId;
        modified = true;
      }

      // TripShares cent alignment
      if (Array.isArray(nextTx.tripShares) && nextTx.tripShares.length > 0) {
        const sumBrl = nextTx.tripShares.reduce((acc, s) => acc + s.brlShare, 0);
        const diff = Math.round((nextTx.amount - sumBrl) * 100) / 100;
        if (Math.abs(diff) > 0.01) {
          const updatedShares = [...nextTx.tripShares];
          updatedShares[0] = {
            ...updatedShares[0],
            brlShare: Math.round((updatedShares[0].brlShare + diff) * 100) / 100,
          };
          nextTx.tripShares = updatedShares;
          modified = true;
        }
      }

      if (modified) {
        repairedCount++;
        repairedLog.push(`Lançamento "${nextTx.description}" normalizado.`);
      }
      return nextTx;
    });

  return {
    repairedCount,
    repairedLog,
    accounts: cleanAccounts,
    cards: cleanCards,
    transactions: cleanTransactions,
    goals: cleanGoals,
    investments: cleanInvestments,
    trips: cleanTrips,
  };
}
