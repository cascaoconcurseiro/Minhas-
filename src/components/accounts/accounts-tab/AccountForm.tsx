/** Formulário de cadastro e edição de conta. Parte de AccountsTab (ver AccountsTab.tsx). */
import { Building2, Globe, X } from 'lucide-react';
import { ACCOUNT_COLORS, FOREIGN_CURRENCY_OPTIONS, INTL_ACCOUNT_PRESETS } from './accountsTabConfig';
import { CURRENCY_CATALOG } from '../../../domain/trips/travelRules';
import { AccountType, CurrencyCode } from '../../../types/finance';
import { InstitutionMark } from '../InstitutionMark';
import { CurrencyInput } from '../../ui/CurrencyInput';
import type { AccountsTabContext } from './accountsTabContext';

export function AccountForm({ form }: { form: AccountsTabContext }) {
  const {
    accColor,
    accCurrency,
    accIncludeInTotal,
    accInitialDate,
    accInitialForeignStr,
    accInitialStr,
    accInstitution,
    accName,
    accType,
    editingAccount,
    formError,
    handleSaveAccountForm,
    setAccColor,
    setAccCurrency,
    setAccIncludeInTotal,
    setAccInitialDate,
    setAccInitialForeignStr,
    setAccInitialStr,
    setAccInstitution,
    setAccName,
    setAccType,
    setShowAccountForm,
    showAccountForm,
  } = form;
  return (
    <>
{/* Create / Edit Account Modal Form */}
            {showAccountForm && (
              <form
                onSubmit={handleSaveAccountForm}
                data-testid="account-create-edit-form"
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4 animate-expand-in"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    {accType === 'international' ? (
                      <Globe className="h-4 w-4 text-sky-600" />
                    ) : (
                      <Building2 className="h-4 w-4 text-emerald-600" />
                    )}
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingAccount
                        ? `Editar Conta — ${editingAccount.name}`
                        : accType === 'international'
                        ? 'Cadastrar Conta Internacional / Global (Wise, Nomad, Avenue, C6 Global)'
                        : 'Cadastrar Nova Conta ou Carteira'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAccountForm(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {formError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {formError}
                  </div>
                )}

                {accType === 'international' && (
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900">
                        Modelos Rápidos de Conta Internacional (1 clique):
                      </span>
                      <span className="text-[11px] font-semibold text-sky-700">
                        Conta independente em moeda estrangeira ({accCurrency})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {INTL_ACCOUNT_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setAccName(preset.name);
                            setAccInstitution(preset.institution);
                            setAccCurrency(preset.currency);
                            setAccColor(preset.color);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                            accName === preset.name && accCurrency === preset.currency
                              ? 'border-sky-600 bg-sky-600 text-white shadow-2xs'
                              : 'border-sky-200 bg-white text-sky-900 hover:bg-sky-100'
                          }`}
                        >
                          <span>{CURRENCY_CATALOG[preset.currency].flag}</span>
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div>
                    <label htmlFor="account-form-type-select" className="block text-xs font-semibold text-slate-700 mb-1">
                      Modalidade da Conta
                    </label>
                    <select
                      id="account-form-type-select"
                      data-testid="account-form-type-select"
                      value={accType}
                      onChange={(e) => {
                        const nextType = e.target.value as AccountType;
                        setAccType(nextType);
                        if (nextType === 'international') {
                          setAccIncludeInTotal(false);
                          if (!accName.trim()) {
                            setAccName('Wise Conta Global Euro');
                            setAccInstitution('Wise');
                          }
                        } else {
                          setAccIncludeInTotal(true);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
                    >
                      <option value="checking">Conta Corrente / Digital (R$)</option>
                      <option value="international">
                        🌎 Conta Internacional / Global (Wise, Nomad, Avenue, C6)
                      </option>
                      <option value="cash">Carteira Física (Dinheiro R$)</option>
                      <option value="savings">Conta Poupança (R$)</option>
                      <option value="investment">Reserva / Investimento (CDB, Tesouro)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="account-form-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome da Conta / Carteira
                    </label>
                    <input
                      type="text"
                      id="account-form-name-input"
                      data-testid="account-form-name-input"
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      placeholder={
                        accType === 'international'
                          ? 'Ex: Wise Conta Global Euro, Nomad USD'
                          : 'Ex: Itaú Unibanco, Carteira Física'
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="account-form-institution-input" className="block text-xs font-semibold text-slate-700 mb-1">
                      Instituição Financeira
                    </label>
                    <div className="flex min-w-0 items-center gap-2">
                      <InstitutionMark
                        institution={accInstitution}
                        accountName={accName}
                        color={accColor}
                        size="sm"
                      />
                      <input
                        type="text"
                        id="account-form-institution-input"
                        value={accInstitution}
                        onChange={(e) => setAccInstitution(e.target.value)}
                        placeholder={
                          accType === 'international'
                            ? 'Ex: Wise, Nomad, Avenue, C6 Global'
                            : 'Ex: Itaú, Nubank, Caixa, Dinheiro'
                        }
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  {accType === 'international' ? (
                    <div>
                      <label htmlFor="account-form-currency-select" className="block text-xs font-semibold text-sky-900 mb-1">
                        Moeda Oficial da Conta Internacional
                      </label>
                      <select
                        id="account-form-currency-select"
                        data-testid="account-form-currency-select"
                        value={accCurrency}
                        onChange={(e) => {
                          const nextCurr = e.target.value as CurrencyCode;
                          setAccCurrency(nextCurr);
                        }}
                        className="w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-950"
                      >
                        {FOREIGN_CURRENCY_OPTIONS.map((code) => (
                          <option key={code} value={code}>
                            {CURRENCY_CATALOG[code].flag} {code} — {CURRENCY_CATALOG[code].name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="account-form-initial-balance-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Saldo Inicial de Implantação (R$)
                      </label>
                      <CurrencyInput
                        id="account-form-initial-balance-input"
                        value={accInitialStr}
                        currency="BRL"
                        onValueChange={setAccInitialStr}
                        placeholder="0,00"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono tabular-nums text-slate-900"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="account-form-initial-date-input" className="block text-xs font-semibold text-slate-700 mb-1">
                    Saldo inicial vale desde (opcional)
                  </label>
                  <input
                    id="account-form-initial-date-input"
                    type="date"
                    value={accInitialDate}
                    onChange={(event) => setAccInitialDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    É o saldo no começo desse dia. Lançamentos de antes dessa data ficam só no histórico e não mexem no saldo. Em branco, todos os lançamentos contam.
                  </p>
                </div>

                {accType === 'international' && (
                  <div className="rounded-xl border border-sky-200/80 bg-white p-3.5">
                    <div>
                      <label htmlFor="account-form-initial-foreign-input" className="block text-xs font-semibold text-slate-700 mb-1">
                        Saldo Inicial na Moeda ({CURRENCY_CATALOG[accCurrency].symbol} {accCurrency})
                      </label>
                      <CurrencyInput
                        id="account-form-initial-foreign-input"
                        data-testid="account-form-initial-foreign-input"
                        value={accInitialForeignStr}
                        currency={accCurrency}
                        onValueChange={setAccInitialForeignStr}
                        placeholder="0,00"
                        className="w-full sm:max-w-xs rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono font-bold tabular-nums text-slate-900"
                      />
                      <span className="block text-[10px] text-slate-500 mt-1">
                        Sua conta internacional em {accCurrency} funciona de forma independente (igual na vida real) e pode ser usada em compras internacionais ou em viagens nessa moeda.
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700 mr-1">Cor:</span>
                      {ACCOUNT_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setAccColor(c.hex)}
                          title={c.name}
                          className={`h-6 w-6 rounded-full transition-transform ${
                            accColor === c.hex
                              ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>

                    {accType !== 'international' ? (
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={accIncludeInTotal}
                          onChange={(e) => setAccIncludeInTotal(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <span>Incluir no Saldo de Giro Mensal (Caixa Principal em R$)</span>
                      </label>
                    ) : (
                      <span className="text-[11px] font-semibold text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-md">
                        🔒 Conta em {accCurrency}: isolada do giro doméstico em R$
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setShowAccountForm(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      data-testid="save-account-form-btn"
                      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      {editingAccount ? 'Salvar Alterações' : 'Criar Conta'}
                    </button>
                  </div>
                </div>
              </form>
            )}
    </>
  );
}
