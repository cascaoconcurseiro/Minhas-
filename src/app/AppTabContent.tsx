/** Conteúdo da aba ativa (Visão Geral, Extrato, Cartões…), com telas de carregamento. Parte da tela do App (ver src/App.tsx). */
import { FaceIdOfferBanner } from '../components/auth/FaceIdOfferBanner';
import { BudgetsSkeleton, CreditCardsSkeleton, DashboardSkeleton, ReportsSkeleton, TransactionsSkeleton } from '../components/layout/SkeletonScreens';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { Suspense } from 'react';
import { AccountsTab, AuthAndCloudTab, BudgetsTab, CreditCardsTab, GoalsAndSimulatorTab, InvestmentsTab, OverviewTab, ReceivablesTab, ReportsAndDataTab, SharedExpensesTab, TransactionsTab, TripsTab } from './lazyScreens';
import type { AppContext } from './appContext';

export function AppTabContent({ app }: { app: AppContext }) {
  const {
    accountBalances,
    accounts,
    activeTab,
    autoVaultId,
    cardSummaries,
    cards,
    cashForecast,
    categories,
    categoryBreakdown,
    cloudSyncStatus,
    currentPosition,
    currentReceivables,
    currentUser,
    effectiveUserDisplayName,
    effectiveUserEmail,
    familyMembers,
    globalSearchQuery,
    goals,
    handleAcceptFamilyInvite,
    handleAddAccount,
    handleAddCard,
    handleAddCategory,
    handleAddExchangeLot,
    handleAddFamilyMemberWithInvite,
    handleAddGoal,
    handleAddInvestmentAsset,
    handleAddTrip,
    handleAnticipateInstallments,
    handleApplyHistoricalInstallmentTotals,
    handleBatchSettleTransactions,
    handleBatchUpdateInvestmentAssets,
    handleContributeGoal,
    handleCreateReceivable,
    handleDeclineFamilyInvite,
    handleDeleteAccount,
    handleDeleteCard,
    handleDeleteCategory,
    handleDeleteExchangeLot,
    handleDeleteFamilyMember,
    handleDeleteGoal,
    handleDeleteInvestmentAsset,
    handleDeleteReceivable,
    handleDeleteTransaction,
    handleDeleteTrip,
    handleDismissRecurring,
    handleDuplicateTransaction,
    handleEditTransaction,
    handleExportFullBackupJson,
    handleForceCloudSync,
    handleImportQuickCsvLines,
    handleNavigateToAccount,
    handleNavigateToCard,
    handleOpenNewTransaction,
    handleOpenReconciliation,
    handleOperateInvestmentAsset,
    handleCarryOverInvoice,
    handlePayCardInvoice,
    handleUndoInvoiceCarryOver,
    handleRecordDividendIncome,
    handleRecordTripSettlement,
    handleRegisterEmail,
    handleRegisterReceivablePayment,
    handleRemoveReceivablePayment,
    handleReopenSharedTransaction,
    handleRequestCreateFromTransaction,
    handleResetWorkspaceData,
    handleReverseAnticipation,
    handleScheduleRecurring,
    handleSelectTab,
    handleSettleAllMemberInvoices,
    handleSettleSharedTransaction,
    handleSignInEmail,
    handleSignOut,
    handleToggleAccountInTotal,
    handleToggleTransactionStatus,
    handleUpdateAccount,
    handleUpdateAccountInitialBalance,
    handleUpdateCard,
    handleUpdateCategory,
    handleUpdateCategoryBudget,
    handleUpdateFamilyMember,
    handleUpdateGoal,
    handleUpdateInvestmentAsset,
    handleUpdateSettings,
    handleUpdateTrip,
    initialSelectedAccountId,
    initialSelectedCardId,
    investmentTargets,
    investments,
    inviteCodes,
    inviteeHasAccount,
    isLoadingData,
    isUserAuthenticated,
    lastSyncedAt,
    monthlySummary,
    pendingCreateRequest,
    receivables,
    receivablesSummary,
    recurringSuggestions,
    requestedLedgerViewMode,
    requireWorkspaceWrite,
    selectedMonth,
    setGlobalSearchQuery,
    setInvestmentTargets,
    setIsSettingsOpen,
    setPendingCreateRequest,
    setRequestedLedgerViewMode,
    setSettingsInitialTab,
    settings,
    showNotice,
    transactions,
    triggerCrossAccountInviteSync,
    trips,
  } = app;
  return (
    <>
<main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden flex-1 px-3.5 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-8">
          <FaceIdOfferBanner />
          {isLoadingData ? (
            activeTab === 'overview' ? (
              <DashboardSkeleton />
            ) : activeTab === 'transactions' ? (
              <TransactionsSkeleton />
            ) : activeTab === 'cards' ? (
              <CreditCardsSkeleton />
            ) : activeTab === 'budgets' ? (
              <BudgetsSkeleton />
            ) : activeTab === 'reports' ? (
              <ReportsSkeleton />
            ) : (
              <DashboardSkeleton />
            )
          ) : (
            <ErrorBoundary scope="tela" resetKey={activeTab}>
            <Suspense
              fallback={
                activeTab === 'transactions' ? (
                  <TransactionsSkeleton />
                ) : activeTab === 'cards' ? (
                  <CreditCardsSkeleton />
                ) : activeTab === 'budgets' ? (
                  <BudgetsSkeleton />
                ) : activeTab === 'reports' ? (
                  <ReportsSkeleton />
                ) : (
                  <DashboardSkeleton />
                )
              }
            >
              <>
              {activeTab === 'overview' && (
                <OverviewTab
                  selectedMonth={selectedMonth}
                  currentPosition={currentPosition}
                  recurringSuggestions={recurringSuggestions}
                  cashForecast={cashForecast}
                  receivablesSummary={currentReceivables}
                  onScheduleRecurring={handleScheduleRecurring}
                  onDismissRecurring={handleDismissRecurring}
                  userName={
                    settings.userName &&
                    settings.userName !== 'Você' &&
                    settings.userName !== 'Minha Conta'
                      ? settings.userName
                      : effectiveUserDisplayName || undefined
                  }
                  monthlySummary={monthlySummary}
                  accounts={accounts}
                  accountBalances={accountBalances}
                  cards={cards}
                  cardSummaries={cardSummaries}
                  categories={categories}
                  categoryBreakdown={categoryBreakdown}
                  transactions={transactions}
                  investments={investments}
                  showOverviewAlerts={settings.showOverviewAlerts}
                  alertsExpandedByDefault={settings.alertsExpandedByDefault}
                  viewClarityMode={settings.viewClarityMode || 'complete'}
                  onChangeClarityMode={(mode) =>
                    handleUpdateSettings({ viewClarityMode: mode })
                  }
                  onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
                  onToggleAccountInTotal={handleToggleAccountInTotal}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onNavigateTab={handleSelectTab}
                  onNavigateToAccount={handleNavigateToAccount}
                  onNavigateToCard={handleNavigateToCard}
                />
              )}

              {activeTab === 'accounts' && (
                <AccountsTab
                  selectedMonth={selectedMonth}
                  accounts={accounts}
                  accountBalances={accountBalances}
                  categories={categories}
                  transactions={transactions}
                  trips={trips}
                  initialSelectedAccountId={initialSelectedAccountId}
                  autoOpenCreate={pendingCreateRequest === 'account' || pendingCreateRequest === 'international_account'}
                  autoOpenCreateType={pendingCreateRequest === 'international_account' ? 'international' : 'checking'}
                  onAutoOpenHandled={() => setPendingCreateRequest(null)}
                  onToggleAccountInTotal={handleToggleAccountInTotal}
                  onAddAccount={handleAddAccount}
                  onUpdateAccount={handleUpdateAccount}
                  onDeleteAccount={handleDeleteAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onUpdateTrip={handleUpdateTrip}
                  onToggleTransactionStatus={(id) =>
                    handleToggleTransactionStatus(id, 'single')
                  }
                  onEditTransaction={handleEditTransaction}
                  onDuplicateTransaction={handleDuplicateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onOpenReconciliation={handleOpenReconciliation}
                />
              )}

              {activeTab === 'investments' && (
                <InvestmentsTab
                  getAuthToken={() => currentUser?.getIdToken() ?? Promise.resolve('')}
                  selectedMonth={selectedMonth}
                  assets={investments}
                  targetMap={investmentTargets}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  transactions={transactions}
                  monthlyLivingExpense={monthlySummary.expenseTotal}
                  onAddAsset={handleAddInvestmentAsset}
                  onUpdateAsset={handleUpdateInvestmentAsset}
                  onBatchUpdateAssets={handleBatchUpdateInvestmentAssets}
                  onDeleteAsset={handleDeleteInvestmentAsset}
                  onOperateAsset={handleOperateInvestmentAsset}
                  onRecordDividendIncome={handleRecordDividendIncome}
                  onUpdateTargetMap={(nextMap) => {
                    if (!requireWorkspaceWrite()) return;
                    setInvestmentTargets(nextMap);
                    showNotice('Metas estratégicas de alocação salvas.');
                  }}
                />
              )}

              {activeTab === 'transactions' && (
                <TransactionsTab
                  selectedMonth={selectedMonth}
                  transactions={transactions}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  globalSearchQuery={globalSearchQuery}
                  onChangeGlobalSearchQuery={setGlobalSearchQuery}
                  requestedViewMode={requestedLedgerViewMode}
                  onConsumeRequestedViewMode={() => setRequestedLedgerViewMode(null)}
                  onToggleStatus={(id) => handleToggleTransactionStatus(id, 'single')}
                  onBatchSettleTransactions={handleBatchSettleTransactions}
                  onAnticipateInstallments={handleAnticipateInstallments}
                  onReverseAnticipation={handleReverseAnticipation}
                  onEditTransaction={handleEditTransaction}
                  onDuplicateTransaction={handleDuplicateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewTransaction={(mode) => handleOpenNewTransaction(mode)}
                  onOpenReconciliation={handleOpenReconciliation}
                />
              )}

              {activeTab === 'cards' && (
                <CreditCardsTab
                  selectedMonth={selectedMonth}
                  cards={cards}
                  cardSummaries={cardSummaries}
                  accounts={accounts}
                  categories={categories}
                  transactions={transactions}
                  initialSelectedCardId={initialSelectedCardId}
                  autoOpenCreate={pendingCreateRequest === 'card'}
                  onAutoOpenHandled={() => setPendingCreateRequest(null)}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  onPayInvoice={handlePayCardInvoice}
                  onCarryOverInvoice={handleCarryOverInvoice}
                  onUndoInvoiceCarryOver={handleUndoInvoiceCarryOver}
                  onAnticipateInstallments={handleAnticipateInstallments}
                  onReverseAnticipation={handleReverseAnticipation}
                  onAddCard={handleAddCard}
                  onUpdateCard={handleUpdateCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteTransaction={handleDeleteTransaction}
                  onOpenNewCardExpense={() => handleOpenNewTransaction('credit_card')}
                  commitmentLimitPercent={settings.cardCommitmentLimitPercent}
                  commitmentWarnPercent={settings.cardCommitmentWarnPercent}
                  onOpenCommitmentSettings={() => {
                    setSettingsInitialTab('rules');
                    setIsSettingsOpen(true);
                  }}
                />
              )}

              {activeTab === 'receivables' && (
                <ReceivablesTab
                  receivables={receivables}
                  cards={cards}
                  accounts={accounts}
                  familyMembers={familyMembers}
                  transactions={transactions}
                  onCreate={handleCreateReceivable}
                  onRegisterPayment={handleRegisterReceivablePayment}
                  onRemovePayment={handleRemoveReceivablePayment}
                  onDelete={handleDeleteReceivable}
                />
              )}

              {activeTab === 'shared' && (
                <SharedExpensesTab
                  selectedMonth={selectedMonth}
                  transactions={transactions}
                  familyMembers={familyMembers}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  cards={cards}
                  categories={categories}
                  userPixKey={settings.userPixKey}
                  onAddFamilyMember={handleAddFamilyMemberWithInvite}
                  onUpdateFamilyMember={handleUpdateFamilyMember}
                  onDeleteFamilyMember={handleDeleteFamilyMember}
                  onAcceptFamilyInvite={handleAcceptFamilyInvite}
                  onDeclineFamilyInvite={handleDeclineFamilyInvite}
                  onResendFamilyInvite={triggerCrossAccountInviteSync}
                  inviteeHasAccount={inviteeHasAccount}
                  inviteCodes={inviteCodes}
                  onSettleSharedTransaction={handleSettleSharedTransaction}
                  onSettleAllMemberInvoices={handleSettleAllMemberInvoices}
                  onReopenSharedTransaction={handleReopenSharedTransaction}
                  onOpenNewSharedTransaction={() => {
                    handleOpenNewTransaction('expense');
                  }}
                />
              )}

              {activeTab === 'trips' && (
                <TripsTab
                  getAuthToken={() => currentUser?.getIdToken() ?? Promise.resolve('')}
                  trips={trips}
                  transactions={transactions}
                  categories={categories}
                  accounts={accounts}
                  onRequestCreateAccount={handleRequestCreateFromTransaction}
                  familyMembers={familyMembers}
                  privacyMode={settings.privacyMode}
                  onAddTrip={handleAddTrip}
                  onUpdateTrip={handleUpdateTrip}
                  onDeleteTrip={handleDeleteTrip}
                  onAddExchangeLot={handleAddExchangeLot}
                  onDeleteExchangeLot={handleDeleteExchangeLot}
                  onRecordSettlement={handleRecordTripSettlement}
                  onOpenNewTripExpense={(tripId) =>
                    handleOpenNewTransaction('expense', tripId)
                  }
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={(id) => handleDeleteTransaction(id, false)}
                  onAddAccount={handleAddAccount}
                />
              )}

              {activeTab === 'budgets' && (
                <BudgetsTab
                  selectedMonth={selectedMonth}
                  categories={categories}
                  categoryBreakdown={categoryBreakdown}
                  transactions={transactions}
                  onUpdateCategoryBudget={handleUpdateCategoryBudget}
                  onAddCategory={handleAddCategory}
                  onUpdateCategory={handleUpdateCategory}
                  onDeleteCategory={handleDeleteCategory}
                />
              )}

              {activeTab === 'goals' && (
                <GoalsAndSimulatorTab
                  goals={goals}
                  investments={investments}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  onContributeGoal={handleContributeGoal}
                  onAddGoal={handleAddGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsAndDataTab
                  selectedMonth={selectedMonth}
                  currentPosition={currentPosition}
                  receivablesTotal={currentReceivables.totalOpen}
                  accounts={accounts}
                  onRequestCreateAccount={() => handleRequestCreateFromTransaction('account')}
                  accountBalances={accountBalances}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  investments={investments}
                  userName={effectiveUserDisplayName || undefined}
                  userEmail={effectiveUserEmail || undefined}
                  onExportFullBackupJson={handleExportFullBackupJson}
                  onAddAccount={handleAddAccount}
                  onUpdateAccountInitialBalance={handleUpdateAccountInitialBalance}
                  onImportQuickCsvLines={handleImportQuickCsvLines}
                  onOpenReconciliation={handleOpenReconciliation}
                  onApplyHistoricalInstallmentTotals={handleApplyHistoricalInstallmentTotals}
                  onResetWorkspaceData={handleResetWorkspaceData}
                />
              )}

              {activeTab === 'cloud' && (
                <AuthAndCloudTab
                  userEmail={effectiveUserEmail}
                  userDisplayName={effectiveUserDisplayName}
                  isAnonymousUser={!isUserAuthenticated}
                  autoVaultId={autoVaultId}
                  cloudSyncStatus={cloudSyncStatus}
                  lastSyncedAt={lastSyncedAt}
                  settings={settings}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  investments={investments}
                  goals={goals}
                  trips={trips}
                  onSignInEmail={handleSignInEmail}
                  onRegisterEmail={handleRegisterEmail}
                  onSignOut={handleSignOut}
                  onForceCloudSync={handleForceCloudSync}
                  onUpdateSettings={handleUpdateSettings}
                />
              )}
              </>
            </Suspense>
            </ErrorBoundary>
          )}
        </main>
    </>
  );
}
