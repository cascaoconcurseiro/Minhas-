import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { getVaultIdForUid as getStableVaultIdForUid } from '../../shared/workspaceIdentity';

const firebaseConfigForAuth = {
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
};
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfigForAuth);
export const auth = getAuth(firebaseApp);

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

export async function resendEmailVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function refreshFirebaseUser(user: User): Promise<User> {
  await reload(user);
  await user.getIdToken(true);
  return auth.currentUser ?? user;
}

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export function getVaultIdForUid(uid: string | null | undefined): string {
  return uid?.trim()
    ? getStableVaultIdForUid(uid)
    : getOrCreateAutoCloudVaultId();
}

export {
  onAuthStateChanged,
  type User,
};



