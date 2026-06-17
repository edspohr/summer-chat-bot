import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import type { UserProfileRole } from "@salvador/shared";

// ── User document ─────────────────────────────────────────────────────────────

interface UserDocPayload {
  email: string;
  displayName: string;
  role: "participant";
  profile?: { role: UserProfileRole };
  createdAt: ReturnType<typeof serverTimestamp>;
}

async function ensureUserDoc(
  user: FirebaseUser,
  profileRole?: UserProfileRole
): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  const payload: UserDocPayload = {
    email: user.email ?? "",
    displayName: user.displayName ?? "",
    role: "participant",
    createdAt: serverTimestamp(),
    ...(profileRole !== undefined && { profile: { role: profileRole } }),
  };

  await setDoc(ref, payload);
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function signUpWithEmail(args: {
  email: string;
  password: string;
  displayName: string;
  profileRole: UserProfileRole;
}): Promise<void> {
  const { email, password, displayName, profileRole } = args;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await ensureUserDoc(cred.user, profileRole);
}

export async function signInWithEmail(args: {
  email: string;
  password: string;
}): Promise<void> {
  await signInWithEmailAndPassword(auth, args.email, args.password);
}

export async function signInWithGoogle(): Promise<void> {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await ensureUserDoc(cred.user);
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

// ── Error translation ─────────────────────────────────────────────────────────

interface FirebaseAuthError {
  code: string;
}

function isAuthError(err: unknown): err is FirebaseAuthError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  );
}

export function translateAuthError(err: unknown): string {
  if (!isAuthError(err)) return "Algo salió mal. Intenta de nuevo.";
  switch (err.code) {
    case "auth/email-already-in-use":
      return "Este correo ya está registrado.";
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/user-not-found":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos.";
    case "auth/network-request-failed":
      return "Error de conexión. Verifica tu internet.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Inicio de sesión cancelado.";
    case "auth/operation-not-allowed":
      return "Este método de inicio de sesión no está habilitado.";
    default:
      return "No se pudo completar la acción. Intenta de nuevo.";
  }
}
