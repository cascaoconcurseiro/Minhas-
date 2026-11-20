/** Resumo das metas e formulário de cadastro. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { formatBRL } from '../../../domain/finance/financeRules';
import { Plus } from 'lucide-react';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { SavingsGoal } from '../../../types/finance';
import type { GoalsAndSimulatorTabContext } from './goalsTabContext';

export function GoalsSummaryAndForm({ form }: { form: GoalsAndSimulatorTabContext }) {
  const {
    assetMap,
    editingGoal,
    goalCategory,
    goalCurrent,
    goalDeadline,
    goalIndexer,
    goalLinkedAssetId,
    goalMonthly,
    goalName,
    goalTarget,
    handleSaveGoal,
    investments,
    openNewGoalForm,
    setEditingGoal,
    setGoalCategory,
    setGoalCurrent,
    setGoalDeadline,
    setGoalIndexer,
    setGoalLinkedAssetId,
    setGoalMonthly,
    setGoalName,
    setGoalTarget,
    setShowGoalForm,
    showGoalForm,
    totalSavedInGoals,
    totalTargetInGoals,
  } = form;
  return (
    <>
<section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Metas de Economia, Sonhos e Reserva de Emergência
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Vincule suas metas diretamente a ativos reais da sua Carteira de Investimentos ou acompanhe caixinhas dedicadas
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            <div className="sm:text-right font-mono tabular-nums">
              <p className="text-[11px] text-slate-500">Total Acumulado em Metas</p>
              <p className="text-base sm:text-lg font-bold text-emerald-700">
                {formatBRL(totalSavedInGoals)}{' '}
                <span className="text-xs font-normal text-slate-500">
                  de {formatBRL(totalTargetInGoals)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (showGoalForm) {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                } else {
                  openNewGoalForm();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {showGoalForm ? 'Fechar Formulário' : 'Nova Meta'}
            </button>
          </div>
        </div>

        {showGoalForm && (
          <form
            onSubmit={handleSaveGoal}
            className="mt-5 border-t border-slate-200 pt-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900">
              {editingGoal ? `Editar Meta: ${editingGoal.name}` : 'Criar Nova Meta de Economia'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="goal-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome da Meta / Objetivo
                </label>
                <input
                  id="goal-name"
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Ex: Viagem em 3 meses, Entrada da casa, Troca de Carro"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="goal-linked-asset" className="block text-xs font-semibold text-slate-700 mb-1">
                  Vincular a Ativo Real da Carteira (Sincronização Automática)
                </label>
                <select
                  id="goal-linked-asset"
                  value={goalLinkedAssetId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setGoalLinkedAssetId(nextId);
                    const found = assetMap.get(nextId);
                    if (found) {
                      const val = Math.round(found.quantity * found.currentPrice * 100) / 100;
                      setGoalCurrent(val.toFixed(2).replace('.', ','));
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  <option value="">Sem vínculo (Saldo manual independente)</option>
                  {investments.map((asset) => {
                    const val = Math.round(asset.quantity * asset.currentPrice * 100) / 100;
                    return (
                      <option key={asset.id} value={asset.id}>
                        {asset.ticker} — {asset.name} ({formatBRL(val)})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="goal-target" className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor da Meta (R$)
                </label>
                <CurrencyInput
                  id="goal-target"
                  value={goalTarget}
                  currency="BRL"
                  onValueChange={setGoalTarget}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="goal-current" className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor Já Guardado (R$)
                </label>
                <CurrencyInput
                  id="goal-current"
                  value={goalCurrent}
                  disabled={Boolean(goalLinkedAssetId)}
                  currency="BRL"
                  onValueChange={setGoalCurrent}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900 ${
                    goalLinkedAssetId ? 'bg-slate-100 opacity-75 cursor-not-allowed' : ''
                  }`}
                />
              </div>

              <div>
                <label htmlFor="goal-monthly" className="block text-xs font-semibold text-slate-700 mb-1">
                  Aporte Mensal Planejado (R$)
                </label>
                <CurrencyInput
                  id="goal-monthly"
                  value={goalMonthly}
                  currency="BRL"
                  onValueChange={setGoalMonthly}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="goal-deadline" className="block text-xs font-semibold text-slate-700 mb-1">
                  Data Limite (Prazo)
                </label>
                <input
                  id="goal-deadline"
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="goal-indexer" className="block text-xs font-semibold text-slate-700 mb-1">
                  Onde está guardado? (Indexador)
                </label>
                <select
                  id="goal-indexer"
                  value={goalIndexer}
                  onChange={(e) => setGoalIndexer(e.target.value as SavingsGoal['indexer'])}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                >
                  <option value="TESOURO_SELIC">Tesouro Selic (100% Selic)</option>
                  <option value="CDI_100">Caixinha / CDB 100% CDI</option>
                  <option value="CDI_110">CDB 110% CDI</option>
                  <option value="LCI_92">LCI / LCA 92% CDI (Isento IR)</option>
                  <option value="POUPANCA">Poupança</option>
                </select>
              </div>

              <div>
                <label htmlFor="goal-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                  Finalidade
                </label>
                <input
                  id="goal-cat"
                  type="text"
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {editingGoal ? 'Salvar Alterações' : 'Salvar Meta'}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
