import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Edit3,
  Link2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { BankAccount, InvestmentAsset, SavingsGoal } from '../types/finance';
import {
  formatBRL,
  formatShortDateBR,
  parseBRLInput,
  simulateFixedIncomeBR,
} from '../utils/financeRules';
import { CurrencyInput } from './CurrencyInput';

interface GoalsAndSimulatorTabProps {
  goals: SavingsGoal[];
  investments?: InvestmentAsset[];
  accounts?: BankAccount[];
  onContributeGoal: (
    goalId: string,
    amount: number,
    debitAccountId?: string
  ) => void;
  onAddGoal: (goal: Omit<SavingsGoal, 'id'>) => void;
  onUpdateGoal: (goal: SavingsGoal) => void;
  onDeleteGoal: (goalId: string) => void;
}

export const GoalsAndSimulatorTab: React.FC<GoalsAndSimulatorTabProps> = ({
  goals,
  investments = [],
  accounts = [],
  onContributeGoal,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  const [activeGoalContributeId, setActiveGoalContributeId] = useState<string | null>(null);
  const [contributeAmountStr, setContributeAmountStr] = useState('500,00');
  const [contributeAccountId, setContributeAccountId] = useState<string>('');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);

  // Goal Form State
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0,00');
  const [goalMonthly, setGoalMonthly] = useState('0,00');
  const [goalDeadline, setGoalDeadline] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [goalIndexer, setGoalIndexer] = useState<SavingsGoal['indexer']>('TESOURO_SELIC');
  const [goalCategory, setGoalCategory] = useState('Patrimônio');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalLinkedAssetId, setGoalLinkedAssetId] = useState('');

  // Brazilian Fixed Income Simulator State
  const [simInitialStr, setSimInitialStr] = useState('0,00');
  const [simMonthlyStr, setSimMonthlyStr] = useState('0,00');
  const [simMonths, setSimMonths] = useState(24);
  const [simCdiAnnual, setSimCdiAnnual] = useState('10,75');
  const [simCdiMultiplier, setSimCdiMultiplier] = useState('100');
  const [simIsExempt, setSimIsExempt] = useState(false);

  const assetMap = useMemo(
    () => new Map(investments.map((a) => [a.id, a])),
    [investments]
  );

  const getEffectiveGoalAmount = (goal: SavingsGoal): number => {
    if (goal.linkedAssetId) {
      const linked = assetMap.get(goal.linkedAssetId);
      if (linked) {
        return Math.round(linked.quantity * linked.currentPrice * 100) / 100;
      }
    }
    return goal.currentAmount;
  };

  const totalSavedInGoals = useMemo(
    () => goals.reduce((sum, g) => sum + getEffectiveGoalAmount(g), 0),
    [goals, assetMap]
  );
  const totalTargetInGoals = useMemo(
    () => goals.reduce((sum, g) => sum + g.targetAmount, 0),
    [goals]
  );

  const simulation = useMemo(() => {
    return simulateFixedIncomeBR({
      initialAmount: parseBRLInput(simInitialStr),
      monthlyContribution: parseBRLInput(simMonthlyStr),
      months: simMonths,
      cdiAnnualRatePercent: parseBRLInput(simCdiAnnual) || 10.75,
      cdiMultiplierPercent: parseBRLInput(simCdiMultiplier) || 100,
      isTaxExempt: simIsExempt,
    });
  }, [simInitialStr, simMonthlyStr, simMonths, simCdiAnnual, simCdiMultiplier, simIsExempt]);

  const getIndexerLabel = (indexer: SavingsGoal['indexer']) => {
    switch (indexer) {
      case 'TESOURO_SELIC':
        return 'Tesouro Selic (100% Selic)';
      case 'CDI_110':
        return 'CDB Liquidez 110% CDI';
      case 'LCI_92':
        return 'LCI / LCA 92% CDI (Isento IR)';
      case 'POUPANCA':
        return 'Caderneta de Poupança';
      default:
        return 'CDB / Caixinha 100% CDI';
    }
  };

  const openNewGoalForm = () => {
    setEditingGoal(null);
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('0,00');
    setGoalMonthly('0,00');
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setGoalDeadline(nextYear.toISOString().slice(0, 10));
    setGoalIndexer('TESOURO_SELIC');
    setGoalCategory('Sonhos & Patrimônio');
    setGoalNotes('');
    setGoalLinkedAssetId('');
    setShowGoalForm(true);
  };

  const openEditGoalForm = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setGoalName(goal.name);
    setGoalTarget(goal.targetAmount.toFixed(2).replace('.', ','));
    const effectiveAmt = getEffectiveGoalAmount(goal);
    setGoalCurrent(effectiveAmt.toFixed(2).replace('.', ','));
    setGoalMonthly(goal.monthlyContribution.toFixed(2).replace('.', ','));
    setGoalDeadline(goal.deadline);
    setGoalIndexer(goal.indexer);
    setGoalCategory(goal.category);
    setGoalNotes(goal.notes || '');
    setGoalLinkedAssetId(goal.linkedAssetId || '');
    setShowGoalForm(true);
  };

  const handleConfirmContribution = (goalId: string) => {
    const val = parseBRLInput(contributeAmountStr);
    if (val > 0) {
      onContributeGoal(goalId, val, contributeAccountId || undefined);
    }
    setActiveGoalContributeId(null);
  };

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = parseBRLInput(goalTarget);
    if (!goalName.trim() || targetVal <= 0) return;

    const linkedAsset = goalLinkedAssetId ? assetMap.get(goalLinkedAssetId) : undefined;
    const syncedCurrentVal = linkedAsset
      ? Math.round(linkedAsset.quantity * linkedAsset.currentPrice * 100) / 100
      : parseBRLInput(goalCurrent);

    if (editingGoal) {
      onUpdateGoal({
        ...editingGoal,
        name: goalName.trim(),
        targetAmount: targetVal,
        currentAmount: syncedCurrentVal,
        monthlyContribution: parseBRLInput(goalMonthly),
        deadline: goalDeadline,
        indexer: goalIndexer,
        category: goalCategory,
        notes: goalNotes.trim() || undefined,
        linkedAssetId: goalLinkedAssetId || undefined,
      });
    } else {
      onAddGoal({
        name: goalName.trim(),
        targetAmount: targetVal,
        currentAmount: syncedCurrentVal,
        monthlyContribution: parseBRLInput(goalMonthly),
        deadline: goalDeadline,
        indexer: goalIndexer,
        category: goalCategory,
        notes: goalNotes.trim() || undefined,
        linkedAssetId: goalLinkedAssetId || undefined,
      });
    }

    setGoalName('');
    setEditingGoal(null);
    setShowGoalForm(false);
  };

  return (
    <div className="space-y-6 sm:space-y-8 min-w-0 max-w-full">
      {/* Header & Summary */}
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

      {/* Goals Grid with Visual Progress Alerts */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {goals.map((goal) => {
          const effectiveCurrent = getEffectiveGoalAmount(goal);
          const linkedAsset = goal.linkedAssetId ? assetMap.get(goal.linkedAssetId) : undefined;
          const pct =
            goal.targetAmount > 0
              ? Math.min(100, Math.round((effectiveCurrent / goal.targetAmount) * 1000) / 10)
              : 0;
          const remaining = Math.max(0, goal.targetAmount - effectiveCurrent);
          const monthsLeftEst =
            goal.monthlyContribution > 0
              ? Math.ceil(remaining / goal.monthlyContribution)
              : 0;
          const isContributing = activeGoalContributeId === goal.id;

          const isCompleted = pct >= 100;
          const isNearCompletion = pct >= 80 && pct < 100;

          return (
            <div
              key={goal.id}
              className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : isNearCompletion ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      ) : (
                        <Target className="h-4 w-4 text-emerald-600 shrink-0" />
                      )}
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                        {goal.name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      <span>{goal.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{getIndexerLabel(goal.indexer)}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">
                        Prazo {formatShortDateBR(goal.deadline)}
                      </span>
                    </p>
                    {linkedAsset && (
                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <Link2 className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span>
                          Sincronizado com <strong>{linkedAsset.ticker}</strong> ({linkedAsset.institution})
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-sm font-bold font-mono tabular-nums ${
                        isCompleted
                          ? 'text-emerald-700'
                          : isNearCompletion
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {pct}%
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditGoalForm(goal)}
                      aria-label={`Editar meta ${goal.name}`}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      aria-label={`Excluir meta ${goal.name}`}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Visual Alert Banner inside Goal Card */}
                {isCompleted ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    Meta 100% atingida! Valor completo disponível para o seu objetivo.
                  </div>
                ) : isNearCompletion ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    Alerta de Progresso: Reta final ({pct}% concluído) — faltam apenas {formatBRL(remaining)}!
                  </div>
                ) : null}

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted
                        ? 'bg-emerald-600'
                        : isNearCompletion
                        ? 'bg-amber-500'
                        : 'bg-slate-800'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono tabular-nums">
                  <div>
                    <p className="text-slate-500 font-sans">Acumulado</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {formatBRL(effectiveCurrent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-sans">Meta Total</p>
                    <p className="font-bold text-slate-900 mt-0.5">
                      {formatBRL(goal.targetAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500 font-sans">Faltam</p>
                    <p className="font-bold text-slate-700 mt-0.5">{formatBRL(remaining)}</p>
                  </div>
                </div>

                {goal.notes && (
                  <p className="text-xs text-slate-500 pt-1">{goal.notes}</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3.5 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  Aporte planejado: {formatBRL(goal.monthlyContribution)}/mês
                  {monthsLeftEst > 0 ? ` (~${monthsLeftEst} meses restantes)` : ''}
                </span>

                {isContributing ? (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <CurrencyInput
                      aria-label={`Valor do aporte para ${goal.name}`}
                      value={contributeAmountStr}
                      currency="BRL"
                      onValueChange={setContributeAmountStr}
                      className="w-24 rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
                    />
                    {accounts.length > 0 && (
                      <select
                        aria-label="Conta para debitar o aporte"
                        value={contributeAccountId}
                        onChange={(e) => setContributeAccountId(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                      >
                        <option value="">Apenas atualizar saldo da meta</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            Debitar: {acc.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => handleConfirmContribution(goal.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveGoalContributeId(null)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGoalContributeId(goal.id);
                      setContributeAmountStr(
                        (goal.monthlyContribution > 0
                          ? goal.monthlyContribution
                          : 100
                        )
                          .toFixed(2)
                          .replace('.', ',')
                      );
                      setContributeAccountId(accounts[0]?.id || '');
                    }}
                    className="rounded-lg border border-blue-600/30 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    + Registrar Aporte
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Simulador de Renda Fixa Brasileira (Selic / CDI / LCI vs Poupança) */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-slate-700" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Simulador de Renda Fixa Brasileira (CDI / Tesouro Selic / LCI vs. Poupança)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cálculo automático com alíquota regressiva de Imposto de Renda (22,5% a 15%)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sim-initial" className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Inicial (R$)
              </label>
              <CurrencyInput
                id="sim-initial"
                value={simInitialStr}
                currency="BRL"
                onValueChange={setSimInitialStr}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-monthly" className="block text-xs font-semibold text-slate-700 mb-1">
                Aporte Mensal (R$)
              </label>
              <CurrencyInput
                id="sim-monthly"
                value={simMonthlyStr}
                currency="BRL"
                onValueChange={setSimMonthlyStr}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-months" className="block text-xs font-semibold text-slate-700 mb-1">
                Prazo de Aplicação (Meses)
              </label>
              <select
                id="sim-months"
                value={simMonths}
                onChange={(e) => setSimMonths(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              >
                <option value={3}>3 meses (Curto Prazo — IR 22,5%)</option>
                <option value={6}>6 meses (IR 22,5%)</option>
                <option value={12}>12 meses / 1 ano (IR 20,0%)</option>
                <option value={24}>24 meses / 2 anos (IR 17,5%)</option>
                <option value={36}>36 meses / 3 anos (IR 15,0%)</option>
                <option value={60}>60 meses / 5 anos (IR 15,0%)</option>
              </select>
            </div>

            <div>
              <label htmlFor="sim-cdi-rate" className="block text-xs font-semibold text-slate-700 mb-1">
                Taxa CDI / Selic Anual (% a.a.)
              </label>
              <input
                id="sim-cdi-rate"
                type="text"
                value={simCdiAnnual}
                onChange={(e) => setSimCdiAnnual(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div>
              <label htmlFor="sim-cdi-mult" className="block text-xs font-semibold text-slate-700 mb-1">
                Rentabilidade (% do CDI)
              </label>
              <input
                id="sim-cdi-mult"
                type="text"
                value={simCdiMultiplier}
                onChange={(e) => setSimCdiMultiplier(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simIsExempt}
                  onChange={(e) => setSimIsExempt(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
                <span>Isento de IR (LCI / LCA / CRI / CRA)</span>
              </label>
            </div>
          </div>

          <div className="lg:col-span-6 lg:border-l lg:border-slate-200 lg:pl-8 space-y-4">
            <div className="flex items-baseline justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Saldo Líquido Estimado (Já descontado IR)
                </p>
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  {formatBRL(simulation.netBalanceCdi)}
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <p className="text-xs text-slate-500">Alíquota IR Aplicada</p>
                <p className="text-sm font-bold text-slate-800">
                  {simulation.irRatePercent}% ({formatBRL(simulation.irTaxAmount)})
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
              <div>
                <p className="font-sans text-slate-500">Total Desembolsado</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">
                  {formatBRL(simulation.totalInvested)}
                </p>
              </div>
              <div>
                <p className="font-sans text-slate-500">Juros Líquidos Ganhos</p>
                <p className="font-bold text-emerald-700 text-sm mt-0.5">
                  +{formatBRL(simulation.netYieldCdi)}
                </p>
              </div>
              <div>
                <p className="font-sans text-slate-500">Na Poupança Renderia</p>
                <p className="font-bold text-slate-700 text-sm mt-0.5">
                  {formatBRL(simulation.poupancaBalance)}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">
                Vantagem real sobre a Caderneta de Poupança no período:
              </span>
              <span className="font-mono tabular-nums font-bold text-emerald-700">
                +{formatBRL(simulation.advantageOverPoupanca)} a mais no bolso
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
