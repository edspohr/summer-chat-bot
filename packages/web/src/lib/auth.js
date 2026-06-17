import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInAnonymously, GoogleAuthProvider, updateProfile, sendPasswordResetEmail, signOut, } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
async function ensureUserDoc(user, profileRole) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists())
        return;
    const payload = {
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        role: "participant",
        createdAt: serverTimestamp(),
        ...(profileRole !== undefined && { profile: { role: profileRole } }),
    };
    await setDoc(ref, payload);
}
// ── Public actions ────────────────────────────────────────────────────────────
export async function signUpWithEmail(args) {
    const { email, password, displayName, profileRole } = args;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await ensureUserDoc(cred.user, profileRole);
}
export async function signInWithEmail(args) {
    await signInWithEmailAndPassword(auth, args.email, args.password);
}
export async function signInWithGoogle() {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureUserDoc(cred.user);
}
export async function requestPasswordReset(email) {
    await sendPasswordResetEmail(auth, email);
}
export async function signInAnon() {
    await signInAnonymously(auth);
}
export async function logout() {
    await signOut(auth);
}
function isAuthError(err) {
    return (typeof err === "object" &&
        err !== null &&
        "code" in err &&
        typeof err.code === "string");
}
export function translateAuthError(err) {
    if (!isAuthError(err))
        return "Algo salió mal. Intenta de nuevo.";
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
