/** Janelas: lançamento, configurações, lembretes, conciliação e conflito de versões. Parte da tela do App (ver src/App.tsx). */
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { Suspense } from 'react';
import { BankReconciliationModal, ReminderCenterModal, SettingsModal, TransactionModal, WorkspaceConflictModal } from './lazyScreens';
import type { AppContext } from './appContext';

export function AppModals({ app }: { app: AppContext }) {
  const {
    accounts,
    appNotices,
    cards,
    categories,
    dailyReminders,
    editingTransaction,
    effectiveUserEmail,
    familyMembers,
    handleAcceptFamilyInvite,
    handleAddAccount,
    handleAddCategory,
    handleAddFamilyMember,
    handleCommitReconciliationBatch,
    handleDeclineFamilyInvite,
    handleDeleteCategory,
    handleDismissNotice,
    handleExportFullBackupJson,
    handleImportFullBackupJson,
    handleKeepLocalWorkspaceVersion,
    handleMarkTransactionPaid,
    handleNavigateToCard,
    handleNoticeAction,
    handleRequestCreateFromTransaction,
    handleResetWorkspaceData,
    handleSaveTransactionBatch,
    handleSelectTab,
    handleSignOut,
    handleUpdateCategoryBudget,
    handleUpdateSettings,
    handleUseCloudWorkspaceVersion,
    incomingFamilyInvites,
    investments,
    isModalOpen,
    isReconciliationModalOpen,
    isReminderModalOpen,
    isResolvingWorkspaceConflict,
    isSettingsOpen,
    isUserAuthenticated,
    isWorkspaceConflictOpen,
    isWorkspaceReadyForCurrentUser,
    modalDefaultMode,
    modalInitialDate,
    modalInitialTripId,
    reconciliationTargetAccountId,
    selectedMonth,
    setEditingTransaction,
    setIsModalOpen,
    setIsReconciliationModalOpen,
    setIsReminderModalOpen,
    setIsSettingsOpen,
    setIsWorkspaceConflictOpen,
    setModalInitialDate,
    setModalInitialTripId,
    setSettingsInitialTab,
    settings,
    settingsInitialTab,
    transactions,
    trips,
    workspaceConflict,
    workspaceConflictError,
  } = app;
  return (
    <>
<ErrorBoundary
        scope="janela"
        resetKey={`${isModalOpen}-${isSettingsOpen}-${isReminderModalOpen}-${isReconciliationModalOpen}`}
        onError={() => {
          // Uma janela que não consegue abrir é fechada, para o resto do app continuar normal
          setIsModalOpen(false);
          setIsSettingsOpen(false);
          setIsReminderModalOpen(false);
          setIsReconciliationModalOpen(false);
        }}
      >
      <Suspense
        fallback={
          // Resposta imediata ao clique enquanto o formulário carrega (nunca fica "parado")
          <div
            role="status"
            aria-label="Abrindo formulário"
            // Tocar fora cancela a abertura (nunca fica preso esperando)
            onClick={() => { setIsModalOpen(false); setIsSettingsOpen(false); setIsReminderModalOpen(false); setIsReconciliationModalOpen(false); }}
            className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white border-r-transparent" />
          </div>
        }
      >
        {/* New / Edit Transaction Modal */}
        {isModalOpen && <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          setModalInitialTripId(undefined);
          setModalInitialDate(undefined);
        }}
        onSaveBatch={handleSaveTransactionBatch}
        accounts={accounts}
        cards={cards}
        categories={categories}
        transactions={transactions}
        familyMembers={familyMembers}
        onAddFamilyMember={handleAddFamilyMember}
        investments={investments}
        trips={trips}
        selectedMonth={selectedMonth}
        editingTransaction={editingTransaction}
        defaultMode={modalDefaultMode}
        initialDate={modalInitialDate}
        initialTripId={modalInitialTripId}
        onRequestCreate={handleRequestCreateFromTransaction}
        budgetWarningPercent={settings.budgetWarningPercent}
        categorySharingRules={settings.categorySharingRules}
        workspaceReady={isWorkspaceReadyForCurrentUser}
        />}

        {/* Settings & Preferences Modal */}
        {isSettingsOpen && <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        settings={settings}
        categories={categories}
        familyMembers={familyMembers}
        userEmail={effectiveUserEmail}
        isUserLoggedIn={isUserAuthenticated}
        onUpdateSettings={handleUpdateSettings}
        onAddCategory={handleAddCategory}
        onUpdateCategoryBudget={handleUpdateCategoryBudget}
        onDeleteCategory={handleDeleteCategory}
        onOpenCloudTab={() => handleSelectTab('cloud')}
        onSignOut={handleSignOut}
        onExportFullBackupJson={handleExportFullBackupJson}
        onImportFullBackupJson={handleImportFullBackupJson}
        onResetWorkspaceData={handleResetWorkspaceData}
        />}

        {/* Daily Reminders & Scheduled Notifications Modal */}
        {isReminderModalOpen && <ReminderCenterModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        reminders={dailyReminders}
        familyInvites={incomingFamilyInvites}
        notices={appNotices}
        onNoticeAction={handleNoticeAction}
        onDismissNotice={handleDismissNotice}
        onAcceptFamilyInvite={handleAcceptFamilyInvite}
        onDeclineFamilyInvite={handleDeclineFamilyInvite}
        onPayCardInvoice={(cardId) => {
          handleNavigateToCard(cardId);
        }}
        onMarkTransactionPaid={handleMarkTransactionPaid}
        onOpenSettingsTab={(tab) => {
          setSettingsInitialTab(tab as any);
          setIsSettingsOpen(true);
        }}
        />}

        {/* Bank Reconciliation & Smart OFX/CSV Import Modal */}
        {isReconciliationModalOpen && <BankReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        accounts={accounts}
        cards={cards}
        categories={categories}
        existingTransactions={transactions}
        familyMembers={familyMembers}
        defaultAccountId={reconciliationTargetAccountId}
        onCommitImport={handleCommitReconciliationBatch}
        onAddAccount={handleAddAccount}
        />}

        {workspaceConflict && (
        <WorkspaceConflictModal
          conflict={workspaceConflict}
          isOpen={isWorkspaceConflictOpen}
          isSaving={isResolvingWorkspaceConflict}
          errorMessage={workspaceConflictError}
          onDismiss={() => {
            if (!isResolvingWorkspaceConflict) setIsWorkspaceConflictOpen(false);
          }}
          onKeepLocal={handleKeepLocalWorkspaceVersion}
          onUseCloud={handleUseCloudWorkspaceVersion}
        />
        )}
      </Suspense>
      </ErrorBoundary>
    </>
  );
}
