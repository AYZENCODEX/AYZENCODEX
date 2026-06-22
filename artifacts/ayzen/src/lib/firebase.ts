import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string;
const hasFirebase = !!apiKey && apiKey !== "undefined" && apiKey.length > 10;

const firebaseConfig = {
  apiKey: apiKey || "placeholder-key",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "ayzenworkspacex01.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "ayzenworkspacex01",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "ayzenworkspacex01.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "000000000000",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:000000000000:web:0000000000000000",
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

if (hasFirebase) {
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch {
    app = null;
    auth = null;
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, firebaseSignOut, hasFirebase };
