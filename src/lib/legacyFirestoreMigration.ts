import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

const legacyDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

/** One-time read of this authenticated user's old snapshot before Neon initialization. */
export async function readLegacyFirestoreWorkspace(vaultId: string) {
  const snapshot = await getDocFromServer(doc(legacyDb, 'cloud_vaults', vaultId));
  return snapshot.exists() ? snapshot.data() as Record<string, unknown> : null;
}
