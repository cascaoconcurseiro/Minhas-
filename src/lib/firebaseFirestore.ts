import {
  doc,
  getFirestore,
  getDocFromServer,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { firebaseApp } from './firebase';

export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId
);

export { doc, getDocFromServer, onSnapshot, setDoc };
