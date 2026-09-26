import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// O pacote web do Firebase não declara essa função, mas o bundle React Native exporta.
const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
  }
).getReactNativePersistence;

// Configuração pública do cliente, recuperada do APK. As regras do Firestore
// é que limitam o acesso.
const firebaseConfig = {
  apiKey: "AIzaSyB7776DLS9GcT3VD7XU3ywpzoCaiQv7iG4",
  authDomain: "shapeai-9c9cb.firebaseapp.com",
  projectId: "shapeai-9c9cb",
  storageBucket: "shapeai-9c9cb.firebasestorage.app",
  messagingSenderId: "172159476691",
  appId: "1:172159476691:web:25494f0099f413ebf4c526",
  measurementId: "G-8M713H0870",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
