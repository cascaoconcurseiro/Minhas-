/** Aba Regras e divisão automática. Parte de SettingsModal (ver SettingsModal.tsx). */
import { Bell, Layers } from 'lucide-react';
import { DEFAULT_COMMITMENT_WARN_PERCENT, normalizeCommitmentLimit } from '../../../domain/cards/cardCommitment';
import { CategorySharingRule } from '../../../types/finance';
import type { SettingsModalContext } from './settingsModalContext';

export function SettingsRulesTab({ form }: { form: SettingsModalContext }) {
  const {
    activeTab,
    categories,
    familyMembers,
    onUpdateSettings,
    settings,
  } = form;
  return (
    <>
{activeTab === 'rules' && (
            <div className="space-y-6">
              <section className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  1. Reversão de Pagamento & Efeito Cascata (Recorrências e Parcelas)
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 text-indigo-600 mt-0.5">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">
                        Comportamento Padrão ao Editar Série Recorrente / Parcelada
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Quando você altera o valor ou categoria de uma conta fixa ou parcela, ou reverte um pagamento marcado por engano, qual escopo deve vir pré-selecionado?
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {(
                      [
                        {
                          id: 'single',
                          title: 'Apenas Este Mês',
                          desc: 'Altera somente o lançamento clicado',
                        },
                        {
                          id: 'this_and_future',
                          title: 'Este + Próximos (Cascata)',
                          desc: 'Propaga para os meses seguintes automaticamente',
                        },
                        {
                          id: 'all_series',
                          title: 'Toda a Série',
                          desc: 'Atualiza passados, atual e futuros da série',
                        },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({ defaultCascadeMode: opt.id })
                        }
                        className={`rounded-xl border p-3 text-left transition-all ${
                          (settings.defaultCascadeMode || 'this_and_future') ===
                          opt.id
                            ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs font-bold text-slate-900">
                          {opt.title}
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-0.5">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  2. Alertas de Orçamento & Painel de Avisos
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-white border border-slate-200 p-2 text-amber-600 mt-0.5">
                        <Bell className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          Exibir Avisos no Topo da Visão Geral
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Mostra lembretes de contas pendentes do mês e categorias próximas do limite.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.showOverviewAlerts}
                    aria-label="Exibir avisos no topo da Visão Geral"
                      onClick={() =>
                        onUpdateSettings({
                          showOverviewAlerts: !settings.showOverviewAlerts,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        settings.showOverviewAlerts
                          ? 'bg-emerald-600'
                          : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                          settings.showOverviewAlerts
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">
                        Sensibilidade do Alerta Preventivo de Orçamento
                      </span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        Avisar ao atingir {settings.budgetWarningPercent}% do teto
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      {[70, 80, 85, 90].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() =>
                            onUpdateSettings({ budgetWarningPercent: pct })
                          }
                          className={`rounded-lg border py-1.5 text-xs font-mono font-bold transition-colors ${
                            settings.budgetWarningPercent === pct
                              ? 'border-blue-600 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="card-commitment-settings">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  3. Limite do Cartão de Crédito
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <p className="text-[11px] text-slate-600">
                    Defina quanto da sua renda do mês pode ficar comprometido com o cartão (compras à vista, parceladas e
                    fixas). A renda é só o que está lançado ou previsto no mês. Você vê o resultado mês a mês na tela
                    Cartões.
                  </p>

                  <div>
                    <label htmlFor="card-commitment-limit" className="text-xs font-semibold text-slate-700 block mb-1.5">
                      Limite: % da renda do mês
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="card-commitment-limit"
                        data-testid="card-commitment-limit-input"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        max={100}
                        step="0.5"
                        defaultValue={settings.cardCommitmentLimitPercent ?? ''}
                        key={settings.cardCommitmentLimitPercent ?? 'sem-limite'}
                        placeholder="Ex.: 30"
                        onBlur={(e) => {
                          const limit = normalizeCommitmentLimit(e.target.value);
                          onUpdateSettings({ cardCommitmentLimitPercent: limit ?? undefined });
                        }}
                        className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2.5 sm:py-1.5 text-base sm:text-xs font-mono font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">%</span>
                      {settings.cardCommitmentLimitPercent ? (
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ cardCommitmentLimitPercent: undefined })}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 sm:py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Sem limite
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Sem limite definido: o app só mostra os números.</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-xs font-semibold text-slate-700">Quando avisar</span>
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        Avisar ao chegar em {settings.cardCommitmentWarnPercent ?? DEFAULT_COMMITMENT_WARN_PERCENT}% do limite
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[70, 80, 85, 90].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => onUpdateSettings({ cardCommitmentWarnPercent: pct })}
                          className={`rounded-lg border py-2.5 sm:py-1.5 text-xs font-mono font-bold transition-colors ${
                            (settings.cardCommitmentWarnPercent ?? DEFAULT_COMMITMENT_WARN_PERCENT) === pct
                              ? 'border-blue-600 bg-blue-50 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3 pt-4 border-t border-slate-200" data-testid="category-sharing-settings">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  4. Divisão automática por categoria
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                  <p className="text-[11px] text-slate-600">
                    Escolha a pessoa, quem paga e a divisão para cada categoria. Ao lançar uma despesa nessa categoria, o
                    formulário já vem dividido (você pode desfazer na hora). Vale só para lançamentos novos.
                  </p>
                  {familyMembers.length === 0 ? (
                    <p className="text-[11px] font-semibold text-amber-700">
                      Cadastre uma pessoa em Compartilhado para configurar a divisão automática.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {categories
                        .filter((category) => category.type === 'expense')
                        .map((category) => {
                          const rule = settings.categorySharingRules?.[category.id];
                          const update = (next: CategorySharingRule | null) => {
                            const rules = { ...(settings.categorySharingRules ?? {}) };
                            if (next) rules[category.id] = next;
                            else delete rules[category.id];
                            onUpdateSettings({ categorySharingRules: Object.keys(rules).length > 0 ? rules : undefined });
                          };
                          return (
                            <li
                              key={category.id}
                              data-testid={`category-sharing-row-${category.id}`}
                              className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2"
                            >
                              <p className="text-xs font-bold text-slate-800">{category.name}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <select
                                  aria-label={`Dividir ${category.name} com`}
                                  data-testid={`category-sharing-member-${category.id}`}
                                  value={rule?.memberId ?? ''}
                                  onChange={(e) =>
                                    e.target.value
                                      ? update({
                                          memberId: e.target.value,
                                          paidBy: rule?.paidBy ?? 'me',
                                          splitMode: rule?.splitMode ?? 'half',
                                          percentage: rule?.percentage,
                                        })
                                      : update(null)
                                  }
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                                >
                                  <option value="">Não dividir</option>
                                  {familyMembers.map((member) => (
                                    <option key={member.id} value={member.id}>{member.name}</option>
                                  ))}
                                </select>
                                {rule && (
                                  <>
                                    <select
                                      aria-label={`Quem paga ${category.name}`}
                                      value={rule.paidBy}
                                      onChange={(e) => update({ ...rule, paidBy: e.target.value === 'member' ? 'member' : 'me' })}
                                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                                    >
                                      <option value="me">Eu pago</option>
                                      <option value="member">A pessoa paga</option>
                                    </select>
                                    <select
                                      aria-label={`Divisão de ${category.name}`}
                                      value={rule.splitMode === 'half' ? 'half' : String(rule.percentage ?? 50)}
                                      onChange={(e) =>
                                        e.target.value === 'half'
                                          ? update({ ...rule, splitMode: 'half', percentage: undefined })
                                          : update({ ...rule, splitMode: 'percentage', percentage: Number(e.target.value) })
                                      }
                                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                                    >
                                      <option value="half">Metade (50%)</option>
                                      {[10, 20, 25, 30, 40, 60, 70, 75, 80, 90].map((pct) => (
                                        <option key={pct} value={pct}>{pct}% da pessoa</option>
                                      ))}
                                    </select>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}
    </>
  );
}
