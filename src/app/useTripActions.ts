/** Ações de viagens e câmbio. Parte do App (ver src/App.tsx). */
import { Transaction, Trip, TripExchangeLot, TripSettlement } from '../types/finance';
import { releaseExchangeLotMovements } from '../domain/finance/financeRules';
import { getAccountCurrency } from '../domain/finance/transferRules';
import { newEntityId } from '../utils/ids';
import type { AppStateApi } from './useAppState';

export function useTripActions(app: AppStateApi) {
  const {
    accounts,
    requireWorkspaceWrite,
    setTransactions,
    setTrips,
    showNotice,
    trips,
  } = app;
  // Trips & Multi-Currency Handlers
  const handleAddTrip = (newTrip: Trip) => {
    if (!requireWorkspaceWrite()) return;
    setTrips((prev) => [newTrip, ...prev]);
    showNotice(`Viagem "${newTrip.name}" criada com sucesso!`);
  };

  const handleUpdateTrip = (updatedTrip: Trip) => {
    if (!requireWorkspaceWrite()) return;
    setTrips((prev) =>
      prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t))
    );
    showNotice(`Viagem "${updatedTrip.name}" atualizada.`);
  };

  const handleDeleteTrip = (tripId: string) => {
    if (!requireWorkspaceWrite()) return;
    const target = trips.find((t) => t.id === tripId);
    const lotIdList = (target?.exchangeLots || []).map((l) => l.id);
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    setTransactions((prev) =>
      releaseExchangeLotMovements(prev, lotIdList)
        .map((tx) =>
          tx.tripId === tripId
            ? {
                ...tx,
                tripId: undefined,
                paidByParticipantId: undefined,
                splitBetweenParticipantIds: undefined,
                customParticipantSplits: undefined,
              }
            : tx
        )
    );
    showNotice(`Viagem "${target?.name || ''}" removida.`);
  };

  const handleAddExchangeLot = (
    tripId: string,
    lot: TripExchangeLot,
    debitFromAccountId?: string
  ) => {
    if (!requireWorkspaceWrite()) return;
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, exchangeLots: [lot, ...t.exchangeLots] }
          : t
      )
    );
    if (debitFromAccountId && lot.totalBrlPaid > 0) {
      const targetTrip = trips.find((t) => t.id === tripId);
      const debitAccount = accounts.find((account) => account.id === debitFromAccountId);
      if (debitAccount && getAccountCurrency(debitAccount) !== 'BRL') {
        showNotice('Os reais da compra de câmbio precisam sair de uma conta em reais.', undefined, true);
        return;
      }
      // A compra de câmbio é uma TRANSFERÊNCIA (reais -> conta internacional), não um gasto: se fosse despesa,
      // contaria duas vezes (na compra da moeda e depois nos gastos da viagem). Sem conta internacional vinculada,
      // continua como saída de reais.
      const creditAccount = accounts.find(
        (account) =>
          account.id === lot.accountId &&
          account.type === 'international' &&
          account.currency === lot.currency
      );
      const fxTx: Transaction = {
        id: `tx-fxlot-${lot.id}`,
        description: `Compra de Câmbio (${lot.currency} ${lot.foreignAmount.toFixed(2)}) — ${
          lot.sourceLabel
        }`,
        amount: lot.totalBrlPaid,
        date: lot.date,
        competenceMonth: lot.date.slice(0, 7),
        type: creditAccount ? 'transfer' : 'expense',
        status: 'paid',
        categoryId: 'cat-viagens',
        accountId: debitFromAccountId,
        destinationAccountId: creditAccount?.id,
        paymentMethod: creditAccount ? 'transfer' : 'pix',
        recurrence: 'single',
        notes: `Lote de câmbio para ${targetTrip?.name || 'Viagem'} (VET R$ ${lot.effectiveRateBrl.toFixed(4)}) [lot:${lot.id}]`,
      };
      setTransactions((prev) => [fxTx, ...prev]);
    }
    showNotice('Lote de câmbio registrado e câmbio médio ponderado atualizado!');
  };

  const handleDeleteExchangeLot = (tripId: string, lotId: string) => {
    if (!requireWorkspaceWrite()) return;
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, exchangeLots: t.exchangeLots.filter((l) => l.id !== lotId) }
          : t
      )
    );
    setTransactions((prev) =>
      prev.filter(
        (tx) =>
          tx.id !== `tx-fxlot-${lotId}` && !tx.notes?.includes(`[lot:${lotId}]`)
      )
    );
    showNotice('Lote de câmbio removido.');
  };

  const handleRecordTripSettlement = (
    tripId: string,
    settlement: TripSettlement,
    bankAccountEffect?: {
      accountId: string;
      type: 'income' | 'expense';
      brlAmount: number;
      description: string;
    }
  ) => {
    if (!requireWorkspaceWrite()) return;
    const settlementTxId = bankAccountEffect && bankAccountEffect.brlAmount > 0
      ? newEntityId('tx-tripsettle')
      : undefined;
    // Vínculo nos dois sentidos: o acerto aponta para o movimento do extrato (apagar o movimento reabre o acerto).
    const linkedSettlement: TripSettlement = settlementTxId
      ? { ...settlement, linkedTransactionId: settlementTxId }
      : settlement;
    setTrips((prev) =>
      prev.map((t) =>
        t.id === tripId
          ? { ...t, settlements: [linkedSettlement, ...t.settlements] }
          : t
      )
    );

    if (bankAccountEffect && settlementTxId) {
      const settleTx: Transaction = {
        id: settlementTxId,
        description: bankAccountEffect.description,
        amount: bankAccountEffect.brlAmount,
        date: settlement.date,
        competenceMonth: settlement.date.slice(0, 7),
        type: bankAccountEffect.type,
        status: 'paid',
        // Reembolso de viagem não é rendimento de investimento: usa a categoria de reembolsos.
        categoryId:
          bankAccountEffect.type === 'income' ? 'cat-reembolsos' : 'cat-viagens',
        accountId: bankAccountEffect.accountId,
        paymentMethod: 'pix',
        recurrence: 'single',
        notes: settlement.notes || 'Acerto de contas de viagem internacional',
      };
      setTransactions((prev) => [settleTx, ...prev]);
    }

    showNotice('Acerto de viagem liquidado e saldos do grupo atualizados!');
  };

  return {
    handleAddExchangeLot,
    handleAddTrip,
    handleDeleteExchangeLot,
    handleDeleteTrip,
    handleRecordTripSettlement,
    handleUpdateTrip,
  };
}

export type TripActionsApi = ReturnType<typeof useTripActions>;
