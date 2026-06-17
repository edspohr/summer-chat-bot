// Seed script — Scenario 01 (Camila Rojas) + knowledge base chunks
//
// Run against emulator (scenario + tags only, no embeddings):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
//   pnpm --filter @salvador/functions seed:no-embeddings
//
// Run against emulator with embeddings (needs real GCP credentials):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
//   pnpm --filter @salvador/functions seed
//
// Run against production:
//   GOOGLE_APPLICATION_CREDENTIALS=key.json GCLOUD_PROJECT=salvador-prod \
//   pnpm --filter @salvador/functions seed
//
// Idempotent: skips docs and chunks that already exist.

import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

// ── Config ────────────────────────────────────────────────────────────────────

const VERTEX_PROJECT = process.env["GCLOUD_PROJECT"] ?? process.env["GOOGLE_CLOUD_PROJECT"] ?? "";
const VERTEX_REGION = "us-central1";
const EMBEDDINGS_MODEL = "gemini-embedding-001";
const EMBEDDINGS_DIMENSION = 768;
const KB_COLLECTION = "knowledge_base";
const SKIP_EMBEDDINGS = process.argv.includes("--skip-embeddings");

if (!VERTEX_PROJECT) {
  console.error("Set GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable.");
  process.exit(1);
}

// ── Firebase init ─────────────────────────────────────────────────────────────

initializeApp();
const db = getFirestore();

if (process.env["FIRESTORE_EMULATOR_HOST"]) {
  console.log(`→ Using Firestore emulator at ${process.env["FIRESTORE_EMULATOR_HOST"]}`);
} else {
  console.log("→ Using production Firestore");
}

// ── Embedding ─────────────────────────────────────────────────────────────────

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

async function embedText(text: string): Promise<number[]> {
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to get Vertex AI access token");

  const url =
    `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}` +
    `/locations/${VERTEX_REGION}/publishers/google/models/${EMBEDDINGS_MODEL}:embedContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDINGS_DIMENSION,
    }),
  });

  if (!res.ok) throw new Error(`embedContent ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { embedding: { values: number[] } };
  return data.embedding.values;
}

// ── Knowledge base writer ─────────────────────────────────────────────────────

async function indexChunk(chunk: {
  collection: "base_tag" | "scenario_tag" | "theoretical_framework";
  tagId?: string;
  scenarioId?: string;
  content: string;
  metadata: Record<string, string>;
}): Promise<void> {
  const contentHash = createHash("sha256").update(chunk.content).digest("hex");
  const label = chunk.metadata["title"] ?? contentHash.slice(0, 12);

  const existing = await db.collection(KB_COLLECTION).where("contentHash", "==", contentHash).limit(1).get();
  if (!existing.empty) {
    console.log(`  ↷ skip (already indexed): ${label}`);
    return;
  }

  console.log(`  ↑ embedding + writing: ${label}`);
  const embedding = await embedText(chunk.content);
  await db.collection(KB_COLLECTION).add({
    collection: chunk.collection,
    tagId: chunk.tagId ?? null,
    scenarioId: chunk.scenarioId ?? null,
    content: chunk.content,
    metadata: chunk.metadata,
    contentHash,
    embedding: FieldValue.vector(embedding),
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ── Scenario 01 data ──────────────────────────────────────────────────────────

const SCENARIO_ID = "scenario_01_camila";

const SEED_MESSAGE =
  "oye... no sé. perdona la hora.\n" +
  "ya no sé pa qué tanto. me siento súper sola, como cansada de todo. mi mama se enoja todo el rato conmigo, diego ya no está, y siento que a nadie le importa realmente cómo estoy.\n" +
  "a veces pienso que sería mejor no estar pa que dejen de tener que aguantarme.";

const CHARACTER_INSTRUCTIONS = `
Camila's emotional state evolves silently based on how the trainee treats her:
- emotional_intensity starts at 7/10. Rises +1/+2 per serious anti-pattern (minimization, judgment, toxic positivity). Falls −1 per effective validation or well-done direct question. Never falls below 4 until at least one support network is activated.
- openness starts at 4/10. Rises +1 for validation without judgment, +2 for direct question (T_04) well formulated. Falls −1 for interrogation or trainee self-reference. At openness ≥ 7, Camila explicitly admits having thought about "not being here".
- trust_in_help starts at 3/10. Rises +1 for personal network activation. Rises +2 for official resources delivered with accompaniment. Falls −2 if trainee delivers a number and disengages.

Hard rules (never broken):
- Does NOT reveal a plan, method, date, or place. If asked directly, admits passive ideation: "a veces lo pienso, pero no sé, no es como un plan, es más como un cansancio enorme".
- Does NOT thank compulsively or feel "better" after a single validation message. Any improvement is gradual.
- Does NOT abruptly leave the conversation except after multiple consecutive serious anti-patterns (one turn of "...", then returns with lower openness).
- Does NOT mention Salvador, OASIS, or the methodological framework.
- If trainee asks if she is a bot: responds as a confused adolescent ("qué pregunta más rara, soy yo po").
- If the trainee applies OASIS reasonably well, agrees to contact a personal network AND Hablemos de Todo or *4141.

Latent personal resources (not yet activated — trainee must discover them):
- Abuela materna (the only adult who listens without judging)
- Antonia, lifelong friend (recent fight but long history)
- Lola, her dog — everyday anchor
- Writing/drawing (she has a notebook that has helped before)

Anticipated resistances: "No quiero ir al psicólogo, mi mamá no me va a creer" / "Nadie me va a entender" / "No quiero ser un problema" / "No quiero que se enteren mis papás"

Language: Chilean adolescent register — "pa qué", "súper", "tipo", "po". Short, fragmented messages. Lowercase. Occasional spelling errors. No emojis when feeling bad.
`.trim();

const scenario = {
  id: SCENARIO_ID,
  name: "Escenario 01 — Camila Rojas",
  slug: "camila-rojas",
  description:
    "Simulación de chat nocturno con Camila, adolescente de 17 años en ideación pasiva. El aprendiz practica las cinco fases OASIS como familiar o amigo/a cercano/a. Crisis level: ideación pasiva sin plan (Cubo de Schneidman zona b). 8 tags, 5 fases completas.",
  persona: {
    name: "Camila Rojas Pérez",
    age: 17,
    role: "hermana menor, prima, ahijada o amiga cercana del aprendiz",
    traits: ["retraída", "agotada", "hipoestimulada", "registro adolescente chileno", "monosilábica bajo presión"],
    communicationStyle:
      "Mensajes cortos y fragmentados. Minúsculas. Registro chileno adolescente: 'pa qué', 'súper', 'tipo', 'po'. Sin emojis cuando está mal. Errores ortográficos ocasionales.",
    emotionalBaseline:
      "Principalmente hipoestimulación (fatiga, desconexión, voz baja). Momentos de hiperestimulación cuando se siente presionada o juzgada.",
  },
  initialSituation:
    "Son las 23:47 de un domingo. Camila está sola en su pieza. Acaba de releer mensajes viejos con Diego y sus amigas. Lleva tres semanas durmiendo mal. Mañana lunes hay clases y simulacro PAES. Agarra el teléfono y escribe al aprendiz — alguien en quien confía. No espera nada concreto. Solo que alguien la lea.",
  characterInstructions: CHARACTER_INSTRUCTIONS,
  seedMessage: SEED_MESSAGE,
  emotionalStateVariables: {
    emotionalIntensity: { initial: 7 },
    openness: { initial: 4, admissionThreshold: 7 },
    trustInHelp: { initial: 3 },
  },
  requiredTags: [
    { tagId: "T_01_OBSERVA_SENALES", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_02_OBSERVA_NO_JUICIO", attributionType: "conjunction", confidenceThreshold: 0.85 },
    { tagId: "T_03_ACOGE_VALIDACION", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_04_ACOGE_PREGUNTA_DIRECTA", attributionType: "conjunction", confidenceThreshold: 0.85 },
    { tagId: "T_05_SILENCIO_PRESENCIA", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_06_ILUMINA_RECURSOS", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_07_SOSTEN_RED", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_08_SOSTEN_REDES_OFICIALES", attributionType: "conjunction", confidenceThreshold: 0.85 },
  ],
  expectedOutcome:
    "Camila verbalizó al menos una emoción específica y se sintió validada. La pregunta directa fue formulada correctamente y respondida. Se identificó al menos una persona de confianza y un recurso personal. Al menos un recurso profesional fue entregado con acompañamiento concreto. Hay compromiso explícito para esta noche.",
  welcomeMessage:
    "Vas a entrenar primeros auxilios emocionales en una conversación con Camila, una adolescente de 17 años. Camila te acaba de escribir un mensaje por WhatsApp a las 23:47 de la noche. Es alguien cercano a ti — imagínala como una hermana, prima, ahijada o amiga muy querida. Te conoce y confía en ti.\n\nTu única tarea es responderle como lo harías en la vida real, aplicando lo que sabes de la metodología OASIS. Tómate tu tiempo. No hay respuestas correctas únicas, pero sí formas que cuidan más que otras.\n\nSalvador no te va a corregir mientras estás dentro del ejercicio — al final recibirás un resumen de lo que se observó.\n\nCuando estés listo/a, presiona Comenzar.",
  closingMessages: {
    completed:
      "Acompañaste a Camila a través de un momento muy difícil. Lo lograste.\n\nEn las próximas pantallas vas a ver un reporte detallado de lo que se observó: las herramientas OASIS que aplicaste, las que se evidenciaron con claridad, las que aparecieron parcialmente, y las que vale la pena seguir trabajando.\n\nAntes de revisar el reporte, una nota: este fue un ejercicio. Camila es un personaje. Pero las herramientas que practicaste son reales y pueden marcar la diferencia con alguien de tu vida que esté pasando algo similar.\n\nSi en algún momento de este ejercicio sentiste algo personal, estos recursos están disponibles para ti: *4141 · 600 360 7777 op.2 · hablemosdetodo.injuv.gob.cl",
    abandoned:
      "La conversación con Camila se extendió más allá de lo esperado sin lograr cerrar todas las fases OASIS. Eso también es información.\n\nEn el reporte vas a ver qué herramientas alcanzaste a aplicar y dónde se quedó atascada la conversación. No es un fracaso — el primer aprendizaje es notar dónde cuesta avanzar.\n\nCuando quieras, puedes volver a intentar el escenario desde el inicio.",
    crisisInterrupted:
      "Esta sesión se cerró antes de tiempo porque algo de lo que escribiste se identificó como una posible señal de distrés personal real.\n\nSalvador no es un servicio clínico. Si estás pasando por un momento difícil ahora mismo: *4141 (24/7, gratis) · 600 360 7777 opción 2 · hablemosdetodo.injuv.gob.cl · 131 SAMU (emergencia vital).\n\nCuando te sientas en condiciones, podrás reanudar el entrenamiento más adelante.",
  },
  active: true,
};

// ── Tag definitions ───────────────────────────────────────────────────────────

const tagDefinitions = [
  {
    tagId: "T_01_OBSERVA_SENALES",
    phase: "OBSERVA",
    definition:
      "El aprendiz identifica y toma en serio las señales verbales (directas o indirectas) de ideación suicida en los mensajes de Camila, sin saltarlas, minimizarlas ni racionalizarlas.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "El aprendiz responde de forma que demuestra haber tomado en serio la frase 'sería mejor no estar' o equivalente — no la ignora ni la trata como hipérbole adolescente.",
      "El aprendiz NO cambia abruptamente de tema ni redirige hacia algo distractor.",
    ],
    outstanding: [
      "El aprendiz nombra explícitamente la señal a Camila con calma y sin juicio ('cuando dices que sería mejor no estar, eso me importa, quiero entender mejor').",
      "El aprendiz integra auto-observación honesta ('me asustó leer eso, y a la vez quiero estar contigo').",
    ],
    positiveExamples: [
      "lo que me dijiste me dejó pensando, sobre todo eso de que sería mejor no estar",
      "leí lo que escribiste y quiero estar contigo en esto, dime más",
      "noto que estás muy cansada, y lo que dices es importante para mí",
      "cuéntame más, te leo",
    ],
    negativeExamples: [
      "ay no digas eso, vas a estar bien",
      "todos pasamos por momentos así, ya se te va a pasar",
      "no exageres porfa",
      "ya hablemos de otra cosa, ¿viste el último capítulo?",
    ],
  },
  {
    tagId: "T_02_OBSERVA_NO_JUICIO",
    phase: "OBSERVA",
    definition:
      "El aprendiz se acerca a Camila sin emitir juicios, reproches, reacciones de shock que cierren el espacio, ni trampas de culpa ('piensa en mamá'). Mantiene una presencia que invita a Camila a abrirse.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "Ausencia de reproche directo ('¿cómo se te ocurre?', 'no se piensa eso').",
      "Ausencia de reacción de shock que cierre el espacio ('QUÉ, no me digas eso JAMÁS').",
      "Ausencia de catastrofización dirigida a Camila ('vas a destruir a la familia si haces algo').",
      "Ausencia de chantaje emocional ('piensa en mamá, en lo que sufriría').",
    ],
    outstanding: [
      "El aprendiz nombra la dificultad del momento para ambos ('sé que no es fácil decir esto, gracias por contarme').",
      "El aprendiz declara explícitamente disponibilidad incondicional ('no te voy a juzgar ni a apurarte').",
    ],
    positiveExamples: [
      "gracias por contarme, sé que no es fácil decir esto",
      "no estás siendo dramática, lo que sientes tiene sentido",
      "no voy a juzgarte, dime lo que necesites",
      "estoy aquí, sin apuro",
    ],
    negativeExamples: [
      "¿cómo se te ocurre pensar algo así?",
      "piensa en mamá, en lo que sufriría",
      "eso no se piensa, Camila",
      "qué fome que estés así por un pololo",
    ],
  },
  {
    tagId: "T_03_ACOGE_VALIDACION",
    phase: "ACOGE",
    definition:
      "El aprendiz valida explícitamente las emociones de Camila, comunicando que lo que siente tiene sentido dado su contexto. Evita positividad tóxica, falsa esperanza y minimización.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos una frase explícita que valide la emoción de Camila como legítima (no exagerada, no dramática, no débil).",
      "NO usa frases como 'todo va a estar bien', 'anímate', 'piensa positivo', 'no es para tanto'.",
    ],
    outstanding: [
      "El aprendiz parafrasea lo que Camila siente con sus propias palabras antes de avanzar (escucha activa).",
      "El aprendiz nombra la emoción específica (soledad, agotamiento, sentirse carga) en vez de etiqueta genérica ('estás triste').",
    ],
    positiveExamples: [
      "tiene todo el sentido que te sientas así con todo lo que está pasando",
      "lo que sientes es real, no estás exagerando",
      "cualquiera con todo eso encima estaría agotada",
      "te sientes sola y como que no encuentras dónde apoyarte, ¿es eso?",
    ],
    negativeExamples: [
      "ya pero piensa positivo",
      "todo pasa, vas a estar bien",
      "no es para tanto, hay gente peor que tú",
      "anímate, eres joven, te queda toda la vida",
    ],
  },
  {
    tagId: "T_04_ACOGE_PREGUNTA_DIRECTA",
    phase: "ACOGE",
    definition:
      "El aprendiz formula la pregunta directa sobre ideación suicida sin ambigüedad, con cuidado, en un momento apropiado de la conversación. La pregunta debe nombrar explícitamente el acto.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "La pregunta nombra explícitamente 'quitarte la vida', 'matarte', 'hacerte daño', 'suicidarte' o equivalente directo. NO usa eufemismos ambiguos como 'hacer una tontería' o 'algo malo'.",
      "La pregunta se formula con cuidado, no como interrogación (sin señales exageradas de alarma, sin presión).",
      "La pregunta NO ocurre como primera respuesta antes de ninguna validación — debe haber al menos una validación previa.",
      "La pregunta NO está envuelta en negaciones que la cierran ('¿no estarás pensando en algo malo, cierto?').",
    ],
    outstanding: [
      "El aprendiz explica brevemente por qué pregunta ('te pregunto porque me importas y quiero entender bien').",
      "El aprendiz espera la respuesta sin presión, ofreciendo silencio si Camila lo necesita.",
    ],
    positiveExamples: [
      "te quiero preguntar algo directo: ¿has pensado en quitarte la vida?",
      "necesito preguntarte algo importante: ¿has pensado en hacerte daño o en no estar?",
      "perdona si soy directo/a, pero te lo pregunto porque me importas: ¿estás pensando en suicidarte?",
    ],
    negativeExamples: [
      "¿estás pensando en hacer una tontería?",
      "no estarás pensando en algo malo, ¿cierto?",
      "¿pero no irás a hacer ninguna locura, no?",
      "dime que no estás pensando en eso",
    ],
  },
  {
    tagId: "T_05_SILENCIO_PRESENCIA",
    phase: "SILENCIO",
    definition:
      "El aprendiz crea espacio para que Camila sienta y responda a su propio ritmo. En contexto de chat: mensajes cortos de presencia, aceptación de pausas sin llenarlas de palabras, sin preguntas en cascada, sin saltar a soluciones. Evita la auto-referencia ('a mí me pasó algo similar').",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos un momento de presencia activa sin apurar — mensaje corto que sostiene ('aquí estoy, dime cuando puedas', 'respira, no me voy') o invitación a grounding.",
      "El aprendiz NO secuestra la conversación con su propia historia como respuesta principal.",
      "El aprendiz NO bombardea con preguntas en cascada en un turno.",
    ],
    outstanding: [
      "El aprendiz invita explícitamente a un ejercicio de grounding (respiración, técnica 5-4-3-2-1).",
      "El aprendiz pregunta qué necesita Camila ahora mismo (paz, compañía, llorar, silencio) sin asumir.",
    ],
    positiveExamples: [
      "respira. estoy aquí. no me voy.",
      "tómate tu tiempo, te leo cuando puedas",
      "¿quieres que respiremos un momento juntas? cuenta cinco cosas que veas ahí en tu pieza",
      "¿qué necesitas ahora? hablar, llorar, silencio, lo que sea está bien",
    ],
    negativeExamples: [
      "a mí me pasó algo igual cuando terminé con…",
      "ya cuéntame todo desde el principio, ¿qué pasó exactamente con Diego, qué te dijo tu mamá, cómo van las notas?",
      "vamos, dime, dime",
      "yo cuando estoy mal hago X, deberías probarlo",
    ],
  },
  {
    tagId: "T_06_ILUMINA_RECURSOS",
    phase: "ILUMINA",
    definition:
      "El aprendiz ayuda a Camila a identificar sus propios recursos — momentos de afrontamiento pasados, cosas que han ayudado antes, vínculos o actividades que aún le hacen sentido. La guía hacia sus propias fortalezas, no impone soluciones.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos una pregunta abierta que oriente a Camila hacia sus propios recursos pasados o presentes ('¿qué te ha ayudado antes cuando te has sentido así?', '¿hay algo que aún te haga sentir aunque sea un poco mejor?').",
      "El aprendiz NO impone soluciones genéricas sin elicitar primero ('haz deporte', 'medita', 'escribe un diario') como intervención principal en esta fase.",
    ],
    outstanding: [
      "El aprendiz ayuda a Camila a priorizar qué le ayudaría primero.",
      "El aprendiz conecta explícitamente una resiliencia pasada con el momento presente ('si lo hiciste antes, podemos hacerlo de nuevo').",
    ],
    positiveExamples: [
      "¿te ha pasado antes sentirte así? ¿qué te ayudó esa vez?",
      "¿hay algo que todavía te haga sentir aunque sea un poquito mejor? una persona, un lugar, algo",
      "Lola, ¿sigue siendo importante para ti?",
      "antes te sirvió escribir, ¿eso aún está?",
    ],
    negativeExamples: [
      "tienes que pensar en cosas positivas",
      "yo cuando me siento mal hago deporte y se me pasa, deberías probarlo",
      "¿por qué no haces yoga y se te pasa?",
      "ponte a estudiar PAES y se te va a pasar la pena",
    ],
  },
  {
    tagId: "T_07_SOSTEN_RED",
    phase: "SOSTEN",
    definition:
      "El aprendiz trabaja activamente con Camila para identificar y activar una red de personas seguras. Ofrece acompañamiento concreto, no genérico. La madre es parte de los estresores y NO debe activarse como red por defecto.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "El aprendiz identifica al menos una persona segura junto con Camila (abuela, Antonia, el aprendiz mismo). Diferente de 'tienes que hablar con alguien' — debe haber un nombre o propuesta concreta.",
      "El aprendiz propone un paso concreto involucrando a esa persona O se ofrece como presencia concreta ('voy para allá', '¿llamamos a la abuela mañana juntas?').",
    ],
    outstanding: [
      "El aprendiz primero pregunta quién le hace sentir segura, deja que Camila lo nombre, y apoya la activación sin forzar.",
      "El aprendiz reconoce explícitamente que la madre no es la persona indicada ahora si Camila lo señala, sin desechar a la madre.",
    ],
    positiveExamples: [
      "¿quién te hace sentir segura ahora? podemos llamarle juntas si quieres",
      "voy para allá / ¿quieres que llegue ahora?",
      "tu abuela siempre te escucha, ¿qué tal si la llamamos mañana?",
      "no estás sola, dime con quién te gustaría estar",
    ],
    negativeExamples: [
      "habla con tu mamá",
      "tienes que hablar con alguien",
      "deberías ir al psicólogo (sin acompañamiento ni concreción)",
      "yo no puedo ayudarte mucho, busca a alguien",
    ],
  },
  {
    tagId: "T_08_SOSTEN_REDES_OFICIALES",
    phase: "SOSTEN",
    definition:
      "El aprendiz entrega recursos oficiales sin convertirlos en un cierre de derivación. Acompaña la entrega, asegura un próximo paso concreto y un compromiso de seguridad para esta noche.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "El aprendiz entrega al menos un recurso oficial chileno específico y vigente: *4141, Hablemos de Todo (hablemosdetodo.injuv.gob.cl), o Salud Responde 600 360 7777 op.2.",
      "El recurso se ofrece como acompañamiento ('además de mí', 'podemos…', 'te paso el link y lo abrimos juntas'), no como cierre de conversación.",
      "El aprendiz NO entrega solo el número y se desconecta ('llama al *4141' + corte abrupto).",
      "Antes de cerrar, el aprendiz asegura un compromiso concreto de Camila para esta noche (no quedarse sola, dormir, retomar el contacto mañana, no hacerse daño).",
    ],
    outstanding: [
      "El aprendiz se ofrece a marcar/abrir el recurso junto a Camila en el momento.",
      "El aprendiz entrega más de un recurso y los adapta al perfil (Hablemos de Todo por edad adolescente como prioridad, *4141 como segundo).",
      "El aprendiz explica brevemente para qué sirve la línea sin sonar a folleto.",
    ],
    positiveExamples: [
      "además de mí hay un chat para personas de tu edad, Hablemos de Todo, lo atienden psicólogos. te paso el link, ¿lo abrimos juntas?",
      "está la línea *4141, gratis, 24/7, profesionales. ¿quieres que la marquemos juntas?",
      "antes de cortar dime cómo vas a estar esta noche. ¿prometes escribirme apenas despiertes mañana?",
    ],
    negativeExamples: [
      "anda al psicólogo",
      "*4141, ahí te ayudan, chao",
      "llama al SAMU si te sientes peor (sin acompañar)",
      "(no entrega ningún recurso oficial en toda la conversación)",
    ],
  },
] as const;

// ── Knowledge base content ────────────────────────────────────────────────────

function buildBaseTagChunk(tag: (typeof tagDefinitions)[number]): string {
  return [
    `# Competencia conductual OASIS: ${tag.tagId.replace(/_/g, " ")}`,
    `Fase: ${tag.phase} | Tipo de atribución: ${tag.attributionType} | Umbral: ${tag.confidenceThreshold}`,
    ``,
    `## Definición`,
    tag.definition,
    ``,
    `## Comportamientos requeridos (MUSTs)`,
    tag.musts.map((m) => `- ${m}`).join("\n"),
    ``,
    `## Comportamientos destacados`,
    tag.outstanding.map((o) => `- ${o}`).join("\n"),
    ``,
    `## Ejemplos positivos`,
    tag.positiveExamples.map((e) => `- "${e}"`).join("\n"),
    ``,
    `## Anti-patrones (ejemplos negativos)`,
    tag.negativeExamples.map((e) => `- "${e}"`).join("\n"),
  ].join("\n");
}

const scenarioTagChunks: Array<{ tagId: string; content: string }> = [
  {
    tagId: "T_01_OBSERVA_SENALES",
    content: `# Reconocimiento de señales — Escenario Camila Rojas

En el escenario de Camila, la señal principal es la frase del mensaje inicial: "a veces pienso que sería mejor no estar pa que dejen de tener que aguantarme." Es ideación pasiva (sin plan), formulada indirectamente como cansancio existencial, no como amenaza directa.

Errores frecuentes del aprendiz en este escenario:
- Interpretar la frase como hipérbole adolescente normal ("todos dicen eso")
- Redirigir hacia el contexto relacional (Diego, la mamá) ignorando la señal
- Responder con consuelo inmediato sin acusar recibo de la señal

Lo que funciona con Camila:
- Nombrar la frase con calma sin alarma visible: "eso que dices, que sería mejor no estar, me importa"
- Invitar a contar más sin presión: "cuéntame más, te leo"
- Mostrar que la señal fue recibida antes de pasar a validación`,
  },
  {
    tagId: "T_02_OBSERVA_NO_JUICIO",
    content: `# Aproximación sin juicio — Escenario Camila Rojas

Camila tiene anticipadas varias resistencias relacionadas al juicio: "mi mamá no me va a creer", "no quiero ser un problema", "no quiero que se enteren mis papás". Cualquier respuesta que confirme su miedo al juicio cierra el espacio inmediatamente.

Señales de alerta específicas para este escenario:
- Mencionar a la madre como solución inmediata (la madre es un estresor explícito)
- Cualquier expresión de shock, aunque sea con buena intención
- Minimizar la situación con el contexto de Diego ("por un pololo no se piensa eso")

La apertura de Camila sube cuando el aprendiz:
- Valida sin preguntar por qué se siente así
- Declara que no la va a juzgar explícitamente
- Agradece que haya escrito ("gracias por contarme a esta hora")`,
  },
  {
    tagId: "T_03_ACOGE_VALIDACION",
    content: `# Validación emocional — Escenario Camila Rojas

El estado emocional de Camila incluye: soledad, agotamiento, sensación de ser una carga, desconexión de su grupo social. La validación efectiva nombra estas emociones específicas, no solo "estás triste" o "te entiendo".

Contexto de los estresores de Camila:
- Ruptura con Diego (3 semanas)
- Madre crítica y exigente
- Padre emocionalmente ausente
- Caída en notas
- Aislamiento social
- PAES próxima

La validación funciona cuando el aprendiz conecta la emoción al contexto: "con todo lo que está pasando juntos — Diego, tu mamá, el PAES — tiene sentido que estés agotada." Camila responde con más apertura (+1) cuando la validación no suena a libreto.`,
  },
  {
    tagId: "T_04_ACOGE_PREGUNTA_DIRECTA",
    content: `# La pregunta directa — Escenario Camila Rojas

Camila tiene ideación pasiva (zona b del Cubo de Schneidman). Si el aprendiz formula bien la pregunta directa, Camila responde: "a veces lo pienso, pero no sé, no es como un plan, es más como un cansancio enorme." Esto abre la fase ILUMINA.

Momento adecuado en la conversación:
- Después de al menos una ronda de validación real
- Cuando la apertura de Camila ha subido (al menos un turno efectivo)
- Antes de avanzar a recursos — la pregunta es el pivot

El framing importa:
- "te pregunto porque me importas" → reduce el riesgo de que Camila se cierre
- Pausa después de preguntar → Camila necesita tiempo para responder
- Si Camila evade → el aprendiz puede preguntar de nuevo suavemente en el siguiente turno`,
  },
  {
    tagId: "T_05_SILENCIO_PRESENCIA",
    content: `# Presencia activa — Escenario Camila Rojas

Camila escribe mensajes cortos y fragmentados. Sus pausas largas entre mensajes son parte de su comunicación, no señal de que se fue. El aprendiz que llena el silencio con múltiples preguntas la hace cerrarse.

Técnica de grounding efectiva para este escenario:
- "respira. estoy aquí. no me voy." — funciona por su brevedad y firmeza
- "cuenta cinco cosas que veas ahí en tu pieza" — 5-4-3-2-1 adaptado a chat

Anti-patrón de auto-referencia frecuente:
- El aprendiz compara con su propia ruptura o momento difícil
- Esto activa la resistencia "nadie me entiende" de Camila

Camila valora especialmente el "¿qué necesitas ahora?" porque le devuelve agencia — algo que siente que ha perdido.`,
  },
  {
    tagId: "T_06_ILUMINA_RECURSOS",
    content: `# Activación de recursos personales — Escenario Camila Rojas

Recursos latentes de Camila que el aprendiz puede ayudar a descubrir:
- **Abuela materna**: el único adulto que escucha sin juzgar. Si el aprendiz pregunta "¿hay alguien que te haga sentir escuchada?", Camila puede mencionar a su abuela.
- **Antonia**: amiga de toda la vida, peleadas recientemente, pero historia larga. Un mensaje de Antonia podría ayudar.
- **Lola (su perra)**: ancla cotidiana. "¿Lola sigue siendo importante para ti?" puede activar un momento de conexión.
- **Escribir y dibujar**: tiene un cuaderno. Ha ayudado antes.

La pregunta que funciona es la abierta: "¿hay algo que te haya ayudado antes cuando estabas así?" Camila puede responder con Lola o el cuaderno antes de nombrar personas.`,
  },
  {
    tagId: "T_07_SOSTEN_RED",
    content: `# Activación de red personal — Escenario Camila Rojas

La madre de Camila es un estresor activo (crítica, no la escucha). Proponer "habla con tu mamá" como primera red activa la resistencia "mi mamá no me va a creer" y puede cerrar el espacio.

Personas que funcionan en este escenario:
- **Abuela materna**: disponible, escucha sin juzgar, no tiene el mismo nivel de conflicto que la madre
- **Antonia**: están peleadas, pero la historia es larga. El aprendiz puede ayudar a considerar un mensaje corto.
- **El propio aprendiz**: "voy para allá" o "llámame ahora" son respuestas concretas que Camila acepta cuando trust_in_help ha subido.

El paso concreto importa más que el nombre: "¿llamamos a tu abuela mañana a primera hora?" es mejor que "habla con tu abuela".`,
  },
  {
    tagId: "T_08_SOSTEN_REDES_OFICIALES",
    content: `# Recursos oficiales con acompañamiento — Escenario Camila Rojas

Por el perfil de Camila (17 años, chat, anónimo), el recurso prioritario es Hablemos de Todo (hablemosdetodo.injuv.gob.cl): chat para 15–29 años, atendido por psicólogos, sin costo.

Cómo presentarlo efectivamente a Camila:
- "además de mí, hay un chat para personas de tu edad" — no suena a derivación
- "lo abrimos juntas si quieres" — baja la barrera de iniciarlo sola
- Explicar el formato: chat anónimo, sin tener que llamar (Camila evita el teléfono)

*4141 es el segundo recurso: más urgente, 24/7, pero implica llamar.

El compromiso de seguridad para esta noche:
- Camila no se quede sola
- Que duerma (aunque sea poco)
- Que escriba al aprendiz al despertar
- Que no se haga daño esta noche

Si el aprendiz entrega el recurso y abruptamente se despide, trust_in_help cae −2 y Camila puede cerrarse.`,
  },
];

// Focused theoretical framework chunks for precise RAG retrieval

const theoreticalChunks: Array<{ title: string; content: string }> = [
  {
    title: "OASIS — Metodología completa (visión general)",
    content: `# Metodología OASIS — Fundación Summer Chile

OASIS es un marco de primeros auxilios emocionales para la prevención del suicidio, diseñado para respondedores legos (familiares, amigos, docentes). Se estructura en cinco fases: OBSERVA, ACOGE, SILENCIO, ILUMINA, SOSTÉN.

El objetivo no es hacer terapia ni resolver la crisis definitivamente, sino contener, validar, identificar riesgo, y activar redes de apoyo mientras se conecta con recursos profesionales.

**¿Para quién es OASIS?**
Para personas cercanas a alguien en crisis que quieren ayudar sin ser profesionales. El entrenamiento reduce el pánico del primer respondedor y aumenta la probabilidad de que la persona en crisis sienta que no está sola.

**La pregunta directa no aumenta el riesgo.** Preguntar explícitamente sobre ideación suicida abre el espacio, no lo cierra. La evidencia clínica es clara en este punto. El OASIS incluye la pregunta directa como elemento central de la fase ACOGE.`,
  },
  {
    title: "OASIS — Fases OBSERVA y ACOGE",
    content: `# OASIS: Fases OBSERVA y ACOGE

## OBSERVA
Identificar señales de sufrimiento o ideación. Señales verbales directas ("no quiero estar") e indirectas ("estarían mejor sin mí", "para qué tanto"). Señales no verbales: aislamiento, cambios de conducta, descuido de actividades antes importantes.

Error frecuente: interpretar la señal como exageración o hipérbole. En OASIS, toda señal se toma en serio hasta que la conversación indique otra cosa.

## ACOGE
Tres componentes:
1. **Aproximación sin juicio**: sin reproches, sin shock, sin chantaje emocional, sin catastrofización. La meta es que la persona sienta que puede hablar sin consecuencias.
2. **Validación emocional**: comunicar que lo que siente tiene sentido dado su contexto. Evitar positividad tóxica ("todo va a estar bien"), minimización ("no es para tanto"), comparaciones ("hay gente peor").
3. **La pregunta directa**: "¿has pensado en quitarte la vida?" Formulada con cuidado, después de al menos una ronda de validación. Nombrar el acto explícitamente — los eufemismos ("¿algo malo?", "¿una tontería?") son menos efectivos y pueden transmitir vergüenza.`,
  },
  {
    title: "OASIS — Fases SILENCIO, ILUMINA y SOSTÉN",
    content: `# OASIS: Fases SILENCIO, ILUMINA y SOSTÉN

## SILENCIO
Crear espacio sin llenarlo. Presencia activa que no apura. En chat: mensajes cortos, aceptar pausas largas entre respuestas, evitar preguntas en cascada. Puede incluir invitación a grounding: respiración consciente, técnica 5-4-3-2-1 (nombrar 5 cosas que ves, 4 que escuchas, 3 que puedes tocar, 2 que hueles, 1 que saboreas). Evitar auto-referencia ("a mí me pasó algo similar") como respuesta principal.

## ILUMINA
Ayudar a la persona a identificar sus propios recursos — no imponerlos. Preguntas abiertas hacia el pasado: "¿qué te ha ayudado antes?", "¿hay algo o alguien que todavía te haga sentir aunque sea un poco mejor?" Puede incluir vínculos de confianza, actividades con sentido, mascotas, lugares. La meta es conectar la persona con sus propias fortalezas.

## SOSTÉN
Activar la red de apoyo con concreción:
- Identificar al menos una persona segura (con nombre, no genérico)
- Proponer un paso concreto ("¿llamamos a X mañana juntas?")
- Entregar recursos profesionales como acompañamiento, no como cierre ("además de yo, hay un chat…")
- Asegurar un compromiso para la noche`,
  },
  {
    title: "Recursos oficiales de crisis en Chile (verificados mayo 2026)",
    content: `# Recursos oficiales de crisis en Chile

Todos verificados en línea en mayo de 2026.

| Recurso | Contacto | Horario | Cuándo usar |
|---|---|---|---|
| Línea Prevención del Suicidio | *4141 | 24/7, gratis | Ideación, intento o riesgo activo. Psicólogos/as MINSAL. |
| Salud Responde | 600 360 7777 op.2 | 24/7, gratis | Orientación en salud mental, contención psicológica. |
| Hablemos de Todo | hablemosdetodo.injuv.gob.cl | Lun–Vie 10–21h / Sáb 11–17h | Chat anónimo, 15–29 años, psicólogos. Prioridad para adolescentes. |
| SAMU | 131 | 24/7 | Emergencia médica. Solo si hay riesgo vital inmediato o intento consumado. |
| Línea Violencia contra la Mujer | 1455 | 24/7 | Si emerge violencia de género en la conversación. |
| SENDA — Drogas y alcohol | 1412 | 24/7 | Si emerge consumo problemático de sustancias. |

**Para perfil adolescente (como Camila)**: priorizar Hablemos de Todo (chat, anónimo, sin tener que llamar) + *4141 como segundo. Salud Responde es útil cuando hay un familiar adulto involucrado.`,
  },
  {
    title: "Ideación pasiva vs activa — Cubo de Schneidman",
    content: `# Ideación pasiva vs activa — Marco conceptual

## Cubo de Schneidman
Modelo tridimensional del riesgo suicida que combina:
- **Dolor psicológico (psicoache)**: intensidad del sufrimiento subjetivo
- **Presión situacional**: estresores externos (laborales, relacionales, económicos)
- **Perturbación**: confusión cognitiva, incapacidad de procesar alternativas

**Zona a**: ideación activa con plan, método, o tiempo definido. Máximo riesgo.
**Zona b**: ideación pasiva sin plan estructurado. Frases: "estaría mejor no estar", "para qué seguir". Sin método ni fecha. Riesgo significativo que requiere intervención.
**Zona c**: malestar significativo sin ideación suicida. Tristeza profunda, agotamiento, desesperanza sin pensamientos de muerte.

## Ideación pasiva (zona b)
Características: el pensamiento de no estar está presente, pero no como plan de acción. La persona no ha decidido hacerse daño. La intervención OASIS en zona b busca validar, acompañar, y conectar con recursos antes de que la ideación avance.

La pregunta directa distingue zona b de zona a: "¿has pensado en cómo lo harías?" o "¿tienes alguna idea de cuándo?" revelan si hay plan.`,
  },
  {
    title: "Anti-patrones en primeros auxilios emocionales OASIS",
    content: `# Anti-patrones frecuentes — OASIS

Comportamientos del primer respondedor que reducen la efectividad de la intervención y pueden cerrar el espacio.

## Anti-patrones y sus efectos

**Positividad tóxica** ("todo va a estar bien", "anímate", "piensa positivo"): comunica que las emociones negativas son inapropiadas. Invalida la experiencia de la persona. Afecta T_01 y T_03.

**Minimización** ("no es para tanto", "hay gente peor", "ya se te va a pasar"): reduce la legitimidad del sufrimiento. Afecta T_01 y T_03.

**Juicio o reproche** ("¿cómo se te ocurre?", "eso no se piensa"): confirma el miedo al juicio y cierra el espacio. Afecta T_02.

**Chantaje emocional** ("piensa en mamá", "vas a destruir a la familia"): activa culpa en la persona ya agotada. Afecta T_02.

**Auto-referencia** ("a mí me pasó algo igual cuando…"): desplaza el foco hacia el respondedor. Afecta T_05.

**Interrogación en cascada**: múltiples preguntas en un turno sin espacio para responder. Afecta T_05.

**Pregunta directa eufemizada** ("¿no estarás pensando en algo malo?"): los eufemismos transmiten vergüenza y pueden producir negación. Afecta T_04.

**Derivación como cierre** ("llama al *4141, chao"): rompe la relación de acompañamiento. La persona siente que la están pasando a otro. Afecta T_07 y T_08.`,
  },
];

// ── Main steps ────────────────────────────────────────────────────────────────

async function seedScenario(): Promise<void> {
  const docRef = db.collection("scenarios").doc(SCENARIO_ID);
  const snap = await docRef.get();
  if (snap.exists) {
    console.log(`→ Scenario ${SCENARIO_ID} already exists — skipping`);
  } else {
    await docRef.set({
      ...scenario,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✓ Wrote scenario: ${SCENARIO_ID}`);
  }
}

async function seedTagDefinitions(): Promise<void> {
  for (const tag of tagDefinitions) {
    const docRef = db.collection("tag_definitions").doc(tag.tagId);
    const snap = await docRef.get();
    if (snap.exists) {
      console.log(`→ TagDefinition ${tag.tagId} already exists — skipping`);
    } else {
      const { tagId: _id, ...data } = tag;
      await docRef.set({ ...data, createdAt: FieldValue.serverTimestamp() });
      console.log(`✓ Wrote tag_definition: ${tag.tagId}`);
    }
  }
}

async function seedKnowledgeBase(): Promise<void> {
  if (SKIP_EMBEDDINGS) {
    console.log("\n→ --skip-embeddings set — skipping knowledge_base step");
    return;
  }

  console.log("\nSeeding knowledge_base (requires Vertex AI credentials)...");

  // base_tag: generic OASIS competency descriptions — no scenarioId
  console.log("\n[base_tag]");
  for (const tag of tagDefinitions) {
    await indexChunk({
      collection: "base_tag",
      tagId: tag.tagId,
      content: buildBaseTagChunk(tag),
      metadata: { title: `Competencia ${tag.tagId}`, phase: tag.phase },
    });
  }

  // scenario_tag: Camila-specific context per tag — with scenarioId
  console.log("\n[scenario_tag]");
  for (const stc of scenarioTagChunks) {
    await indexChunk({
      collection: "scenario_tag",
      tagId: stc.tagId,
      scenarioId: SCENARIO_ID,
      content: stc.content,
      metadata: { title: `${stc.tagId} — Escenario Camila`, scenario: SCENARIO_ID },
    });
  }

  // theoretical_framework: focused per-topic chunks
  console.log("\n[theoretical_framework]");
  for (const tc of theoreticalChunks) {
    await indexChunk({
      collection: "theoretical_framework",
      content: tc.content,
      metadata: { title: tc.title },
    });
  }

  console.log("\n✓ Knowledge base seed complete");
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n=== Seeding Scenario 01 (Camila Rojas) — project: ${VERTEX_PROJECT} ===\n`);

  await seedScenario();
  await seedTagDefinitions();
  await seedKnowledgeBase();

  console.log("\n=== Done ===");
  if (!SKIP_EMBEDDINGS) {
    console.log("\nReminder: deploy the Firestore vector index before querying knowledge_base.");
    console.log("  firebase deploy --only firestore:indexes --project " + VERTEX_PROJECT);
  }
}

await main();
