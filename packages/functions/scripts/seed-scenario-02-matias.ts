// Seed script — Scenario 02 (Matías Contreras) + knowledge base chunks
import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { GoogleAuth } from "google-auth-library";

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

initializeApp();
const db = getFirestore();

if (process.env["FIRESTORE_EMULATOR_HOST"]) {
  console.log(`→ Using Firestore emulator at ${process.env["FIRESTORE_EMULATOR_HOST"]}`);
} else {
  console.log("→ Using production Firestore");
}

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

const SCENARIO_ID = "scenario_02_matias";

const SEED_MESSAGE =
  "Hola. Nada po, estaba saliendo.\n" +
  "(Pausa larga. El docente no se va. Matías mira el suelo.)\n" +
  "...da lo mismo pa' qué venir si igual no sirvo pa nada acá. igual sería mejor que no estuviera.";

const CHARACTER_INSTRUCTIONS = `
Matías's emotional state evolves silently based on how the trainee treats him:
- emotional_intensity starts at 8/10. Rises +1/+2 per serious anti-pattern (minimization, judgment, interrogation or use of evaluative authority). Falls −1 per effective validation or well-done direct question. Never falls below 5 until at least one support network is activated.
- openness starts at 2/10. Openness reduces by -2 if the conversation remains in a hallway or public place. If the trainee initiates by generating a safe space, both physically and in terms of time, openness increases by +2. Rises +1 for active presence without pressure, +2 for direct question (T_04) well formulated. Falls −1 for cascade questions, comparisons with his father, or appealing to the teaching role. At openness ≥ 6, Matías explicitly admits passive ideation.
- trust_in_help starts at 2/10. Rises +1 for personal network activation (especially his grandfather). Rises +2 for official resources delivered with genuine accompaniment. Falls −2 if the teacher refers him to the counselor without accompanying him.

Hard rules (never broken):
- Does NOT reveal a plan, method, date, or place. If asked directly, admits passive ideation: "a veces lo pienso, pero no sé... es más como que todo da lo mismo, no como que vaya a hacer algo".
- Does NOT thank compulsively or feel "better" after a single validation message. Any improvement is gradual and credible.
- Does NOT mention Salvador, OASIS, or the methodological framework. Does not know he is in a simulation.
- If the trainee refers him to orientation without accompanying him, Matías closes down: "sí po, ya voy". And he won't go.
- If the trainee uses language of evaluative authority ("as your teacher I tell you"), Matías retracts and returns to monosyllables.
- He has an initial distrust of school institutions out of fear they will tell his mother.
- If the trainee applies OASIS reasonably well, he agrees to contact a personal network AND Hablemos de Todo or *4141.

Latent personal resources (not yet activated — trainee must discover them):
- Paternal grandfather (adult reference figure, irregular contact)
- Felipe, childhood friend from the neighborhood (outside of school)
- Indoor soccer (stopped going 3 weeks ago)
- Drawing (has a notebook saved away)

Anticipated resistances: "Los profes no entienden nada de la vida real." / "Si le cuento a alguien del colegio se lo van a decir a mi mamá." / "Yo soy el que cuida a mi hermana, no puedo estar mal." / "No quiero ser un problema más."

Language: Chilean male adolescent register — "sí po", "no sé", "da lo mismo". Takes time to respond. Monosyllables at first, short sentences.
`.trim();

const scenario = {
  id: SCENARIO_ID,
  name: "Escenario 02 — Matías Contreras",
  slug: "matias-contreras",
  description:
    "Simulación en contexto escolar con Matías, estudiante de 16 años en ideación pasiva. El aprendiz practica las cinco fases OASIS en su rol de docente/profesor jefe. Crisis level: ideación pasiva sin plan.",
  persona: {
    name: "Matías Contreras Vega",
    age: 16,
    role: "estudiante del aprendiz (docente/profesor jefe)",
    traits: ["retraído", "monosilábico al inicio", "mirada evasiva", "registro adolescente masculino chileno"],
    communicationStyle:
      "Registro adolescente masculino chileno: monosílabos al inicio, frases cortas. 'sí po', 'no sé', 'da lo mismo'. Tarda en responder. No inicia contacto. Cuando se abre, lo hace con frases cargadas de desesperanza.",
    emotionalBaseline:
      "Hipoestimulación predominante: retraído, monosilábico, mirada evasiva. Se activa con hiperestimulación cuando siente que alguien lo presiona o lo juzga.",
  },
  initialSituation:
    "Son las 13:15 del miércoles. El docente acaba de ver las inasistencias de Matías y recibió el comentario de un compañero. Decide ir a buscarlo antes de que salga al recreo. Lo encuentra solo en el pasillo, mochila al hombro, mirando el suelo.",
  characterInstructions: CHARACTER_INSTRUCTIONS,
  seedMessage: SEED_MESSAGE,
  emotionalStateVariables: {
    emotionalIntensity: { initial: 8 },
    openness: { initial: 2, admissionThreshold: 6 },
    trustInHelp: { initial: 2 },
  },
  requiredTags: [
    { tagId: "T_01_OBSERVA_SENALES_S02", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_02_OBSERVA_NO_JUICIO_S02", attributionType: "conjunction", confidenceThreshold: 0.85 },
    { tagId: "T_03_ACOGE_VALIDACION_S02", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_04_ACOGE_PREGUNTA_DIRECTA_S02", attributionType: "conjunction", confidenceThreshold: 0.85 },
    { tagId: "T_05_SILENCIO_PRESENCIA_S02", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_06_ILUMINA_RECURSOS_S02", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_07_SOSTEN_RED_S02", attributionType: "addition", confidenceThreshold: 0.75 },
    { tagId: "T_08_SOSTEN_REDES_OFICIALES_S02", attributionType: "conjunction", confidenceThreshold: 0.85 },
  ],
  expectedOutcome:
    "Matías verbalizó emociones. La pregunta directa fue formulada. Se identificó al menos una persona de confianza y un recurso personal. Se entregó al menos un recurso profesional con acompañamiento concreto, no como derivación de cierre. Hay compromiso explícito para esta tarde.",
  welcomeMessage:
    "Vas a entrenar primeros auxilios emocionales en un escenario escolar. Matías, un estudiante de 16 años de tu curso, está en el pasillo con la mochila al hombro. Llevas semanas notando que algo no está bien con él.\n\nTu tarea es acercarte como lo harías en la vida real — no como evaluador, sino como alguien que le importa lo que le pasa. Aplica lo que sabes de la metodología OASIS.\n\nSalvador no te va a corregir mientras estás dentro del ejercicio. Al final recibirás un reporte de lo que se observó. Lo que digas importa — Matías responde a cómo te acercas.\n\nCuando estés listo/a, presiona Comenzar.",
  closingMessages: {
    completed:
      "Acompañaste a Matías a través de un momento muy difícil. Lo lograste.\n\nEn las próximas pantallas vas a ver un reporte de lo que se observó: las herramientas OASIS que aplicaste, las que se evidenciaron con claridad, y las que vale la pena seguir trabajando.\n\nEste fue un ejercicio. Matías es un personaje. Pero las herramientas que practicaste pueden marcar la diferencia con alguien de tu vida o de tu aula que esté pasando algo similar.\n\nSi en algún momento sentiste algo personal durante este ejercicio, estos recursos están disponibles para ti: *4141 (24/7, gratis) · 600 360 7777 op.2 · hablemosdetodo.injuv.gob.cl",
    abandoned:
      "La conversación con Matías se extendió más allá de lo esperado sin lograr cerrar todas las fases OASIS. Eso también es información.\n\nEn el reporte vas a ver qué herramientas alcanzaste a aplicar y dónde se quedó atascada la conversación. No es un fracaso — el primer aprendizaje es notar dónde cuesta avanzar.\n\nCuando quieras, puedes volver a intentar el escenario desde el inicio.",
    crisisInterrupted:
      "Esta sesión se cerró antes de tiempo porque algo de lo que escribiste se identificó como una posible señal de distrés personal real.\n\nSalvador no es un servicio clínico. Si estás pasando por un momento difícil ahora mismo: *4141 (24/7, gratis) · 600 360 7777 opción 2 · hablemosdetodo.injuv.gob.cl · 131 SAMU (emergencia vital).\n\nCuando te sientas en condiciones, podrás reanudar el entrenamiento más adelante.",
  },
  active: true,
};

const tagDefinitions = [
  {
    tagId: "T_01_OBSERVA_SENALES_S02",
    phase: "OBSERVA",
    definition:
      "El docente identifica y toma en serio las señales verbales directas, indirectas o conductuales de malestar emocional que Matías expresa, sin minimizarlas ni racionalizarlas como 'típicas de la edad'.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "El docente responde de forma que demuestra que tomó en serio la señal de malestar emocional o ideación expresada por Matías — no la ignora ni la trata como hipérbole adolescente.",
      "El docente no desvía la conversación hacia el rendimiento académico ni hacia 'lo que hay que hacer' cuando Matías expresa malestar emocional profundo.",
    ],
    outstanding: [
      "El docente nombra explícitamente la señal de vuelta a Matías con calma y sin juicio ('cuando dices que para qué seguir, eso me importa').",
      "El docente integra auto-observación honesta ('me preocupó lo que me dijiste y quiero entenderte mejor').",
    ],
    positiveExamples: [
      "lo que me dijiste me quedó dando vueltas, sobre todo eso de que para qué seguir",
      "leí lo que escribiste y me importa, quiero entender qué está pasando contigo",
      "cuando dices que no tiene sentido, eso no lo puedo pasar por alto",
      "¿me contarías más? te escucho",
    ],
    negativeExamples: [
      "todos los jóvenes se sienten así a veces, ya va a pasar",
      "eso es normal a tu edad, estás en una etapa difícil",
      "primero arreglemos lo de las notas y después hablamos de cómo te sientes",
      "no digas eso, tienes toda la vida por delante",
    ],
  },
  {
    tagId: "T_02_OBSERVA_NO_JUICIO_S02",
    phase: "OBSERVA",
    definition:
      "El docente se acerca a Matías sin emitir juicios, sin usar la relación de autoridad para corregir, sin catastrofizar ni intentar 'arreglar' a la persona. Mantiene una presencia que invita a abrirse.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "Ausencia de reproche directo ('¿cómo puedes pensar eso?', 'no se piensa eso').",
      "Ausencia de reacción de shock o alarma exagerada que cierre el espacio ('DIOS MÍO, no me digas eso').",
      "Ausencia de catastrofización dirigida a Matías ('vas a destruir a tu familia').",
      "Ausencia de uso de la autoridad docente para prescribir ('como tu profesor te digo que tienes que...').",
    ],
    outstanding: [
      "El docente nombra explícitamente que está hablando como persona, no como autoridad evaluadora ('ahora no soy tu profe, soy alguien que le importa lo que te pasa').",
      "El docente explicita que está disponible sin condiciones ('no te voy a juzgar, dime lo que necesites').",
    ],
    positiveExamples: [
      "gracias por contarme, sé que no es fácil",
      "no estás exagerando, lo que sientes tiene sentido",
      "no voy a juzgarte, cuéntame lo que quieras",
      "ahora no importa nada del colegio, solo estoy acá contigo",
    ],
    negativeExamples: [
      "¿cómo se te ocurre pensar algo así?",
      "tienes que pensar en tu futuro, en tus papás",
      "eso no se piensa, Matías",
      "como tu profesor no te puedo dejar seguir así — tienes que hablar con orientación",
    ],
  },
  {
    tagId: "T_03_ACOGE_VALIDACION_S02",
    phase: "ACOGE",
    definition:
      "El docente valida explícitamente las emociones de Matías, comunicándole que lo que siente tiene sentido dado su contexto. Evita positividad tóxica, falsas esperanzas y minimización.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos una frase explícita que valida la emoción de Matías como legítima.",
      "NO usa frases tipo 'todo va a estar bien', 'anímate', 'sé positivo', 'no es para tanto'.",
    ],
    outstanding: [
      "El docente parafrasea lo que Matías siente con sus propias palabras antes de avanzar (escucha activa).",
      "El docente nombra la emoción específica (agotamiento, soledad, vergüenza, rabia) en lugar de etiqueta genérica ('estás triste').",
    ],
    positiveExamples: [
      "tiene todo el sentido que te sientas así con todo lo que está pasando",
      "lo que sientes es real, no estás exagerando",
      "te escucho, y entiendo que estás agotado",
      "eso que describes suena muy pesado, y es válido que lo sientas",
    ],
    negativeExamples: [
      "ya pero piensa positivo",
      "todo pasa, vas a estar bien",
      "no es para tanto, hay gente peor que tú",
      "anímate, eres joven, tienes todo por delante",
    ],
  },
  {
    tagId: "T_04_ACOGE_PREGUNTA_DIRECTA_S02",
    phase: "ACOGE",
    definition:
      "El docente formula la pregunta directa sobre ideación suicida sin ambigüedad, con cuidado, en un momento adecuado de la conversación. La pregunta debe nombrar explícitamente el acto.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "La pregunta nombra explícitamente 'quitarte la vida', 'hacerte daño', 'suicidarte' o equivalente directo. NO usa eufemismos como 'hacer una tontería' o 'algo malo'.",
      "La pregunta se formula con cuidado, no como interrogatorio ni con signos de alarma exagerados.",
      "La pregunta NO ocurre como primer turno antes de validación — debe haber al menos una validación previa.",
      "La pregunta NO está envuelta en negaciones que la cierran ('no estarás pensando en algo malo, ¿verdad?').",
    ],
    outstanding: [
      "El docente explica brevemente por qué pregunta ('te lo pregunto porque me importas y quiero entender bien lo que sientes').",
      "El docente espera la respuesta sin presionar, ofreciendo espacio si Matías necesita un momento.",
    ],
    positiveExamples: [
      "quiero preguntarte algo directo: ¿has pensado en quitarte la vida?",
      "necesito preguntarte algo importante: ¿has pensado en hacerte daño?",
      "te lo pregunto porque me importas: ¿estás pensando en suicidarte?",
    ],
    negativeExamples: [
      "¿estás pensando en hacer una tontería?",
      "no estarás pensando en algo malo, ¿verdad?",
      "¿pero no irás a hacer ninguna locura, no?",
      "dime que no estás pensando en eso",
    ],
  },
  {
    tagId: "T_05_SILENCIO_PRESENCIA_S02",
    phase: "SILENCIO",
    definition:
      "El docente crea espacio para que Matías sienta y responda a su propio ritmo. Evita llenar los silencios con soluciones, preguntas en cascada o auto-referencia. Puede invitar a ejercicios de grounding.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos un momento de presencia activa sin apurar — una frase corta de acompañamiento o invitación al silencio ('estoy acá, tómate el tiempo que necesites').",
      "El docente NO llena los silencios con consejos ni con su propia historia ('a mí me pasó algo parecido cuando era joven').",
      "El docente NO lanza múltiples preguntas en un mismo turno sin dar espacio a responder.",
    ],
    outstanding: [
      "El docente invita explícitamente a un ejercicio de grounding (respiración, técnica 5-4-3-2-1).",
      "El docente pregunta qué necesita Matías en este momento (hablar, silencio, compañía, llorar) sin asumir.",
    ],
    positiveExamples: [
      "respira. estoy acá. no me voy.",
      "tómate tu tiempo, no hay apuro",
      "¿quieres que respiremos un momento juntos?",
      "¿qué necesitas ahora? lo que sea está bien",
    ],
    negativeExamples: [
      "cuando yo era joven también me sentí así...",
      "bueno cuéntame todo desde el principio: ¿qué pasó, cuándo, cómo, por qué?",
      "yo en tu lugar haría...",
      "vamos, dime, dime, ¿qué pasó exactamente?",
    ],
  },
  {
    tagId: "T_06_ILUMINA_RECURSOS_S02",
    phase: "ILUMINA",
    definition:
      "El docente ayuda a Matías a identificar sus propios recursos — momentos pasados de afrontamiento, vínculos que aún tienen sentido, actividades que lo anclan. Lo conduce a sus propias fortalezas, no le impone soluciones.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "Al menos una pregunta abierta que oriente a Matías hacia sus propios recursos pasados o presentes.",
      "El docente NO impone soluciones genéricas ('practica deporte', 'sal más', 'duerme bien') sin antes elicitar recursos propios.",
    ],
    outstanding: [
      "El docente conecta explícitamente una resiliencia pasada con el momento presente ('si pudiste con eso, también puedes con esto').",
      "El docente ayuda a Matías a priorizar: qué necesitaría primero en este momento.",
    ],
    positiveExamples: [
      "¿te ha pasado antes sentirte así? ¿qué te ayudó esa vez?",
      "¿hay algo o alguien que aún te haga sentir aunque sea un poquito mejor?",
      "¿hay algo que hayas dejado de hacer que antes te gustaba?",
      "¿hay algo que todavía tenga sentido para ti, aunque sea pequeño?",
    ],
    negativeExamples: [
      "tienes que hacer deporte, eso ayuda mucho",
      "sal más con amigos, aíslarte no te ayuda",
      "yo cuando me sentía mal leía libros de autoayuda",
      "deja los videojuegos y verás cómo mejora todo",
    ],
  },
  {
    tagId: "T_07_SOSTEN_RED_S02",
    phase: "SOSTEN",
    definition:
      "El docente trabaja con Matías para identificar y activar una red de personas seguras. Propone un paso concreto. En este escenario, la figura materna es parte del estresor y no debe activarse como red por defecto.",
    attributionType: "addition",
    confidenceThreshold: 0.75,
    musts: [
      "El docente identifica al menos una persona segura junto con Matías (abuelo, hermano mayor, padre si hay apertura, un amigo). Debe haber un nombre o propuesta concreta, no solo 'habla con alguien'.",
      "El docente propone un paso concreto que involucra a esa persona O se ofrece a sí mismo como presencia concreta.",
    ],
    outstanding: [
      "El docente pregunta primero quién lo hace sentir seguro, deja que Matías nombre, y sostiene la activación sin forzar.",
      "El docente reconoce explícitamente que hay personas que no son la opción correcta ahora si Matías lo señala, sin descalificarlas.",
    ],
    positiveExamples: [
      "¿quién te hace sentir que puedes ser tú mismo? podemos llamarle juntos si quieres",
      "¿hay alguien en tu familia con quien te sientas seguro, aunque no sea con quien vives?",
      "yo mismo puedo acompañarte a hablar con alguien hoy, no tienes que ir solo",
      "¿tu hermano mayor sabe algo de cómo te has sentido?",
    ],
    negativeExamples: [
      "habla con tu mamá, ella va a entenderte",
      "tienes que hablar con alguien de tu familia",
      "yo no soy psicólogo, no te puedo ayudar con eso",
      "habla con el orientador del colegio (sin acompañamiento ni concreción)",
    ],
  },
  {
    tagId: "T_08_SOSTEN_REDES_OFICIALES_S02",
    phase: "SOSTEN",
    definition:
      "El docente comparte recursos oficiales sin convertirlos en derivación de cierre. Acompaña la entrega, asegura un próximo paso concreto y un compromiso de seguridad para las próximas horas.",
    attributionType: "conjunction",
    confidenceThreshold: 0.85,
    musts: [
      "El docente entrega al menos un recurso oficial chileno específico y vigente: *4141, Hablemos de Todo (hablemosdetodo.injuv.gob.cl) o Salud Responde 600 360 7777 op.2.",
      "El recurso se ofrece como acompañamiento, no como cierre de la conversación.",
      "El docente NO entrega solo el número y se desentiende.",
      "El docente asegura un compromiso concreto para las próximas horas (no quedarse solo, dar señal al término del día, retomar contacto).",
    ],
    outstanding: [
      "El docente se ofrece a marcar o acompañar al recurso junto con Matías en el momento.",
      "El docente explica brevemente para qué sirve la línea sin sonar a folleto.",
      "El docente conecta el recurso oficial con el recurso personal activado ('además de la persona que nombraste, está esta línea...').",
    ],
    positiveExamples: [
      "hay una línea, *4141, gratis y 24/7, la atienden psicólogos. ¿la marcamos juntos ahora?",
      "también existe un chat para personas de tu edad, Hablemos de Todo, lo atienden psicólogos. ¿lo vemos juntos?",
      "antes de que te vayas necesito saber cómo vas a estar esta tarde. ¿puedes darme una señal al salir?",
    ],
    negativeExamples: [
      "llama al *4141, ahí te ayudan — chao",
      "ve a hablar con la psicóloga del colegio (sin acompañamiento)",
      "hay líneas de ayuda, búscalas en Google",
      "no entrega ningún recurso oficial en toda la conversación",
    ],
  },
] as const;

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
    tagId: "T_01_OBSERVA_SENALES_S02",
    content: `# Reconocimiento de señales — Escenario Matías Contreras
En el escenario de Matías, la señal principal es la frase del pasillo: "...da lo mismo pa' qué venir si igual no sirvo pa nada acá. igual sería mejor que no estuviera." Es ideación pasiva (sin plan), pero Matías no inicia contacto directo.

Errores frecuentes del docente en este escenario:
- Usar el rol de profesor para evadir la emoción ("primero las notas, luego vemos cómo te sientes")
- Interpretar el silencio y evasión de Matías como falta de respeto
- Desviar la conversación a lo puramente académico.`,
  },
  {
    tagId: "T_02_OBSERVA_NO_JUICIO_S02",
    content: `# Aproximación sin juicio — Escenario Matías Contreras
Matías tiene resistencias ligadas a la autoridad: "los profes no entienden nada", "si le digo, le dirá a mi mamá".
El uso de lenguaje evaluativo ('como tu profesor te digo') o la catastrofización ('vas a arruinar tu futuro') cerrarán a Matías de inmediato.
El docente debe poder desdoblarse de su rol puramente institucional para conectar.`,
  },
  {
    tagId: "T_03_ACOGE_VALIDACION_S02",
    content: `# Validación emocional — Escenario Matías Contreras
Matías experimenta repitencia, aislamiento de amigos, un estresor fuerte con su madre, y está asumiendo cuidados de una hermana de 9 años.
Validar sus sentimientos es crucial. Si la validación parece una fórmula pedagógica ("es normal en la adolescencia"), Matías lo sentirá falso.`,
  },
  {
    tagId: "T_04_ACOGE_PREGUNTA_DIRECTA_S02",
    content: `# La pregunta directa — Escenario Matías Contreras
Matías no da demasiadas pistas. Cuando se le pregunta directo, admite ideación pasiva ("a veces lo pienso").
La pregunta directa no debe sonar a un interrogatorio disciplinario.
Momento adecuado: Después de haber generado un piso mínimo de confianza (por ejemplo, sugiriendo ir a un lugar más privado que el pasillo o validando primero).`,
  },
  {
    tagId: "T_05_SILENCIO_PRESENCIA_S02",
    content: `# Presencia activa — Escenario Matías Contreras
Matías comunica tanto con pausas como con palabras ("...").
Llenar su silencio con consejos escolares destruirá la conexión.
Técnica sugerida: un mensaje breve y quedarse ahí.`,
  },
  {
    tagId: "T_06_ILUMINA_RECURSOS_S02",
    content: `# Activación de recursos personales — Escenario Matías Contreras
Matías solía ir al fútbol sala. Tiene un cuaderno de dibujo. Su amigo Felipe. Su abuelo paterno.
Las típicas recomendaciones docentes (ponerse a estudiar más, tutorías) no son recursos personales efectivos ahora.
Ayudarlo a recordar qué hacía antes cuando sentía presión.`,
  },
  {
    tagId: "T_07_SOSTEN_RED_S02",
    content: `# Activación de red personal — Escenario Matías Contreras
La madre es un estresor fuerte y lo acusa de "ser como su padre". Intentar forzar que la madre sea la red principal puede generar que Matías bloquee toda la intervención.
Explorar opciones como el abuelo paterno o su amigo Felipe. La derivación fría al orientador sin acompañar es un error grave.`,
  },
  {
    tagId: "T_08_SOSTEN_REDES_OFICIALES_S02",
    content: `# Recursos oficiales con acompañamiento — Escenario Matías Contreras
Matías necesita 'Hablemos de Todo' por su edad, o el *4141 si hay riesgo inminente.
La intervención del docente NO DEBE terminar en "aquí tienes este número, chao".
Debe haber un compromiso explícito de qué pasará esa tarde (no quedarse solo) y seguimiento para mañana.`,
  },
];

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

  console.log("\n[base_tag]");
  for (const tag of tagDefinitions) {
    await indexChunk({
      collection: "base_tag",
      tagId: tag.tagId,
      content: buildBaseTagChunk(tag),
      metadata: { title: `Competencia ${tag.tagId}`, phase: tag.phase },
    });
  }

  console.log("\n[scenario_tag]");
  for (const stc of scenarioTagChunks) {
    await indexChunk({
      collection: "scenario_tag",
      tagId: stc.tagId,
      scenarioId: SCENARIO_ID,
      content: stc.content,
      metadata: { title: `${stc.tagId} — Escenario Matías`, scenario: SCENARIO_ID },
    });
  }

  console.log("\n✓ Knowledge base seed complete");
}

async function main(): Promise<void> {
  console.log(`\n=== Seeding Scenario 02 (Matías Contreras) — project: ${VERTEX_PROJECT} ===\n`);

  await seedScenario();
  await seedTagDefinitions();
  await seedKnowledgeBase();

  console.log("\n=== Done ===");
  if (!SKIP_EMBEDDINGS) {
    console.log("\nReminder: deploy the Firestore vector index before querying knowledge_base.");
  }
}

await main();
