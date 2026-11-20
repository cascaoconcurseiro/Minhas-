/** Lista de orçamentos por categoria (celular e computador). Parte de BudgetsTab (ver BudgetsTab.tsx). */
import { calculateMonthBurnRateMarker } from '../../../domain/budgets/uxEnhancementRules';
import { CategoryIconBadge } from '../../ui/CategoryIconBadge';
import { formatBRL } from '../../../domain/finance/financeRules';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { Check, Edit3 } from 'lucide-react';
import type { BudgetsTabContext } from './budgetsTabContext';

export function BudgetsListBody({ form }: { form: BudgetsTabContext }) {
  const {
    budgetEditError,
    cancelBudgetEdit,
    categories,
    editValueStr,
    editingCatId,
    filteredItems,
    getBucketLabel,
    isMobile,
    openEditCategoryForm,
    saveBudget,
    selectedMonth,
    setBudgetEditError,
    setEditValueStr,
    startEditingBudget,
  } = form;
  return (
    <>
{isMobile ? (
              <ul data-testid="budget-mobile-list" className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const remaining = item.budget - item.spent;
                  const isEditing = editingCatId === item.categoryId;
                  const fullCat = categories.find((c) => c.id === item.categoryId);
                  const burnRate = calculateMonthBurnRateMarker(selectedMonth, item.percentOfBudget);
                  const barColor =
                    item.status === 'over' ? 'bg-rose-600' : item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-600';
                  return (
                    <li key={item.categoryId} className="space-y-3 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <CategoryIconBadge icon={item.categoryIcon} color={item.categoryColor} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold text-slate-900">{item.categoryName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {getBucketLabel(item.bucket)} · {item.percentOfTotalExpense}% das despesas
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold text-slate-900">{item.percentOfBudget}%</span>
                      </div>

                      <div>
                        <div className="relative h-2.5 w-full rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                          />
                          <div
                            data-testid="burn-rate-marker"
                            className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full bg-slate-900/80"
                            style={{ left: `${burnRate.monthProgressPercent}%` }}
                          />
                        </div>
                        <p
                          className={`mt-1 text-[11px] font-semibold ${
                            item.status === 'over'
                              ? 'text-rose-700'
                              : item.status === 'warning'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {item.budget <= 0
                            ? 'Sem teto definido'
                            : item.status === 'over'
                            ? 'Limite excedido'
                            : item.status === 'warning'
                            ? 'Próximo do limite (acima de 80%)'
                            : `Dentro do limite · ${burnRate.paceLabel}`}
                        </p>
                      </div>

                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-slate-500">Gasto</dt>
                          <dd className="font-mono font-bold tabular-nums text-slate-900">{formatBRL(item.spent)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Teto</dt>
                          <dd className="font-mono tabular-nums text-slate-700">
                            {isEditing ? (
                              <CurrencyInput
                                aria-label={`Novo teto para ${item.categoryName}`}
                                value={editValueStr}
                                currency="BRL"
                                onValueChange={(value) => {
                                  setEditValueStr(value);
                                  setBudgetEditError('');
                                }}
                                className="w-full rounded border border-emerald-600 px-2 py-2 text-right text-sm font-mono tabular-nums text-slate-900"
                              />
                            ) : (
                              formatBRL(item.budget)
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Sobra</dt>
                          <dd className={`font-mono font-semibold tabular-nums ${remaining >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatBRL(remaining)}
                          </dd>
                        </div>
                      </dl>

                      <div className="flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveBudget(item.categoryId)}
                              aria-label={`Salvar teto de ${item.categoryName}`}
                              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white"
                            >
                              <Check className="h-4 w-4" />
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelBudgetEdit}
                              aria-label={`Cancelar edição do teto de ${item.categoryName}`}
                              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditingBudget(item)}
                              aria-label={`Editar teto de ${item.categoryName}`}
                              className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
                            >
                              <Edit3 className="h-4 w-4" />
                              Teto
                            </button>
                            {fullCat && (
                              <button
                                type="button"
                                onClick={() => openEditCategoryForm(fullCat)}
                                aria-label={`Personalizar ${item.categoryName}`}
                                className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700"
                              >
                                Personalizar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {isEditing && budgetEditError && (
                        <p role="alert" className="text-xs text-rose-700">{budgetEditError}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
            <p className="px-6 pt-3 text-xs text-slate-500 xl:hidden" role="note">
              Deslize horizontalmente para acessar todas as colunas e ações.
            </p>
            <div className="max-w-full overflow-x-auto">
              <table className="w-full min-w-[920px] text-left border-collapse xl:min-w-0">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-500">
                    <th className="py-3 pl-6 pr-3">Categoria</th>
                    <th className="py-3 px-3">Progresso & Alerta</th>
                    <th className="py-3 px-3 text-right">Gasto Real + Cartão</th>
                    <th className="py-3 px-3 text-right">Teto Planejado</th>
                    <th className="py-3 px-3 text-right">Saldo Disponível</th>
                    <th className="py-3 pl-3 pr-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredItems.map((item) => {
                    const remaining = item.budget - item.spent;
                    const isEditing = editingCatId === item.categoryId;
                    const fullCat = categories.find((c) => c.id === item.categoryId);

                    return (
                      <tr key={item.categoryId} className="hover:bg-slate-50/80">
                        <td className="py-3.5 pl-6 pr-3">
                          <div className="flex items-start gap-3">
                            <CategoryIconBadge
                              icon={item.categoryIcon}
                              color={item.categoryColor}
                              size="md"
                            />
                            <div>
                              <p className="font-semibold text-slate-900">{item.categoryName}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                <span>{getBucketLabel(item.bucket)}</span>
                                <span aria-hidden="true"> · </span>
                                <span>{item.percentOfTotalExpense}% das despesas</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 min-w-[230px]">
                          {(() => {
                            const burnRate = calculateMonthBurnRateMarker(
                              selectedMonth,
                              item.percentOfBudget
                            );
                            return (
                              <div>
                                <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1">
                                  <span
                                    className={
                                      item.status === 'over'
                                        ? 'font-bold text-rose-700'
                                        : item.status === 'warning'
                                        ? 'font-semibold text-amber-700'
                                        : 'text-slate-600'
                                    }
                                  >
                                    {item.status === 'over'
                                      ? 'Alerta: Limite Excedido!'
                                      : item.status === 'warning'
                                      ? 'Alerta: Próximo (>80%)'
                                      : 'Dentro do limite'}
                                  </span>
                                  <span className="text-slate-700 font-semibold">
                                    {item.percentOfBudget}%
                                  </span>
                                </div>
                                <div className="relative h-2.5 w-full rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.status === 'over'
                                        ? 'bg-rose-600'
                                        : item.status === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-600'
                                    }`}
                                    style={{ width: `${Math.min(100, item.percentOfBudget)}%` }}
                                  />
                                  {/* Monthly Burn Rate Marker (Ritmo do Mês) */}
                                  <div
                                    data-testid="burn-rate-marker"
                                    title={`Ritmo ideal hoje (Dia ${burnRate.referenceDay}/${burnRate.daysInMonth}): ${burnRate.monthProgressPercent}% do mês decorrido`}
                                    className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 bg-slate-900/80 rounded-full"
                                    style={{ left: `${burnRate.monthProgressPercent}%` }}
                                  />
                                </div>
                                <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500">
                                  <span>
                                    Ritmo dia {burnRate.referenceDay}/{burnRate.daysInMonth}:{' '}
                                    {burnRate.monthProgressPercent}%
                                  </span>
                                  <span
                                    className={
                                      burnRate.paceStatus === 'over_pace'
                                        ? 'text-amber-700 font-semibold'
                                        : burnRate.paceStatus === 'under_pace'
                                        ? 'text-emerald-700 font-semibold'
                                        : 'text-slate-500'
                                    }
                                  >
                                    {burnRate.paceLabel}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatBRL(item.spent)}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {isEditing ? (
                            <CurrencyInput
                              aria-label={`Novo teto para ${item.categoryName}`}
                              value={editValueStr}
                              currency="BRL"
                              onValueChange={(value) => {
                                setEditValueStr(value);
                                setBudgetEditError('');
                              }}
                              className="w-28 rounded border border-emerald-600 px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-900"
                            />
                          ) : (
                            <span className="text-slate-700">{formatBRL(item.budget)}</span>
                          )}
                        </td>

                        <td
                          className={`py-3.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                            remaining >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatBRL(remaining)}
                        </td>

                        <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => saveBudget(item.categoryId)}
                                  aria-label={`Salvar teto de ${item.categoryName}`}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelBudgetEdit}
                                  aria-label={`Cancelar edição do teto de ${item.categoryName}`}
                                  className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditingBudget(item)}
                                  aria-label={`Editar teto de ${item.categoryName}`}
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Teto
                                </button>
                                {fullCat && (
                                  <button
                                    type="button"
                                    onClick={() => openEditCategoryForm(fullCat)}
                                    aria-label={`Personalizar ${item.categoryName}`}
                                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                  >
                                    Personalizar
                                  </button>
                                )}
                              </>
                            )}
                            {isEditing && budgetEditError && (
                              <p role="alert" className="mt-1 text-xs text-rose-700">{budgetEditError}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
              </>
            )}
    </>
  );
}
