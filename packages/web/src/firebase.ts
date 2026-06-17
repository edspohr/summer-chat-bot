import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] as string | undefined ?? "",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] as string | undefined ?? "",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] as string | undefined ?? "",
  storageBucket: import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] as string | undefined ?? "",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] as string | undefined ?? "",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] as string | undefined ?? "",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
