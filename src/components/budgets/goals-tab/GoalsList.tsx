/** Lista de metas com progresso e aporte. Parte de GoalsAndSimulatorTab (ver GoalsAndSimulatorTab.tsx). */
import { AlertTriangle, CheckCircle2, Edit3, Link2, Target, Trash2 } from 'lucide-react';
import { formatBRL, formatShortDateBR, getLocalDateISO } from '../../../domain/finance/financeRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import type { GoalsAndSimulatorTabContext } from './goalsTabContext';

export function GoalsList({ form }: { form: GoalsAndSimulatorTabContext }) {
  const {
    activeGoalContributeId,
    assetMap,
    brlAccounts,
    contributeAccount,
    contributeAccountId,
    contributeAmountStr,
    contributeDate,
    contributeError,
    getEffectiveGoalAmount,
    getIndexerLabel,
    goals,
    handleConfirmContribution,
    onDeleteGoal,
    onRequestCreateAccount,
    openEditGoalForm,
    setActiveGoalContributeId,
    setContributeAccountId,
    setContributeAmountStr,
    setContributeDate,
    setContributeError,
  } = form;
  return (
    <>
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
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words sm:truncate">
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
                    {goal.linkedAssetId && <label className="text-xs text-slate-600">
                      Data do aporte
                      <input type="date" value={contributeDate} onChange={event => setContributeDate(event.target.value)} className="ml-2 rounded-lg border border-slate-300 px-2 py-1" />
                    </label>}
                    {contributeError && <p role="alert" className="w-full text-xs text-rose-700">{contributeError}</p>}
                    <CurrencyInput
                      aria-label={`Valor do aporte para ${goal.name}`}
                      value={contributeAmountStr}
                      currency="BRL"
                      onValueChange={setContributeAmountStr}
                      className="w-24 rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900"
                    />
                    {!goal.linkedAssetId && <p className="w-full text-xs text-slate-500">Reserva do dinheiro existente. Para transferir para um investimento, vincule o ativo à meta.</p>}
                    {goal.linkedAssetId && brlAccounts.length === 0 && (
                      <div className="w-full">
                        <MissingSetupNotice
                          testId="missing-brl-account-for-goal"
                          message="Para debitar o aporte de uma conta é preciso ter conta em reais cadastrada. Cadastre uma conta ou registre como aporte já feito fora."
                          onAction={onRequestCreateAccount}
                        />
                      </div>
                    )}
                    {goal.linkedAssetId && brlAccounts.length > 0 && (
                      <>
                        <select
                          aria-label="Conta para debitar o aporte"
                          value={contributeAccountId}
                          onChange={(e) => setContributeAccountId(e.target.value)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                        >
                          <option value="">Aporte já feito fora das contas cadastradas</option>
                          {brlAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              Debitar: {acc.name}
                            </option>
                          ))}
                        </select>
                        {contributeAccount && (
                          <InstitutionMark
                            institution={contributeAccount.institution}
                            accountName={contributeAccount.name}
                            color={contributeAccount.color}
                            size="xs"
                          />
                        )}
                      </>
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
                      setContributeDate(getLocalDateISO());
                      setContributeError('');
                      setContributeAmountStr(
                        (goal.monthlyContribution > 0
                          ? goal.monthlyContribution
                          : 100
                        )
                          .toFixed(2)
                          .replace('.', ',')
                      );
                      setContributeAccountId(brlAccounts[0]?.id || '');
                    }}
                    className="rounded-lg border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    + Registrar Aporte
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
