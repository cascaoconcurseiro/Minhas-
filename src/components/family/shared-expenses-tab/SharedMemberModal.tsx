/** Janela de cadastro e edição de pessoa. Parte de SharedExpensesTab (ver SharedExpensesTab.tsx). */
import { X } from 'lucide-react';
import { FamilyMember } from '../../../types/finance';
import { MEMBER_COLORS } from './sharedExpensesTabConfig';
import type { SharedExpensesTabContext } from './sharedExpensesTabContext';

export function SharedMemberModal({ form }: { form: SharedExpensesTabContext }) {
  const {
    editingMember,
    handleSaveMember,
    isSavingMember,
    memberColor,
    memberEmail,
    memberName,
    memberNotes,
    memberPixKey,
    memberRelation,
    memberSaveError,
    setMemberColor,
    setMemberEmail,
    setMemberName,
    setMemberNotes,
    setMemberPixKey,
    setMemberRelation,
    setShowMemberModal,
    showMemberModal,
  } = form;
  return (
    <>
{/* Add / Edit Family Member + Email Invite Modal */}
      {showMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px] modal-shell"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMemberModal(false);
          }}
        >
          <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-modal-in">
            <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingMember
                    ? 'Editar familiar / vínculo por e-mail'
                    : 'Cadastrar familiar na conta compartilhada'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  O convite fica registrado no app; nenhum e-mail é enviado. A pessoa precisa entrar no Minhas Economias com o mesmo e-mail para ver e aceitar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMemberModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMember}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {memberSaveError && (
                  <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                    {memberSaveError}
                  </p>
                )}
                <div>
                  <label htmlFor="shared-member-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome Completo ou Apelido:
                  </label>
                  <input
                    type="text"
                    id="shared-member-name"
                    required
                    placeholder="ex: Mariana (Esposa), Lucas (Irmão)"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="shared-member-email" className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail da pessoa (para vincular a conta):
                  </label>
                  <input
                    type="email"
                    id="shared-member-email"
                    data-testid="family-member-email-input"
                    placeholder="colega@exemplo.com"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <span className="block text-[11px] text-slate-500 mt-1">
                    Ao aceitar, a pessoa visualiza em tempo real o que deve a você, o que você deve a ela e o saldo compensado.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="shared-member-relationship" className="block text-xs font-semibold text-slate-700 mb-1">
                      Parentesco:
                    </label>
                    <select
                      id="shared-member-relationship"
                      value={memberRelation}
                      onChange={(e) =>
                        setMemberRelation(e.target.value as FamilyMember['relationship'])
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                    >
                      <option value="cônjuge">Cônjuge / Esposo(a)</option>
                      <option value="filho(a)">Filho(a)</option>
                      <option value="pai/mãe">Pai / Mãe</option>
                      <option value="irmão/irmã">Irmão / Irmã</option>
                      <option value="amigo(a)">Amigo(a) / Colega</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1">
                      Cor de Destaque:
                    </span>
                    <div className="flex items-center gap-1.5 pt-1">
                      {MEMBER_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Cor ${c}`}
                          aria-pressed={memberColor === c}
                          onClick={() => setMemberColor(c)}
                          className={`h-6 w-6 rounded-full transition-transform ${
                            memberColor === c ? 'scale-110 ring-2 ring-slate-900 ring-offset-1' : ''
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="shared-member-pix" className="block text-xs font-semibold text-slate-700 mb-1">
                    Chave PIX da Pessoa (Opcional):
                  </label>
                  <input
                    type="text"
                    id="shared-member-pix"
                    placeholder="ex: CPF, e-mail ou celular"
                    value={memberPixKey}
                    onChange={(e) => setMemberPixKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="shared-member-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Anotações ou Regra de Divisão:
                  </label>
                  <input
                    type="text"
                    id="shared-member-notes"
                    placeholder="ex: Dividimos compras do mercado 50/50"
                    value={memberNotes}
                    onChange={(e) => setMemberNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-3.5">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:cursor-wait disabled:opacity-70"
                >
                  {isSavingMember
                    ? editingMember ? 'Atualizando vínculo...' : 'Registrando convite...'
                    : memberEmail.trim()
                      ? 'Salvar e registrar convite'
                      : 'Salvar pessoa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
