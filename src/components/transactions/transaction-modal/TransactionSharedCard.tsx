/** Cartão Dividir com familiar: pessoa, quem pagou e modo de divisão. Parte de TransactionExtrasSection (ver TransactionExtrasSection.tsx). */
import { Plus, UserPlus, Users } from 'lucide-react';
import { formatBRL } from '../../../domain/finance/financeRules';
import { FamilyMember } from '../../../types/finance';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionSharedCard({ form }: { form: TransactionFormContext }) {
  const {
    amountMode,
    calculatedSharedPreview,
    entryMode,
    familyMembers,
    handleInlineAddFamilyMember,
    handleToggleShared,
    inlineFamilyMemberError,
    isAddingFamilyMember,
    isShared,
    isTripLinked,
    newMemberEmail,
    newMemberName,
    newMemberRelationship,
    numericPreview,
    onAddFamilyMember,
    recurrence,
    setIsAddingFamilyMember,
    setNewMemberEmail,
    setNewMemberName,
    setNewMemberRelationship,
    setSharedCustomAmountStr,
    setSharedCustomPercentStr,
    setSharedMemberId,
    setSharedPaidBy,
    setSharedSplitMode,
    sharedCustomAmountStr,
    sharedCustomPercentStr,
    sharedMemberId,
    sharedPaidBy,
    sharedSplitMode,
  } = form;
  return (
    <>
{/* Switch Card 2: Dividir com Familiar (Rateio Doméstico em R$ - Oculto quando for Viagem Internacional) */}
                {entryMode !== 'income' && !isTripLinked && (
                  <div
                    className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isShared
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                            isShared
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Users className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              Dividir com Familiar (Compensação em R$)
                            </span>
                            {isShared && numericPreview > 0 && (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  sharedPaidBy === 'member'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200'
                                    : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200'
                                }`}
                              >
                                {sharedPaidBy === 'member' ? 'Eu devo: ' : 'Me deve: '}
                                {formatBRL(calculatedSharedPreview())}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Rachar despesa nacional e abater automaticamente no encontro de contas
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={isShared}
                        data-testid="toggle-shared-switch"
                        onClick={handleToggleShared}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                          isShared
                            ? 'bg-indigo-600'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <span className="sr-only">Dividir com Familiar</span>
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isShared ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Expanded Family Split Panel */}
                    {isShared && (
                      <div
                        data-testid="family-split-panel"
                        className="border-t border-indigo-200/80 dark:border-indigo-800/60 p-3.5 sm:p-4 pt-3.5 space-y-3.5 animate-expand-in bg-white/40 dark:bg-slate-900/40"
                      >
                        {familyMembers.length === 0 ? (
                          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-3.5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              <UserPlus className="h-4 w-4 text-indigo-600 shrink-0" />
                              <span>Adicionar familiar à lista</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Adicione um familiar sem e-mail. Para vincular uma conta por e-mail, use a aba Compartilhado.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                              <input
                                type="text"
                                data-testid="inline-family-member-name"
                                placeholder="Nome (ex: Mariana)"
                                value={newMemberName}
                                onChange={(e) =>
                                  setNewMemberName(e.target.value)
                                }
                                className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                              />
                              <input
                                type="email"
                                data-testid="inline-family-member-email"
                                placeholder="E-mail (use a aba Compartilhado)"
                                value={newMemberEmail}
                                onChange={(e) =>
                                  setNewMemberEmail(e.target.value)
                                }
                                className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                              />
                              {inlineFamilyMemberError && (
                                <p role="alert" data-testid="inline-family-member-error" className="sm:col-span-12 text-xs text-rose-700">
                                  {inlineFamilyMemberError}
                                </p>
                              )}
                              <select
                                value={newMemberRelationship}
                                onChange={(e) =>
                                  setNewMemberRelationship(
                                    e.target
                                      .value as FamilyMember['relationship']
                                  )
                                }
                                className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                              >
                                <option value="cônjuge">Cônjuge</option>
                                <option value="filho(a)">Filho(a)</option>
                                <option value="pai/mãe">Pai/Mãe</option>
                                <option value="irmão/irmã">Irmão/Irmã</option>
                                <option value="amigo(a)">Amigo(a)</option>
                                <option value="outro">Outro</option>
                              </select>
                              <button
                                type="button"
                                data-testid="inline-family-member-submit"
                                onClick={handleInlineAddFamilyMember}
                                className="sm:col-span-2 rounded-lg bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 hover:bg-indigo-700 transition-colors"
                              >
                                Adicionar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Bilateral Payer Selector: Who paid this bill? */}
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Quem pagou esta despesa? (Compensação Automática)
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  data-testid="shared-paid-by-me-btn"
                                  onClick={() => setSharedPaidBy('me')}
                                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                                    sharedPaidBy === 'me'
                                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-100 font-bold ring-1 ring-indigo-600'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="block font-bold">
                                    👤 Eu paguei a conta
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    O familiar me deve a parte dele(a)
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  data-testid="shared-paid-by-member-btn"
                                  onClick={() => setSharedPaidBy('member')}
                                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                                    sharedPaidBy === 'member'
                                      ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/70 text-amber-950 dark:text-amber-100 font-bold ring-1 ring-amber-600'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="block font-bold">
                                    🤝 Familiar pagou a conta
                                  </span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    Eu devo minha parte a ele(a) (abate do saldo)
                                  </span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                    Dividir com qual familiar?
                                  </label>
                                  {onAddFamilyMember && (
                                    <button
                                      type="button"
                                      data-testid="toggle-inline-family-member-form"
                                      onClick={() =>
                                        setIsAddingFamilyMember(
                                          !isAddingFamilyMember
                                        )
                                      }
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-0.5"
                                    >
                                      <Plus className="h-3 w-3" />
                                      {isAddingFamilyMember
                                        ? 'Fechar cadastro'
                                        : '+ Convidar familiar'}
                                    </button>
                                  )}
                                </div>
                                <select
                                  value={sharedMemberId}
                                  onChange={(e) =>
                                    setSharedMemberId(e.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none"
                                >
                                  {familyMembers.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.relationship}){m.email ? ` • ${m.email}` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                                  Regra de Divisão
                                </label>
                                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
                                  <button
                                    type="button"
                                    onClick={() => setSharedSplitMode('half')}
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'half'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    ½ 50%
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSharedSplitMode('percentage')
                                    }
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'percentage'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    % Porcento
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSharedSplitMode('custom')}
                                    className={`rounded-lg py-1.5 text-[11px] font-bold transition-all text-center ${
                                      sharedSplitMode === 'custom'
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                                    }`}
                                  >
                                    R$ Fixo
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isAddingFamilyMember && (
                              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-3 space-y-2 animate-expand-in">
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                                  Adicionar familiar sem e-mail:
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                  <input
                                    type="text"
                                    data-testid="inline-family-member-name"
                                    placeholder="Nome (ex: Juliana)"
                                    value={newMemberName}
                                    onChange={(e) =>
                                      setNewMemberName(e.target.value)
                                    }
                                    className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                  />
                                  <input
                                    type="email"
                                    data-testid="inline-family-member-email"
                                    placeholder="E-mail (use a aba Compartilhado)"
                                    value={newMemberEmail}
                                    onChange={(e) =>
                                      setNewMemberEmail(e.target.value)
                                    }
                                    className="sm:col-span-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                                  />
                                  {inlineFamilyMemberError && (
                                    <p role="alert" data-testid="inline-family-member-error" className="sm:col-span-12 text-xs text-rose-700">
                                      {inlineFamilyMemberError}
                                    </p>
                                  )}
                                  <select
                                    value={newMemberRelationship}
                                    onChange={(e) =>
                                      setNewMemberRelationship(
                                        e.target
                                          .value as FamilyMember['relationship']
                                      )
                                    }
                                    className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                                  >
                                    <option value="cônjuge">Cônjuge</option>
                                    <option value="filho(a)">Filho(a)</option>
                                    <option value="pai/mãe">Pai/Mãe</option>
                                    <option value="irmão/irmã">
                                      Irmão/Irmã
                                    </option>
                                    <option value="amigo(a)">Amigo(a)</option>
                                    <option value="outro">Outro</option>
                                  </select>
                                  <button
                                    type="button"
                                    data-testid="inline-family-member-submit"
                                    onClick={handleInlineAddFamilyMember}
                                    className="sm:col-span-2 rounded-lg bg-indigo-600 text-white text-xs font-bold py-1.5 px-3 hover:bg-indigo-700 transition-colors"
                                  >
                                    Adicionar
                                  </button>
                                </div>
                              </div>
                            )}

                            {sharedSplitMode === 'percentage' && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  Porcentagem da divisão (%)
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={sharedCustomPercentStr}
                                    onChange={(e) =>
                                      setSharedCustomPercentStr(e.target.value)
                                    }
                                    className="w-28 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                  />
                                  <span className="text-xs text-slate-500 font-bold">
                                    %
                                  </span>
                                </div>
                              </div>
                            )}

                            {sharedSplitMode === 'custom' && (
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                  {recurrence === 'installment' && amountMode === 'total_divided' ? 'Cota total na compra (R$)' : 'Valor exato da parte dividida (R$)'}
                                </label>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-500">
                                    R$
                                  </span>
                                  <CurrencyInput
                                    value={sharedCustomAmountStr}
                                    data-testid="shared-total-amount-input"
                                    currency="BRL"
                                    onValueChange={setSharedCustomAmountStr}
                                    className="w-36 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>
                            )}

                            {numericPreview > 0 && (
                              <div className="rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/80 p-3 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                                <div className="text-xs">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Valor total da nota:{' '}
                                  </span>
                                  <strong className="font-mono text-slate-900 dark:text-white">
                                    {formatBRL(numericPreview)}
                                  </strong>
                                </div>
                                <div className="text-xs">
                                  <span
                                    className={`font-semibold ${
                                      sharedPaidBy === 'member'
                                        ? 'text-amber-700 dark:text-amber-400'
                                        : 'text-indigo-600 dark:text-indigo-400'
                                    }`}
                                  >
                                    {sharedPaidBy === 'member'
                                      ? `Você deve para ${
                                          familyMembers.find(
                                            (m) => m.id === sharedMemberId
                                          )?.name || 'familiar'
                                        }: `
                                      : `${
                                          familyMembers.find(
                                            (m) => m.id === sharedMemberId
                                          )?.name || 'Familiar'
                                        } te deve: `}
                                  </span>
                                  <strong className="font-mono text-indigo-700 dark:text-indigo-300 text-sm">
                                    {formatBRL(calculatedSharedPreview())}
                                  </strong>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
    </>
  );
}
