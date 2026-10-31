import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const AUTO_VAULT_STORAGE_KEY = 'minhas_economias_cloud_vault_id_v2';

export function getOrCreateAutoCloudVaultId(): string {
  try {
    const existing = localStorage.getItem(AUTO_VAULT_STORAGE_KEY);
    if (existing && existing.length >= 16) {
      return existing;
    }
    const randomPart =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}${Math.random()
            .toString(36)
            .slice(2, 12)}`;
    const newVaultId = `vault_${randomPart.slice(0, 28)}`;
    localStorage.setItem(AUTO_VAULT_STORAGE_KEY, newVaultId);
    return newVaultId;
  } catch {
    return 'vault_default_session_br_01';
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Sync Notice: ', JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export async function signInWithGooglePopup(): Promise<User | null> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  if (displayName.trim()) {
    await updateProfile(result.user, { displayName: displayName.trim() });
  }
  return result.user;
}

export async function tryAutoAnonymousSignIn(): Promise<User | null> {
  try {
    if (auth.currentUser) return auth.currentUser;
    const res = await signInAnonymously(auth);
    return res.user;
  } catch {
    return null;
  }
}

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export function getVaultIdForEmail(email: string | null | undefined): string {
  if (!email || !email.trim()) {
    return getOrCreateAutoCloudVaultId();
  }
  const cleanSlug = email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const candidate = `vault_usr_${cleanSlug}`;
  const padded =
    candidate.length < 18 ? `${candidate}_cloud_vault_br` : candidate;
  return padded.slice(0, 60);
}

export async function sendCrossAccountFamilyInvite(params: {
  inviterEmail: string;
  inviterName: string;
  inviterPixKey?: string;
  invitedEmail: string;
  relationship: string;
  color: string;
  defaultCategoriesJson: string;
  defaultInvestmentTargetsJson: string;
}): Promise<boolean> {
  const cleanInviterEmail = params.inviterEmail.trim().toLowerCase();
  const cleanInvitedEmail = params.invitedEmail.trim().toLowerCase();
  if (
    !cleanInviterEmail ||
    !cleanInvitedEmail ||
    cleanInviterEmail === cleanInvitedEmail
  ) {
    return false;
  }

  const targetVaultId = getVaultIdForEmail(cleanInvitedEmail);
  const targetRef = doc(db, 'cloud_vaults', targetVaultId);
  const inviterSlug = cleanInviterEmail.replace(/[^a-z0-9]/g, '_');
  const incomingId = `fam-inv-${inviterSlug}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  const incomingMemberRecord = {
    id: incomingId,
    name: params.inviterName.trim() || cleanInviterEmail.split('@')[0],
    email: cleanInviterEmail,
    relationship: params.relationship || 'outro',
    color: params.color || '#6366f1',
    pixKey: params.inviterPixKey?.trim() || undefined,
    inviteStatus: 'invited',
    invitedAt: todayStr,
    invitedByEmail: cleanInviterEmail,
    invitedByName: params.inviterName.trim() || cleanInviterEmail.split('@')[0],
    direction: 'incoming',
    notes: `Convite familiar enviado por ${params.inviterName.trim() || cleanInviterEmail} (${cleanInviterEmail})`,
  };

  try {
    const snap = await getDoc(targetRef);
    const nowIso = new Date().toISOString();

    if (snap.exists()) {
      const data = snap.data();
      let existingMembers: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(data.familyMembersJson || '[]');
        if (Array.isArray(parsed)) existingMembers = parsed;
      } catch {
        existingMembers = [];
      }

      const existingIdx = existingMembers.findIndex(
        (m) =>
          String(m.email || '').toLowerCase() === cleanInviterEmail ||
          m.id === incomingId
      );

      if (existingIdx >= 0) {
        const currentStatus = existingMembers[existingIdx].inviteStatus;
        existingMembers[existingIdx] = {
          ...existingMembers[existingIdx],
          ...incomingMemberRecord,
          inviteStatus: currentStatus === 'accepted' ? 'accepted' : 'invited',
        };
      } else {
        existingMembers.unshift(incomingMemberRecord);
      }

      await setDoc(targetRef, {
        uid: targetVaultId,
        email: cleanInvitedEmail,
        updatedAt: nowIso,
        accountsJson: data.accountsJson || '[]',
        cardsJson: data.cardsJson || '[]',
        categoriesJson: data.categoriesJson || params.defaultCategoriesJson,
        transactionsJson: data.transactionsJson || '[]',
        goalsJson: data.goalsJson || '[]',
        familyMembersJson: JSON.stringify(existingMembers),
        investmentsJson: data.investmentsJson || '[]',
        investmentTargetsJson:
          data.investmentTargetsJson || params.defaultInvestmentTargetsJson,
        tripsJson: data.tripsJson || '[]',
        ...(data.settingsJson ? { settingsJson: data.settingsJson } : {}),
        ...(data.displayName ? { displayName: data.displayName } : {}),
      });
    } else {
      await setDoc(targetRef, {
        uid: targetVaultId,
        email: cleanInvitedEmail,
        updatedAt: nowIso,
        accountsJson: '[]',
        cardsJson: '[]',
        categoriesJson: params.defaultCategoriesJson,
        transactionsJson: '[]',
        goalsJson: '[]',
        familyMembersJson: JSON.stringify([incomingMemberRecord]),
        investmentsJson: '[]',
        investmentTargetsJson: params.defaultInvestmentTargetsJson,
        tripsJson: '[]',
      });
    }
    return true;
  } catch (err) {
    console.error('Erro ao enviar convite familiar entre contas:', err);
    return false;
  }
}

export async function respondToCrossAccountFamilyInvite(params: {
  responderEmail: string;
  responderName: string;
  inviterEmail: string;
  action: 'accepted' | 'declined';
}): Promise<boolean> {
  const cleanResponderEmail = params.responderEmail.trim().toLowerCase();
  const cleanInviterEmail = params.inviterEmail.trim().toLowerCase();
  if (!cleanResponderEmail || !cleanInviterEmail) return false;

  const inviterVaultId = getVaultIdForEmail(cleanInviterEmail);
  const inviterRef = doc(db, 'cloud_vaults', inviterVaultId);

  try {
    const snap = await getDoc(inviterRef);
    if (!snap.exists()) return false;
    const data = snap.data();
    let members: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(data.familyMembersJson || '[]');
      if (Array.isArray(parsed)) members = parsed;
    } catch {
      members = [];
    }

    const updatedMembers = members.map((m) => {
      if (String(m.email || '').trim().toLowerCase() === cleanResponderEmail) {
        return {
          ...m,
          inviteStatus: params.action === 'accepted' ? 'accepted' : 'none',
          name:
            params.responderName.trim() ||
            String(m.name || cleanResponderEmail.split('@')[0]),
        };
      }
      return m;
    });

    await setDoc(inviterRef, {
      uid: inviterVaultId,
      ...(data.email ? { email: data.email } : { email: cleanInviterEmail }),
      ...(data.displayName ? { displayName: data.displayName } : {}),
      updatedAt: new Date().toISOString(),
      accountsJson: data.accountsJson || '[]',
      cardsJson: data.cardsJson || '[]',
      categoriesJson: data.categoriesJson || '[]',
      transactionsJson: data.transactionsJson || '[]',
      goalsJson: data.goalsJson || '[]',
      familyMembersJson: JSON.stringify(updatedMembers),
      investmentsJson: data.investmentsJson || '[]',
      ...(data.investmentTargetsJson
        ? { investmentTargetsJson: data.investmentTargetsJson }
        : {}),
      ...(data.tripsJson ? { tripsJson: data.tripsJson } : {}),
      ...(data.settingsJson ? { settingsJson: data.settingsJson } : {}),
    });
    return true;
  } catch (err) {
    console.error('Erro ao responder convite familiar:', err);
    return false;
  }
}

export async function syncSharedTransactionsWithFamilyVaults(params: {
  ownerEmail: string;
  ownerName: string;
  ownerPixKey?: string;
  familyMembers: Array<{
    id: string;
    name: string;
    email?: string;
    invitedByEmail?: string;
    relationship: string;
    color: string;
  }>;
  sharedTransactions: Array<Record<string, unknown>>;
  deletedSharedSyncIds?: string[];
  defaultCategoriesJson: string;
  defaultInvestmentTargetsJson: string;
}): Promise<void> {
  const cleanOwnerEmail = params.ownerEmail.trim().toLowerCase();
  if (!cleanOwnerEmail) return;

  const ownerSlug = cleanOwnerEmail.replace(/[^a-z0-9]/g, '_');
  const defaultIncomingId = `fam-inv-${ownerSlug}`;
  const todayStr = new Date().toISOString().slice(0, 10);
  const deletedSet = new Set(
    (params.deletedSharedSyncIds || []).map((id) =>
      String(id).replace(/^tx-mirror-/, '')
    )
  );

  for (const member of params.familyMembers) {
    const memberEmail = String(member.email || member.invitedByEmail || '')
      .trim()
      .toLowerCase();
    if (!memberEmail || memberEmail === cleanOwnerEmail) continue;

    const memberTxs = params.sharedTransactions.filter(
      (tx) =>
        tx.isShared === true &&
        !tx.tripId &&
        String(tx.sharedMemberId || '') === member.id
    );

    if (memberTxs.length === 0 && deletedSet.size === 0) continue;

    const targetVaultId = getVaultIdForEmail(memberEmail);
    const targetRef = doc(db, 'cloud_vaults', targetVaultId);

    try {
      const snap = await getDoc(targetRef);
      const nowIso = new Date().toISOString();
      const data = snap.exists() ? snap.data() : {};

      let targetFamilyMembers: Array<Record<string, unknown>> = [];
      try {
        const parsedFam = JSON.parse(data.familyMembersJson || '[]');
        if (Array.isArray(parsedFam)) targetFamilyMembers = parsedFam;
      } catch {
        targetFamilyMembers = [];
      }

      let counterpartMember = targetFamilyMembers.find(
        (m) =>
          String(m.email || m.invitedByEmail || '')
            .trim()
            .toLowerCase() === cleanOwnerEmail || m.id === defaultIncomingId
      );

      if (!counterpartMember) {
        counterpartMember = {
          id: defaultIncomingId,
          name: params.ownerName.trim() || cleanOwnerEmail.split('@')[0],
          email: cleanOwnerEmail,
          relationship: member.relationship || 'outro',
          color: member.color || '#6366f1',
          ...(params.ownerPixKey?.trim()
            ? { pixKey: params.ownerPixKey.trim() }
            : {}),
          inviteStatus: 'invited',
          invitedAt: todayStr,
          invitedByEmail: cleanOwnerEmail,
          invitedByName:
            params.ownerName.trim() || cleanOwnerEmail.split('@')[0],
          direction: 'incoming',
        };
        targetFamilyMembers.unshift(counterpartMember);
      }

      const counterpartMemberId = String(
        counterpartMember.id || defaultIncomingId
      );

      let targetTransactions: Array<Record<string, unknown>> = [];
      try {
        const parsedTxs = JSON.parse(data.transactionsJson || '[]');
        if (Array.isArray(parsedTxs)) targetTransactions = parsedTxs;
      } catch {
        targetTransactions = [];
      }

      // 1. Apply deletions if any shared transaction was deleted
      if (deletedSet.size > 0) {
        targetTransactions = targetTransactions.filter((t) => {
          const tSyncKey = String(t.sharedSyncId || t.id || '').replace(
            /^tx-mirror-/,
            ''
          );
          return !deletedSet.has(tSyncKey);
        });
      }

      // 2. Upsert mirrored shared transactions for this member
      for (const tx of memberTxs) {
        const rawId = String(tx.id || '');
        if (!rawId) continue;
        const syncKey = String(tx.sharedSyncId || rawId).replace(
          /^tx-mirror-/,
          ''
        );
        const ownerPaidBy = tx.sharedPaidBy === 'member' ? 'member' : 'me';
        const counterpartPaidBy = ownerPaidBy === 'me' ? 'member' : 'me';

        const existingIdx = targetTransactions.findIndex((t) => {
          const tKey = String(t.sharedSyncId || t.id || '').replace(
            /^tx-mirror-/,
            ''
          );
          return tKey === syncKey;
        });

        if (existingIdx >= 0) {
          const prev = targetTransactions[existingIdx];
          targetTransactions[existingIdx] = {
            ...prev,
            sharedSyncId: syncKey,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            competenceMonth: tx.competenceMonth,
            categoryId: tx.categoryId || prev.categoryId || 'cat-outros',
            ...(tx.subcategoryId ? { subcategoryId: tx.subcategoryId } : {}),
            ...(tx.notes ? { notes: tx.notes } : {}),
            isShared: true,
            sharedMemberId: counterpartMemberId,
            sharedAmount: tx.sharedAmount,
            sharedSplitMode: tx.sharedSplitMode || 'half',
            sharedPaidBy: counterpartPaidBy,
            sharedStatus: tx.sharedStatus || 'pending',
            ...(tx.sharedSettledDate
              ? { sharedSettledDate: tx.sharedSettledDate }
              : { sharedSettledDate: undefined }),
          };
        } else {
          const mirroredTx: Record<string, unknown> = {
            id: `tx-mirror-${syncKey}`,
            sharedSyncId: syncKey,
            sharedOriginEmail: cleanOwnerEmail,
            sharedTargetEmail: memberEmail,
            description: tx.description,
            amount: tx.amount,
            date: tx.date,
            competenceMonth: tx.competenceMonth,
            type: 'expense',
            status: tx.status || 'paid',
            categoryId: tx.categoryId || 'cat-outros',
            ...(tx.subcategoryId ? { subcategoryId: tx.subcategoryId } : {}),
            paymentMethod: tx.paymentMethod || 'pix',
            recurrence: tx.recurrence || 'single',
            ...(tx.installmentGroupId
              ? { installmentGroupId: `mirror-${String(tx.installmentGroupId)}` }
              : {}),
            ...(tx.installmentNumber
              ? { installmentNumber: tx.installmentNumber }
              : {}),
            ...(tx.installmentTotal
              ? { installmentTotal: tx.installmentTotal }
              : {}),
            ...(tx.notes ? { notes: tx.notes } : {}),
            isShared: true,
            sharedMemberId: counterpartMemberId,
            sharedAmount: tx.sharedAmount,
            sharedSplitMode: tx.sharedSplitMode || 'half',
            sharedPaidBy: counterpartPaidBy,
            sharedStatus: tx.sharedStatus || 'pending',
            ...(tx.sharedSettledDate
              ? { sharedSettledDate: tx.sharedSettledDate }
              : {}),
            isCompanionOnlyExpense: true,
          };
          targetTransactions.unshift(mirroredTx);
        }
      }

      await setDoc(targetRef, {
        uid: targetVaultId,
        email: data.email || memberEmail,
        ...(data.displayName ? { displayName: data.displayName } : {}),
        updatedAt: nowIso,
        accountsJson: data.accountsJson || '[]',
        cardsJson: data.cardsJson || '[]',
        categoriesJson: data.categoriesJson || params.defaultCategoriesJson,
        transactionsJson: JSON.stringify(targetTransactions),
        goalsJson: data.goalsJson || '[]',
        familyMembersJson: JSON.stringify(targetFamilyMembers),
        investmentsJson: data.investmentsJson || '[]',
        investmentTargetsJson:
          data.investmentTargetsJson || params.defaultInvestmentTargetsJson,
        tripsJson: data.tripsJson || '[]',
        ...(data.settingsJson ? { settingsJson: data.settingsJson } : {}),
      });
    } catch (err) {
      console.error(
        `Erro ao sincronizar despesas compartilhadas com ${memberEmail}:`,
        err
      );
    }
  }
}

export async function purgeMockDataAcrossKnownVaults(params: {
  stripFn: <T extends { id: string }>(items: T[]) => T[];
  extraEmails?: string[];
  defaultCategoriesJson: string;
}): Promise<number> {
  const candidateEmails = new Set<string>([
    'wesley.diaslima@gmail.com',
    'mariana.oliveira@gmail.com',
    'rafael.oliveira@gmail.com',
    ...(params.extraEmails || []),
  ]);

  const candidateVaultIds = new Set<string>([
    'vault_default_session_br_01',
    getOrCreateAutoCloudVaultId(),
  ]);

  for (const email of candidateEmails) {
    if (email && email.trim()) {
      candidateVaultIds.add(getVaultIdForEmail(email));
    }
  }

  let cleanedVaultsCount = 0;

  for (const vaultId of candidateVaultIds) {
    if (!vaultId || vaultId.length < 16 || vaultId.length > 64) continue;
    try {
      const ref = doc(db, 'cloud_vaults', vaultId);
      const snap = await getDoc(ref);
      if (!snap.exists()) continue;

      const data = snap.data();
      const parseList = (raw: unknown): Array<{ id: string }> => {
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? (raw as Array<{ id: string }>) : [];
      };

      const rawAccounts = parseList(data.accountsJson ?? data.accounts);
      const rawCards = parseList(data.cardsJson ?? data.cards);
      const rawTransactions = parseList(data.transactionsJson ?? data.transactions);
      const rawGoals = parseList(data.goalsJson ?? data.goals);
      const rawMembers = parseList(data.familyMembersJson ?? data.familyMembers);
      const rawInvestments = parseList(data.investmentsJson ?? data.investments);
      const rawTrips = parseList(data.tripsJson ?? data.trips);

      const nextAccounts = params.stripFn(rawAccounts);
      const nextCards = params.stripFn(rawCards);
      const nextTransactions = params.stripFn(rawTransactions);
      const nextGoals = params.stripFn(rawGoals);
      const nextMembers = params.stripFn(rawMembers);
      const nextInvestments = params.stripFn(rawInvestments);
      const nextTrips = params.stripFn(rawTrips);

      const changed =
        nextAccounts.length !== rawAccounts.length ||
        nextCards.length !== rawCards.length ||
        nextTransactions.length !== rawTransactions.length ||
        nextGoals.length !== rawGoals.length ||
        nextMembers.length !== rawMembers.length ||
        nextInvestments.length !== rawInvestments.length ||
        nextTrips.length !== rawTrips.length;

      if (changed) {
        await setDoc(ref, {
          uid: vaultId,
          ...(typeof data.email === 'string' ? { email: data.email } : {}),
          ...(typeof data.displayName === 'string' ? { displayName: data.displayName } : {}),
          updatedAt: new Date().toISOString(),
          accountsJson: JSON.stringify(nextAccounts),
          cardsJson: JSON.stringify(nextCards),
          categoriesJson:
            typeof data.categoriesJson === 'string' && data.categoriesJson.length > 2
              ? data.categoriesJson
              : params.defaultCategoriesJson,
          transactionsJson: JSON.stringify(nextTransactions),
          goalsJson: JSON.stringify(nextGoals),
          familyMembersJson: JSON.stringify(nextMembers),
          investmentsJson: JSON.stringify(nextInvestments),
          ...(typeof data.investmentTargetsJson === 'string'
            ? { investmentTargetsJson: data.investmentTargetsJson }
            : {}),
          tripsJson: JSON.stringify(nextTrips),
          ...(typeof data.settingsJson === 'string'
            ? { settingsJson: data.settingsJson }
            : {}),
        });
        cleanedVaultsCount++;
      }
    } catch {
      // Ignore individual vault read/write errors
    }
  }

  return cleanedVaultsCount;
}

export {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  onAuthStateChanged,
  type User,
};



