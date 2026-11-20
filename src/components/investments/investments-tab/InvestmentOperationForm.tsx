/** Formulário de aporte e resgate. Parte de InvestmentsTab (ver InvestmentsTab.tsx). */
import { CurrencyInput } from '../../ui/CurrencyInput';
import { isMarketQuotedAsset } from '../../../domain/investments/investmentRules';
import { Loader2, RefreshCw } from 'lucide-react';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import type { InvestmentsTabContext } from './investmentsTabContext';

export function InvestmentOperationForm({ form }: { form: InvestmentsTabContext }) {
  const {
    accounts,
    activeOperation,
    brlAccounts,
    handleConfirmOperation,
    handleFetchQuoteForActiveOperation,
    isLookingUpTicker,
    onRequestCreateAccount,
    opAccountId,
    opLinkBankAccount,
    opPriceStr,
    opQtyStr,
    operationDate,
    operationError,
    setActiveOperation,
    setOpAccountId,
    setOpLinkBankAccount,
    setOpPriceStr,
    setOpQtyStr,
    setOperationDate,
    setOperationError,
  } = form;
  return (
    <>
{/* Quick Operation Inline Panel (Buy / Sell / Quote / Dividend) */}
        {activeOperation && (
          <form
            data-testid="investment-operation-panel"
            onSubmit={handleConfirmOperation}
            className="border-b border-emerald-200 bg-emerald-50/80 px-4 sm:px-6 py-4 space-y-3 animate-expand-in"
          >
            {activeOperation.mode !== 'update_quote' && (
              <label className="block text-xs font-semibold text-slate-700 mb-3">
                Data da operação
                <input type="date" data-testid="investment-operation-date" value={operationDate} onChange={event=>setOperationDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            )}

            {operationError && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {operationError}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-950">
                  {activeOperation.mode === 'buy'
                    ? `Registrar Novo Aporte / Compra — ${activeOperation.asset.ticker}`
                    : activeOperation.mode === 'sell'
                    ? `Registrar Resgate / Venda — ${activeOperation.asset.ticker}`
                    : activeOperation.mode === 'dividend'
                    ? `Creditar Dividendo / Provento no Caixa — ${activeOperation.asset.ticker}`
                    : `Atualizar Cotação de Mercado — ${activeOperation.asset.ticker}`}
                </h3>
                <p className="text-[11px] text-emerald-800">
                  {activeOperation.mode === 'buy'
                    ? 'O sistema recalcula automaticamente o seu Preço Médio Ponderado.'
                    : activeOperation.mode === 'sell'
                    ? 'O resgate reduz a quantidade mantendo o Preço Médio original (Regra da Receita Federal).'
                    : activeOperation.mode === 'dividend'
                    ? 'Lança o provento recebido diretamente como receita efetivada na sua conta bancária.'
                    : 'Atualiza o valor de mercado atual para refletir sua posição patrimonial.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveOperation(null)}
                className="text-xs font-semibold text-emerald-800 hover:underline"
              >
                Cancelar
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {activeOperation.mode !== 'update_quote' &&
                activeOperation.mode !== 'dividend' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                      Quantidade ({activeOperation.mode === 'buy' ? 'Comprada' : 'Vendida'}):
                    </label>
                    <input
                      type="text"
                      value={opQtyStr}
                      onChange={(e) => {
                        setOpQtyStr(e.target.value);
                        setOperationError('');
                      }}
                      className="w-28 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                    />
                  </div>
                )}

              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  {activeOperation.mode === 'dividend'
                    ? 'Valor Total do Provento Recebido (R$):'
                    : 'Preço Unitário / Cotação (R$):'}
                </label>
                <div className="flex items-center gap-1.5">
                  <CurrencyInput
                    value={opPriceStr}
                    currency="BRL"
                    onValueChange={(value) => {
                      setOpPriceStr(value);
                      setOperationError('');
                    }}
                    className="w-36 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-mono tabular-nums text-slate-900"
                  />
                  {activeOperation.mode !== 'dividend' &&
                    isMarketQuotedAsset(activeOperation.asset) && (
                      <button
                        type="button"
                        onClick={handleFetchQuoteForActiveOperation}
                        disabled={isLookingUpTicker}
                        title="Buscar cotação atual no Google Finance"
                        className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[11px] font-bold text-sky-900 hover:bg-sky-100 transition-colors disabled:opacity-60"
                      >
                        {isLookingUpTicker ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 text-sky-700" />
                        )}
                        <span>Buscar Cotação</span>
                      </button>
                    )}
                </div>
              </div>

              {activeOperation.mode !== 'update_quote' && brlAccounts.length === 0 && (
                <MissingSetupNotice
                  testId="missing-brl-account-for-investment"
                  message="Você não tem conta em reais cadastrada para debitar ou creditar esta operação. Cadastre uma conta, ou registre sem vincular a conta."
                  onAction={onRequestCreateAccount}
                />
              )}
              {activeOperation.mode !== 'update_quote' && brlAccounts.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                    {activeOperation.mode === 'buy'
                      ? 'Debitar Aporte da Conta:'
                      : 'Creditar Valor na Conta:'}
                  </label>
                  <select
                    value={opAccountId}
                    onChange={(e) => setOpAccountId(e.target.value)}
                    className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                  >
                    {brlAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const selectedAccount = accounts.find((account) => account.id === opAccountId);
                    return selectedAccount ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <InstitutionMark institution={selectedAccount.institution} accountName={selectedAccount.name} color={selectedAccount.color} size="xs" />
                        <span>Conta selecionada: {selectedAccount.name}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {activeOperation.mode !== 'update_quote' &&
                activeOperation.mode !== 'dividend' && (
                  <label className="flex items-center gap-1.5 text-xs font-medium text-emerald-950 pb-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={opLinkBankAccount}
                      onChange={(e) => setOpLinkBankAccount(e.target.checked)}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600"
                    />
                    <span>Registrar no extrato da conta</span>
                  </label>
                )}

              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors ml-auto"
              >
                Confirmar Operação
              </button>
            </div>
          </form>
        )}
    </>
  );
}
