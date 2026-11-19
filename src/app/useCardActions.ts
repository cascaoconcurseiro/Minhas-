/** Ações de cartão: pagar fatura, cadastrar, editar, apagar. Parte do App (ver src/App.tsx). */
import { getAccountCurrency } from '../domain/finance/transferRules';
import { formatBRL, getLocalDateISO, getTransactionsLinkedToCreditCard, payCreditCardInvoice, reclassifyClosingDayPurchases } from '../domain/finance/financeRules';
import { CreditCard } from '../types/finance';
import { newEntityId } from '../utils/ids';
import type { AppStateApi } from './useAppState';

export function useCardActions(app: AppStateApi) {
  const {
    accounts,
    cards,
    requireWorkspaceWrite,
    selectedMonth,
    setCards,
    setTransactions,
    showNotice,
    transactions,
  } = app;
  const handlePayCardInvoice = (
    cardId: string,
    paymentAccountId: string,
    customAmount?: number
  ) => {
    if (!requireWorkspaceWrite()) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const effectiveAccountId =
      paymentAccountId ||
      card.defaultAccountId ||
      accounts.find((account) => getAccountCurrency(account) === 'BRL')?.id ||
      '';
    const paymentAccount = accounts.find((account) => account.id === effectiveAccountId);
    if (!paymentAccount) {
      showNotice('Não há conta cadastrada para pagar a fatura. Cadastre uma conta em reais primeiro.', undefined, true);
      return;
    }
    if (getAccountCurrency(paymentAccount) !== 'BRL') {
      showNotice('A fatura é em reais: pague por uma conta em reais.', undefined, true);
      return;
    }
    const prevSnapshot = [...transactions];
    const paymentDate = getLocalDateISO();
    const updated = payCreditCardInvoice(
      card,
      transactions,
      selectedMonth,
      effectiveAccountId,
      paymentDate,
      customAmount
    );
    if (updated === transactions) {
      showNotice('Informe um valor positivo que não ultrapasse o saldo pendente.', undefined, true);
      return;
    }
    setTransactions(updated);
    if (customAmount && customAmount > 0) {
      showNotice(
        `Pagamento parcial de ${formatBRL(customAmount)} na fatura de ${card.name} registrado.`,
        prevSnapshot
      );
    } else {
      showNotice(
        `Fatura de ${card.name} paga e debitada da conta selecionada.`,
        prevSnapshot
      );
    }
  };

  const handleAddCard = (newCard: Omit<CreditCard, 'id'>) => {
    if (!requireWorkspaceWrite()) return;
    const created: CreditCard = {
      ...newCard,
      id: newEntityId('card'),
    };
    setCards((prev) => [...prev, created]);
    showNotice(`Cartão ${created.name} adicionado.`);
  };

  const handleUpdateCard = (updatedCard: CreditCard) => {
    if (!requireWorkspaceWrite()) return;
    const previousCard = cards.find((c) => c.id === updatedCard.id);
    if (
      previousCard &&
      (previousCard.closingDay !== updatedCard.closingDay ||
        Boolean(previousCard.closingDayStartsNextInvoice) !== Boolean(updatedCard.closingDayStartsNextInvoice))
    ) {
      const moved = reclassifyClosingDayPurchases(transactions, previousCard, updatedCard);
      if (moved.some((tx, index) => tx !== transactions[index])) setTransactions(moved);
    }
    setCards((prev) =>
      prev.map((c) => (c.id === updatedCard.id ? updatedCard : c))
    );
    showNotice(`Cartão ${updatedCard.name} atualizado.`);
  };

  const handleDeleteCard = (cardId: string): boolean => {
    if (!requireWorkspaceWrite()) return false;
    const target = cards.find((c) => c.id === cardId);
    if (!target) return false;
    const linkedTransactions = getTransactionsLinkedToCreditCard(target, transactions);
    if (linkedTransactions.length > 0) {
      showNotice(
        `Este cartão tem ${linkedTransactions.length} lançamento(s) no histórico. Para preservar compras e pagamentos já registrados, mantenha o cartão no histórico.`,
        undefined,
        true
      );
      return false;
    }
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    showNotice(`Cartão ${target.name} removido.`);
    return true;
  };

  return {
    handleAddCard,
    handleDeleteCard,
    handlePayCardInvoice,
    handleUpdateCard,
  };
}

export type CardActionsApi = ReturnType<typeof useCardActions>;
