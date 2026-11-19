/** Login, leitura e gravação do workspace no Neon (revisão, fila, conflito, tempo real, convites) e saída da conta. Parte do App (ver src/App.tsx). */
import { useEffect, useRef } from 'react';
import { auth, getVaultIdForUid, onAuthStateChanged, registerWithEmail, signInWithEmail, signInWithPasskey, signOutUser } from '../lib/authClient';
import { clearWorkspaceCacheForVault, shouldResetWorkspaceForAuthChange } from '../services/workspace/workspaceSession';
import { compactTransactionListForStorage } from '../services/import-export/ofxParser';
import { applyRemoteSettlementReports, collectSharedSettlementReceipts, replaceIncomingSharedTransactions, restoreSharedSettlementReceipts } from '../domain/family/sharedFinanceRules';
import { parsePersistedSettings, removeSmtpPasswordsFromSettings, serializeSettingsWithoutSmtpSecrets } from '../utils/secureSettings';
import { createNeonWorkspace, loadNeonFamilyInvitations, loadNeonSharedSnapshot, loadNeonWorkspace, loadNeonWorkspaceRevision, NeonWorkspaceError, saveNeonWorkspace, syncNeonSharedTransactions } from '../lib/neonWorkspace';
import { isRetryableWorkspaceSaveError, updateWorkspaceConflictLocalPayload, workspaceContentSignature } from '../services/workspace/workspaceSyncRecovery';
import { parseCachedWorkspace } from '../services/workspace/workspaceCache';
import { mergeCategoryCatalog, stripLegacySubcategories, stripLegacyTransactionSubcategory } from '../domain/finance/categoryCatalog';
import { AppSettings, BankAccount, Category, CreditCard, FamilyMember, InvestmentAsset, InvestmentTargetMap, Receivable, SavingsGoal, Transaction, Trip } from '../types/finance';
import { parseWorkspaceArray, parseWorkspaceObject } from '../services/workspace/workspacePayload';
import { INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_CREDIT_CARDS, INITIAL_FAMILY_MEMBERS, INITIAL_INVESTMENTS, INITIAL_SAVINGS_GOALS, INITIAL_TRANSACTIONS, INITIAL_TRIPS } from '../domain/finance/seedData';
import { DEFAULT_INVESTMENT_TARGETS } from '../domain/investments/investmentRules';
import { DEFAULT_SETTINGS, STORAGE_KEY, settingsUserNameFallback, stripLegacyMockItems, stripLegacyMockItemsFromWorkspace } from './appConfig';
import type { AppStateApi } from './useAppState';

export function useWorkspaceSync(app: AppStateApi) {
  const {
    acceptedSharedPartnersRef,
    accounts,
    authenticatedUidRef,
    autoVaultId,
    cards,
    categories,
    cloudSyncStatus,
    currentUser,
    effectiveUserDisplayName,
    effectiveUserEmail,
    familyMembers,
    goals,
    hasLoadedRemoteOnceRef,
    investmentTargets,
    investments,
    isApplyingRemoteSnapshotRef,
    isAuthReady,
    isResolvingWorkspaceConflict,
    isUserAuthenticated,
    knownRemoteSignaturesRef,
    lastConfirmedSignatureRef,
    latestNeonPayloadRef,
    loadedWorkspaceUidRef,
    neonSaveQueueRef,
    neonWorkspaceRevisionRef,
    receivables,
    rememberRemoteSignature,
    requestSilentWorkspaceRefresh,
    requireWorkspaceWrite,
    resetFinancialStateToCleanZero,
    saveRetryCountRef,
    saveRetryPendingRef,
    saveRetryTimerRef,
    saveRetryUidRef,
    scheduleSaveRetryRef,
    scopedStorageKey,
    setAccounts,
    setAuthSession,
    setCards,
    setCategories,
    setCloudSyncStatus,
    setCurrentUser,
    setFamilyMembers,
    setGoals,
    setInvestmentTargets,
    setInvestments,
    setInviteCodes,
    setInviteeHasAccount,
    setIsAuthReady,
    setIsResolvingWorkspaceConflict,
    setIsShowingCachedWorkspace,
    setIsWorkspaceConflictOpen,
    setLastSyncedAt,
    setReceivables,
    setServerSentSharedIds,
    setServerStaleSharedIds,
    setSettings,
    setTransactions,
    setTrips,
    setWorkspaceConflict,
    setWorkspaceConflictError,
    setWorkspaceLoadAttempt,
    setWorkspaceLoadState,
    settings,
    sharedPendingHideRef,
    sharedProjectedRevisionsRef,
    sharedWorkspaceProjectionRef,
    showNotice,
    silentWorkspaceRefreshRef,
    transactions,
    trips,
    workspaceConflictRef,
    workspaceLoadAttempt,
    workspaceLoadState,
  } = app;
  // Auth session listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const previousUid = authenticatedUidRef.current;
      const nextUid = user && !user.isAnonymous && user.email ? user.uid : null;
      if (shouldResetWorkspaceForAuthChange(previousUid, nextUid)) {
        if (previousUid) {
          clearWorkspaceCacheForVault(localStorage, STORAGE_KEY, getVaultIdForUid(previousUid));
          try {
            // Cópia descartada por conflito e avisos dispensados também saem do aparelho ao encerrar a sessão
            localStorage.removeItem(`minhas-economias:descartado:${previousUid}`);
            localStorage.removeItem('minhas-economias:dismissed-notices');
          } catch { /* sem armazenamento local */ }
        }
        resetFinancialStateToCleanZero();
        setSettings(DEFAULT_SETTINGS);
        hasLoadedRemoteOnceRef.current = false;
        loadedWorkspaceUidRef.current = null;
        setWorkspaceLoadState(nextUid ? 'loading' : 'error');
        setIsShowingCachedWorkspace(false);
        setCloudSyncStatus(nextUid ? 'syncing' : 'local');
        setIsResolvingWorkspaceConflict(false);
      }
      authenticatedUidRef.current = nextUid;
      setCurrentUser(user);
      setIsAuthReady(true);
      neonWorkspaceRevisionRef.current = null;
      hasLoadedRemoteOnceRef.current = false;
      workspaceConflictRef.current = null;
      setWorkspaceConflict(null);
      setIsWorkspaceConflictOpen(false);
      setWorkspaceConflictError(null);
      setAuthSession(
        user && !user.isAnonymous && user.email
          ? {
              isLoggedIn: true,
              email: user.email.trim().toLowerCase(),
              displayName: user.displayName || settingsUserNameFallback(user.email) || user.email,
            }
          : { isLoggedIn: false, email: '', displayName: '' }
      );
    });
    return () => unsubscribe();
  }, []);

  // Build the authenticated workspace payload persisted by the Neon API.
  const buildCloudPayload = (targetId: string) => ({
    uid: targetId,
    ...(effectiveUserEmail ? { email: effectiveUserEmail } : {}),
    ...(effectiveUserDisplayName ? { displayName: effectiveUserDisplayName } : {}),
    updatedAt: new Date().toISOString(),
    ...(sharedWorkspaceProjectionRef.current ? { sharedWorkspaceProjection: true } : {}),
    accountsJson: JSON.stringify(accounts),
    cardsJson: JSON.stringify(cards),
    categoriesJson: JSON.stringify(categories),
    transactionsJson: JSON.stringify(
      compactTransactionListForStorage(
        transactions.filter((transaction) => !transaction.id.startsWith('tx-mirror-'))
      )
    ),
    sharedSettlementReceiptsJson: JSON.stringify(collectSharedSettlementReceipts(transactions)),
    goalsJson: JSON.stringify(goals),
    receivablesJson: JSON.stringify(receivables),
    familyMembersJson: JSON.stringify(familyMembers),
    investmentsJson: JSON.stringify(investments),
    investmentTargetsJson: JSON.stringify(investmentTargets),
    tripsJson: JSON.stringify(trips),
    settingsJson: serializeSettingsWithoutSmtpSecrets(settings),
  });

  const syncSavedFamilyWorkspace = (revision: number, partnerEmails: Iterable<string>) => {
    if (!sharedWorkspaceProjectionRef.current || !currentUser || !navigator.onLine) return;
    const uid = currentUser.uid;
    for (const partnerEmail of new Set(partnerEmails)) {
      const key = `${uid}|${partnerEmail}`;
      const revisions = sharedProjectedRevisionsRef.current;
      const pendingHides = sharedPendingHideRef.current.get(key);
      const previous = revisions.get(key);
      const attemptedAt = Date.now();
      if (previous && previous.revision > revision) continue;
      if (previous && previous.revision >= revision && attemptedAt - previous.attemptedAt < 60_000 && !pendingHides?.size) continue;
      const attempt = { revision, attemptedAt };
      revisions.set(key, attempt);
      const deletedSharedIds = pendingHides ? [...pendingHides] : [];
      void syncNeonSharedTransactions({ partnerEmail, workspaceRevision: revision, deletedSharedIds })
        .then(() => {
          if (pendingHides) for (const id of deletedSharedIds) pendingHides.delete(id);
        })
        .catch((error) => {
          if (revisions.get(key) === attempt) revisions.delete(key);
          if (authenticatedUidRef.current === uid && !(error instanceof NeonWorkspaceError && [403, 409].includes(error.status))) {
            console.warn('Não foi possível sincronizar os compartilhados.', error);
          }
        });
    }
  };

  const syncSavedFamilyMembers = (revision: number) => {
    if (!effectiveUserEmail) return;
    const partners = familyMembers
      .filter((member) => member.inviteStatus === 'accepted')
      .map((member) => (member.email || member.invitedByEmail || '').trim().toLowerCase())
      .filter((email) => email && email !== effectiveUserEmail);
    syncSavedFamilyWorkspace(revision, [...partners, ...(acceptedSharedPartnersRef.current.get(effectiveUserEmail) ?? [])]);
  };

  const queueNeonWorkspaceSave = (payload: Record<string, unknown>) => {
    const authenticatedUser = currentUser;
    if (!authenticatedUser?.email) {
      return Promise.reject(new Error('Entre na sua conta para sincronizar com o Neon.'));
    }

    const queuedSave = neonSaveQueueRef.current.then(async () => {
      if (currentUser?.uid !== authenticatedUser.uid) {
        throw new Error('A conta ativa mudou antes de salvar o workspace.');
      }
      if (workspaceConflictRef.current) {
        throw new NeonWorkspaceError(
          'Resolva o conflito entre esta aba e o Neon antes de sincronizar novamente.',
          409
        );
      }

      let revision = neonWorkspaceRevisionRef.current;
      if (revision === null) {
        try {
          const existing = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== authenticatedUser.uid) {
            throw new Error('A conta ativa mudou durante a leitura do workspace.');
          }
          revision = existing.revision;
          neonWorkspaceRevisionRef.current = revision;
        } catch (error) {
          if (!(error instanceof NeonWorkspaceError) || error.status !== 404) {
            throw error;
          }
          try {
            const created = await createNeonWorkspace(payload);
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a criação do workspace.');
            }
            neonWorkspaceRevisionRef.current = created.revision;
            lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
            return;
          } catch (importError) {
            if (
              !(importError instanceof NeonWorkspaceError) ||
              importError.status !== 409
            ) {
              throw importError;
            }
            const existing = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) {
              throw new Error('A conta ativa mudou durante a leitura do workspace.');
            }
            // O que chegou primeiro ao Neon prevalece: adota a versão da nuvem sem perguntar.
            neonWorkspaceRevisionRef.current = existing.revision;
            requestSilentWorkspaceRefresh();
            throw new NeonWorkspaceError(
              'O workspace Neon foi criado em outra aba durante a inicialização.',
              409
            );
          }
        }
      }

      try {
        rememberRemoteSignature(payload);
        const saved = await saveNeonWorkspace(payload, revision);
        if (authenticatedUidRef.current !== authenticatedUser.uid) {
          throw new Error('A conta ativa mudou durante a gravação do workspace.');
        }
        neonWorkspaceRevisionRef.current = saved.revision;
        lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
      } catch (error) {
        if (error instanceof NeonWorkspaceError && error.status === 409) {
          try {
            const remoteSnapshot = await loadNeonWorkspace();
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            if (knownRemoteSignaturesRef.current.includes(workspaceContentSignature(remoteSnapshot.payload))) {
              // O Neon tem um conteúdo que esta aba já conhecia (ex.: resposta de um salvamento anterior se perdeu).
              const resaved = await saveNeonWorkspace(payload, remoteSnapshot.revision);
              if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
              neonWorkspaceRevisionRef.current = resaved.revision;
              lastConfirmedSignatureRef.current = workspaceContentSignature(payload);
              return;
            }
            // Como em um app em tempo real: o que chegou primeiro ao Neon prevalece. Esta aba adota a versão
            // da nuvem; a cópia descartada fica guardada neste aparelho para recuperação.
            try {
              localStorage.setItem(
                `minhas-economias:descartado:${authenticatedUser.uid}`,
                JSON.stringify({ at: new Date().toISOString(), payload })
              );
              localStorage.removeItem(scopedStorageKey);
            } catch {
              // Sem armazenamento local: segue só com a versão da nuvem.
            }
            neonWorkspaceRevisionRef.current = remoteSnapshot.revision;
            requestSilentWorkspaceRefresh();
            return;
          } catch (refreshError) {
            if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
            console.error(
              'Não foi possível carregar a versão atual do Neon para resolver o conflito.',
              refreshError instanceof Error ? refreshError.message : String(refreshError)
            );
            setWorkspaceConflictError(
              'O Neon recusou a revisão, mas não foi possível carregar a versão mais recente. Suas alterações locais foram mantidas; tente sincronizar novamente quando a conexão voltar.'
            );

          }
          if (authenticatedUidRef.current !== authenticatedUser.uid) throw error;
          setCloudSyncStatus('error');
        }
        throw error;
      }
    });

    neonSaveQueueRef.current = queuedSave.then(
      () => undefined,
      () => undefined
    );
    return queuedSave;
  };

  const cancelSaveRetry = (resetAttempts = false) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
      saveRetryTimerRef.current = null;
    }
    saveRetryPendingRef.current = false;
    saveRetryUidRef.current = null;
    if (resetAttempts) saveRetryCountRef.current = 0;
  };

  const persistNeonWorkspacePayload = async (
    payload: Record<string, unknown>,
    showResultNotice = false
  ) => {
    latestNeonPayloadRef.current = payload;
    // Nada mudou desde a última versão confirmada no Neon (ex.: acabou de carregar a versão de outro aparelho):
    // não grava de novo, senão dois aparelhos ficariam trocando revisões sem fim.
    if (
      !showResultNotice &&
      lastConfirmedSignatureRef.current !== null &&
      neonWorkspaceRevisionRef.current !== null &&
      lastConfirmedSignatureRef.current === workspaceContentSignature(payload)
    ) {
      setCloudSyncStatus('synced');
      return;
    }
    const activeConflict = workspaceConflictRef.current;
    if (activeConflict) {
      const updatedConflict = updateWorkspaceConflictLocalPayload(activeConflict, payload);
      workspaceConflictRef.current = updatedConflict;
      setWorkspaceConflict(updatedConflict);
    }
    const authenticatedUid = currentUser?.uid;
    setCloudSyncStatus('syncing');
    try {
      await queueNeonWorkspaceSave(payload);
      if (authenticatedUidRef.current !== authenticatedUid) return;
      cancelSaveRetry(true);
      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString()
      );
      if (showResultNotice) {
        showNotice('Sincronização em nuvem concluída agora!', undefined, true);
      }
    } catch (error) {
      if (authenticatedUidRef.current !== authenticatedUid) return;
      setCloudSyncStatus('error');
      if (error instanceof NeonWorkspaceError && error.status === 401) {
        void expireSessionRef.current();
        return;
      }
      console.error(
        'Falha ao salvar workspace no Neon; alterações locais foram mantidas.',
        error instanceof Error ? error.message : String(error)
      );

      const canRetry =
        isRetryableWorkspaceSaveError(error) &&
        authenticatedUid &&
        !workspaceConflictRef.current;
      if (canRetry) {
        saveRetryPendingRef.current = true;
        saveRetryUidRef.current = authenticatedUid;
        if (saveRetryCountRef.current < 8) {
          const attempt = saveRetryCountRef.current++;
          const delayMs = Math.min(1000 * 2 ** attempt, 30_000);
          scheduleSaveRetryRef.current(delayMs);
        }
      } else {
        cancelSaveRetry();
      }

      if (showResultNotice) {
        showNotice(
          'Não foi possível concluir a sincronização. Seus dados locais foram preservados; tente novamente.',
          undefined,
          true
        );
      }
    }
  };

  scheduleSaveRetryRef.current = (delayMs = 0) => {
    if (saveRetryTimerRef.current !== null) {
      window.clearTimeout(saveRetryTimerRef.current);
    }
    saveRetryTimerRef.current = window.setTimeout(() => {
      saveRetryTimerRef.current = null;
      const latestPayload = latestNeonPayloadRef.current;
      const currentUid = currentUser?.uid;
      if (
        !saveRetryPendingRef.current ||
        !navigator.onLine ||
        !latestPayload ||
        !hasLoadedRemoteOnceRef.current ||
        workspaceConflictRef.current ||
        !currentUid ||
        currentUid !== saveRetryUidRef.current
      ) {
        return;
      }
      saveRetryPendingRef.current = false;
      void persistNeonWorkspacePayload(latestPayload);
    }, delayMs);
  };

  const handleKeepLocalWorkspaceVersion = async () => {
    const conflict = workspaceConflictRef.current;
    const ownerUid = authenticatedUidRef.current;
    if (!conflict || !ownerUid || isResolvingWorkspaceConflict) return;

    setIsResolvingWorkspaceConflict(true);
    setWorkspaceConflictError(null);
    setCloudSyncStatus('syncing');
    const save = neonSaveQueueRef.current.then(async () => {
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a resolução do conflito.');
      }
      const latestConflict = workspaceConflictRef.current;
      if (!latestConflict) return null;
      const saved = await saveNeonWorkspace(
        latestConflict.localPayload,
        latestConflict.remoteSnapshot.revision
      );
      if (authenticatedUidRef.current !== ownerUid) {
        throw new Error('A conta ativa mudou durante a gravação do conflito.');
      }
      neonWorkspaceRevisionRef.current = saved.revision;
      return latestConflict;
    });
    neonSaveQueueRef.current = save.then(
      () => undefined,
      () => undefined
    );

    try {
      const resolvedConflict = await save;
      if (authenticatedUidRef.current !== ownerUid) return;
      if (!resolvedConflict) return;

      setCloudSyncStatus('synced');
      setLastSyncedAt(
        typeof resolvedConflict.localPayload.updatedAt === 'string'
          ? resolvedConflict.localPayload.updatedAt
          : new Date().toISOString()
      );
      workspaceConflictRef.current = null;
      setWorkspaceConflict(null);
      setIsWorkspaceConflictOpen(false);
    } catch (error) {
      if (authenticatedUidRef.current !== ownerUid) return;
      if (error instanceof NeonWorkspaceError && error.status === 409) {
        try {
          const latest = await loadNeonWorkspace();
          if (authenticatedUidRef.current !== ownerUid) return;
          const updatedConflict = {
            ...conflict,
            remoteSnapshot: latest,
          };
          workspaceConflictRef.current = updatedConflict;
          setWorkspaceConflict(updatedConflict);
          setWorkspaceConflictError(
            'O Neon mudou novamente antes de salvar. Baixe uma nova cópia das duas versões e escolha novamente.'
          );
        } catch {
          if (authenticatedUidRef.current !== ownerUid) return;
          setWorkspaceConflictError(
            'O Neon mudou novamente e a versão mais recente não pôde ser carregada. Suas duas versões continuam preservadas; verifique a conexão e tente outra vez.'
          );
        }
      } else {
        setWorkspaceConflictError(
          error instanceof Error
            ? error.message
            : 'Não foi possível salvar sua versão. As alterações locais foram mantidas.'
        );
      }
      setCloudSyncStatus('error');
    } finally {
      if (authenticatedUidRef.current === ownerUid) setIsResolvingWorkspaceConflict(false);
    }
  };

  const handleUseCloudWorkspaceVersion = () => {
    if (!workspaceConflictRef.current || isResolvingWorkspaceConflict) return;
    workspaceConflictRef.current = null;
    setWorkspaceConflict(null);
    setIsWorkspaceConflictOpen(false);
    setCloudSyncStatus('syncing');
    window.location.reload();
  };

  // Neon is the sole financial data store; the own Neon login supplies identity only.
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated || !effectiveUserEmail) return;

    const loadUid = currentUser?.uid;
    if (!loadUid) return;

    const silent = silentWorkspaceRefreshRef.current && hasLoadedRemoteOnceRef.current;
    silentWorkspaceRefreshRef.current = false;
    if (!silent) {
      hasLoadedRemoteOnceRef.current = false;
      loadedWorkspaceUidRef.current = null;
      isApplyingRemoteSnapshotRef.current = true;
      setWorkspaceLoadState('loading');
    }

    // Abre na hora com a última versão salva neste aparelho; o Neon a substitui em silêncio.
    try {
      const cached = silent ? null : parseCachedWorkspace(localStorage.getItem(scopedStorageKey));
      if (cached) {
        setAccounts(cached.accounts);
        setCards(cached.cards);
        setCategories(stripLegacySubcategories(cached.categories));
        setTransactions(stripLegacyTransactionSubcategory(cached.transactions));
        setGoals(cached.goals);
        setReceivables(cached.receivables);
        setFamilyMembers(cached.familyMembers);
        setInvestments(cached.investments);
        setTrips(cached.trips);
        if (cached.investmentTargets) {
          setInvestmentTargets(cached.investmentTargets as InvestmentTargetMap);
        }
        setSettings(parsePersistedSettings(JSON.stringify(cached.settings), DEFAULT_SETTINGS));
        setIsShowingCachedWorkspace(true);
      }
    } catch {
      // Cópia local inválida ou indisponível: segue só com o Neon.
    }

    if (!silent) setCloudSyncStatus('syncing');

    let active = true;
    // Convites e compartilhados não dependem do workspace: busca tudo ao mesmo tempo.
    const extraLoads = Promise.all([
      loadNeonFamilyInvitations().catch(() => []),
      loadNeonSharedSnapshot(),
    ]);
    extraLoads.catch(() => undefined);
    const initialNeonLoad = (async () => {
      try {
        return await loadNeonWorkspace();
      } catch (error) {
        if (!(error instanceof NeonWorkspaceError) || error.status !== 404) {
          throw error;
        }

        if (!active || authenticatedUidRef.current !== loadUid) {
          throw new Error('A conta ativa mudou antes de inicializar o workspace.');
        }

        try {
          await createNeonWorkspace(buildCloudPayload(autoVaultId));
        } catch (createError) {
          if (
            !(createError instanceof NeonWorkspaceError) ||
            createError.status !== 409
          ) {
            throw createError;
          }
        }
        if (!active || authenticatedUidRef.current !== loadUid) {
          throw new Error('A conta ativa mudou durante a inicialização do workspace.');
        }
        return loadNeonWorkspace();
      }
    })();

    void initialNeonLoad
      .then(async (snapshot) => {
        if (!active || authenticatedUidRef.current !== loadUid) return;
        const cleaned = stripLegacyMockItemsFromWorkspace(snapshot.payload);
        const data = cleaned.payload;
        const [familyInvitations, sharedSnapshot] = await extraLoads;
        if (!active || authenticatedUidRef.current !== loadUid) return;
        sharedWorkspaceProjectionRef.current = sharedSnapshot.workspaceProjectionSupported === true;
        rememberInviteeAccounts(familyInvitations);
        if (silent) isApplyingRemoteSnapshotRef.current = true;

        neonWorkspaceRevisionRef.current = snapshot.revision;
        rememberRemoteSignature(snapshot.payload);
        lastConfirmedSignatureRef.current = workspaceContentSignature(snapshot.payload);
        const rawAccounts = parseWorkspaceArray<BankAccount>(data.accountsJson, INITIAL_ACCOUNTS, 'accountsJson');
        const rawCards = parseWorkspaceArray<CreditCard>(data.cardsJson, INITIAL_CREDIT_CARDS, 'cardsJson');
        const parsedCategories = parseWorkspaceArray<Category>(data.categoriesJson, INITIAL_CATEGORIES, 'categoriesJson');
        const nextCategories = parsedCategories.length > 0
          ? [...parsedCategories]
          : [...INITIAL_CATEGORIES];
        for (const coreCategory of INITIAL_CATEGORIES) {
          if (
            (coreCategory.id === 'cat-outros' || coreCategory.id === 'cat-aportes' || coreCategory.id === 'cat-fatura') &&
            !nextCategories.some((category) => category.id === coreCategory.id)
          ) {
            nextCategories.push(coreCategory);
          }
        }

        const rawTransactions = parseWorkspaceArray<Transaction>(data.transactionsJson, INITIAL_TRANSACTIONS, 'transactionsJson');
        const sharedById = new Map<string, Transaction>();
        for (const sharedPayload of sharedSnapshot.transactions) {
          const sharedTransaction = sharedPayload as unknown as Transaction;
          const sharedId = sharedTransaction.sharedSyncId ||
            sharedTransaction.id?.replace(/^tx-mirror-/, '');
          if (sharedId) sharedById.set(sharedId, sharedTransaction);
        }
        const localTransactions = stripLegacyMockItems(rawTransactions)
          .filter((transaction) => !transaction.id.startsWith('tx-mirror-'));

        const familyMembers = stripLegacyMockItems(
          parseWorkspaceArray<FamilyMember>(data.familyMembersJson, INITIAL_FAMILY_MEMBERS, 'familyMembersJson')
        );
        for (const invitation of familyInvitations) {
          const ownerEmail = invitation.owner_email.trim().toLowerCase();
          const invitedEmail = invitation.invited_email.trim().toLowerCase();
          const incoming = invitedEmail === effectiveUserEmail;
          const memberId = incoming
            ? `fam-inv-${ownerEmail.replace(/[^a-z0-9]/g, '_')}`
            : invitation.owner_member_id;
          const index = familyMembers.findIndex((member) =>
            incoming
              ? member.id === memberId ||
                (member.direction === 'incoming' && member.email?.trim().toLowerCase() === ownerEmail)
              : member.id === memberId ||
                (member.direction !== 'incoming' && member.email?.trim().toLowerCase() === invitedEmail)
          );
          if (invitation.status === 'declined' || invitation.status === 'revoked') {
            if (!incoming) {
              const ownerMember = familyMembers.find(
                (member) => member.email?.trim().toLowerCase() === invitedEmail
              );
              if (ownerMember) {
                ownerMember.inviteStatus = 'none';
                ownerMember.invitationId = invitation.invitation_id;
              }
            }
            continue;
          }
          const member: FamilyMember = incoming
            ? {
                id: memberId,
                name: invitation.owner_name || ownerEmail.split('@')[0],
                relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                color: invitation.color || '#6366f1',
                email: ownerEmail,
                inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                invitedByEmail: ownerEmail,
                invitedByName: invitation.owner_name,
                direction: 'incoming',
                pixKey: invitation.owner_pix_key || undefined,
                invitationId: invitation.invitation_id,
              }
            : {
                id: memberId,
                name: invitation.owner_name || invitedEmail.split('@')[0],
                relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                color: invitation.color || '#6366f1',
                email: invitedEmail,
                inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                direction: 'outgoing',
                invitationId: invitation.invitation_id,
              };
          if (index >= 0) {
            familyMembers[index] = {
              ...familyMembers[index],
              ...member,
              name: familyMembers[index].name || member.name,
            };
          }
          else familyMembers.push(member);
        }

        setAccounts(stripLegacyMockItems(rawAccounts));
        setCards(stripLegacyMockItems(rawCards));
        const loadedSettings = parsePersistedSettings(data.settingsJson, DEFAULT_SETTINGS);
        const catalog = mergeCategoryCatalog(nextCategories, loadedSettings.categoryCatalogVersion);
        setCategories(catalog.categories);
        setTransactions(stripLegacyTransactionSubcategory([...applyRemoteSettlementReports(localTransactions, sharedSnapshot.outgoingSettlements),
          ...restoreSharedSettlementReceipts([...sharedById.values()], data.sharedSettlementReceiptsJson, localTransactions)]));
        setGoals(stripLegacyMockItems(parseWorkspaceArray<SavingsGoal>(data.goalsJson, INITIAL_SAVINGS_GOALS, 'goalsJson')));
        setReceivables(parseWorkspaceArray<Receivable>(data.receivablesJson, [], 'receivablesJson'));
        setFamilyMembers(familyMembers);
        setServerSentSharedIds(sharedSnapshot.outgoingSharedIds ? new Set(sharedSnapshot.outgoingSharedIds) : null);
        setServerStaleSharedIds(new Set(sharedSnapshot.outgoingSharedStaleIds ?? []));
        setInvestments(stripLegacyMockItems(parseWorkspaceArray<InvestmentAsset>(data.investmentsJson, INITIAL_INVESTMENTS, 'investmentsJson')));
        setTrips(stripLegacyMockItems(parseWorkspaceArray<Trip>(data.tripsJson, INITIAL_TRIPS, 'tripsJson')));
        setInvestmentTargets(parseWorkspaceObject(data.investmentTargetsJson, DEFAULT_INVESTMENT_TARGETS, 'investmentTargetsJson'));
        setSettings({ ...loadedSettings, categoryCatalogVersion: catalog.version });
        hasLoadedRemoteOnceRef.current = true;
        loadedWorkspaceUidRef.current = loadUid;
        isApplyingRemoteSnapshotRef.current = false;
        setIsShowingCachedWorkspace(false);
        setWorkspaceLoadState('ready');
        syncSavedFamilyMembers(snapshot.revision);
        setCloudSyncStatus('synced');
        setLastSyncedAt(
          typeof data.updatedAt === 'string'
            ? data.updatedAt
            : new Date().toISOString()
        );
      })
      .catch((error) => {
        if (!active || authenticatedUidRef.current !== loadUid) return;
        isApplyingRemoteSnapshotRef.current = false;
        if (silent) return; // falha na atualização em segundo plano: continua com o que está na tela
        setWorkspaceLoadState('error');
        setCloudSyncStatus('error');
        console.error(
          'Falha ao carregar o workspace principal do Neon.',
          error instanceof Error ? error.message : String(error)
        );
        showNotice(
          'Não foi possível carregar os dados do Neon. Seus dados remotos foram preservados; confira a conexão e o status da nuvem antes de continuar.',
          undefined,
          true
        );
      });
    return () => {
      active = false;
    };
  }, [isAuthReady, isUserAuthenticated, effectiveUserEmail, currentUser?.uid, autoVaultId, workspaceLoadAttempt]);

  useEffect(() => {
    if (workspaceLoadState !== 'error') return;
    const retryWhenOnline = () => setWorkspaceLoadAttempt((attempt) => attempt + 1);
    window.addEventListener('online', retryWhenOnline);
    return () => window.removeEventListener('online', retryWhenOnline);
  }, [workspaceLoadState]);

  useEffect(() => {
    cancelSaveRetry(true);
    latestNeonPayloadRef.current = null;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    const retryAfterReconnect = () => {
      if (saveRetryPendingRef.current && !workspaceConflictRef.current) {
        scheduleSaveRetryRef.current(0);
      }
    };
    window.addEventListener('online', retryAfterReconnect);
    return () => window.removeEventListener('online', retryAfterReconnect);
  }, [isAuthReady, isUserAuthenticated]);

  // Depois que o app abriu, baixa em segundo plano as telas e janelas mais usadas (uma por vez, quando o
  // navegador está ocioso), para que o primeiro clique não espere o download nem trave a tela.
  useEffect(() => {
    if (workspaceLoadState !== 'ready') return;
    const loaders: Array<() => Promise<unknown>> = [
      () => import('../components/transactions/TransactionModal'),
      () => import('../components/layout/GlobalSearchPanel'),
      () => import('../components/transactions/TransactionsTab'),
      () => import('../components/overview/ReminderCenterModal'),
      () => import('../components/settings/SettingsModal'),
      () => import('../components/cards/CreditCardsTab'),
      () => import('../components/accounts/AccountsTab'),
      () => import('../components/budgets/BudgetsTab'),
      () => import('../components/family/SharedExpensesTab'),
      () => import('../components/trips/TripsTab'),
      () => import('../components/budgets/GoalsAndSimulatorTab'),
      () => import('../components/investments/InvestmentsTab'),
    ];
    let cancelled = false;
    let index = 0;
    const idle = (callback: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
      if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(callback, { timeout: 4000 });
      else window.setTimeout(callback, 800);
    };
    const next = () => {
      if (cancelled || index >= loaders.length) return;
      const load = loaders[index++];
      void load().catch(() => undefined).finally(() => idle(next));
    };
    // O formulário de lançamento é o mais usado: começa a baixar já; o resto espera o navegador ficar ocioso
    const start = window.setTimeout(() => next(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [workspaceLoadState]);

  // Ao encostar/tocar no botão de novo lançamento, garante o formulário já carregado antes do clique terminar
  useEffect(() => {
    const preload = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-testid="new-transaction-btn"], [aria-label="Novo lançamento"]')) {
        void import('../components/transactions/TransactionModal').catch(() => undefined);
      }
    };
    document.addEventListener('pointerover', preload, true);
    document.addEventListener('touchstart', preload, { capture: true, passive: true });
    document.addEventListener('pointerdown', preload, true);
    return () => {
      document.removeEventListener('pointerover', preload, true);
      document.removeEventListener('touchstart', preload, true);
      document.removeEventListener('pointerdown', preload, true);
    };
  }, []);

  // Tempo real: a cada poucos segundos (e ao voltar ao app) confere a revisão no Neon e, se outro aparelho
  // gravou, recarrega os dados no lugar, sem recarregar a página. Também reenvia o que ficou sem salvar.
  const cloudSyncStatusRef = useRef(cloudSyncStatus);
  cloudSyncStatusRef.current = cloudSyncStatus;
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated) return;
    let checking = false;
    const check = async () => {
      if (document.hidden || checking || !navigator.onLine || !hasLoadedRemoteOnceRef.current) return;
      if (workspaceConflictRef.current) return;
      checking = true;
      const uid = authenticatedUidRef.current;
      try {
        if (cloudSyncStatusRef.current === 'error' && latestNeonPayloadRef.current) {
          void persistNeonWorkspacePayload(latestNeonPayloadRef.current);
          return;
        }
        if (cloudSyncStatusRef.current !== 'synced') return;
        await neonSaveQueueRef.current;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        const remoteRevision = await loadNeonWorkspaceRevision();
        if (authenticatedUidRef.current !== uid || workspaceConflictRef.current) return;
        const known = neonWorkspaceRevisionRef.current;
        if (remoteRevision === null || known === null || remoteRevision <= known) return;
        if (cloudSyncStatusRef.current !== 'synced' || saveRetryPendingRef.current) return;
        requestSilentWorkspaceRefresh();
      } catch (error) {
        // Sessão recusada: volta ao login; sem rede ou erro passageiro: tenta de novo no próximo ciclo.
        if (error instanceof NeonWorkspaceError && error.status === 401) void expireSessionRef.current();
      } finally {
        checking = false;
      }
    };
    const onVisible = () => void check();
    // Com o app parado (sem toque há mais de 1 min) consulta menos vezes: poupa o servidor e a bateria
    let lastActivityAt = Date.now();
    let idleTicks = 0;
    const markActivity = () => { lastActivityAt = Date.now(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach((name) => document.addEventListener(name, markActivity, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const poll = window.setInterval(() => {
      if (Date.now() - lastActivityAt > 60_000) {
        idleTicks += 1;
        if (idleTicks % 5 !== 0) return;
      } else {
        idleTicks = 0;
      }
      void check();
    }, 4_000);
    return () => {
      ['pointerdown', 'keydown', 'touchstart'].forEach((name) => document.removeEventListener(name, markActivity, true));
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthReady, isUserAuthenticated]);

  // Poll Neon for family invitations and incoming shared expenses while the app is open.
  useEffect(() => {
    if (!isAuthReady || !isUserAuthenticated || !effectiveUserEmail) return;
    let active = true;
    const refreshFamilyData = async () => {
      if (!hasLoadedRemoteOnceRef.current || !navigator.onLine) return;
      try {
        const [invitations, sharedSnapshot] = await Promise.all([
          loadNeonFamilyInvitations(),
          loadNeonSharedSnapshot(),
        ]);
        if (!active) return;
        sharedWorkspaceProjectionRef.current = sharedSnapshot.workspaceProjectionSupported === true;
        rememberInviteeAccounts(invitations);
        const revision = neonWorkspaceRevisionRef.current;
        if (revision !== null) syncSavedFamilyWorkspace(revision, acceptedSharedPartnersRef.current.get(effectiveUserEmail) ?? []);
        setFamilyMembers((previous) => {
          const next = [...previous];
          for (const invitation of invitations) {
            const ownerEmail = invitation.owner_email.trim().toLowerCase();
            const invitedEmail = invitation.invited_email.trim().toLowerCase();
            const incoming = invitedEmail === effectiveUserEmail;
            const memberId = incoming
              ? `fam-inv-${ownerEmail.replace(/[^a-z0-9]/g, '_')}`
              : invitation.owner_member_id;
            const declined = invitation.status === 'declined' || invitation.status === 'revoked';
            const index = next.findIndex((member) =>
              incoming
                ? member.direction === 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === ownerEmail)
                : member.direction !== 'incoming' &&
                  (member.id === memberId || member.email?.trim().toLowerCase() === invitedEmail)
            );
            if (declined) {
              if (incoming && index >= 0) next.splice(index, 1);
              else if (index >= 0) next[index] = { ...next[index], inviteStatus: 'none' };
              continue;
            }
            const member: FamilyMember = incoming
              ? {
                  id: memberId,
                  name: invitation.owner_name || ownerEmail.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: ownerEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  invitedByEmail: ownerEmail,
                  invitedByName: invitation.owner_name,
                  direction: 'incoming',
                  pixKey: invitation.owner_pix_key || undefined,
                  invitationId: invitation.invitation_id,
                }
              : {
                  id: memberId,
                  name: invitation.invited_email.split('@')[0],
                  relationship: (invitation.relationship as FamilyMember['relationship']) || 'outro',
                  color: invitation.color || '#6366f1',
                  email: invitedEmail,
                  inviteStatus: invitation.status === 'accepted' ? 'accepted' : 'invited',
                  direction: 'outgoing',
                  invitationId: invitation.invitation_id,
                };
            if (index >= 0) {
              next[index] = { ...next[index], ...member, name: next[index].name || member.name };
            } else {
              next.push(member);
            }
          }
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        setTransactions((previous) => {
          const next = replaceIncomingSharedTransactions(applyRemoteSettlementReports(previous, sharedSnapshot.outgoingSettlements), sharedSnapshot.transactions as unknown as Transaction[]);
          return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
        });
        const staleIds = sharedSnapshot.outgoingSharedStaleIds ?? [];
        setServerStaleSharedIds((previous) =>
          previous.size === staleIds.length && staleIds.every((id) => previous.has(id)) ? previous : new Set(staleIds));
        const sentIds = sharedSnapshot.outgoingSharedIds;
        if (sentIds) {
          setServerSentSharedIds((previous) =>
            previous && previous.size === sentIds.length && sentIds.every((id) => previous.has(id))
              ? previous
              : new Set(sentIds));
        }
      } catch (error) {
        if (active) {
          console.warn(
            'A atualização periódica dos dados familiares falhou.',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    };
    const timer = window.setInterval(() => void refreshFamilyData(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthReady, isUserAuthenticated, effectiveUserEmail]);

  // Guarda a última versão neste aparelho (só depois de ler o Neon) e persiste o workspace no Neon.
  useEffect(() => {
    if (!effectiveUserEmail) return;
    if (hasLoadedRemoteOnceRef.current) {
      try {
        localStorage.setItem(
          scopedStorageKey,
          JSON.stringify({
            accounts,
            cards,
            categories,
            transactions,
            goals,
            receivables,
            familyMembers,
            investments,
            investmentTargets,
            trips,
            settings: removeSmtpPasswordsFromSettings(settings),
          })
        );
      } catch {
        // Sem espaço ou sem armazenamento local: o Neon continua sendo a fonte.
      }
    }

    if (
      isAuthReady &&
      hasLoadedRemoteOnceRef.current &&
      !isApplyingRemoteSnapshotRef.current
    ) {
      const docId = autoVaultId;
      cancelSaveRetry(true);
      const timer = setTimeout(() => {
        const payload = buildCloudPayload(docId);
        void persistNeonWorkspacePayload(payload);
      }, 420);
      return () => clearTimeout(timer);
    }
  }, [
    isAuthReady,
    effectiveUserEmail,
    autoVaultId,
    scopedStorageKey,
    accounts,
    cards,
    categories,
    transactions,
    goals,
    receivables,
    familyMembers,
    investments,
    investmentTargets,
    trips,
    settings,
  ]);

  const handleForceCloudSync = async () => {
    const docId = autoVaultId;
    await persistNeonWorkspacePayload(buildCloudPayload(docId), true);
  };

  const completeSignIn = (user: Awaited<ReturnType<typeof signInWithEmail>>, cleanEmail: string) => {
    if (cleanEmail !== effectiveUserEmail) {
      resetFinancialStateToCleanZero();
      hasLoadedRemoteOnceRef.current = false;
    }
    const displayName = user.displayName || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    setSettings((prev) => ({ ...prev, userName: displayName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName,
    });
    showNotice(
      `Bem-vindo de volta, ${displayName}!`,
      undefined,
      true
    );
  };

  const handleSignInEmail = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const user = await signInWithEmail(cleanEmail, pass);
    completeSignIn(user, cleanEmail);
  };

  const handleSignInPasskey = async () => {
    const user = await signInWithPasskey();
    completeSignIn(user, user.email.trim().toLowerCase());
  };

  const handleRegisterEmail = async (name: string, email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || settingsUserNameFallback(cleanEmail) || cleanEmail.split('@')[0];
    await registerWithEmail(cleanName, cleanEmail, pass);
    resetFinancialStateToCleanZero();
    hasLoadedRemoteOnceRef.current = false;
    setSettings((prev) => ({ ...prev, userName: cleanName }));
    setAuthSession({
      isLoggedIn: true,
      email: cleanEmail,
      displayName: cleanName,
    });
    showNotice(`Conta criada para ${cleanEmail}.`, undefined, true);
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    resetFinancialStateToCleanZero();
    setSettings(DEFAULT_SETTINGS);
    setAuthSession({
      isLoggedIn: false,
      email: '',
      displayName: '',
    });
    showNotice(
      'Você saiu da sua conta. Faça login novamente quando desejar.',
      undefined,
      true
    );
  };

  // O servidor recusou a sessão (expirou ou foi encerrada em outro aparelho): volta ao login em vez de ficar
  // trabalhando sem conseguir salvar.
  const sessionExpiredRef = useRef(false);
  const expireSession = async () => {
    if (sessionExpiredRef.current) return;
    sessionExpiredRef.current = true;
    try {
      await signOutUser();
    } catch {
      // Ignore
    }
    hasLoadedRemoteOnceRef.current = false;
    loadedWorkspaceUidRef.current = null;
    resetFinancialStateToCleanZero();
    setSettings(DEFAULT_SETTINGS);
    setAuthSession({ isLoggedIn: false, email: '', displayName: '' });
    showNotice('Sua sessão expirou. Entre novamente para continuar.', undefined, true);
    window.setTimeout(() => { sessionExpiredRef.current = false; }, 5000);
  };
  const expireSessionRef = useRef(expireSession);
  expireSessionRef.current = expireSession;

  const handleUpdateSettings = (partial: Partial<AppSettings>) => {
    if (!requireWorkspaceWrite()) return;
    setSettings((prev) => ({ ...prev, ...partial }));
  };
  const rememberInviteeAccounts = (invitations: Array<{ owner_email: string; invited_email: string; status: string; invited_has_account?: boolean; invite_code?: string }>) => {
    const accounts: Record<string, boolean> = {};
    const codes: Record<string, string> = {};
    const acceptedPartners: string[] = [];
    for (const invitation of invitations) {
      const owner = invitation.owner_email.trim().toLowerCase();
      const email = invitation.invited_email.trim().toLowerCase();
      if (invitation.status === 'accepted') {
        acceptedPartners.push(owner === effectiveUserEmail ? email : owner);
      }
      if (invitation.status !== 'invited') continue;
      if (typeof invitation.invited_has_account === 'boolean') accounts[email] = invitation.invited_has_account;
      if (typeof invitation.invite_code === 'string') codes[email] = invitation.invite_code;
    }
    if (effectiveUserEmail) acceptedSharedPartnersRef.current.set(effectiveUserEmail, acceptedPartners);
    setInviteeHasAccount((previous) => JSON.stringify(previous) === JSON.stringify(accounts) ? previous : accounts);
    setInviteCodes((previous) => JSON.stringify(previous) === JSON.stringify(codes) ? previous : codes);
  };

  return {
    handleForceCloudSync,
    handleKeepLocalWorkspaceVersion,
    handleRegisterEmail,
    handleSignInEmail,
    handleSignInPasskey,
    handleSignOut,
    handleUpdateSettings,
    handleUseCloudWorkspaceVersion,
    syncSavedFamilyWorkspace,
  };
}

export type WorkspaceSyncApi = ReturnType<typeof useWorkspaceSync>;
