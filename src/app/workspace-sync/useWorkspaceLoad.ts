/** Primeira leitura do workspace no Neon e aplicação no estado. Parte de useWorkspaceSync (ver useWorkspaceSync.ts). */
import { useEffect } from 'react';
import { parseCachedWorkspace } from '../../services/workspace/workspaceCache';
import { mergeCategoryCatalog, stripLegacySubcategories, stripLegacyTransactionSubcategory } from '../../domain/finance/categoryCatalog';
import { BankAccount, Category, CreditCard, FamilyMember, InvestmentAsset, InvestmentTargetMap, Receivable, SavingsGoal, Transaction, Trip } from '../../types/finance';
import { parsePersistedSettings } from '../../utils/secureSettings';
import { DEFAULT_SETTINGS, stripLegacyMockItems, stripLegacyMockItemsFromWorkspace } from '../appConfig';
import { NeonWorkspaceError, createNeonWorkspace, loadNeonFamilyInvitations, loadNeonSharedSnapshot, loadNeonWorkspace } from '../../lib/neonWorkspace';
import { workspaceContentSignature } from '../../services/workspace/workspaceSyncRecovery';
import { parseWorkspaceArray, parseWorkspaceObject } from '../../services/workspace/workspacePayload';
import { INITIAL_ACCOUNTS, INITIAL_CATEGORIES, INITIAL_CREDIT_CARDS, INITIAL_FAMILY_MEMBERS, INITIAL_INVESTMENTS, INITIAL_SAVINGS_GOALS, INITIAL_TRANSACTIONS, INITIAL_TRIPS } from '../../domain/finance/seedData';
import { applyRemoteSettlementReports, restoreSharedSettlementReceipts } from '../../domain/family/sharedFinanceRules';
import { DEFAULT_INVESTMENT_TARGETS } from '../../domain/investments/investmentRules';
import type { AppStateApi } from '../useAppState';
import type { SessionHelpersApi } from './useSessionHelpers';
import type { WorkspaceSavingApi } from './useWorkspaceSaving';

export function useWorkspaceLoad(ctx: AppStateApi & SessionHelpersApi & WorkspaceSavingApi) {
  const {
    authenticatedUidRef,
    autoVaultId,
    buildCloudPayload,
    currentUser,
    effectiveUserEmail,
    hasLoadedRemoteOnceRef,
    isApplyingRemoteSnapshotRef,
    isAuthReady,
    isUserAuthenticated,
    lastConfirmedSignatureRef,
    loadedWorkspaceUidRef,
    neonWorkspaceRevisionRef,
    rememberInviteeAccounts,
    rememberRemoteSignature,
    scopedStorageKey,
    setAccounts,
    setCards,
    setCategories,
    setCloudSyncStatus,
    setFamilyMembers,
    setGoals,
    setInvestmentTargets,
    setInvestments,
    setIsShowingCachedWorkspace,
    setLastSyncedAt,
    setReceivables,
    setServerSentSharedIds,
    setServerStaleSharedIds,
    setSettings,
    setTransactions,
    setTrips,
    setWorkspaceLoadState,
    sharedWorkspaceProjectionRef,
    showNotice,
    silentWorkspaceRefreshRef,
    syncSavedFamilyMembers,
    workspaceLoadAttempt,
  } = ctx;
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

  return {

  };
}

export type WorkspaceLoadApi = ReturnType<typeof useWorkspaceLoad>;
