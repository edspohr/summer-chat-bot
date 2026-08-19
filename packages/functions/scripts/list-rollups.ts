import { db } from "../src/config/firebase.js";

const snap = await db.collection("analytics_rollups").orderBy("date", "asc").get();
if (snap.empty) {
  console.log("(no rollups)");
} else {
  for (const doc of snap.docs) {
    const d = doc.data();
    const groups = Array.isArray(d.groups) ? d.groups.length : 0;
    const sessions = Array.isArray(d.groups)
      ? d.groups.reduce((s: number, g: { sessionsStarted?: number }) => s + (g.sessionsStarted ?? 0), 0)
      : 0;
    console.log(`${doc.id}  groups=${groups}  sessions=${sessions}`);
  }
  console.log(`\ntotal=${snap.size}  latest=${snap.docs[snap.docs.length - 1]!.id}`);
}
process.exit(0);
