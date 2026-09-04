import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazy initialization: firebase-admin's initializeApp() at module load
// blocks Firebase CLI's source-code discovery pass (~10s timeout, then OOM
// under retries). Deferring to first property access lets `firebase deploy`
// analyze the backend spec without ever booting the SDK.
// See docs/debt/0021-vitest-firebase-admin-init-hang.md.

let firestoreInstance: Firestore | null = null;

function getDb(): Firestore {
  if (firestoreInstance !== null) return firestoreInstance;
  const app = getApps().length === 0 ? initializeApp() : getApps()[0]!;
  firestoreInstance = getFirestore(app);
  // Undefined values in write payloads throw at runtime by default. Optional
  // fields (e.g. Lab's evaluatorLatencyMs in Mentor mode) become undefined and
  // blow up persistLabInteraction. Ignoring them app-wide is safer than
  // scattering defensive omits at every write site.
  firestoreInstance.settings({ ignoreUndefinedProperties: true });
  return firestoreInstance;
}

// Proxy preserves the historical `db.collection(...)` API so the ~9 existing
// call sites need no change. First access triggers init; subsequent accesses
// hit the cached instance.
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
