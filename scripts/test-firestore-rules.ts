// Firestore Security Rules test for lab_sessions collection.
// Run via: pnpm test:rules (requires Firestore emulator on localhost:8080)
//
// What this tests:
//   - Unauthenticated user: cannot read lab_sessions
//   - Authenticated participant: cannot read lab_sessions
//   - Authenticated admin: can read lab_sessions and messages subcollection
//   - Non-admin cannot read lab_sessions/messages subcollection
//   - Existing scenarios rule not broken: participant can still read scenarios

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rules = readFileSync(join(__dirname, "../firestore.rules"), "utf-8");

let passed = 0;
let failed = 0;

async function test(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${String(err)}`);
    failed++;
  }
}

const env = await initializeTestEnvironment({
  projectId: "summer-chatbot-test",
  firestore: {
    rules,
    host: "127.0.0.1",
    port: 8080,
  },
});

// Seed: create user docs and a lab_sessions doc (bypasses rules)
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await db.doc("users/admin-uid").set({ role: "admin", email: "admin@test.com" });
  await db.doc("users/participant-uid").set({ role: "participant", email: "user@test.com" });
  await db.doc("lab_sessions/test-session").set({ label: "test", mode: "mentor" });
  await db.doc("lab_sessions/test-session/messages/msg-1").set({
    content: "hello",
    sessionId: "test-session",
  });
  await db.doc("scenarios/camila").set({ name: "Camila", slug: "camila", active: true });
});

console.log("\nlab_sessions — access control");

await test("unauthenticated: cannot read lab_sessions/{id}", async () => {
  const unauth = env.unauthenticatedContext();
  await assertFails(getDoc(doc(unauth.firestore(), "lab_sessions/test-session")));
});

await test("participant: cannot read lab_sessions/{id}", async () => {
  const participant = env.authenticatedContext("participant-uid");
  await assertFails(getDoc(doc(participant.firestore(), "lab_sessions/test-session")));
});

await test("admin: can read lab_sessions/{id}", async () => {
  const admin = env.authenticatedContext("admin-uid");
  await assertSucceeds(getDoc(doc(admin.firestore(), "lab_sessions/test-session")));
});

await test("unauthenticated: cannot read lab_sessions/{id}/messages/{msgId}", async () => {
  const unauth = env.unauthenticatedContext();
  await assertFails(
    getDoc(doc(unauth.firestore(), "lab_sessions/test-session/messages/msg-1"))
  );
});

await test("participant: cannot read lab_sessions/{id}/messages/{msgId}", async () => {
  const participant = env.authenticatedContext("participant-uid");
  await assertFails(
    getDoc(doc(participant.firestore(), "lab_sessions/test-session/messages/msg-1"))
  );
});

await test("admin: can read lab_sessions/{id}/messages/{msgId}", async () => {
  const admin = env.authenticatedContext("admin-uid");
  await assertSucceeds(
    getDoc(doc(admin.firestore(), "lab_sessions/test-session/messages/msg-1"))
  );
});

await test("participant: cannot write lab_sessions/{id}", async () => {
  const participant = env.authenticatedContext("participant-uid");
  await assertFails(
    participant.firestore().doc("lab_sessions/new-session").set({ label: "evil" })
  );
});

await test("admin: can write lab_sessions/{id}", async () => {
  const admin = env.authenticatedContext("admin-uid");
  await assertSucceeds(
    admin.firestore().doc("lab_sessions/admin-write-test").set({ label: "ok" })
  );
});

console.log("\nExisting rules — regression check");

await test("participant: can still read scenarios/{id}", async () => {
  const participant = env.authenticatedContext("participant-uid");
  await assertSucceeds(getDoc(doc(participant.firestore(), "scenarios/camila")));
});

await test("participant: scenarios write is still denied", async () => {
  const participant = env.authenticatedContext("participant-uid");
  await assertFails(
    participant.firestore().doc("scenarios/camila").set({ name: "tampered" })
  );
});

await test("unauthenticated: scenarios read is denied", async () => {
  const unauth = env.unauthenticatedContext();
  await assertFails(getDoc(doc(unauth.firestore(), "scenarios/camila")));
});

await env.cleanup();

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
