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
import firebaseConfig from '../../firebase-applet-config.json';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
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

export {
  onAuthStateChanged,
  type User,
};



