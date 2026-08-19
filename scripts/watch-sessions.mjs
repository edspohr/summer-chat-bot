import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || "summer-chatbot-dev";

initializeApp({
  credential: applicationDefault(),
  projectId,
});

const db = getFirestore();
db.settings({ databaseId: "(default)" });

const startedAt = new Date();
process.stdout.write(`watching sessions on ${projectId} since ${startedAt.toISOString()}\n`);

const fmt = (ts) => {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(11, 19);
};

const short = (id) => id.slice(0, 8);

db.collection("sessions")
  .where("actualizadoEn", ">=", startedAt)
  .onSnapshot(
    (snap) => {
      snap.docChanges().forEach((chg) => {
        const d = chg.doc.data();
        const id = short(chg.doc.id);
        const modo = d.modo ?? "?";
        const crisis = d.crisis_interrupted ? " CRISIS" : "";
        const m = d.estadoMatriz ?? {};
        const matriz =
          m.intensidadEmocional !== undefined
            ? ` I=${m.intensidadEmocional} A=${m.apertura} C=${m.confianzaEnLaAyuda}`
            : "";
        const turnos = d.turnosCount ?? d.turnos ?? "";
        const turnosStr = turnos !== "" ? ` turnos=${turnos}` : "";
        process.stdout.write(
          `[session ${chg.type}] ${id} modo=${modo}${matriz}${turnosStr}${crisis} @${fmt(d.actualizadoEn)}\n`,
        );
      });
    },
    (err) => {
      process.stdout.write(`ERROR sessions listener: ${err.message}\n`);
      process.exit(1);
    },
  );

db.collectionGroup("turnos")
  .where("creadoEn", ">=", startedAt)
  .onSnapshot(
    (snap) => {
      snap.docChanges().forEach((chg) => {
        if (chg.type !== "added") return;
        const d = chg.doc.data();
        const sessionId = short(chg.doc.ref.parent.parent?.id ?? "?");
        const rol = d.rol ?? d.role ?? "?";
        const clase = d.claseSafety ?? d.safetyClass ?? "";
        const claseStr = clase ? ` safety=${clase}` : "";
        const preview = (d.texto ?? d.text ?? "").toString().slice(0, 60).replace(/\n/g, " ");
        process.stdout.write(
          `[turno] ${sessionId} rol=${rol}${claseStr} "${preview}" @${fmt(d.creadoEn)}\n`,
        );
      });
    },
    (err) => {
      process.stdout.write(`ERROR turnos listener: ${err.message}\n`);
    },
  );

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
