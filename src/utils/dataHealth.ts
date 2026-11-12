import type { BankAccount, Category, CreditCard, FamilyMember, Transaction } from '../types/finance';

/**
 * Saúde dos dados: aponta o que está incompleto ou inconsistente no que a pessoa cadastrou,
 * para ela corrigir. Só lê; nunca altera nada. Cada problema só aparece quando existe.
 */
export interface DataHealthIssue {
  id:
    | 'uncategorized'
    | 'missing_account'
    | 'missing_card'
    | 'missing_member'
    | 'shared_amount_over_total'
    | 'account_without_balance'
    | 'card_invalid_days'
    | 'card_without_limit';
  severity: 'warn' | 'info';
  title: string;
  detail: string;
  count: number;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function assessDataHealth(input: {
  accounts: BankAccount[];
  cards: CreditCard[];
  categories: Category[];
  transactions: Transaction[];
  familyMembers: FamilyMember[];
}): DataHealthIssue[] {
  const { accounts, cards, categories, transactions, familyMembers } = input;
  const accountIds = new Set(accounts.map((item) => item.id));
  const cardIds = new Set(cards.map((item) => item.id));
  const categoryIds = new Set(categories.map((item) => item.id));
  const memberIds = new Set(familyMembers.map((item) => item.id));
  const issues: DataHealthIssue[] = [];

  const uncategorized = transactions.filter(
    (tx) =>
      tx.type !== 'transfer' &&
      !tx.isInvoicePayment &&
      !tx.isCompanionOnlyExpense &&
      (!tx.categoryId || !categoryIds.has(tx.categoryId))
  ).length;
  if (uncategorized > 0) {
    issues.push({
      id: 'uncategorized',
      severity: 'warn',
      title: 'Lançamentos sem categoria',
      detail: `${plural(uncategorized, 'lançamento está', 'lançamentos estão')} sem categoria válida e ${uncategorized === 1 ? 'fica' : 'ficam'} fora dos gráficos e dos tetos.`,
      count: uncategorized,
    });
  }

  const missingAccount = transactions.filter(
    (tx) =>
      (tx.accountId && !accountIds.has(tx.accountId)) ||
      (tx.destinationAccountId && !accountIds.has(tx.destinationAccountId))
  ).length;
  if (missingAccount > 0) {
    issues.push({
      id: 'missing_account',
      severity: 'warn',
      title: 'Lançamentos ligados a uma conta que não existe mais',
      detail: `${plural(missingAccount, 'lançamento aponta', 'lançamentos apontam')} para conta apagada e ${missingAccount === 1 ? 'não entra' : 'não entram'} em nenhum saldo.`,
      count: missingAccount,
    });
  }

  const missingCard = transactions.filter((tx) => tx.creditCardId && !cardIds.has(tx.creditCardId)).length;
  if (missingCard > 0) {
    issues.push({
      id: 'missing_card',
      severity: 'warn',
      title: 'Compras ligadas a um cartão que não existe mais',
      detail: `${plural(missingCard, 'compra aponta', 'compras apontam')} para cartão apagado e ${missingCard === 1 ? 'não entra' : 'não entram'} em nenhuma fatura.`,
      count: missingCard,
    });
  }

  const missingMember = transactions.filter(
    (tx) => tx.isShared && tx.sharedMemberId && !memberIds.has(tx.sharedMemberId)
  ).length;
  if (missingMember > 0) {
    issues.push({
      id: 'missing_member',
      severity: 'warn',
      title: 'Divisões com alguém que não está mais na família',
      detail: `${plural(missingMember, 'lançamento dividido aponta', 'lançamentos divididos apontam')} para uma pessoa removida.`,
      count: missingMember,
    });
  }

  const sharedOver = transactions.filter(
    (tx) => tx.isShared && typeof tx.sharedAmount === 'number' && tx.sharedAmount > tx.amount + 0.005
  ).length;
  if (sharedOver > 0) {
    issues.push({
      id: 'shared_amount_over_total',
      severity: 'warn',
      title: 'Divisão maior que o valor do lançamento',
      detail: `${plural(sharedOver, 'lançamento tem', 'lançamentos têm')} a parte do familiar maior que o valor total.`,
      count: sharedOver,
    });
  }

  const accountsUsed = new Set<string>();
  transactions.forEach((tx) => {
    if (tx.accountId) accountsUsed.add(tx.accountId);
    if (tx.destinationAccountId) accountsUsed.add(tx.destinationAccountId);
  });
  const emptyAccounts = accounts.filter(
    (account) => account.includeInTotal && !account.initialBalance && !accountsUsed.has(account.id)
  );
  if (emptyAccounts.length > 0) {
    issues.push({
      id: 'account_without_balance',
      severity: 'info',
      title: 'Contas sem saldo e sem movimento',
      detail: `${emptyAccounts.map((account) => account.name).join(', ')}: informe o saldo inicial para o patrimônio e a previsão ficarem certos.`,
      count: emptyAccounts.length,
    });
  }

  const invalidDays = cards.filter((card) => {
    const valid = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31;
    return !valid(card.closingDay) || !valid(card.dueDay);
  });
  if (invalidDays.length > 0) {
    issues.push({
      id: 'card_invalid_days',
      severity: 'warn',
      title: 'Cartão com dia de fechamento ou vencimento inválido',
      detail: `${invalidDays.map((card) => card.name).join(', ')}: sem esses dias a fatura cai no mês errado.`,
      count: invalidDays.length,
    });
  }

  const noLimit = cards.filter((card) => !(card.limit > 0));
  if (noLimit.length > 0) {
    issues.push({
      id: 'card_without_limit',
      severity: 'info',
      title: 'Cartão sem limite informado',
      detail: `${noLimit.map((card) => card.name).join(', ')}: sem o limite, o limite livre e a recomendação de cartão não funcionam.`,
      count: noLimit.length,
    });
  }

  return issues;
}
