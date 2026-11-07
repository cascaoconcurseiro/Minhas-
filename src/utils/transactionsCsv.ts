import type { BankAccount, Category, CreditCard, Transaction } from '../types/finance';

function quoteCsvText(value: string): string {
  // Prefix an apostrophe before formula markers, including markers preceded by whitespace.
  const safeValue = /^[\s\u0000-\u001f\u007f-\u009f]*[=+@-]/.test(value)
    ? `'${value}`
    : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function quoteCsvNumber(value: number): string {
  return `"${value.toFixed(2).replace('.', ',')}"`;
}

export function exportTransactionsToSafeCSV(
  transactions: Transaction[],
  categories: Category[],
  accounts: BankAccount[],
  cards: CreditCard[]
): string {
  const catMap = new Map(categories.map((category) => [category.id, category]));
  const accountMap = new Map(accounts.map((account) => [account.id, account.name]));
  const cardMap = new Map(cards.map((card) => [card.id, card.name]));
  const headers = [
    'Data', 'Competencia', 'Descricao', 'Tipo', 'Status', 'Categoria',
    'Subcategoria', 'Conta_ou_Cartao', 'Parcela', 'Valor_BRL',
  ];

  const rows = transactions.map((transaction) => {
    const category = catMap.get(transaction.categoryId);
    const origin = transaction.creditCardId
      ? `Cartao: ${cardMap.get(transaction.creditCardId) || transaction.creditCardId}`
      : accountMap.get(transaction.accountId || '') || 'Carteira';
    const installment = transaction.installmentTotal && transaction.installmentTotal > 1
      ? `${transaction.installmentNumber}/${transaction.installmentTotal}`
      : 'Unico';
    const signedAmount = transaction.type === 'expense' ? -transaction.amount : transaction.amount;
    const fields = [
      quoteCsvText(transaction.date),
      quoteCsvText(transaction.competenceMonth),
      quoteCsvText(transaction.description),
      quoteCsvText(transaction.type === 'income' ? 'Receita' : transaction.type === 'expense' ? 'Despesa' : 'Transferencia'),
      quoteCsvText(transaction.status === 'paid' ? 'Efetivado' : 'Pendente'),
      quoteCsvText(category?.name || 'Outros'),
      quoteCsvText(category?.subcategories?.find((subcategory) => subcategory.id === transaction.subcategoryId)?.name || 'Geral'),
      quoteCsvText(origin),
      quoteCsvText(installment),
      quoteCsvNumber(signedAmount),
    ];
    return fields.join(';');
  });

  return [headers.join(';'), ...rows].join('\n');
}
