/** Etiquetas (tags) do lançamento. Parte de TransactionModal (ver TransactionModal.tsx). */
import { Plus, Tag, X } from 'lucide-react';
import type { TransactionFormContext } from './transactionFormContext';

export function TransactionTagsSection({ form }: { form: TransactionFormContext }) {
  const {
    availableTagSuggestions,
    handleAddTag,
    handleRemoveTag,
    handleTagInputKeyDown,
    setTagInput,
    tagInput,
    tags,
  } = form;
  return (
    <>
{/* Custom Tags Section: Granular Categorization beyond Standard Categories */}
            <div
              data-testid="custom-tags-section"
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 sm:p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="tx-tag-input"
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Tag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Tags Personalizadas (#tags)</span>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Categorize além das categorias padrão ({tags.length}/12)
                </span>
              </div>

              {/* Active Tags Chips */}
              {tags.length > 0 && (
                <div
                  data-testid="tx-active-tags-list"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      data-testid="tx-active-tag-chip"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 text-xs font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs"
                    >
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">#</span>
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remover tag ${tag}`}
                        className="ml-0.5 rounded-full p-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input + Add Button */}
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1 min-w-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    #
                  </span>
                  <input
                    id="tx-tag-input"
                    data-testid="tx-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    placeholder="Ex: reembolsavel, imposto-renda, projeto-casa (Enter ou vírgula)"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-7 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  data-testid="tx-add-tag-btn"
                  onClick={() => handleAddTag()}
                  disabled={!tagInput.trim()}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Adicionar Tag</span>
                </button>
              </div>

              {/* Quick Suggestion Tag Pills */}
              {availableTagSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 mr-1">
                    Sugestões rápidas:
                  </span>
                  {availableTagSuggestions.map((sugTag) => (
                    <button
                      key={sugTag}
                      type="button"
                      data-testid="tx-suggested-tag-pill"
                      onClick={() => handleAddTag(sugTag)}
                      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                    >
                      <span className="text-slate-400 font-mono">+#</span>
                      <span>{sugTag}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
    </>
  );
}
