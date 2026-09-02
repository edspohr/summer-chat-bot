# Documento de Arquitectura Inicial — Chatbot Salvador
## Fundación Summer · Primeros Auxilios Emocionales · Prevención del Suicidio

**Proyecto**: Salvador  
**Cliente**: Fundación Summer (Chile)  
**Autor técnico**: Edmundo Spohr · Growth Buddies SpA  
**Fecha**: Mayo 2026  
**Estado**: Borrador para revisión clínica — sujeto a refinamiento iterativo

---

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

## 11. Dev tools — Latency Lab

The Latency Lab (`/lab` route) is a developer-only testing interface.
It is never shown to training participants or to Fundación Summer.
The route has no link in any participant-visible navigation — access is by direct URL only.
The Cloud Function `labChat` is exported from `packages/functions/src/index.ts` and
persists to a separate Firestore collection (`lab_sessions`) isolated from production data.

Deploy commands — MANUAL ONLY, never automated:

```bash
# Deploy only the lab function to dev
firebase deploy --only functions:labChat --project summer-chatbot-dev

# Deploy web (includes /lab route) to dev
firebase deploy --only hosting --project summer-chatbot-dev

# Deploy everything to dev
firebase deploy --project summer-chatbot-dev
```

Never run `firebase deploy` targeting `summer-chatbot-prod` without explicit review.
The prod project is not touched by Latency Lab development.

---

## 12. Engine Upgrade — June 2026

### Evaluator seam

`packages/functions/src/coach/matrixConstants.ts` contains `MATRIX_EVALUATOR_ADDENDUM` —
a string injected into the Call B prompt when `includeMatrix=true`. This is the **only**
place encoding matrix delta rules for Gemini. The methodological team can edit delta
thresholds and anti-pattern definitions there without touching TypeScript code.

`callB.ts` accepts an `includeMatrix` boolean (default false). It is set to true in
`coachHandler.ts` for `modo === "escenario"` and in `labChatHandler.ts` for
`mode === "coach_context"` + `simulationMode === "escenario"`.

### Matrix variable contract

Three variables tracked server-side per session (`sessions/{id}.estadoMatriz`),
initial values shown for scenario_03 (Martina):

| Variable | Initial | Target | Range | Floor |
|---|---|---|---|---|
| `intensidadEmocional` | 6 | 1 | 1..10 | ≥2 until trustInHelp≥7 AND derivacionAcordada |
| `apertura` | 5 | 10 | 1..10 | — |
| `confianzaEnLaAyuda` | 4 | 10 | 0..10 | Hard reset to 0 on dismissive referral |

**Runtime source of truth** for the initial values is `MARTINA_INITIAL_MATRIX`
in `packages/shared/src/oasis/initialMatrix.ts` (re-exported as
`INITIAL_ESTADO_MATRIZ` from `matrixConstants.ts`). The scenario document's
`emotionalStateVariables.*.initial` field is decorative — the engine never
reads it: `readMatrixState()` falls back to the shared constant when
`estadoMatriz` is absent on the session doc. Web (Session Report, Coach
bars), the Lab prompt scaffold and the closing-data export all read from
the same shared map. See `docs/debt/0022` for the plan to let the engine
read initials from the scenario doc.

Deltas are applied in `packages/functions/src/coach/matrixEngine.ts`.
Turn-level audit stored in `sessions/{id}/turnos/{turnoId}`.

### Timer rules

- 10-minute session (600 seconds), starts on **first user turn** (not page load).
- `sesionIniciadaEn` stored as ISO-8601 string in the session doc.
- Client derives remaining time from server-provided `sesionIniciadaEn` (no drift accumulation).
- **The timer does NOT pause on user inactivity** — the 10 minutes are continuous real-world time.
  This is intentional: it simulates the pressure of a real first-response conversation.
- Admin override: `cronometroAnulado: true` disables the hard cutoff (soft/advisory in that state).
- Timer override callable: `timerOverride` Cloud Function (admin role required).

### Mode toggle

`modo: "escenario" | "promptPuro"` field on session documents.

- `"escenario"` (default): full Martina persona, scenario script, OASIS rules, matrix active.
- `"promptPuro"`: base behavioral instructions only — no Martina, no scenario, no matrix.
  Used by validators to test underlying model behavior.

Toggle is visible on: Latency Lab (`/lab`, coach_context mode only), admin tools.
Toggle is **NOT** visible on: trainee scenario flow.
Switching mode resets the session and conversation history.

### Prompt versioning

New prompt added: `coach_pure_prompt_v1` (Modo Prompt Puro).
Lives in `packages/functions/src/prompts/content.ts` and `docs/prompts/coach_pure_prompt_v1.md`.

### generationConfig (post-upgrade)

| Call | Temperature | topP | maxOutputTokens | thinkingBudget |
|---|---|---|---|---|
| Call A (character) | 0.85 | 0.95 | 600 | 0 |
| Call B (evaluator) | 0.2 | — | 4096 (with matrix) / 256 (tags only) | — (default) |
| Mentor | 0.7 | — | 1024 | — (default) |

Call A `thinkingBudget: 0` — Gemini 2.5 Flash consumes thinking tokens from the same
pool as `maxOutputTokens`. Without pinning to 0, ~34% of Martina's replies were
truncated to 20–40 visible tokens (thoughts ate the budget). Same pattern as the
Layer 2 classifier in `safety/llmClassifier.ts`. A conversational turn in first person
does not need chain-of-thought.
