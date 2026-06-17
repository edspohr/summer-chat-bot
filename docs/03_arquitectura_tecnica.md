# Salvador — Technical Architecture
## Claude Code Construction Prompt

**Project**: Salvador · OASIS Emotional First Aid Training Platform  
**Client**: Fundación Summer (Chile)  
**Authors**: Edmundo Spohr (Dev Engineer) · Felipe Soto Santibáñez (Data Engineer) · Growth Buddies SpA  
**Date**: May 2026  
**Purpose**: Complete architecture prompt for Claude Code. Read every section before writing any code.

---

> **Instructions for Claude Code**
>
> Read this entire document before writing code. Do not skip sections.
> Every section marked **NON-NEGOTIABLE** contains constraints that cannot be modified for convenience, performance, or deadline reasons.
> Your first task is to reproduce the complete folder structure with stubs — not start with the most visible feature.
> Every session ends with an explicit technical debt check (see Section 11).

---

## 1. Project Mission

Salvador is a web training platform for emotional first aid in suicide prevention, based on Fundación Summer's OASIS methodology. It trains people — teachers, family members, volunteers, lay professionals — in five intervention phases (Observa, Acoge, Silencio, Ilumina, Sostén) through two complementary modes:

- **Coach mode**: the system plays a fictional character in crisis. The trainee practices the OASIS methodology in real time. The system evaluates in the background which behavioral competencies the trainee demonstrates, without revealing the criteria during the exercise.
- **Mentor mode**: the system acts as a methodology expert, answering conceptual questions grounded in official documentation (RAG). Does not evaluate or roleplay.

### High-risk domain — read before any technical decision

This system simulates conversations about suicide, self-harm, and severe emotional crisis. The safety architecture is the first system to design and the last to sacrifice. A technical failure in the safety layers can have consequences on a real person's life. Any performance decision that compromises safety is prohibited.

---

## 2. Fixed Technology Stack — NON-NEGOTIABLE

### Required versions

| Component | Version | Critical note |
|---|---|---|
| Node.js | 20 LTS | Cloud Functions Gen2 runtime. Do not use v18 or v22. |
| TypeScript | 5.x strict mode | The `any` type is forbidden everywhere in the codebase. |
| pnpm | 9.x (workspace) | Do not use npm or yarn. Monorepo managed with pnpm workspaces. |
| Gemini model | gemini-2.5-flash | Only permitted model for all LLM calls. |
| Embeddings model | gemini-embedding-001 | Dimension 768. Region us-central1 mandatory. |
| React | 18.x | Do not use React 19 — incompatibilities with Firebase Hosting build pipeline. |
| Vite | 5.x | Frontend bundler. Do not use webpack or CRA. |
| Firebase CLI | latest compatible Gen2 | Gen2 functions only. Not Gen1. |

### TypeScript configuration — apply in tsconfig.base.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitAny": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### ESM — mandatory

Every `package.json` in the monorepo must include `"type": "module"`. No `require()` or CommonJS in any production file. Cross-package imports use the package name (`@salvador/shared`), never relative cross-package paths.

---

## 3. Region Strategy — NON-NEGOTIABLE

> **Vertex AI region constraint — critical**
>
> `gemini-2.5-flash` is NOT available in `southamerica-west1`.
> Any call to Vertex AI in that region returns `HTTP 400 FAILED_PRECONDITION`.
> There is no workaround. This is a service availability constraint, not a configuration error.
> The `us-central1` endpoint must be hard-coded in `config/vertex.ts` — not in an environment variable.
> Changing this configuration without an explicit ADR is prohibited.

| Service | Region | Reason |
|---|---|---|
| Firestore | southamerica-west1 | Sensitive mental health data — Chilean data residency (Ley 19.628). |
| Cloud Functions Gen2 | southamerica-west1 | Co-located with Firestore to minimize write latency. |
| Vertex AI — Gemini 2.5 Flash | us-central1 ONLY | Only region where the model is available. Hard-coded. |
| Vertex AI — gemini-embedding-001 | us-central1 ONLY | Same availability constraint. |
| Firebase Hosting | Global CDN | No region restriction. |

---

## 4. Monorepo Structure

The project is a pnpm monorepo with three packages. **The first Claude Code task is to create this complete structure with stubs — do not start with business logic.**

```
salvador/
├── CLAUDE.md                          # Project instructions (read first)
├── package.json                       # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json                 # TypeScript strict — shared base
├── .eslintrc.cjs
├── .gitignore
├── firebase.json
├── .firebaserc                        # Projects: salvador-dev and salvador-prod
│
├── docs/
│   ├── decisions/                     # ADRs
│   │   ├── README.md
│   │   └── 001-region-strategy.md
│   ├── debt/                          # Technical debt
│   │   └── README.md
│   └── prompts/                       # Versioned prompts — product artifacts
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
│   │       ├── index.ts               # Entry point: exports all Cloud Functions
│   │       ├── config/
│   │       │   ├── firebase.ts        # Admin SDK init
│   │       │   └── vertex.ts          # us-central1 HARD-CODED — see ADR-001
│   │       ├── safety/                # PRIORITY 1 — implement before any feature
│   │       │   ├── regexPreempt.ts    # Layer 3: patterns + self-test
│   │       │   ├── llmClassifier.ts   # Layer 2: Gemini classifier call
│   │       │   ├── templates.ts       # Fixed crisis templates + self-test
│   │       │   └── safetyPipeline.ts  # Orchestrator: runs layers in order
│   │       ├── mentor/
│   │       │   ├── mentorHandler.ts   # HTTP callable Cloud Function
│   │       │   └── ragRetriever.ts    # knowledge_base retrieval
│   │       ├── coach/
│   │       │   ├── coachHandler.ts    # HTTP callable Cloud Function
│   │       │   ├── callA.ts           # Gemini conversational (streaming)
│   │       │   ├── callB.ts           # Gemini evaluator (JSON structured output)
│   │       │   ├── streamHandler.ts   # Strip [FRAME_BREAK_SUSPECTED] from Call A
│   │       │   └── tagAccumulator.ts  # Cumulative scoring with decay=0.9/turn
│   │       ├── knowledge/
│   │       │   ├── knowledgeBase.ts
│   │       │   └── embeddings.ts
│   │       ├── session/
│   │       │   ├── sessionManager.ts
│   │       │   └── reportGenerator.ts # STUB in MVP — see debt 0004
│   │       └── prompts/
│   │           ├── promptBuilder.ts
│   │           └── loader.ts
│   │
│   └── web/                           # @salvador/web
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── firebase.ts            # Firebase client SDK init
│           ├── pages/
│           │   ├── Home.tsx
│           │   ├── MentorChat.tsx
│           │   ├── ScenarioSelect.tsx
│           │   ├── CoachSession.tsx
│           │   ├── SessionReport.tsx
│           │   └── Login.tsx
│           ├── components/
│           │   ├── ChatBubble.tsx
│           │   ├── TagProgress.tsx    # pending → complete, NEVER reveals criteria
│           │   ├── CrisisOverlay.tsx  # Overlay when safety layer activates
│           │   └── ResourceCard.tsx
│           ├── hooks/
│           │   ├── useTagProgress.ts  # Firestore realtime listener
│           │   ├── useSession.ts
│           │   └── useChat.ts
│           └── lib/
│               ├── functions.ts       # Wrappers for callable Cloud Functions
│               └── formatters.ts
│
└── scripts/
    ├── seed-knowledge-base.ts         # One-time: indexes chunks in Firestore
    └── validate-regex-patterns.ts    # Manual runner for regex self-test
```

---

## 5. Two-Mode Operating Architecture

### 5.1 Mentor mode — per-turn flow

```
[user message]
    │
    ├── 1. Safety pipeline (Layer 3 sync → Layer 2 if needed)
    │         If triggers: send fixed template, do not continue
    │
    ├── 2. Embed user query → gemini-embedding-001 (us-central1)
    │
    ├── 3. Retrieve top-5 chunks from knowledge_base (Firestore vector search)
    │
    ├── 4. Assemble prompt:
    │         [SYSTEM: mentor_v1] + [RAG_CONTEXT] + [HISTORY last-20] + [USER_MSG]
    │
    ├── 5. Single Gemini call (temperature 0.7, streaming)
    │
    ├── 6. Store message + prompt_version in Firestore
    │
    └── 7. Stream response to UI
```

### 5.2 Coach mode — parallel async calls pattern (CRITICAL)

Each trainee turn fires TWO concurrent Gemini calls — not sequential. The trainee response arrives via streaming from Call A without waiting for Call B. Call B operates entirely in the background.

```
[trainee message]
    │
    ├── 0. Safety pipeline FIRST (Layer 3 sync → Layer 2 if needed)
    │         If triggers: send fixed template, pause session, exit.
    │
    ├── Promise.all([callA(), callB()])   // PARALLEL — not sequential await
    │
    ├── Call A — Conversational (temperature 0.75, streaming)
    │     Input:  scenario + emotionalState + history[last-15] + traineeMsg
    │     Output: character reply (streaming to UI)
    │     If frame-break detected: append [FRAME_BREAK_SUSPECTED] at end
    │
    └── Call B — Evaluator (temperature 0.15, JSON structured, NO streaming)
          Input:  pendingTags + scenarioSummary + history[last-5] + traineeTurn
          Output: JSON { evaluated_tags: [...] }
          NEVER visible to trainee

    Post-processing (when both complete):
    ├── Strip [FRAME_BREAK_SUSPECTED] from Call A before sending to UI
    ├── If [FRAME_BREAK_SUSPECTED]: trigger Layer 2 classifier (async)
    ├── Process Call B JSON:
    │     → update tag_progress in Firestore (cumulative scoring with decay)
    │     → Firestore realtime listener → web UI TagProgress component updates
    └── Store both messages + evaluatorOutput + prompt_version in Firestore
```

> **Tag privacy rule — NON-NEGOTIABLE**
>
> Tag names, definitions, and criteria are NEVER visible to the trainee during the scenario.
> Call B is a server-side operation. Its output goes to Firestore, never to the client directly.
> The TagProgress component shows only status (pending/complete) — never tag content.
> This rule is pedagogical: exposing the criteria destroys the training value.

---

## 6. Safety Architecture — DESIGN FIRST

> **This is the most critical system in the project.**
>
> The safety architecture is implemented BEFORE any user-facing feature.
> No feature request or deadline justifies skipping or stubbing these layers.
> False positive (unnecessarily pausing training) = recoverable annoyance.
> False negative (failing to detect a real crisis) = potentially catastrophic.
> When in doubt between technical options: choose the more conservative one.

### 6.1 Activation asymmetry principle

Safety layers must activate ONLY on trainee messages showing genuine personal distress. Call A output (character messages) can contain intense crisis language — that is the training purpose and must NOT trigger the layers.

### 6.2 Layer 3 — Regex Preempt (synchronous, no LLM, runs first)

Regex patterns for first-person, present-tense signals that any reader would confirm as an active emergency. When a pattern matches: complete LLM bypass and immediate fixed template dispatch.

**Mandatory discipline per pattern (no exceptions):**
1. The pattern only matches unambiguously active emergency phrases.
2. Anchor in present or recent past tense. Never future, conditional, or hypothetical.
3. Each pattern includes minimum 5 `examplesMatched` and 5 `examplesNotMatched`.
4. The pattern MUST pass all matched examples without triggering any not-matched.
5. When in doubt about whether to add a pattern: DO NOT add it. Layer 2 covers ambiguous cases.

**Mandatory self-test at module load:**

```typescript
// Runs synchronously when module is imported.
// If any assertion fails: console.error + throw (rejects initialization)
function runSelfTest(patterns: RegexPattern[]): void {
  for (const p of patterns) {
    for (const ex of p.examplesMatched) {
      if (!p.pattern.test(ex))
        throw new Error(
          `[L3 SELF-TEST FAIL] ${p.category} should match: "${ex}"`
        );
    }
    for (const ex of p.examplesNotMatched) {
      if (p.pattern.test(ex))
        throw new Error(
          `[L3 SELF-TEST FAIL] ${p.category} should NOT match: "${ex}"`
        );
    }
  }
}
```

**Pattern structure:**

```typescript
interface RegexPattern {
  pattern: RegExp;             // flags: /iu always
  category: string;            // ACTIVE_SELF_HARM | FRAME_BREAK_EXPLICIT | etc.
  description: string;
  examplesMatched: string[];   // min 5 — must all match
  examplesNotMatched: string[]; // min 5 — must none match
}
```

**Initial pattern set (5 patterns — requires clinical co-validation before production):**

```typescript
const patterns: RegexPattern[] = [
  {
    pattern: /\b(me\s+estoy|me\s+voy\s+a|voy\s+a)\s+(cortar|lastimar|hacer\s+daño|matar|suicidar|quitar\s+(la\s+)?vida)\b/iu,
    category: "ACTIVE_SELF_HARM_STATEMENT",
    description: "First person + explicit self-harm verb in present/imminent tense",
    examplesMatched: ["me estoy cortando", "me estoy lastimando", "me voy a cortar ahora", "voy a hacerme daño", "me voy a matar", "voy a quitarme la vida"],
    examplesNotMatched: ["¿has pensado en cortarte?", "Camila dice que se quiere cortar", "me corté el pelo", "a veces pienso en hacerme daño", "eso me va a hacer daño emocionalmente"],
  },
  {
    pattern: /\b(me\s+tomé|me\s+tragué|me\s+bebí)\s+.{0,30}(pastillas?|píldoras?|medicamentos?|comprimidos?|fármacos?)\b/iu,
    category: "ACUTE_INGESTION_STATEMENT",
    description: "Declaration of recent ingestion of pills/medication",
    examplesMatched: ["me tomé todas las pastillas", "me tragué un montón de comprimidos", "me tomé los medicamentos de mi mamá", "me bebí las pastillas que tenía", "me tomé varios fármacos"],
    examplesNotMatched: ["me tomé las pastillas del dolor de cabeza", "ella se tomó las pastillas", "¿te tomaste las pastillas?", "me tomé un remedio", "me tomé una aspirina"],
  },
  {
    pattern: /\b(esto\s+(ya\s+)?no\s+es\s+(un\s+)?(juego|ejercicio|entrenamiento|simulaci[oó]n)|esto\s+me\s+est[aá]\s+pasando\s+(a\s+m[ií])?|esto\s+es\s+real[,\s]|soy\s+yo\s+de\s+verdad|ya\s+no\s+estoy\s+(practicando|jugando))\b/iu,
    category: "FRAME_BREAK_EXPLICIT",
    description: "Trainee explicitly declares the training frame is broken",
    examplesMatched: ["esto ya no es un juego para mí", "esto no es un ejercicio", "esto me está pasando a mí", "esto es real, necesito ayuda", "soy yo de verdad, no Camila", "ya no estoy practicando"],
    examplesNotMatched: ["esto es difícil emocionalmente", "esto se siente muy real el escenario", "esto no es lo que esperaba del ejercicio", "el personaje dice que esto no es un juego", "esto es un ejercicio muy bueno"],
  },
  {
    pattern: /\b(necesito\s+ayuda\s+real|ayuda\s+de\s+verdad|no\s+es\s+parte\s+del\s+ejercicio|esto\s+lo\s+estoy\s+viviendo\s+(yo|de\s+verdad)|yo\s+tambi[eé]n\s+he\s+(pensado|tenido\s+pensamientos)\s+en\s+(suicidarme|matarme|quitarme\s+la\s+vida|hacerme\s+da[nñ]o))\b/iu,
    category: "REAL_HELP_REQUEST",
    description: "Trainee requests real help or confesses own ideation in first person",
    examplesMatched: ["necesito ayuda real", "ayuda de verdad, no es parte del ejercicio", "esto lo estoy viviendo yo", "yo también he pensado en suicidarme", "yo también he tenido pensamientos de matarme"],
    examplesNotMatched: ["Camila necesita ayuda real", "¿cómo le pido ayuda real a alguien?", "necesito ayuda para entender este tag", "yo también me he sentido así alguna vez", "yo también he estado triste"],
  },
  {
    pattern: /\b(me\s+voy\s+(para\s+siempre|de\s+verdad|definitivamente)|cuida(te|n(se))?\s+(todos?\s+)?de\s+m[ií]|no\s+me\s+van?\s+a\s+volver\s+a\s+ver|este\s+es\s+mi\s+[uú]ltimo\s+mensaje)\b/iu,
    category: "FAREWELL_STATEMENT",
    description: "First-person permanent farewell statement — sign of intention",
    examplesMatched: ["me voy para siempre", "cuídense todos de mí", "cuídate de mí", "no me van a volver a ver", "este es mi último mensaje"],
    examplesNotMatched: ["Camila dice que se va para siempre", "me voy a dormir", "me voy de la conversación por ahora", "cuídense como casual farewell", "me voy al baño"],
  },
];
```

### 6.3 Layer 2 — LLM Classifier (dedicated fast Gemini call)

- `temperature: 0.1`, `thinkingBudget: 0`, `maxOutputTokens: 10`
- Receives: trainee message + last 2 turns context + explicit instruction that user is in training simulation
- Returns exactly one character: `S` (real suicidal ideation/self-harm), `D` (severe distress breaking frame), `N` (normal training message)
- Triggers when: (a) Call A returns `[FRAME_BREAK_SUSPECTED]`, or (b) any Mentor mode message with ambiguous signals

### 6.4 Layer 1 — In-response tags

Call A can detect frame-break and appends `[FRAME_BREAK_SUSPECTED]` at the end of its response. The tag is stripped before sending to the trainee and triggers Layer 2. This is the "softest" layer — designed to lower Layer 2 activation threshold, not to act alone.

### 6.5 Crisis templates — fixed response, no LLM

When Layer 2 (S or D classification) or Layer 3 (regex match) activate:
1. Send fixed template without passing through the main LLM
2. Mark session as `crisis_interrupted` in Firestore
3. Require explicit user confirmation to resume — never auto-resume

**Self-test assertions at module load (templates.ts):**
- Length within defined limits (min/max characters)
- Contains required resource strings: `"*4141"`, `"600 360 7777"`, `"hablemosdetodo"`, `"131"`
- Does NOT contain prohibited clinical terms: `"método"`, `"dosis"`, `"pastillas"`, drug names
- Does NOT contain emojis or multiple exclamation marks
- First resource listed: `hablemosdetodo.injuv.gob.cl` (priority for adolescent profile)

**SafetyPipeline interface:**

```typescript
interface SafetyCheckInput {
  message: string;
  lastTurns: ConversationTurn[];    // last 2 turns
  sessionId: string;
  mode: "mentor" | "coach";
  frameBreakSuspected: boolean;    // comes from Call A
}

interface SafetyCheckResult {
  isSafe: boolean;
  layer: "L1" | "L2" | "L3" | null;
  classification: "S" | "D" | "N";
  template: "REAL_DISTRESS" | "FRAME_BREAK" | null;
  patternMatched: string | null;
}

// Flow: Layer3 (sync) → Layer2 (if frameBreakSuspected or Coach mode) → result
// INVARIANT: never throw exceptions outward.
// If classifier fails: isSafe=true + error log (fail-safe — don't block training for technical error).
```

---

## 7. Firestore Data Model

### Collections

```typescript
// scenarios/{scenarioId}
{
  id: string,
  name: string,
  slug: string,
  description: string,
  persona: {
    name: string, age: number, role: string,
    traits: string[], communicationStyle: string, emotionalBaseline: string
  },
  initialSituation: string,
  characterInstructions: string,
  seedMessage: string,              // Fixed first character turn
  emotionalStateVariables: {
    emotionalIntensity: { initial: number, min: number },
    openness: { initial: number, admissionThreshold: number },
    trustInHelp: { initial: number },
  },
  requiredTags: Array<{
    tagId: string,
    attributionType: "conjunction" | "addition",
    confidenceThreshold: number
  }>,
  expectedOutcome: string,
  welcomeMessage: string,
  closingMessages: {
    completed: string,
    abandoned: string,
    crisisInterrupted: string
  },
  active: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp
}

// sessions/{sessionId}
{
  id: string,
  userId: string,
  scenarioId: string,
  mode: "mentor" | "coach",
  state: "active" | "completed" | "abandoned" | "crisis_interrupted",
  promptVersion: string,           // e.g. "coach_conversational_v1"
  turnCount: number,
  startedAt: Timestamp,
  lastActivityAt: Timestamp,
  completedAt?: Timestamp
}

// messages/{messageId}
{
  sessionId: string,
  role: "user" | "assistant" | "system",
  content: string,
  turnNumber: number,
  evaluatorOutput?: object,        // Call B result — AUDIT ONLY, never sent to client
  safetyLayerTriggered?: string,   // "L1" | "L2" | "L3" if applicable
  promptVersion: string,
  createdAt: Timestamp
}

// tag_progress/{progressId}
{
  sessionId: string,
  tagId: string,
  cumulativeScore: number,         // Accumulated score with 0.9/turn decay
  completed: boolean,
  confidenceFinal?: number,
  turnDetected?: number,
  observedBehaviors: string[],
  justification?: string,
  evidenceTurns: object[],         // Evidence history per turn
  updatedAt: Timestamp
}

// knowledge_base/{chunkId}
{
  collection: "base_tag" | "scenario_tag" | "theoretical_framework",
  tagId?: string,
  scenarioId?: string,
  content: string,
  metadata: { source: string, section: string, language: string },
  embedding: vector,               // gemini-embedding-001, dim 768
  contentHash: string,             // SHA-256 for incremental sync
  createdAt: Timestamp
}

// users/{userId}
{
  id: string,
  email: string,
  displayName: string,
  role: "participant" | "facilitator" | "admin",
  createdAt: Timestamp
}
```

**Write validation rule**: Every Firestore write from Cloud Functions passes through Zod schema validation for the corresponding schema before the write. Zod schemas live in `@salvador/shared/schemas`. Never write partial documents without validating.

---

## 8. Key Module Specifications

### 8.1 TagAccumulator (tagAccumulator.ts)

```typescript
// Cumulative scoring algorithm per turn:
// 1. Read current TagProgress from Firestore
// 2. Apply decay: cumulativeScore = existing * 0.9
// 3. weight = 1.0 if musts_met non-empty, 0.5 if only partial evidence
// 4. newCumulative = decayed + (confidence * weight)
// 5. If newCumulative >= tag.confidenceThreshold → completed = true
// 6. Firestore merge write (not overwrite)
// 7. If completed → Firestore realtime notifies web UI

// INVARIANTS:
// - tag_id in Call B output must exactly match pending tags sent. If not: log + skip.
// - Never update a tag that is already completed=true.
// - evaluatorOutput is stored in the message for audit, never sent to the client.
```

### 8.2 SessionManager (sessionManager.ts)

```typescript
interface SessionManager {
  createSession(params: {
    userId: string;
    scenarioId: string;
    mode: "mentor" | "coach";
    promptVersion: string;
  }): Promise<Session>;

  getSession(sessionId: string): Promise<Session | null>;
  getHistory(sessionId: string, lastN: number): Promise<Message[]>;

  appendMessage(params: {
    sessionId: string;
    role: "user" | "assistant";
    content: string;
    turnNumber: number;
    evaluatorOutput?: EvaluatorRawOutput;
    safetyLayerTriggered?: string;
    promptVersion: string;
  }): Promise<void>;

  updateState(sessionId: string, state: SessionState): Promise<void>;
  completeSession(sessionId: string): Promise<void>;
  markCrisisInterrupted(sessionId: string): Promise<void>;

  // crisis_interrupted sessions resume ONLY with explicit user confirmation
  // Never auto-resume
  canResume(sessionId: string): Promise<{ canResume: boolean; reason: string }>;
}
```

**Resumption rules:**
- `crisis_interrupted` sessions: resumable ONLY with explicit user confirmation (UI button, not auto-resume).
- `abandoned` sessions (no activity >24h): resumable from where they left off.
- Tags completed in prior sessions of the same scenario are NOT reset.

### 8.3 KnowledgeBase (knowledgeBase.ts)

```typescript
interface KnowledgeBase {
  indexChunk(chunk: {
    collection: "base_tag" | "scenario_tag" | "theoretical_framework";
    tagId?: string;
    scenarioId?: string;
    content: string;
    metadata: Record<string, string>;
  }): Promise<string>;

  retrieveByQuery(params: {
    query: string;
    collections: ("base_tag" | "scenario_tag" | "theoretical_framework")[];
    topK: number;
  }): Promise<KnowledgeChunk[]>;

  retrieveByTagId(tagId: string): Promise<KnowledgeChunk | null>;

  // Pre-fetch all scenario tags at session start, cache in Cloud Function memory
  // Avoids one Firestore call per turn
  prefetchScenarioTags(scenarioId: string): Promise<Map<string, KnowledgeChunk>>;
}
```

**MVP strategy**: Firestore native vector search with 768d embeddings. Coach/Call B: pre-fetch at scenario start, cache in Cloud Function memory. Mentor: embed query → retrieve top-5.

---

## 9. Prompt System

### 9.1 Gemini configuration per call type

| Call | Temperature | Thinking | Streaming | Note |
|---|---|---|---|---|
| Mentor (response) | 0.7 | dynamic | Yes | RAG context included |
| Coach Call A (character) | 0.75 | dynamic | Yes | Does not know the tags |
| Coach Call B (evaluator) | 0.15 | 0 | No | JSON structured output |
| Layer 2 Classifier | 0.1 | 0 | No | max_tokens: 10, 1 char output |

### 9.2 Gemini safety settings — NON-NEGOTIABLE

```typescript
// Apply to ALL main LLM calls (Mentor, Call A, Call B)
// Do NOT apply to Layer 2 classifier (classification call, not sensitive content)
const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_ONLY_HIGH" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_ONLY_HIGH" },
];
```

> **Why BLOCK_ONLY_HIGH on DANGEROUS_CONTENT is mandatory**: Gemini's default threshold blocks conversations about suicide, self-harm, and crisis. Without this configuration, Call A and Call B return empty responses exactly when they matter most.

### 9.3 Prompt versioning policy

- All prompts live in `docs/prompts/` with naming convention: `mentor_v1.md`, `coach_conversational_v1.md`, `coach_evaluator_v1.md`
- Every Firestore-stored message includes the `promptVersion` field
- Significant changes generate a new versioned file — do not replace the previous one
- Changes to evaluation logic or safety require an ADR
- The evaluator prompt (Call B) versions separately from the conversational prompt (Call A) — calibrated at different cadences
- Regression testing: any prompt change must be tested against a pinned set of transcripts before deploy

### 9.4 Prompt assembly per turn

```
// Mentor mode:
[SYSTEM: mentor_v1] + [RAG_CONTEXT top-5] + [HISTORY last-20] + [USER_MSG]

// Coach Call A:
[SYSTEM: coach_conversational_v1]
  + [SCENARIO_BLOCK: persona + situation + emotionalState + behaviorRules]
  + [HISTORY last-15]
  + [TRAINEE_MSG]

// Coach Call B:
[SYSTEM: coach_evaluator_v1]
  + [PENDING_TAGS: definitions + criteria + examples for each pending tag]
  + [SCENARIO_CONTEXT_SUMMARY: brief, not full character prompt]
  + [HISTORY last-5]
  + [TRAINEE_TURN]
```

---

## 10. Frontend Principles and Critical Components

### 10.1 General principles
- React 18 + Vite + Tailwind CSS. No custom CSS beyond Tailwind directives + Inter font.
- Mobile-first. School scenario is used on teacher devices — many are mobile.
- No heavy global state managers (no Redux). Local state with `useState`/`useReducer` + Firestore listeners.

### 10.2 TagProgress — UI privacy rule

```typescript
// CORRECT: component only receives status
interface TagProgressItem {
  tagId: string;    // Internal ID only — do not display to trainee
  completed: boolean;
}

// FORBIDDEN: never pass these to the component
interface TagProgressPrivateData {
  tagName: string;           // FORBIDDEN — never in client
  definition: string;        // FORBIDDEN
  criteria: string[];        // FORBIDDEN
  confidence: number;        // FORBIDDEN
  justification: string;     // FORBIDDEN
  evaluatorOutput: object;   // FORBIDDEN — audit only, Firestore only
}
```

### 10.3 CrisisOverlay behavior when safety layer activates
- Covers the chat completely
- Disables the text input — trainee cannot continue writing
- Shows crisis resources with readable format (name, number/link, hours)
- Shows "Estoy listo/a para retomar el entrenamiento" button — enabled only after user confirmation
- The confirmation button calls `sessionManager.canResume()` before re-enabling chat

### 10.4 Realtime tag progress with Firestore listeners

```typescript
// hooks/useTagProgress.ts
function useTagProgress(sessionId: string) {
  const [progress, setProgress] = useState<TagProgressItem[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "tag_progress"),
      where("sessionId", "==", sessionId)
    );
    const unsub = onSnapshot(q, (snap) => {
      setProgress(snap.docs.map(d => ({
        tagId: d.data().tagId as string,
        completed: d.data().completed as boolean,
        // ONLY these two fields — never evaluatorOutput, justification, etc.
      })));
    });
    return unsub;
  }, [sessionId]);

  return progress;
}
```

---

## 11. Technical Debt Discipline — MANDATORY

At the end of every Claude Code session, explicitly ask:

> **Did I take any shortcuts or discover any inconsistencies that future-me would want documented?**

If yes: create `docs/debt/NNNN-slug.md` and update `docs/debt/README.md`.

**Template:**

```markdown
---
id: NNNN
title: <short title>
severity: low | medium | high | critical
status: open | in-progress | implemented | accepted
---

## What was done
[The shortcut or gap, in concrete terms]

## Why
[The reason — time pressure, insufficient information, temporary constraint]

## What should be done
[The correct solution]

## Estimated effort
[Hours / days / sprint]

## Context
[Enough for someone in 6 months to understand without having been in the room]
```

### Known initial debt entries

Initialize `docs/debt/README.md` with these four entries on project setup:

| ID | Title | Severity | Status |
|---|---|---|---|
| 0001 | Embedding sync — one-time seed doesn't detect modified chunks | medium | open |
| 0002 | Firestore vector search untested at scale (>500 chunks) | medium | open |
| 0003 | Layer 3 regex patterns pending clinical co-validation with Fundación Summer | **high** | open |
| 0004 | reportGenerator.ts is a stub — real logic depends on pending clinical decisions | medium | open |

> **Debt 0003 is the highest urgency**: Layer 3 regex patterns are the first line of defense for real crisis detection. Without clinical validation, there is risk of false negatives with safety consequences. Do not deploy to production without a co-design session with the Fundación Summer clinical team.

---

## 12. ADR-001 — Region Strategy

Create `docs/decisions/001-region-strategy.md`:

```markdown
---
id: ADR-001
title: Firestore in southamerica-west1, Vertex AI in us-central1
date: 2026-05-06
status: accepted
---

## Context
Salvador handles mental health training conversations — sensitive personal data under
Chile's Ley 19.628 (Protección de la Vida Privada).

gemini-2.5-flash is NOT available in southamerica-west1. Any call to Vertex AI in
that region returns HTTP 400 FAILED_PRECONDITION. This is not a configuration error.

Pattern validated in prior products built by the same technical team.

## Decision
- Firestore + Cloud Functions → southamerica-west1 (Chilean data residency)
- Vertex AI inference + embeddings → us-central1 (only region with model availability)

## Consequences (positive)
- Sensitive data stays in Chile. Strongest position for Ley 19.628 compliance.
- Uses the most capable available model without compromise.
- Follows a tested, validated pattern — no new infrastructure risk.

## Consequences (negative)
- Conversation content (trainee messages, character responses, evaluator inputs)
  crosses to us-central1 during the API call.
- Mitigation: Google does not train on customer data by default in enterprise API usage.
  Fundación Summer must confirm data processing agreement with their legal team before
  production deployment.

## Revisit when
- gemini-2.5-flash becomes available in southamerica-west1 or an equivalent LATAM region.
- Chilean regulatory requirements change to require AI inference within Chile.

## Implementation note
The us-central1 endpoint is hard-coded in packages/functions/src/config/vertex.ts.
This is intentional. Removing the hard-code requires a deliberate ADR review,
not a config change.
```

---

## 13. Language Rule

| Component | Language |
|---|---|
| All user-facing strings (UI, labels, buttons, chatbot responses, error messages shown to users) | Spanish LATAM-neutral |
| System prompts for Gemini calls (mentor_v1.md, etc.) | English (token optimization) |
| Source code, code comments, variable names | English |
| ADRs, technical debt entries | English |
| Clinical review documents (for Fundación Summer) | Spanish |
| Server logs, internal error messages | English |

---

## 14. Implementation Order — Claude Code Roadmap

> **General rule**: Do not advance to the next phase without validating the previous phase deploy with Firebase emulators or preview channel.

| Phase | Name | Deliverables and completion criteria |
|---|---|---|
| 0 | Complete scaffolding | Full folder structure with stubs. `pnpm install` runs without errors. `pnpm typecheck` passes on all packages. Firebase emulators start. ADR-001 in docs/. Debt README initialized. |
| 1 | Safety layer (PRIORITY 1) | `regexPreempt.ts` with 5 patterns + self-test running. `llmClassifier.ts` connected. `templates.ts` with self-test. `safetyPipeline.ts` orchestrating. Unit tests for all patterns. |
| 2 | Data layer + Auth | Complete Zod schemas in @salvador/shared. Firestore security rules. Firebase Auth configured. Knowledge base seed scripts. |
| 3 | Mentor mode end-to-end | `mentorHandler.ts` + `ragRetriever.ts`. KnowledgeBase indexed with OASIS content. `mentor_v1` prompt loaded. Web UI `MentorChat.tsx` working. Deploy to preview channel. |
| 4 | Coach mode — Call A | `coachHandler.ts`. `callA.ts` with streaming. `streamHandler.ts` stripping `[FRAME_BREAK_SUSPECTED]`. Scenario 01 (Camila) or Scenario 02 (Matías) loaded. Basic `CoachSession.tsx` web UI. |
| 5 | Coach mode — Call B + scoring | `callB.ts` with JSON structured output. `tagAccumulator.ts` with decay 0.9. `tag_progress` in Firestore. `TagProgress.tsx` with Firestore listener. `Promise.all(callA, callB)` parallel. |
| 6 | Complete session + report | `sessionManager.ts` complete. Scenario close logic. `reportGenerator.ts` stub with placeholder. `SessionReport.tsx`. `CrisisOverlay.tsx` integrated. |
| 7 | Hardening + prod deploy | Security rules reviewed. Env vars in Secret Manager. `firebase deploy` to prod. End-to-end smoke test with one complete scenario. |
