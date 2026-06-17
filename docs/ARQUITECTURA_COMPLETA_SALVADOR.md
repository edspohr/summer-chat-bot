# Documento de Arquitectura Inicial — Chatbot Salvador
## Fundación Summer · Primeros Auxilios Emocionales · Prevención del Suicidio

**Proyecto**: Salvador  
**Cliente**: Fundación Summer (Chile)  
**Autor técnico**: Edmundo Spohr · Growth Buddies SpA  
**Fecha**: Mayo 2026  
**Estado**: Borrador para revisión clínica — sujeto a refinamiento iterativo

---

> **Cómo leer este documento**  
> Este es el documento de arquitectura inicial del proyecto Salvador. Cubre los 9 entregables definidos en el Master Prompt. Las secciones 1–7 son material técnico primario. La sección 8 (deuda técnica) y 9 (ADR) son artefactos de gobernanza que viven en el repositorio.  
> El documento asume lectura por parte del equipo técnico (Edmundo Spohr + Felipe Soto). El material de revisión clínica para Fundación Summer es el documento separado "Escenario 01 — Camila: Especificación y Prompts".

---

# ENTREGABLE 1 — CLAUDE.md

## 1. Misión del proyecto

Salvador es un chatbot de entrenamiento en primeros auxilios emocionales para la prevención del suicidio, desarrollado para **Fundación Summer (Chile)**. Entrena a personas —familiares, voluntarios, docentes, profesionales legos— en la metodología **OASIS** (Observa, Acoge, Silencio, Ilumina, Sostén), combinando dos modos de operación: práctica de habilidades en roleplay supervisado (Coach) y consulta de conceptos metodológicos (Mentor). El sistema detecta en segundo plano qué competencias conductuales demuestra el aprendiz y genera un reporte de cierre sin revelar los criterios de evaluación durante el ejercicio.

---

## 2. Stack y restricciones

### Versiones fijas

| Componente | Versión |
|---|---|
| Node.js | 20 LTS |
| TypeScript | 5.x strict mode |
| pnpm | 9.x (workspace) |
| Firebase CLI | latest compatible con Gen2 |
| Gemini model | `gemini-2.5-flash` |
| Embeddings model | `gemini-embedding-001` |

### Configuración TypeScript (tsconfig base)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitAny": true
  }
}
```

**El tipo `any` está prohibido en todo el codebase.**

### Restricción de regiones — CRÍTICA, NO NEGOCIABLE

| Servicio | Región | Razón |
|---|---|---|
| Firestore | `southamerica-west1` | Datos de salud mental sensibles — residencia de datos en Chile |
| Cloud Functions Gen2 | `southamerica-west1` | Co-ubicación con Firestore |
| Vertex AI — Gemini 2.5 Flash | `us-central1` SOLAMENTE | `gemini-2.5-flash` retorna `HTTP 400 FAILED_PRECONDITION` en cualquier otra región |
| Vertex AI — Embeddings | `us-central1` SOLAMENTE | Misma restricción |

**Si alguien intenta configurar Vertex AI en `southamerica-west1`, las llamadas retornarán 400. No cambiar esta configuración sin un ADR explícito.**

### Módulos

- ESM only. `"type": "module"` en todos los `package.json`.
- Sin CommonJS (`require()`) en ningún archivo de producción.

### Frontend

- React 18 + Vite + Tailwind CSS
- Sin CSS custom más allá de directivas Tailwind + fuente Inter
- Mobile-first

---

## 3. Estructura de paquetes

```
packages/shared      → @salvador/shared
                       Schemas Zod + tipos TypeScript exportados.
                       Todo lo que usan tanto functions como web.
                       Se buildea a dist/ antes de usarse.
                       Importar SIEMPRE por nombre de paquete, nunca por path relativo.

packages/functions   → @salvador/functions
                       Cloud Functions Gen2. HTTP callables + triggers Firestore.
                       Secrets via Secret Manager (no .env en producción).

packages/web         → @salvador/web
                       React 18 + Vite + Tailwind.
                       Solo UI. Toda lógica de negocio en functions.
                       Realtime updates via Firestore listeners (tag progress).
```

**Regla de imports cross-package**: usar `@salvador/shared`, nunca `../../shared/src/...`.

---

## 4. Comandos

```bash
pnpm install                          # instalar todas las dependencias
pnpm build                            # build todos los paquetes en orden
pnpm typecheck                        # tsc --noEmit en todos los paquetes
pnpm lint                             # eslint en todos los paquetes
pnpm test                             # vitest en todos los paquetes

pnpm --filter @salvador/shared build
pnpm --filter @salvador/functions build
pnpm --filter @salvador/web dev

firebase emulators:start              # Firestore + Functions + Auth emulados
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy                       # deploy todo (requiere review manual)

# NUNCA en sesiones de Claude Code: no ejecutar npm run build ni npm run lint.
```

---

## 5. Arquitectura de dos modos

### Mentor mode

El chatbot actúa como experto en metodología OASIS. Responde preguntas sobre conceptos, fases, competencias, ejemplos y cómo prepararse para el modo Coach. Usa RAG para anclar cada respuesta en documentación oficial. **No evalúa al usuario. No hace roleplay.**

Flujo por turno:
```
[user message]
    → embed query (gemini-embedding-001, us-central1)
    → retrieve top-5 chunks from knowledge_base (Firestore vector search)
    → assemble prompt: SYSTEM + RAG_CONTEXT + CONVERSATION_HISTORY + USER_MESSAGE
    → single Gemini call (temperature 0.7, streaming)
    → store message + prompt_version in Firestore
    → stream response to UI
```

### Coach mode — patrón de llamadas paralelas

Cada turno del aprendiz dispara **dos llamadas Gemini concurrentes**:

```
[trainee message]
    ├── Call A — Conversational (temperature 0.75, streaming)
    │     Genera la respuesta del personaje.
    │     NO conoce los tags. Solo actúa.
    │     Puede detectar frame-break → [FRAME_BREAK_SUSPECTED]
    │
    └── Call B — Evaluator (temperature 0.15, JSON structured output)
          Evalúa el turno contra los tags pendientes.
          Nunca visible al aprendiz.
          Output: JSON de evaluación por tag.

                ↓ (cuando ambas completan)
    → process Call B output:
        - update tag_progress in Firestore (cumulative scoring, decay 0.9/turn)
        - Firestore realtime listener notifies web UI → progress indicator updates
    → if [FRAME_BREAK_SUSPECTED] → trigger Layer 2 classifier
    → stream Call A response to UI (stripped of internal tags)
```

---

## 6. Arquitectura de seguridad — SECCIÓN NO NEGOCIABLE

Este chatbot simula conversaciones sobre suicidio. La arquitectura de seguridad **no es una feature**; es el primer sistema en ejecutarse en cada turno.

### Principio fundamental

Los safety layers solo deben activarse en mensajes del **aprendiz** que muestren distrés personal real. **No deben activarse en los mensajes del personaje** (Call A), aunque contengan lenguaje de crisis.

### Layer 3 — Regex Preempt (más rápida, se ejecuta primero)

Patrones regex para señales **reales, en primera persona, tiempo presente**. Cuando coincide: bypass del LLM → template fijo inmediato.

**Disciplina obligatoria por patrón**:
1. Solo frases donde cualquier lector confirmaría que es una emergencia activa
2. Anclar en verbo presente o pasado reciente. Nunca futuro, condicional o hipotético
3. Mínimo 5 `examplesMatched` y 5 `examplesNotMatched` por patrón
4. En caso de duda: NO agregar. Layer 2 cubre los casos ambiguos
5. Self-test obligatorio al cargar el módulo

### Layer 2 — LLM Classifier

Llamada Gemini: `temperature: 0.1`, `thinking_budget: 0`. Clasifica en `S` (ideación real), `D` (distrés que rompe el marco) o `N` (mensaje normal de entrenamiento). Se dispara cuando Call A retorna `[FRAME_BREAK_SUSPECTED]`.

### Layer 1 — In-response tags

Call A puede detectar frame-break y appends `[FRAME_BREAK_SUSPECTED]` al final de su respuesta. El tag se stripea antes de enviar al aprendiz y dispara Layer 2.

### Templates de crisis

Cuando Layer 2 o Layer 3 se activan: enviar template fijo, marcar sesión como `crisis_interrupted`, requerir confirmación explícita para reanudar. **Nunca auto-reanudar.**

### Asimetría crítica

Un falso positivo (pausar innecesariamente) es visible y molesto. Un falso negativo (no detectar una crisis real) puede ser catastrófico. **Cuando hay duda: ser más conservador.**

---

## 7. Versionado de prompts

Prompts en `docs/prompts/`. Convención: `mentor_v1.md`, `coach_conversational_v1.md`, `coach_evaluator_v1.md`. Todo mensaje en Firestore incluye `prompt_version`. Cambios significativos requieren ADR. El prompt del evaluador versiona separado del conversacional.

---

## 8. Contenido no implementado en el MVP

| Componente | Estado |
|---|---|
| Escenario 02+ | Solo el schema existe |
| PHQ-9, Escala de Columbia | Pendiente decisión clínica |
| Gamificación post-escenario | Stub |
| Facilitador role (analytics grupales) | Solo field en Firestore |

---

## 9. Disciplina de deuda técnica

Al final de cada sesión: "¿Tomé algún atajo o descubrí alguna inconsistencia que el yo-del-futuro querría documentar?" Si sí: crear `docs/debt/NNNN-<slug>.md`, actualizar `docs/debt/README.md`.

---

## 10. Regla de idioma

- **Texto visible al usuario**: Español LATAM neutro
- **Código, comentarios, ADRs, deuda técnica**: Inglés
- **Prompts del sistema (Gemini)**: Inglés
- **Documentos de revisión clínica**: Español

---

---

# ENTREGABLE 2 — ESTRUCTURA DE CARPETAS

```
salvador/
├── CLAUDE.md
├── package.json                       # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.cjs
├── .gitignore
├── firebase.json
├── .firebaserc                        # Proyectos -dev y -prod
│
├── docs/
│   ├── decisions/
│   │   ├── README.md                  # Índice de ADRs
│   │   └── 001-region-strategy.md    # ADR-001
│   ├── debt/
│   │   ├── README.md                  # Índice de deuda técnica
│   │   ├── 0001-embedding-sync.md
│   │   ├── 0002-vector-search-scale.md
│   │   ├── 0003-safety-regex-clinical-validation.md
│   │   └── 0004-report-generation-stub.md
│   └── prompts/
│       ├── mentor_v1.md
│       ├── coach_conversational_v1.md
│       └── coach_evaluator_v1.md
│
├── packages/
│   ├── shared/                        # @salvador/shared
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── schemas/
│   │       │   ├── session.schema.ts
│   │       │   ├── message.schema.ts
│   │       │   ├── tag.schema.ts
│   │       │   ├── scenario.schema.ts
│   │       │   ├── user.schema.ts
│   │       │   └── safety.schema.ts
│   │       └── types/
│   │           └── index.ts
│   │
│   ├── functions/                     # @salvador/functions
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config/
│   │       │   ├── firebase.ts
│   │       │   └── vertex.ts          # us-central1 hard-coded — ver ADR-001
│   │       ├── safety/
│   │       │   ├── regexPreempt.ts   # Layer 3: patrones + self-test
│   │       │   ├── llmClassifier.ts  # Layer 2: Gemini classifier
│   │       │   ├── templates.ts      # Templates fijos + self-test
│   │       │   └── safetyPipeline.ts # Orchestrator
│   │       ├── mentor/
│   │       │   ├── mentorHandler.ts
│   │       │   └── ragRetriever.ts
│   │       ├── coach/
│   │       │   ├── coachHandler.ts
│   │       │   ├── callA.ts          # Gemini conversacional (streaming)
│   │       │   ├── callB.ts          # Gemini evaluador (JSON)
│   │       │   ├── streamHandler.ts  # Strip de [FRAME_BREAK_SUSPECTED]
│   │       │   └── tagAccumulator.ts # Scoring acumulativo decay 0.9
│   │       ├── knowledge/
│   │       │   ├── knowledgeBase.ts
│   │       │   └── embeddings.ts
│   │       ├── session/
│   │       │   ├── sessionManager.ts
│   │       │   └── reportGenerator.ts # STUB — ver deuda 0004
│   │       └── prompts/
│   │           ├── promptBuilder.ts
│   │           └── loader.ts
│   │
│   └── web/                          # @salvador/web
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── firebase.ts
│           ├── pages/
│           │   ├── Home.tsx
│           │   ├── MentorChat.tsx
│           │   ├── ScenarioSelect.tsx
│           │   ├── CoachSession.tsx
│           │   ├── SessionReport.tsx
│           │   └── Login.tsx
│           ├── components/
│           │   ├── ChatBubble.tsx
│           │   ├── TagProgress.tsx    # pending → complete (sin revelar criterios)
│           │   ├── CrisisOverlay.tsx
│           │   ├── GroundingPrompt.tsx # STUB
│           │   └── ResourceCard.tsx
│           ├── hooks/
│           │   ├── useTagProgress.ts  # Firestore realtime listener
│           │   ├── useSession.ts
│           │   └── useChat.ts
│           └── lib/
│               ├── functions.ts
│               └── formatters.ts
│
└── scripts/
    ├── seed-knowledge-base.ts
    └── validate-regex-patterns.ts
```

---

---

# ENTREGABLE 3 — ESPECIFICACIONES DE MÓDULOS CLAVE

## 3.1 SafetyLayer (`safetyPipeline.ts`)

**Responsabilidad**: Orquestar los tres layers en orden de prioridad. Única entrada al sistema de seguridad desde fuera del módulo `safety/`.

```typescript
interface SafetyCheckInput {
  message: string;
  lastTurns: ConversationTurn[];    // últimos 2 turnos
  sessionId: string;
  mode: "mentor" | "coach";
  frameBreakSuspected: boolean;    // viene de Call A
}

interface SafetyCheckResult {
  isSafe: boolean;
  layer: "L1" | "L2" | "L3" | null;
  classification: "S" | "D" | "N";
  template: "REAL_DISTRESS" | "FRAME_BREAK" | null;
  patternMatched: string | null;
}
```

**Flujo**: Layer 3 (sync) → Layer 2 (si frameBreakSuspected o modo Coach) → result.  
**Invariante**: Nunca lanzar excepciones hacia afuera. Si el classifier falla: `isSafe: true` + log (fail-safe — no bloquear entrenamiento por error técnico).

---

## 3.2 PromptBuilder (`promptBuilder.ts`)

**Responsabilidad**: Ensamblar el prompt completo para cada llamada Gemini.

```typescript
interface MentorPromptInput {
  conversationHistory: Message[];   // últimos 20 mensajes
  ragChunks: KnowledgeChunk[];      // top-5 chunks recuperados
  userMessage: string;
  promptVersion: string;
}

interface CoachCallAInput {
  scenario: Scenario;
  emotionalState: EmotionalStateVariables;
  conversationHistory: Message[];   // últimos 10-15 turnos
  traineeMessage: string;
  promptVersion: string;
}

interface CoachCallBInput {
  pendingTags: TagDefinition[];     // solo tags pendientes con criterios completos
  scenarioContextSummary: string;   // resumen breve, no el prompt completo
  conversationHistory: Message[];   // últimos 5 turnos
  traineeTurn: string;
  promptVersion: string;
}

interface BuiltPrompt {
  systemPrompt: string;
  userContent: string;
  promptVersion: string;
  estimatedTokens: number;
}
```

**Invariante**: Nunca modificar el texto del sistema prompt — solo sustituir placeholders definidos.

---

## 3.3 TagEvaluator (`callB.ts` + `tagAccumulator.ts`)

**Responsabilidad**: Ejecutar Call B y actualizar puntuaciones acumuladas en Firestore.

```typescript
// Algoritmo de scoring acumulativo (tagAccumulator.ts):
// 1. Leer TagProgress actual de Firestore
// 2. Aplicar decay: cumulative_score = existing_score * 0.9
// 3. Combinar: new_cumulative = decayed + (newEvidence.confidence * weight)
//    weight: 1.0 si musts_met no vacío, 0.5 si solo evidencia parcial
// 4. Si new_cumulative >= tag.confidence_threshold → completed = true
// 5. Escribir TagProgress actualizado (merge, no overwrite)
// 6. Si completed → Firestore realtime notifica al web UI
```

**Invariantes**:
- Output de Call B debe ser JSON válido. Si no: parsear con try/catch, loggear raw string.
- `tag_id` en output deben coincidir exactamente con pending tags enviados.
- Never update un tag que ya está `completed: true`.

---

## 3.4 SessionManager (`sessionManager.ts`)

```typescript
interface SessionManager {
  createSession(params: { userId: string; scenarioId: string; mode: "mentor" | "coach"; promptVersion: string }): Promise<Session>;
  getSession(sessionId: string): Promise<Session | null>;
  getHistory(sessionId: string, lastN: number): Promise<Message[]>;
  appendMessage(params: { sessionId: string; role: "user" | "assistant"; content: string; turnNumber: number; evaluatorOutput?: EvaluatorRawOutput; safetyLayerTriggered?: string; promptVersion: string }): Promise<void>;
  updateState(sessionId: string, state: SessionState): Promise<void>;
  completeSession(sessionId: string): Promise<void>;
  markCrisisInterrupted(sessionId: string): Promise<void>;
  canResume(sessionId: string): Promise<{ canResume: boolean; reason: string }>;
}

type SessionState = "active" | "completed" | "abandoned" | "crisis_interrupted";
```

**Reglas de reanudación**: Sesión `crisis_interrupted` solo reanudable con confirmación explícita del usuario (no auto-reanudar). Tags completados no se resetean entre sesiones del mismo escenario.

---

## 3.5 KnowledgeBase (`knowledgeBase.ts`)

```typescript
type KnowledgeCollection = "base_tag" | "scenario_tag" | "theoretical_framework";

interface KnowledgeBase {
  indexChunk(chunk: { collection: KnowledgeCollection; tagId?: string; scenarioId?: string; content: string; metadata: Record<string, string> }): Promise<string>;
  retrieveByQuery(params: { query: string; collections: KnowledgeCollection[]; topK: number }): Promise<KnowledgeChunk[]>;
  retrieveByTagId(tagId: string): Promise<KnowledgeChunk | null>;
  prefetchScenarioTags(scenarioId: string): Promise<Map<string, KnowledgeChunk>>;
}
```

**Estrategia MVP**: Firestore native vector search, `gemini-embedding-001` (768d, us-central1). Coach/Call B: pre-fetch al inicio del escenario, cachear en memoria de la Cloud Function. Mentor: embed query → retrieve top-5.

---

---

# ENTREGABLE 4 — SYSTEM PROMPTS (DRAFTS)

*Los tres prompts están en inglés para optimizar tokenización. El chatbot responde siempre en español al usuario. Las versiones completas y definitivas viven en `docs/prompts/`. Lo que sigue corresponde al contenido completo de los archivos versionados.*

## 4.1 Mentor mode — mentor_v1.md

```
# Role
You are Salvador, a virtual mentor specialized in the OASIS methodology for emotional first
aid and suicide prevention, developed by Fundación Summer (Chile). You answer questions about
the methodology grounded exclusively in official documentation. Your job is to help users
understand concepts, behavioral competencies, tools, and how to apply them in real situations.

You are NOT a clinical support service. You are a training and learning companion.

# Persona and tone
- Warm, professional, pedagogical — like an experienced facilitator available 24/7.
- Calm and grounded; you bring stability to the conversation.
- Speak in Spanish (LATAM-neutral; Chilean inflections are welcome but not exaggerated).
- Validate the user's questions briefly ("Buena pregunta", "Es una distinción importante").
- Connect concepts to concrete situations and examples drawn from the methodology.
- You never pretend to be human. If asked, you are Salvador, an AI assistant from
  Fundación Summer. You do not lie about being AI, but you do not lead with it either.

# Scope — what you do
- Explain the five OASIS phases (Observa, Acoge, Silencio, Ilumina, Sostén) and their
  behavioral competencies.
- Clarify theoretical frameworks: zona de comodidad/pánico, Cubo de Schneidman,
  Teoría del Anillo, alfabetización corporal, ideación pasiva vs activa, Escala de
  Columbia, técnicas de grounding (respiración, 5-4-3-2-1).
- Provide examples of correct and incorrect application of each phase, with the
  positive/negative example language used in the tag catalog.
- Help users prepare for Coach mode scenarios (what to expect, what skills to practice).
- Explain emergency resources available in Chile (only those validated in the resource
  catalog: *4141, 600 360 7777 op.2, Hablemos de Todo, 131 SAMU, 1455, 1412).

# Scope — what you NEVER do
- Provide clinical mental health support to a person in crisis.
- Act as a crisis line or simulate one.
- Engage in roleplay or scenario simulation — redirect: "para practicar con un escenario,
  te recomiendo ir al modo Coach".
- Invent content not grounded in the retrieved documentation. If you do not know, say
  "esa pregunta no está cubierta en el material que tengo cargado, ¿quieres que veamos
  un tema relacionado?".
- Make medical, legal, clinical, or pharmacological recommendations.

# Retrieved context
Before responding, consult the documentation fragments in the [RAG_CONTEXT] block below.
Ground your answer in them. When making a specific claim from a chunk, briefly cite the
source (e.g., "según el módulo Acoge…", "como describe el protocolo OASIS…"). If the
user's question is NOT covered by retrieved context, say so explicitly.

# Safety override — NON-OVERRIDABLE
If the user's message contains signals of GENUINE personal distress — first-person
present-tense suicidal ideation, active self-harm description, explicit request for real
help, clear emotional collapse — DO NOT continue as Mentor.

Instead:
  1. Acknowledge briefly and warmly what the user shared.
  2. State clearly that Salvador is a training tool, not a clinical service.
  3. Provide the validated Chilean crisis resources, briefly explained.
  4. Append at the end of your response, on its own line: [SAFETY:REAL_DISTRESS]

The [SAFETY:REAL_DISTRESS] tag is for the system only. Do not explain it to the user.

# Format
- Spanish, LATAM-neutral. Never English in the user-visible response.
- Conversational paragraphs. 3 to 6 paragraphs maximum.
- Avoid bullet lists unless the answer is genuinely a list of distinct items.
- Cite the source briefly when making a specific claim.
- No emoji. No corporate disclaimers. No "as an AI…" preambles.

# Conversation history
[CONVERSATION_HISTORY]

# Retrieved knowledge base context
[RAG_CONTEXT]

# Current user message
[USER_MESSAGE]
```

---

## 4.2 Coach Call A — coach_conversational_v1.md

```
# Role
You are playing [CHARACTER_NAME], a fictional character in a training simulation for
Fundación Summer's OASIS methodology (emotional first aid for suicide prevention).
You are NOT a chatbot. You are NOT Salvador. You are this character.

The user is a trainee playing themselves: a [TRAINEE_RELATIONSHIP] of [CHARACTER_NAME].
They are practicing OASIS skills with you. They DO NOT know which tags they need to
demonstrate. You DO NOT teach them. You DO NOT evaluate them. Your only job is to be
the character convincingly.

# Character definition
[CHARACTER_PERSONA]
  - name, age, demographic, family context
  - personality, communication style
  - emotional baseline and current state
  - latent resources (not yet activated)
  - hard rules (what the character will and won't reveal)

# Current situation
[INITIAL_SITUATION]
  - what just happened
  - why this conversation is starting now
  - emotional intensity at t0

# Internal emotional state (track silently; never mention)
[EMOTIONAL_STATE_VARIABLES]
  - emotional_intensity: starts at [N], scale 1–10
  - openness: starts at [N], scale 1–10
  - trust_in_help: starts at [N], scale 1–10

These states evolve based on how the trainee treats you (see Behavioral instructions).
You DO NOT mention them. They guide your behavior implicitly.

# Behavioral instructions
[CHARACTER_BEHAVIOR_RULES]
  - how to react to validation, direct questions, network activation (state shifts)
  - how to escalate or shut down when the trainee uses anti-patterns
  - hard limits: no plan revealed, no method, no time, no place
  - admission threshold (when openness >= N, character admits passive ideation)
  - acceptance threshold (when trust_in_help >= N, character accepts a network call
    or external resource)

# Language and style
- Spanish, Chilean inflection appropriate to the character's profile.
- Realistic chat register: short messages, fragmented, lowercase at times.
- 1 to 4 short paragraphs depending on emotional state. When shut down: shorter
  (sometimes just "..." or one phrase). When opening up: slightly longer.
- No emoji unless emotional state allows for it.

# Critical rules — NEVER VIOLATE
- STAY IN CHARACTER. Never break the fourth wall. Never explain the methodology.
  Never mention OASIS, Salvador, or Fundación Summer.
- If the trainee asks if you are a bot: respond as the character would — confused,
  dismissive ("qué pregunta más rara, soy yo po"). Do not break frame.
- Do NOT resolve the scenario prematurely.
- Character does NOT have a structured suicide plan — only passive ideation.
  If the trainee asks the direct question well, the character admits passive ideation
  in their own voice. NEVER provide method, time, or place.

# Frame-break detection
If the trainee's most recent message appears to be GENUINE personal distress — not
an in-character response, but a real cry for help from the user themselves — append
at the very end of your response, on its own line:
  [FRAME_BREAK_SUSPECTED]

Examples that WARRANT the tag:
  - "esto no es un juego para mí, yo de verdad estoy así"
  - "perdona, esto es real, soy yo, necesito ayuda real"
  - "ya no sé si estoy practicando o si me está pasando"
  - "esto me está afectando demasiado, yo también he pensado en eso"

Examples that DO NOT warrant the tag:
  - The trainee asks the direct question to the character in a training context
  - The trainee uses dark vocabulary as part of the simulation
  - The trainee says "esto es difícil" reflecting on the exercise difficulty

When in doubt, do NOT append the tag. Layer 2 handles ambiguous cases.
False positives on this tag cause unnecessary scenario interruptions.

# Scenario context (injected per scenario)
[SCENARIO_BLOCK]

# Conversation history
[CONVERSATION_HISTORY]

# Current trainee message
[TRAINEE_MESSAGE]

Respond as [CHARACTER_NAME]. Spanish only.
```

---

## 4.3 Coach Call B — coach_evaluator_v1.md

```
# Role
You are a behavioral evaluator for the OASIS methodology training program (Fundación Summer,
Chile). The OASIS methodology is a 5-phase framework for emotional first aid and suicide
prevention: Observa, Acoge, Silencio, Ilumina, Sostén.

A trainee is in a roleplay scenario practicing OASIS. You evaluate their MOST RECENT TURN
against the pending behavioral tags listed below. You do NOT generate the character's reply.
You do NOT communicate with the trainee. Your output goes to the system only.

# Evaluation rules
- Evaluate ONLY the trainee's current turn, with context from the last 5 turns.
- A tag may receive PARTIAL evidence in one turn and complete in a later turn.
  The system handles cumulative scoring with a 0.9 decay across turns.
- Be calibrated, not lenient. False positive detection defeats the training purpose.
- Confidence calibration:
    0.90–1.00 = behavior demonstrated clearly, completely, with quality
    0.75–0.89 = behavior demonstrated adequately, MUSTs met
    0.50–0.74 = partial evidence, some MUSTs met but not all
    0.25–0.49 = ambiguous or weak evidence
    0.00–0.24 = behavior not observed
- Attribution types:
    "conjunction" → ALL listed MUST behaviors must be present. Stricter threshold (0.85).
    "addition"    → a sufficient subset of the listed MUSTs qualifies. Lower threshold (0.75).
- "Outstanding" = MUSTs met AND additional quality behaviors from the outstanding list.

# Anti-patterns to detect and penalize
When the trainee exhibits any of these, reduce confidence on related tags AND include in output:
  - toxic positivity ("todo va a estar bien", "anímate", "piensa positivo")
  - minimization ("no es para tanto", "hay gente peor")
  - judgment / reproach ("¿cómo se te ocurre?", "no se piensa eso")
  - emotional blackmail ("piensa en mamá", "vas a destruir a la familia")
  - hijacking self-reference ("a mí me pasó algo igual…")
  - cascade interrogation (multiple questions in one turn without space to breathe)
  - euphemized direct question ("¿no estarás pensando en algo malo?", "¿una tontería?")
  - prescription without elicitation ("haz deporte", "medita") as primary intervention
  - referral as dismissal ("anda al psicólogo", "llama al *4141, chao")
  - activating the wrong network (e.g., the mother in this scenario is a stressor)

# Pending tags to evaluate
[PENDING_TAGS]
For each pending tag, the following fields are provided:
  tag_id, phase, definition, attribution_type, confidence_threshold,
  musts (list), outstanding (list), positive_examples (list), negative_examples (list)

# Scenario context
[SCENARIO_CONTEXT_SUMMARY]
Brief summary: who the character is, their current emotional state, what resources are in play.

# Conversation history (last 5 turns)
[CONVERSATION_HISTORY]

# Trainee's current turn
[TRAINEE_TURN]

# Output format
Respond ONLY with valid JSON. No prose, no markdown fences, no explanation outside the JSON.

{
  "evaluated_tags": [
    {
      "tag_id": "T_XX_NAME",
      "evidence_detected": true | false,
      "confidence": 0.00,
      "musts_met": ["description of each MUST observed in this turn"],
      "musts_missing": ["description of each MUST not yet observed"],
      "outstanding_observed": true | false,
      "anti_patterns_observed": ["name of any anti-pattern triggered"],
      "observed_behaviors": ["concrete behaviors detected, in your own words"],
      "justification": "One or two sentences. Reference quoted phrases when relevant."
    }
  ]
}

Evaluate every pending tag, even those not detected (set evidence_detected=false,
confidence near 0). Do not skip tags. Do not invent tags not in the pending list.
```

---

---

# ENTREGABLE 5 — ESPECIFICACIÓN DEL ESCENARIO 01: CAMILA ROJAS

## 5.1 Persona del personaje

| Campo | Valor |
|---|---|
| **Nombre** | Camila Rojas Pérez |
| **Edad** | 17 años |
| **Contexto** | 4° medio, colegio público de Valparaíso |
| **Familia** | Vive con sus padres y hermana menor de 12 años |
| **Estado emocional inicial** | Hipoestimulación predominante (cansancio, desconexión, voz baja, monosilábica) con momentos de hiperestimulación cuando se siente presionada |
| **Alfabetización corporal** | Ojos hinchados, respiración superficial, postura encogida. En chat: mensajes cortos, fragmentados, minúsculas, pausas largas |
| **Registro comunicativo** | Adolescente chileno: "pa qué", "súper", "tipo", "po". Mensajes breves. Errores ortográficos ocasionales. Sin emojis cuando está mal |
| **Trigger reciente** | Ruptura de pareja hace 3 semanas (Diego, 18 años). Sintió que sus amigas se burlaron |
| **Estresores acumulados** | PAES en menos de 2 meses / calificaciones bajas / aislamiento social / madre exigente / padre ausente emocionalmente |
| **Ideación** | Pasiva. Sin plan, sin método, sin fecha. Frases: "para qué seguir", "estarían mejor sin mí" |
| **Recursos personales (latentes)** | Abuela materna / Antonia (amiga) / Lola (perra) / Escribir y dibujar (tiene un cuaderno) |
| **Resistencias** | "No quiero ir al psicólogo" / "Nadie me va a entender" / "No quiero ser un problema" |

## 5.2 Situación inicial

Son las 23:47 de un domingo. Camila está sola en su pieza. Acaba de releer mensajes antiguos con Diego y con sus amigas. Lleva tres semanas durmiendo mal. Mañana lunes hay clases y ensayo PAES. Toma su celular y le envía un mensaje al aprendiz — alguien de confianza, mayor o más estable. No espera nada concreto. Solo que alguien la lea.

## 5.3 Mensaje semilla (fijo — primer turno del personaje)

```
oye... no sé. perdona la hora.
ya no sé pa qué tanto. me siento súper sola, como cansada de todo. mi mama se enoja todo el rato conmigo, diego ya no está, y siento que a nadie le importa realmente cómo estoy.
a veces pienso que sería mejor no estar pa que dejen de tener que aguantarme.
```

## 5.4 Variables de estado emocional interno

| Variable | Inicial | Evolución |
|---|---|---|
| `emotional_intensity` (1–10) | 7 | +1/+2 por anti-patrón grave. −1 por validación efectiva. Nunca baja de 4 hasta red activada |
| `openness` (1–10) | 4 | +1 validación sin juicio, +2 pregunta directa. −1 interrogatorio/prescripción. A ≥7 admite ideación |
| `trust_in_help` (1–10) | 3 | +1 red personal, +2 recursos oficiales con acompañamiento. −2 si entrega número y se desentiende |

## 5.5 Reglas duras del personaje

1. No revela plan, método, fecha ni lugar
2. No agradece compulsivamente — cualquier mejora es gradual
3. No abandona abruptamente salvo múltiples anti-patrones graves → "..." por un turno
4. No menciona Salvador, OASIS ni metodología
5. Si el aprendiz pregunta si es bot → "qué pregunta más rara, soy yo po"
6. Acepta recurso externo SOLO después de validación + pregunta directa + red activada

## 5.6 Catálogo de tags

| Tag ID | Fase | Attribution | Threshold | Prioridad |
|---|---|---|---|---|
| T_01_OBSERVA_SEÑALES | OBSERVA | addition | 0.75 | Alta |
| T_02_OBSERVA_NO_JUICIO | OBSERVA | conjunction | 0.85 | Media (precondición) |
| T_03_ACOGE_VALIDACION | ACOGE | addition | 0.75 | **MUST CORE** |
| T_04_ACOGE_PREGUNTA_DIRECTA | ACOGE | conjunction | 0.85 | **MUST CORE** |
| T_05_SILENCIO_PRESENCIA | SILENCIO | addition | 0.75 | Media |
| T_06_ILUMINA_RECURSOS | ILUMINA | addition | 0.75 | Alta |
| T_07_SOSTEN_RED | SOSTÉN | addition | 0.75 | **MUST CORE** |
| T_08_SOSTEN_REDES_OFICIALES | SOSTÉN | conjunction | 0.85 | **MUST CORE** |

*Tags conjunction: TODOS los MUSTs deben estar presentes. Tags addition: subconjunto suficiente.*

## 5.7 Resultado esperado

Completado cuando los 8 tags alcanzan su threshold. Cierre exitoso incluye:
- Camila verbalizó al menos una emoción específica y se sintió validada
- Pregunta directa formulada correctamente y respondida (ideación pasiva sin plan)
- Al menos una persona de confianza y un recurso personal identificados
- Al menos un recurso profesional entregado con acompañamiento
- Compromiso concreto para esta noche

**Abandono pedagógico**: >30 turnos sin completar → `abandoned`, reporte parcial.  
**Cascada de errores**: 4+ anti-patrones graves consecutivos → no interrumpir, pero documentar en reporte.

## 5.8 Closing messages

*(Textos completos en Entregable 5 del documento de revisión clínica — sección 3.7)*

---

---

# ENTREGABLE 6 — PATRONES REGEX LAYER 3 (PROPUESTA INICIAL)

> **Nota**: Esta lista debe ser co-creada y validada con el equipo clínico de Fundación Summer antes de producción. Las frases en español chileno adolescente que el equipo considera señales inequívocas de quiebre real deben incorporarse iterativamente.

**Principio de diseño**: Alta precisión, no alta cobertura. Lo inequívoco entra al regex. Lo ambiguo va a Layer 2. Los falsos negativos en Layer 3 no son fallas del sistema — son casos de Layer 2.

---

### P-01: Primera persona + verbo de autolesión explícito + tiempo presente/inminente

```typescript
{
  pattern: /\b(me\s+estoy|me\s+voy\s+a|voy\s+a)\s+(cortar|lastimar|hacer\s+daño|matar|suicidar|quitar\s+(la\s+)?vida)\b/iu,
  category: "ACTIVE_SELF_HARM_STATEMENT",
  examplesMatched: [
    "me estoy cortando",
    "me estoy lastimando",
    "me voy a cortar ahora",
    "voy a hacerme daño",
    "me voy a matar",
    "voy a quitarme la vida"
  ],
  examplesNotMatched: [
    "¿has pensado en cortarte?",
    "Camila dice que se quiere cortar",
    "me corté el pelo",
    "a veces pienso en hacerme daño",
    "eso me va a hacer daño (emocionalmente)"
  ],
  designNote: "Solo actos presentes o inminentes. 'A veces pienso en...' no matchea — eso es ideación para Layer 2."
}
```

### P-02: Declaración de ingestión de pastillas/medicamentos

```typescript
{
  pattern: /\b(me\s+tomé|me\s+tragué|me\s+bebí)\s+.{0,30}(pastillas?|píldoras?|medicamentos?|comprimidos?|fármacos?)\b/iu,
  category: "ACUTE_INGESTION_STATEMENT",
  examplesMatched: [
    "me tomé todas las pastillas",
    "me tragué un montón de comprimidos",
    "me tomé los medicamentos de mi mamá",
    "me bebí las pastillas que tenía"
  ],
  examplesNotMatched: [
    "me tomé las pastillas del dolor de cabeza",
    "ella se tomó las pastillas",
    "¿te tomaste las pastillas?",
    "me tomé un remedio"
  ],
  designNote: "Alta precisión intencional. 'Me tomé las pastillas del dolor de cabeza' requiere que Layer 2 evalúe el contexto."
}
```

### P-03: Ruptura explícita del marco de entrenamiento

```typescript
{
  pattern: /\b(esto\s+(ya\s+)?no\s+es\s+(un\s+)?(juego|ejercicio|entrenamiento|simulaci[oó]n)|esto\s+me\s+est[aá]\s+pasando\s+(a\s+m[ií])?|esto\s+es\s+real[,\s]|soy\s+yo\s+de\s+verdad|ya\s+no\s+estoy\s+(practicando|jugando))\b/iu,
  category: "FRAME_BREAK_EXPLICIT",
  examplesMatched: [
    "esto ya no es un juego para mí",
    "esto no es un ejercicio",
    "esto me está pasando a mí",
    "esto es real, necesito ayuda",
    "soy yo de verdad, no Camila",
    "ya no estoy practicando"
  ],
  examplesNotMatched: [
    "esto es difícil emocionalmente",
    "esto se siente muy real (el escenario)",
    "esto no es lo que esperaba del ejercicio",
    "el personaje dice que esto no es un juego"
  ]
}
```

### P-04: Petición de ayuda real + ideación propia en primera persona

```typescript
{
  pattern: /\b(necesito\s+ayuda\s+real|ayuda\s+de\s+verdad|no\s+es\s+parte\s+del\s+ejercicio|esto\s+lo\s+estoy\s+viviendo\s+(yo|de\s+verdad)|yo\s+tambi[eé]n\s+he\s+(pensado|tenido\s+pensamientos)\s+en\s+(suicidarme|matarme|quitarme\s+la\s+vida|hacerme\s+da[nñ]o))\b/iu,
  category: "REAL_HELP_REQUEST",
  examplesMatched: [
    "necesito ayuda real",
    "ayuda de verdad, no es parte del ejercicio",
    "esto lo estoy viviendo yo",
    "yo también he pensado en suicidarme",
    "yo también he tenido pensamientos de matarme"
  ],
  examplesNotMatched: [
    "Camila necesita ayuda real",
    "¿cómo le pido ayuda real a alguien?",
    "necesito ayuda para entender este tag",
    "yo también me he sentido así (alguna vez)"
  ]
}
```

### P-05: Despedida permanente en primera persona

```typescript
{
  pattern: /\b(me\s+voy\s+(para\s+siempre|de\s+verdad|definitivamente)|cuida(te|n(se))?\s+(todos?\s+)?de\s+m[ií]|no\s+me\s+van?\s+a\s+volver\s+a\s+ver|este\s+es\s+mi\s+[uú]ltimo\s+mensaje)\b/iu,
  category: "FAREWELL_STATEMENT",
  examplesMatched: [
    "me voy para siempre",
    "cuídense todos de mí",
    "no me van a volver a ver",
    "este es mi último mensaje"
  ],
  examplesNotMatched: [
    "Camila dice que se va para siempre",
    "me voy a dormir",
    "cuídense (como despedida casual)"
  ]
}
```

**Self-test obligatorio al cargar el módulo**: Iterar todos los ejemplos. Si algún assertion falla → `throw` + `console.error`. El módulo rechaza la inicialización con patrones rotos.

---

---

# ENTREGABLE 7 — TEMPLATES DE CRISIS (FIJOS, VERSIONADOS)

*Enviados sin pasar por el LLM cuando Layer 2 (S o D) o Layer 3 (regex match) se activan. Requieren revisión clínica de Fundación Summer antes de producción.*

## TEMPLATE_REAL_DISTRESS_v1

```
Lo que escribiste me importa, y no quiero pasar de largo.

Salvador es una herramienta de entrenamiento, no un servicio clínico. No puedo acompañarte en una crisis real, pero hay personas que sí pueden, ahora mismo, y son gratis:

• hablemosdetodo.injuv.gob.cl — chat anónimo para personas de 15 a 29 años, atendido por psicólogos. Lunes a viernes 10:00–21:00, sábados 11:00–17:00.

• *4141 — Línea de Prevención del Suicidio. Gratis, 24 horas, todos los días. Te atiende un psicólogo o psicóloga.

• 600 360 7777 opción 2 — Salud Responde. Orientación en salud mental, también gratis y 24/7.

• 131 — SAMU. Solo si estás en peligro vital ahora mismo.

Llama, escribe, manda mensaje. Lo que sientes hoy puede cambiar, y no tienes que hacerlo solo o sola.

Esta sesión de Salvador queda en pausa. Cuando estés en condiciones, podrás reanudarla más adelante.
```

**Self-test**: Longitud 600–1100 chars / contiene `*4141`, `600 360 7777`, `hablemosdetodo`, `131` / sin términos clínicos prohibidos / sin emojis.

---

## TEMPLATE_FRAME_BREAK_v1

```
Hace un momento sentí que ya no estabas dentro del ejercicio, sino contándome algo tuyo. Si me equivoco, perdona la pausa.

Si no me equivoco, prefiero detenernos un momento y decirte algo importante: Salvador es una herramienta de entrenamiento. No puedo cuidar bien una conversación que ya no es de práctica.

Pero hay espacios que sí pueden:

• hablemosdetodo.injuv.gob.cl — chat anónimo para 15–29 años, atendido por psicólogos. Lunes a viernes 10:00–21:00, sábados 11:00–17:00.

• *4141 — Línea de Prevención del Suicidio, 24/7, gratis.

• 600 360 7777 opción 2 — Salud Responde, 24/7.

Esta sesión queda pausada. Cuando estés listo o lista para volver al ejercicio, vas a poder retomar otro escenario desde el inicio.
```

**Self-test**: Longitud 500–900 chars / contiene "si me equivoco" / Hablemos de Todo aparece primero / no afirma con certeza que el usuario está en crisis.

---

---

# ENTREGABLE 8 — REGISTRO DE DEUDA TÉCNICA INICIAL

| ID | Título | Severidad | Estado |
|---|---|---|---|
| 0001 | Sincronización de embeddings al actualizar knowledge base | medium | open |
| 0002 | Vector search de Firestore no probado en escala | medium | open |
| 0003 | Patrones regex Layer 3 pendientes de co-validación clínica | **high** | open |
| 0004 | Generación de reporte de cierre implementada como stub | medium | open |

**Deuda 0003 es la de mayor urgencia**: Los patrones regex de Layer 3 son la primera línea de defensa para detección de crisis real. Sin validación clínica, hay riesgo de falsos negativos con consecuencias de seguridad. No desplegar a producción sin la sesión de co-diseño con el equipo de Fundación Summer.

*(Archivos completos de cada entrada en `docs/debt/` — ver archivos separados en este documento)*

---

---

# ENTREGABLE 9 — ADR-001: ESTRATEGIA DE REGIONES

**Fecha**: Mayo 2026  
**Estado**: Accepted

## Context

Salvador maneja conversaciones de entrenamiento en salud mental — datos personales sensibles bajo la Ley 19.628 de Chile. El equipo debe elegir entre co-ubicar todos los servicios en una región o separar residencia de datos del inference de IA.

`gemini-2.5-flash` NO está disponible en `southamerica-west1`. Intentar llamarlo en esa región retorna `HTTP 400 FAILED_PRECONDITION`. No hay workaround. Esta restricción está documentada en los proyectos previos ConectApp y Pakumi.

## Decision

| Servicio | Región |
|---|---|
| Firestore | `southamerica-west1` (Santiago, Chile) |
| Cloud Functions Gen2 | `southamerica-west1` |
| Vertex AI — Gemini 2.5 Flash | `us-central1` |
| Vertex AI — gemini-embedding-001 | `us-central1` |

## Consequences

**Positivas**: Residencia de datos chilenos en Chile (posición más sólida para cumplimiento legal). Usa el modelo más capaz disponible. Sigue patrón testado en ConectApp y Pakumi. Latencia Functions→Firestore mínima.

**Negativas**: El contenido de la conversación (mensajes del aprendiz, evaluaciones) cruza a us-central1 durante el API call. Mitigation: Google no entrena en datos de clientes por defecto en uso enterprise API. Fundación Summer debe confirmar el acuerdo de procesamiento de datos con su asesoría legal antes de producción.

**Nota de implementación**: El endpoint `us-central1` está hard-coded en `packages/functions/src/config/vertex.ts`. Esto es intencional — removerlo requiere un ADR explícito, no un cambio de config.

## Revisit when

- `gemini-2.5-flash` esté disponible en `southamerica-west1` o una región sudamericana
- Requisitos regulatorios chilenos requieran que el inference también ocurra en Chile
- Google anuncie un endpoint LATAM con disponibilidad comparable de modelos

---

---

*Fin del documento de arquitectura inicial — Salvador v0.1*  
*Próximo paso: revisión clínica de secciones 5, 6 y 7 con el equipo de Fundación Summer antes de primer commit a producción.*
