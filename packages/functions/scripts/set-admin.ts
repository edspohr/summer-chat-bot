import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();
await db
  .collection("users")
  .doc("71UhIZ0erwT00Prw6C4csP5n2ip1")
  .set({ role: "admin" }, { merge: true });
console.log("Done — admin role set.");
process.exit(0);
