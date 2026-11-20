/** Ações: abrir cadastro, salvar conta, métricas de conta internacional e rótulos. Parte de AccountsTab (ver AccountsTab.tsx). */
import { AccountType, BankAccount, CurrencyCode, Transaction } from '../../../types/finance';
import React, { useEffect } from 'react';
import { getTransferForeignLeg } from '../../../domain/finance/transferRules';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { parseBRLInput } from '../../../domain/finance/financeRules';
import { parseCurrencyInput } from '../../../utils/currencyInput';
import { isValidISODate } from '../../../domain/finance/formatting';
import { isValidBalanceInput, isValidBrlBalanceInput } from './accountsTabConfig';
import type { AccountsTabPropsApi } from './accountsTabConfig';
import type { AccountsStateApi } from './useAccountsState';
import type { AccountsDerivedApi } from './useAccountsDerived';

export function useAccountsActions(ctx: AccountsTabPropsApi & AccountsStateApi & AccountsDerivedApi) {
  const {
    accColor,
    accCurrency,
    accIncludeInTotal,
    accInitialDate,
    accInitialForeignStr,
    accInitialStr,
    accInstitution,
    accName,
    accType,
    accounts,
    activeAccount,
    activeViewAccountId,
    autoOpenCreate,
    autoOpenCreateType,
    editingAccount,
    onAddAccount,
    onAutoOpenHandled,
    onUpdateAccount,
    onUpdateAccountInitialBalance,
    selectedMonth,
    setAccColor,
    setAccCurrency,
    setAccIncludeInTotal,
    setAccInitialDate,
    setAccInitialForeignStr,
    setAccInitialStr,
    setAccInstitution,
    setAccName,
    setAccType,
    setEditingAccount,
    setFormError,
    setShowAccountForm,
    statementSummary,
    transactions,
    trips,
  } = ctx;
  const openNewAccountForm = (initialType: AccountType = 'checking') => {
    setEditingAccount(null);
    setAccName('');
    setAccInstitution('');
    setAccType(initialType);
    setAccCurrency('EUR');
    setAccInitialStr('0,00');
    setAccInitialDate('');
    setAccInitialForeignStr('0,00');
    setAccColor('#059669');
    setAccIncludeInTotal(initialType !== 'international');
    setFormError('');
    setShowAccountForm(true);
  };

  const openEditAccountForm = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccInstitution(acc.institution);
    setAccType(acc.type);
    const curr = acc.currency && acc.currency !== 'BRL' ? acc.currency : 'EUR';
    setAccCurrency(curr);
    setAccInitialStr(acc.initialBalance.toFixed(2).replace('.', ','));
    setAccInitialDate(acc.initialBalanceDate ?? '');
    setAccInitialForeignStr(
      (acc.initialBalanceForeign ?? 0).toFixed(2).replace('.', ',')
    );
    setAccColor(acc.color || '#059669');
    setAccIncludeInTotal(acc.includeInTotal);
    setFormError('');
    setShowAccountForm(true);
  };

  useEffect(() => {
    if (!autoOpenCreate) return;
    openNewAccountForm(autoOpenCreateType);
    onAutoOpenHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  // Compute foreign balance for an international account
  const getInternationalAccountForeignMetrics = (acc: BankAccount) => {
    const currency: CurrencyCode =
      acc.currency && acc.currency !== 'BRL' ? acc.currency : 'EUR';
    const baseForeign = acc.initialBalanceForeign ?? 0;

    // Sum exchange lots explicitly credited to this account
    let purchasedLotsForeign = 0;
    let totalLotsBrl = 0;
    let costBasisForeign = Number.isFinite(baseForeign) && baseForeign > 0 ? baseForeign : 0;
    let costBasisBrl = Number.isFinite(acc.initialBalance) && acc.initialBalance > 0 ? acc.initialBalance : 0;
    for (const t of trips) {
      if (t.currency !== currency) continue;
      for (const lot of t.exchangeLots) {
        if (
          lot.accountId === acc.id &&
          /^\d{4}-\d{2}-\d{2}$/.test(lot.date) &&
          lot.date.slice(0, 7) <= selectedMonth &&
          Number.isFinite(lot.foreignAmount) &&
          lot.foreignAmount > 0 &&
          Number.isSafeInteger(Math.round(lot.foreignAmount * 100)) &&
          Number.isFinite(lot.totalBrlPaid) &&
          lot.totalBrlPaid > 0 &&
          Number.isSafeInteger(Math.round(lot.totalBrlPaid * 100))
        ) {
          purchasedLotsForeign += lot.foreignAmount;
          totalLotsBrl += lot.totalBrlPaid;
          costBasisForeign += lot.foreignAmount;
          costBasisBrl += lot.totalBrlPaid;
        }
      }
    }

    // Apply foreign income and expenses with separate realized/projected balances.
    let spentForeign = 0;
    let pendingForeign = 0;
    let receivedForeign = 0;
    let pendingIncomeForeign = 0;
    for (const tx of transactions) {
      // Transferência de/para conta internacional: usa a perna em moeda estrangeira gravada na transferência.
      const transferLeg = tx.competenceMonth <= selectedMonth ? getTransferForeignLeg(tx, acc) : null;
      if (transferLeg) {
        if (transferLeg.direction === 'out') {
          if (tx.status === 'paid') spentForeign += transferLeg.amount;
          else pendingForeign += transferLeg.amount;
        } else if (tx.status === 'paid') {
          receivedForeign += transferLeg.amount;
          const acquisitionCents = Math.round(transferLeg.amount * (transferLeg.rate || 0) * 100);
          if (transferLeg.rate && transferLeg.rate > 0 && Number.isSafeInteger(acquisitionCents) && acquisitionCents > 0) {
            costBasisForeign += transferLeg.amount;
            costBasisBrl += acquisitionCents / 100;
          }
        } else {
          pendingIncomeForeign += transferLeg.amount;
        }
        continue;
      }
      if (
        tx.accountId === acc.id &&
        (tx.type === 'expense' || tx.type === 'income') &&
        !tx.isCompanionOnlyExpense &&
        tx.sharedPaidBy !== 'member' &&
        tx.competenceMonth <= selectedMonth &&
        (tx.originalCurrency === currency ||
          (!tx.originalCurrency && Boolean(tx.tripId) && trips.some((trip) => trip.id === tx.tripId && trip.currency === currency)))
      ) {
        const amount = Number.isFinite(tx.originalAmount) ? tx.originalAmount || 0 : 0;
        if (amount <= 0) continue;
        if (tx.type === 'expense' && tx.status === 'paid') spentForeign += amount;
        else if (tx.type === 'expense' && tx.status === 'pending') pendingForeign += amount;
        else if (tx.type === 'income' && tx.status === 'paid') {
          receivedForeign += amount;
          const effectiveRate = tx.effectiveExchangeRate ?? tx.exchangeRate;
          const acquisitionCents = Number.isFinite(effectiveRate)
            ? Math.round(amount * (effectiveRate || 0) * 100)
            : 0;
          if (effectiveRate && effectiveRate > 0 && Number.isSafeInteger(acquisitionCents) && acquisitionCents > 0) {
            costBasisForeign += amount;
            costBasisBrl += acquisitionCents / 100;
          }
        }
        else if (tx.type === 'income' && tx.status === 'pending') pendingIncomeForeign += amount;
      }
    }

    const currentForeignBalance =
      Math.round((baseForeign + purchasedLotsForeign + receivedForeign - spentForeign) * 100) / 100;
    const projectedForeignBalance =
      Math.round((currentForeignBalance + pendingIncomeForeign - pendingForeign) * 100) / 100;
    const avgRate =
      costBasisForeign > 0 && costBasisBrl > 0
        ? costBasisBrl / costBasisForeign
        : CURRENCY_CATALOG[currency]?.defaultCommercialRateBrl || 6.0;
    const estimatedBrlValue = Math.round(currentForeignBalance * avgRate * 100) / 100;

    return {
      currency,
      currentForeignBalance,
      projectedForeignBalance,
      purchasedLotsForeign,
      spentForeign,
      pendingForeign,
      receivedForeign,
      pendingIncomeForeign,
      avgRate,
      estimatedBrlValue,
    };
  };

  const handleSaveAccountForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setFormError('Informe o nome da conta ou carteira (ex: Itaú Conta Corrente ou Wise Euro).');
      return;
    }
    const normalizedName = accName.trim().toLocaleLowerCase('pt-BR');
    if (accounts.some((other) => other.id !== editingAccount?.id && other.name.trim().toLocaleLowerCase('pt-BR') === normalizedName)) {
      setFormError('Já existe uma conta com esse nome. Use um nome diferente para não confundir os saldos.');
      return;
    }
    const isIntl = accType === 'international';
    const parsedInitialBrl = parseBRLInput(accInitialStr);
    const parsedInitialForeign = parseCurrencyInput(accInitialForeignStr, accCurrency);
    // parseBRLInput deliberately returns 0 for malformed input; validate the
    // text separately so malformed values cannot become real zero balances.
    if (!isValidBrlBalanceInput(accInitialStr)) {
      setFormError('Informe um saldo inicial válido.');
      return;
    }
    if (isIntl && !isValidBalanceInput(accInitialForeignStr, accCurrency)) {
      setFormError(`Informe um saldo na moeda estrangeira válido, com até ${CURRENCY_CATALOG[accCurrency].decimals} casa(s) decimal(is).`);
      return;
    }
    if (accInitialDate && !isValidISODate(accInitialDate)) {
      setFormError('Informe uma data válida para o saldo inicial (ou deixe em branco).');
      return;
    }
    const effectiveCurrency: CurrencyCode = isIntl ? accCurrency : 'BRL';
    const fallbackRate =
      CURRENCY_CATALOG[effectiveCurrency]?.defaultCommercialRateBrl || 1;
    const finalInitialBrl = isIntl
      ? Math.round(parsedInitialForeign * fallbackRate * 100) / 100
      : parsedInitialBrl;

    if (editingAccount) {
      if (onUpdateAccount) {
        onUpdateAccount({
          ...editingAccount,
          name: accName.trim(),
          institution:
            accInstitution.trim() || (isIntl ? 'Conta Global' : 'Instituição / Carteira'),
          type: accType,
          currency: effectiveCurrency,
          initialBalance: finalInitialBrl,
          initialBalanceDate: accInitialDate || undefined,
          initialBalanceForeign: isIntl ? parsedInitialForeign : undefined,
          color: accColor,
          includeInTotal: isIntl ? false : accIncludeInTotal,
        });
      } else {
        onUpdateAccountInitialBalance(editingAccount.id, finalInitialBrl);
      }
    } else {
      onAddAccount({
        name: accName.trim(),
        institution: accInstitution.trim() || (isIntl ? 'Conta Global' : 'Banco / Carteira'),
        type: accType,
        currency: effectiveCurrency,
        initialBalance: finalInitialBrl,
        initialBalanceDate: accInitialDate || undefined,
        initialBalanceForeign: isIntl ? parsedInitialForeign : undefined,
        color: accColor,
        includeInTotal: isIntl ? false : accIncludeInTotal,
      });
    }

    setShowAccountForm(false);
    setEditingAccount(null);
  };

  const getAccountTypeLabel = (type: AccountType, currency?: CurrencyCode) => {
    switch (type) {
      case 'international':
        return `Conta Internacional (${currency && currency !== 'BRL' ? currency : 'Global'})`;
      case 'checking':
        return 'Conta Corrente';
      case 'savings':
        return 'Poupança';
      case 'investment':
        return 'Reserva / Investimento';
      case 'cash':
        return 'Dinheiro em Espécie';
      default:
        return 'Conta';
    }
  };

  const getMethodLabel = (method: Transaction['paymentMethod']) => {
    switch (method) {
      case 'pix':
        return 'PIX';
      case 'debit_card':
        return 'Cartão Débito';
      case 'boleto':
        return 'Boleto / Déb. Auto';
      case 'cash':
        return 'Espécie';
      case 'transfer':
        return 'TED / Transferência';
      default:
        return method;
    }
  };

  const isAccountDetailOpen = Boolean(
    activeViewAccountId &&
      activeAccount &&
      statementSummary &&
      accounts.some((a) => a.id === activeViewAccountId)
  );

  return {
    getAccountTypeLabel,
    getInternationalAccountForeignMetrics,
    getMethodLabel,
    handleSaveAccountForm,
    isAccountDetailOpen,
    openEditAccountForm,
    openNewAccountForm,
  };
}

export type AccountsActionsApi = ReturnType<typeof useAccountsActions>;
