/** Janela de nova/editar viagem (JSX guardado para a tela montar). Parte de TripsTab (ver TripsTab.tsx). */
import { X } from 'lucide-react';
import { CurrencyCode } from '../../../types/finance';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { CURRENCY_OPTIONS } from './tripsTabConfig';
import type { TripsStateApi } from './useTripsState';
import type { TripsActionsApi } from './useTripsActions';

export function useTripsModals(ctx: TripsStateApi & TripsActionsApi) {
  const {
    editingTripId,
    handleCreateTrip,
    isNewTripModalOpen,
    setEditingTripId,
    setIsNewTripModalOpen,
    setTripBudgetStr,
    setTripCompanionsInput,
    setTripCurrency,
    setTripDefaultRateStr,
    setTripDestination,
    setTripEndDate,
    setTripFormError,
    setTripIsArchivedCheckbox,
    setTripName,
    setTripStartDate,
    tripBudgetStr,
    tripCompanionsInput,
    tripCurrency,
    tripDefaultRateStr,
    tripDestination,
    tripEndDate,
    tripFormError,
    tripIsArchivedCheckbox,
    tripName,
    tripStartDate,
  } = ctx;
  const newTripModalNode = isNewTripModalOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/65 p-0 sm:p-4 overflow-hidden modal-shell"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-sheet-up sm:animate-modal-in">
        <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white font-display">
            {editingTripId
              ? 'Editar Roteiro & Orçamento da Viagem'
              : 'Criar Nova Viagem (TravelSpend + Splitwise)'}
          </h3>
          <button
            type="button"
            onClick={() => {
              setIsNewTripModalOpen(false);
              setEditingTripId(null);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleCreateTrip} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs modal-form-scroll custom-scrollbar">
            {tripFormError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-medium text-rose-800">{tripFormError}</p>}
            <div>
              <label htmlFor="trip-form-name" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Viagem
              </label>
              <input
                type="text"
                id="trip-form-name"
                required
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="Ex: Roteiro Internacional, Férias..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-destination" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destino / Países
                </label>
                <input
                  type="text"
                  id="trip-form-destination"
                  value={tripDestination}
                  onChange={(e) => setTripDestination(e.target.value)}
                  placeholder="Ex: Lisboa, Madri, Santiago..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-currency" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Moeda Principal da Viagem
                </label>
                <select
                  id="trip-form-currency"
                  value={tripCurrency}
                  onChange={(e) => {
                    const code = e.target.value as CurrencyCode;
                    setTripCurrency(code);
                    setTripFormError(null);
                    setTripDefaultRateStr(
                      CURRENCY_CATALOG[code].defaultCommercialRateBrl
                        .toFixed(2)
                        .replace('.', ',')
                    );
                  }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-semibold"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CURRENCY_CATALOG[c].flag} {c} — {CURRENCY_CATALOG[c].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-start-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Ida
                </label>
                <input
                  type="date"
                  id="trip-form-start-date"
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-end-date" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Volta
                </label>
                <input
                  type="date"
                  id="trip-form-end-date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="trip-form-budget" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Meu Orçamento Pessoal ({tripCurrency})
                </label>
                <CurrencyInput
                  id="trip-form-budget"
                  value={tripBudgetStr}
                  currency={tripCurrency}
                  onValueChange={(value) => { setTripBudgetStr(value); setTripFormError(null); }}
                  placeholder="Ex: 1500"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="trip-form-exchange-rate" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Câmbio Referência (R$ / {tripCurrency})
                </label>
                <input
                  type="text"
                  id="trip-form-exchange-rate"
                  value={tripDefaultRateStr}
                  onChange={(e) => { setTripDefaultRateStr(e.target.value); setTripFormError(null); }}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="trip-form-companions" className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Acompanhantes da Viagem (separados por vírgula)
              </label>
              <input
                type="text"
                id="trip-form-companions"
                value={tripCompanionsInput}
                onChange={(e) => setTripCompanionsInput(e.target.value)}
                placeholder="Opcional: nomes separados por vírgula"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
              <span className="block text-[10px] text-slate-400 mt-1">
                &ldquo;Você&rdquo; já é incluído automaticamente como participante principal.
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-300">
              Suas contas internacionais (Wise, Nomad, Avenue, C6 Global) e cartões de crédito são independentes e não ficam presos a uma viagem — você escolhe como pagou cada despesa no momento do lançamento.
            </div>

            {editingTripId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tripIsArchivedCheckbox}
                    onChange={(e) => setTripIsArchivedCheckbox(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                      Arquivar Viagem (Mover para Histórico de Concluídas)
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Remove o roteiro da lista e contagem de viagens ativas, mantendo o histórico de câmbio e gastos intacto.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-800/40 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            <button
              type="button"
              onClick={() => {
                setIsNewTripModalOpen(false);
                setEditingTripId(null);
              }}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
            >
              {editingTripId ? 'Salvar Alterações' : 'Criar Viagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return {
    newTripModalNode,
  };
}

export type TripsModalsApi = ReturnType<typeof useTripsModals>;
