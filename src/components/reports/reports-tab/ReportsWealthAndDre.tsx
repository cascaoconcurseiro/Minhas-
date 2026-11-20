/** DRE pessoal, patrimônio, importação e exportação. Parte de ReportsAndDataTab (ver ReportsAndDataTab.tsx). */
import { formatBRL, formatMonthYearPT } from '../../../domain/finance/financeRules';
import { Download, FileCheck2, FileSpreadsheet, FileText, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { InstitutionMark } from '../../accounts/InstitutionMark';
import { MissingSetupNotice } from '../../layout/MissingSetupNotice';
import type { ReportsAndDataTabContext } from './reportsTabContext';

export function ReportsWealthAndDre({ form }: { form: ReportsAndDataTabContext }) {
  const {
    accounts,
    brlImportAccounts,
    confirmApplyHistoryTotals,
    confirmReset,
    csvPasteText,
    handleDownloadCSV,
    handleDownloadHistoryAudit,
    handleExportPdf,
    handleRunImport,
    highConfidenceHistoryGroups,
    historyAuditRows,
    historyBackupPrepared,
    importFeedback,
    importTargetAccId,
    isExportingPdf,
    onApplyHistoricalInstallmentTotals,
    onExportFullBackupJson,
    onOpenReconciliation,
    onRequestCreateAccount,
    onResetWorkspaceData,
    personalDre,
    selectedMonth,
    setConfirmApplyHistoryTotals,
    setConfirmReset,
    setCsvPasteText,
    setHistoryBackupPrepared,
    setImportTargetAccId,
  } = form;
  return (
    <>
{/* Personal DRE + Privacy / Offline Export Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Demonstrativo de Resultado Pessoal (DRE) & Composição Patrimonial */}
        <section
          data-testid="personal-dre-section"
          className="lg:col-span-6 rounded-xl border border-slate-200 bg-white flex flex-col justify-between"
        >
          <div className="p-4 sm:p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  DRE Pessoal & Evolução Patrimonial — {formatMonthYearPT(selectedMonth)}
                </h2>
                <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                  Regime de Competência
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Separação clara entre geração operacional de caixa, consumo e aportes em investimentos
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (+) Receitas Operacionais (Salário, Projetos, Extras)
                </span>
                <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold text-emerald-700">
                  +{formatBRL(personalDre.operationalIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (+) Renda Passiva (Dividendos, FIIs e Rendimentos)
                </span>
                <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold text-emerald-700">
                  +{formatBRL(personalDre.dividendIncome)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-700">
                  (−) Despesas de Consumo & Estilo de Vida
                </span>
                <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold text-rose-700">
                  -{formatBRL(personalDre.consumptionExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 bg-slate-50/80 px-2.5 rounded-lg">
                <span className="font-bold text-slate-900">
                  (=) Geração Livre de Caixa (Antes de Aportes)
                </span>
                <span
                  className={`whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold ${
                    personalDre.freeCashFlowBeforeInvestments >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {personalDre.freeCashFlowBeforeInvestments >= 0 ? '+' : ''}
                  {formatBRL(personalDre.freeCashFlowBeforeInvestments)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-indigo-800">
                  (−) Aportes em Investimentos & Construção de Patrimônio
                </span>
                <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold text-indigo-700">
                  {formatBRL(personalDre.investmentContributions)}
                </span>
              </div>
              {personalDre.investmentWithdrawals > 0 && (
                <div className="flex items-center justify-between py-2.5">
                  <span className="font-semibold text-indigo-800">
                    (+) Resgates e Vendas de Investimentos
                    <span className="block text-[11px] font-normal text-slate-500">
                      {personalDre.realizedCapitalGain >= 0 ? 'Lucro' : 'Prejuízo'} na venda (sobre o preço médio): {formatBRL(Math.abs(personalDre.realizedCapitalGain))}
                    </span>
                  </span>
                  <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums font-bold text-indigo-700">
                    +{formatBRL(personalDre.investmentWithdrawals)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5 border-t border-slate-200">
                <span className="font-bold text-slate-900">
                  (=) Superávit / Caixa Retido no Giro do Mês
                </span>
                <span
                  className={`whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums text-sm font-extrabold ${
                    personalDre.netSurplusAfterInvestments >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {personalDre.netSurplusAfterInvestments >= 0 ? '+' : ''}
                  {formatBRL(personalDre.netSurplusAfterInvestments)}
                </span>
              </div>
            </div>

            {/* Consolidated Wealth Strip inside DRE */}
            <div className="rounded-xl border border-slate-200 bg-slate-900 text-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Patrimônio Líquido Consolidado</span>
                <span className="whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums text-sm font-bold text-emerald-400">
                  {formatBRL(personalDre.totalNetWorth)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1.5 border-t border-slate-800 text-[11px] whitespace-nowrap shrink-0 pl-3 font-mono tabular-nums">
                <div>
                  <span className="block font-sans text-slate-400">Liquidez em Contas</span>
                  <span className="font-semibold text-white">
                    {formatBRL(personalDre.liquidAccountsBalance)}
                  </span>
                </div>
                <div>
                  <span className="block font-sans text-slate-400">Ativos Investidos</span>
                  <span className="font-semibold text-emerald-300">
                    {formatBRL(personalDre.investedAssetsValue)}
                  </span>
                </div>
                <div>
                  <span className="block font-sans text-slate-400">A Receber de Pessoas</span>
                  <span className="font-semibold text-emerald-300">{formatBRL(personalDre.receivablesTotal)}</span>
                </div>
                <div>
                  <span className="block font-sans text-slate-400">Dívida dos Cartões</span>
                  <span className="font-semibold text-rose-300">{formatBRL(personalDre.creditCardDebt)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 sm:px-6 py-3 bg-slate-50/60 rounded-b-xl text-xs text-slate-600">
            Para gerenciar contas bancárias e saldos iniciais, acesse a aba dedicada{' '}
            <strong>Contas & Carteiras</strong>.
          </div>
        </section>

        <section className="lg:col-span-6 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="p-4 sm:p-6 space-y-5">
            <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Privacidade & Portabilidade de Dados
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seus dados financeiros nunca passam por integrações Open Finance de terceiros. Exporte planilhas CSV ou importe lançamentos em lote quando quiser.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {onOpenReconciliation && (
                <button
                  type="button"
                  onClick={onOpenReconciliation}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Conciliação Inteligente (OFX / CSV)
                </button>
              )}

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                aria-label="Exportar relatório financeiro do mês em PDF formatado"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                {isExportingPdf ? 'Gerando PDF...' : 'Exportar Relatório em PDF'}
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Planilha CSV (Excel)
              </button>

              <button
                type="button"
                onClick={onExportFullBackupJson}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                Baixar backup do workspace JSON
              </button>

              {!confirmReset ? (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Limpar dados pessoais
                </button>
              ) : (
                <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2">
                  <span className="text-xs font-medium text-rose-800">
                    Apaga contas, cartões, lançamentos, metas, investimentos e viagens do workspace pessoal. Convites e lançamentos compartilhados não são apagados. Exporte um backup antes.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onResetWorkspaceData();
                      setConfirmReset(false);
                    }}
                    className="rounded-md bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                  >
                    Confirmar limpeza pessoal
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-amber-950">
                <p className="font-semibold">Revisão de lançamentos históricos</p>
                <p className="mt-0.5 text-amber-900">
                  {historyAuditRows.length === 0
                    ? 'Nenhuma divergência detectada nas séries parceladas e competências verificadas.'
                    : `${historyAuditRows.length} apontamento(s) para revisar. Competências são comparadas com os dados atuais do cartão.`}{' '}
                  O relatório não altera lançamentos.
                </p>
              </div>
              <button
                type="button"
                data-testid="download-financial-history-audit"
                onClick={handleDownloadHistoryAudit}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100 transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar revisão CSV
              </button>
              {onApplyHistoricalInstallmentTotals && highConfidenceHistoryGroups.length > 0 && (
                <button
                  type="button"
                  data-testid="apply-high-confidence-history-totals"
                  onClick={() => setConfirmApplyHistoryTotals(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
                >
                  Preencher {highConfidenceHistoryGroups.length} total(is) confiável(is)
                </button>
              )}
            </div>
            {confirmApplyHistoryTotals && onApplyHistoricalInstallmentTotals && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-3 text-xs text-amber-950">
                <span>
                  {historyBackupPrepared
                    ? `Confirme que o arquivo de backup JSON foi salvo. Só então o app preencherá o total original em ${highConfidenceHistoryGroups.length} série(s) completa(s) de alta confiança. Valores das parcelas e competências não serão alterados; também será possível desfazer pelo aviso nesta sessão.`
                    : `Primeiro baixe o backup JSON completo. Confira se o navegador salvou o arquivo; o histórico não será alterado nesta etapa. Depois confirme o preenchimento do total original em ${highConfidenceHistoryGroups.length} série(s) de alta confiança.`}
                </span>
                {historyBackupPrepared ? (
                  <button
                    type="button"
                    data-testid="confirm-apply-history-totals"
                    onClick={() => {
                      onApplyHistoricalInstallmentTotals();
                      setHistoryBackupPrepared(false);
                      setConfirmApplyHistoryTotals(false);
                    }}
                    className="rounded-md bg-amber-700 px-2.5 py-1.5 font-bold text-white hover:bg-amber-800"
                  >
                    Já salvei o backup; preencher totais
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="download-history-backup-before-apply"
                    onClick={() => {
                      onExportFullBackupJson();
                      setHistoryBackupPrepared(true);
                    }}
                    className="rounded-md bg-amber-700 px-2.5 py-1.5 font-bold text-white hover:bg-amber-800"
                  >
                    Baixar backup JSON
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setHistoryBackupPrepared(false);
                    setConfirmApplyHistoryTotals(false);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}

            <form onSubmit={handleRunImport} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="csv-paste-box" className="text-xs font-bold text-slate-800">
                  Importação Rápida de Extrato Manual (Texto / CSV)
                </label>
                <select
                  aria-label="Conta destino da importação em lote"
                  value={importTargetAccId}
                  onChange={(e) => setImportTargetAccId(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
                >
                  {brlImportAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      Importar em: {a.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const selectedAccount = accounts.find((account) => account.id === importTargetAccId);
                  return selectedAccount ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                      <InstitutionMark institution={selectedAccount.institution} accountName={selectedAccount.name} color={selectedAccount.color} size="xs" />
                      {selectedAccount.name}
                    </span>
                  ) : null;
                })()}
              </div>
              <textarea
                id="csv-paste-box"
                rows={3}
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                placeholder={'Cole linhas no formato Data;Descrição;Valor\n2026-10-21;Padaria Real;-28,50\n2026-10-22;Reembolso PIX;150,00'}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              {brlImportAccounts.length === 0 && (
                <MissingSetupNotice
                  testId="missing-brl-account-for-import"
                  message={accounts.length === 0 ? 'Cadastre uma conta antes de importar lançamentos.' : 'A importação em lote é em reais e não há conta em reais cadastrada. Cadastre uma conta.'}
                  onAction={onRequestCreateAccount}
                />
              )}
              {importFeedback && (
                <p className="text-xs font-medium text-emerald-700">{importFeedback}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={brlImportAccounts.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Processar e Importar Linhas
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
