/** Cartão de observações e anotações. Parte de TransactionExtrasSection (ver TransactionExtrasSection.tsx). */
import { FileText } from 'lucide-react';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionNotesCard({ form }: { form: TransactionFormContext }) {
  const {
    isNotesOpen,
    notes,
    setIsNotesOpen,
    setNotes,
  } = form;
  return (
    <>
{/* Switch Card 3: Observações & Anotações */}
                <div
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isNotesOpen || Boolean(notes)
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between p-3 sm:p-3.5 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isNotesOpen || Boolean(notes)
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          Observações & Comprovante
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          Anotações livres, código de rastreio ou detalhes adicionais
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={isNotesOpen || Boolean(notes)}
                      data-testid="toggle-notes-switch"
                      onClick={() => setIsNotesOpen(!isNotesOpen)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                        isNotesOpen || Boolean(notes)
                          ? 'bg-emerald-600'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      <span className="sr-only">Observações</span>
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isNotesOpen || Boolean(notes)
                            ? 'translate-x-5'
                            : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {(isNotesOpen || Boolean(notes)) && (
                    <div className="border-t border-emerald-200/80 dark:border-emerald-800/60 p-3.5 sm:p-4 pt-3.5 animate-expand-in">
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Pago via Wise cartão final 4321, nota fiscal anexa, código PIX..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
    </>
  );
}
