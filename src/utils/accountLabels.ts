import type { AccountType, BankAccount } from '../types/finance';

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  cash: 'Carteira',
  investment: 'Investimentos',
  international: 'Conta internacional',
};

/** Nomes genéricos de conta que não dizem de qual banco ela é. */
const GENERIC_NAMES = new Set([
  'conta',
  'conta corrente',
  'corrente',
  'conta poupanca',
  'poupanca',
  'conta bancaria',
  'conta digital',
  'conta salario',
  'conta pagamento',
  'conta principal',
  'minha conta',
  'carteira',
  'dinheiro',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function isGenericName(account: Pick<BankAccount, 'name' | 'type'>): boolean {
  const name = normalize(account.name);
  return !name || GENERIC_NAMES.has(name) || name === normalize(TYPE_LABELS[account.type] ?? '');
}

/**
 * Nome da conta para os formulários: mostra o BANCO, e não o tipo da conta ("Conta corrente").
 * - Nome genérico ("Conta corrente") com banco informado → o banco ("Nubank").
 * - Dois nomes genéricos do mesmo banco → "Nubank · Poupança" (banco e tipo) para não confundir.
 * - Nome que já diz algo próprio ("Reserva Viagem", "Wise USD") → mantém o nome.
 */
export function getAccountLabel(
  account: Pick<BankAccount, 'id' | 'name' | 'institution' | 'type'>,
  allAccounts: Array<Pick<BankAccount, 'id' | 'name' | 'institution' | 'type'>> = []
): string {
  const institution = account.institution?.trim() ?? '';
  const name = account.name?.trim() ?? '';
  if (!institution) return name || TYPE_LABELS[account.type] || 'Conta';
  if (!isGenericName(account)) return name;
  const sameBank = allAccounts.filter(
    (other) => other.id !== account.id && normalize(other.institution ?? '') === normalize(institution) && isGenericName(other)
  );
  return sameBank.length > 0 ? `${institution} · ${TYPE_LABELS[account.type] ?? name}` : institution;
}

/** Como `getAccountLabel`, acrescentando o banco entre parênteses quando o nome não o diz (e só se houver banco). */
export function getAccountLabelWithBank(
  account: Pick<BankAccount, 'id' | 'name' | 'institution' | 'type'>,
  allAccounts: Array<Pick<BankAccount, 'id' | 'name' | 'institution' | 'type'>> = []
): string {
  const label = getAccountLabel(account, allAccounts);
  const institution = account.institution?.trim() ?? '';
  if (!institution || normalize(label).includes(normalize(institution))) return label;
  return `${label} (${institution})`;
}
