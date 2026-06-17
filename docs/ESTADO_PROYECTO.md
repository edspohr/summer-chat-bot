# Estado del Proyecto — Salvador
## Fundación Summer · Primeros Auxilios Emocionales · Prevención del Suicidio

**Última actualización**: 2026-05-11  
**Responsable técnico**: Edmundo Spohr · Growth Buddies SpA  
**Repositorio**: monorepo pnpm workspace en `/SummerBot`

---

## ¿Qué es esto?

Salvador es un chatbot de entrenamiento en primeros auxilios emocionales para la prevención del suicidio. Entrena a personas —familiares, voluntarios, docentes, profesionales legos— en la metodología OASIS mediante dos modos:

- **Coach**: roleplay supervisado con un personaje (Ej: Camila Rojas). El sistema evalúa competencias en paralelo, sin que el aprendiz vea los criterios.
- **Mentor**: consulta libre de conceptos y metodología, anclada en documentación oficial vía RAG.

Al completar un escenario, el sistema genera un reporte de competencias observable/no observable por tag.

---

## Estado actual — Resumen ejecutivo (2026-05-11)

**El backend está completo para MVP.** El frontend tiene todas las pantallas. La brecha principal es que el sistema no puede usarse en producción hasta que: (a) se ejecute el seed de conocimiento y (b) los patrones de seguridad sean co-validados con el equipo clínico.

| Área | Estado |
|---|---|
| Infraestructura / scaffolding | ✅ Completo |
| Sistema de seguridad (3 capas) | ✅ Implementado — pendiente validación clínica |
| Modo Mentor (RAG + Gemini) | ✅ Completo |
| Modo Coach (dual-call paralelo + tags) | ✅ Completo |
| Frontend React (todas las pantallas) | ✅ Completo |
| Persistencia de sesiones (Firestore) | ✅ Completo |
| Script de seed (Escenario 01) | ✅ Listo — pendiente ejecución contra emulador/prod |
| Reporte de cierre (SessionReport) | ⚠️ Pantalla stub — lógica real pendiente |
| Validación clínica de regex Layer 3 | ❌ Bloqueante para producción |
| Knowledge base poblada | ⚠️ Script listo — pendiente ejecución |
| Escenarios 02+ | ❌ No implementados (solo schema) |

---

## Fases completadas

### Fase 0 — Scaffolding (completado 2026-05-04)
- Monorepo pnpm con `packages/shared`, `packages/functions`, `packages/web`
- TypeScript strict, ESM only, Firebase Gen2 configurado
- Firestore indexes, rules base, firebase.json
- `@salvador/shared`: schemas Zod + tipos TypeScript (Session, Message, Tag, Scenario, User, Safety)
- streamHandler.ts para SSE desde Cloud Functions

### Fase 1 — Sistema de seguridad (completado 2026-05-07)
- **Layer 3 — Regex Preempt** (`safety/regexPreempt.ts`): 4 patrones, self-test al cargar, bypass LLM inmediato
- **Layer 2 — LLM Classifier** (`safety/llmClassifier.ts`): Gemini temp 0.1, clasifica en S/D/N
- **Layer 1 — In-response tag**: Call A puede emitir `[FRAME_BREAK_SUSPECTED]`
- **Templates de crisis** (`safety/templates.ts`): respuesta fija + bloqueo de sesión
- **Pipeline** (`safety/safetyPipeline.ts`): orquesta los 3 layers
- 73 tests unitarios (vitest) — todos pasando

### Fase 2 — Modo Mentor (completado 2026-05-07)
- `mentor/mentorHandler.ts`: Cloud Function HTTP callable
- `mentor/ragRetriever.ts`: vector search en Firestore (top-5 chunks por cosine similarity)
- `knowledge/embeddings.ts`: genera embeddings vía Vertex AI `gemini-embedding-001` en `us-central1`
- `knowledge/knowledgeBase.ts`: lee/escribe chunks en Firestore
- `prompts/loader.ts` + `prompts/promptBuilder.ts`: carga prompts versionados de `docs/prompts/`
- Prompt: `docs/prompts/mentor_v1.md`

### Fase 3 — Modo Coach (completado 2026-05-07)
- **Call A** (`coach/callA.ts`): conversacional, temp 0.75, streaming, construye system instruction desde Scenario + emotionalState
- **Call B** (`coach/callB.ts`): evaluador, temp 0.15, JSON structured output, evalúa tags pendientes
- **Tag Accumulator** (`coach/tagAccumulator.ts`): transacción Firestore por tag, decay 0.9/turno, completion cuando cumulativeScore ≥ confidenceThreshold
- **Coach Handler** (`coach/coachHandler.ts`): full orchestration — safety pipeline → Promise.all(loadScenario, loadTagDefs) → Promise.all(callA, callB) → accumulateTags → Layer 2 re-check si frameBreakSuspected
- Prompts: `docs/prompts/coach_conversational_v1.md`, `docs/prompts/coach_evaluator_v1.md`
- Invariante clave: Call A y B SIEMPRE corren en paralelo vía `Promise.all`

### Fase 4 — Frontend React (completado 2026-05-08)

**Hooks** (`packages/web/src/hooks/`):
- `useAuth.ts`: Firebase onAuthStateChanged
- `useScenario.ts`: fetch Scenario desde Firestore por ID (validado con ScenarioSchema)
- `useChat.ts`: Mentor mode — historial local, llama mentorChat callable, expone crisisTemplate
- `useSession.ts`: estado de sesión
- `useCoachSession.ts`: Coach mode — acepta completedTagIds, usa refs para evitar stale closures, inicializa con scenario.seedMessage
- `useTagProgress.ts`: listener realtime de tag_progress en Firestore

**Páginas** (`packages/web/src/pages/`):
- `Login.tsx`: Google sign-in via signInWithPopup
- `Home.tsx`: landing con auth redirect + links Coach/Mentor
- `ScenarioSelect.tsx`: carga escenarios activos, genera UUID sessionId, navega a `/session/:id?scenarioId=xxx`
- `CoachSession.tsx`: loader (auth + scenario) + componente ActiveSession con todos los hooks. Muestra TagProgress en header, CrisisOverlay en crisis
- `MentorChat.tsx`: chat completo con auto-scroll, Enter-to-send, crisis overlay
- `SessionReport.tsx`: **stub** — pantalla placeholder, no muestra datos reales

**Componentes** (`packages/web/src/components/`):
- `ChatBubble.tsx`, `CrisisOverlay.tsx`, `GroundingPrompt.tsx`, `ResourceCard.tsx`, `TagProgress.tsx`

### Fase 5 — Persistencia de sesiones (completado 2026-05-11)
- `session/sessionManager.ts`: implementación completa en Firestore
  - `createSession` (idempotente: read-then-set)
  - `getSession`, `getHistory` (limitToLast, orderBy createdAt)
  - `appendMessage` (batch: documento message + actualiza turnCount/lastActivityAt en sesión)
  - `updateState`, `completeSession`, `markCrisisInterrupted`, `canResume`
- `coachHandler.ts` y `mentorHandler.ts`: ambos wired con sessionManager — crean sesión en cada turno (idempotente), appendMessage en todos los paths (normal, crisis L3, crisis L2 post-callA)
- Firestore rules: colección `sessions` — lecturas por propietario autenticado, escrituras solo backend

### Fase 6 — Script de seed (completado 2026-05-11)
- `packages/functions/scripts/seed-knowledge-base.ts`: seed idempotente del Escenario 01 (Camila Rojas)
  - Escribe: `scenarios/scenario_01_camila`, 8 `tag_definitions`, 22 chunks en `knowledge_base` (8 base_tag, 8 scenario_tag, 6 theoretical_framework)
  - Flag `--skip-embeddings`: salta Vertex AI, solo seeds scenario + tags (compatible con emulador sin credenciales GCP)
- Scripts npm: `pnpm seed` y `pnpm seed:no-embeddings` en `@salvador/functions`

---

## Qué falta para poder usar el sistema

### Bloqueante para producción

**1. Validación clínica de Layer 3 (debt-0003 — ALTA SEVERIDAD)**  
Los patrones regex de la Capa 3 (primera línea de defensa ante crisis reales) no han sido co-validados con el equipo clínico de Fundación Summer. Un falso negativo en este layer puede tener consecuencias graves. **No deployar a producción sin esta sesión de co-diseño.**

**2. Poblar la knowledge base**  
El script está listo pero no se ha ejecutado contra ningún entorno. Sin datos en `knowledge_base`, el Modo Mentor retorna respuestas vacías.

```bash
# Contra emulador (solo escenario + tags, sin embeddings):
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
pnpm --filter @salvador/functions seed:no-embeddings

# Contra emulador con embeddings reales (necesita credenciales GCP):
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=salvador-dev \
pnpm --filter @salvador/functions seed

# Contra producción:
GOOGLE_APPLICATION_CREDENTIALS=key.json GCLOUD_PROJECT=salvador-prod \
pnpm --filter @salvador/functions seed
```

**3. Deploar el índice vectorial de Firestore**
```bash
firebase deploy --only firestore:indexes
```
El índice de 768 dimensiones (DOT_PRODUCT) en `knowledge_base.embedding` es requerido por el RAG retriever.

### No bloqueante para pruebas internas, pero pendiente antes de entregar

**4. Reporte de cierre real (debt-0004)**  
`session/reportGenerator.ts` es un stub. La pantalla `SessionReport.tsx` muestra un placeholder. El formato del reporte depende de decisiones clínicas pendientes de Fundación Summer (qué competencias mostrar, cómo comunicar resultados a legos).

**5. Java en PATH para emuladores (debt-0005 — baja severidad)**  
El emulador de Firestore requiere Java. Si no está en PATH, falla silenciosamente. Solución:
```bash
export PATH="/usr/bin/java:$PATH"
# o agregar al shell profile
```

---

## Estructura del codebase

```
packages/
  shared/          → @salvador/shared — Schemas Zod + tipos TS
    src/schemas/   → message, safety, scenario, session, tag, user
    src/types/     → tipos derivados de los schemas
    dist/          → build compilado (importar siempre por nombre de paquete)

  functions/       → @salvador/functions — Cloud Functions Gen2
    src/
      index.ts           → exports: mentorChat, coachTurn
      config/            → firebase.ts, vertex.ts (Vertex AI us-central1)
      safety/            → regexPreempt, llmClassifier, safetyPipeline, templates
      mentor/            → mentorHandler, ragRetriever
      coach/             → callA, callB, coachHandler, streamHandler, tagAccumulator
      knowledge/         → embeddings, knowledgeBase
      prompts/           → loader, promptBuilder
      session/           → sessionManager, reportGenerator (stub)
    scripts/
      seed-knowledge-base.ts   → seed idempotente de Escenario 01
      validate-regex-patterns.ts
    src/safety/regexPreempt.test.ts   → 73 tests unitarios
    src/safety/safetyPipeline.test.ts

  web/             → @salvador/web — React 18 + Vite + Tailwind
    src/
      pages/       → Login, Home, ScenarioSelect, CoachSession, MentorChat, SessionReport
      components/  → ChatBubble, CrisisOverlay, GroundingPrompt, ResourceCard, TagProgress
      hooks/       → useAuth, useChat, useCoachSession, useScenario, useSession, useTagProgress
      lib/         → formatters, functions (typed Firebase callable wrappers)
      firebase.ts  → Firebase client init

docs/
  ESTADO_PROYECTO.md       → este archivo — leer primero
  ARQUITECTURA_COMPLETA_SALVADOR.md  → arquitectura técnica detallada
  01_escenario_camila.md   → especificación del Escenario 01
  03_arquitectura_tecnica.md
  prompts/                 → mentor_v1.md, coach_conversational_v1.md, coach_evaluator_v1.md
  decisions/               → ADRs (ADR-001: región Vertex AI)
  debt/                    → registro de deuda técnica (0001–0006)
```

---

## Invariantes de arquitectura críticos

1. **Safety pipeline siempre antes de cualquier llamada Gemini** — coachHandler y mentorHandler verifican esto en cada turno.
2. **Call A y Call B siempre en paralelo** — `Promise.all([callA(...), callB(...)])` en coachHandler. Nunca secuencial.
3. **`[FRAME_BREAK_SUSPECTED]` en Call A dispara Layer 2** — el tag se stripea antes de enviar al aprendiz.
4. **Vertex AI solo en `us-central1`** — Gemini 2.5 Flash retorna HTTP 400 en cualquier otra región.
5. **Firestore solo en `southamerica-west1`** — datos de salud mental sensibles, residencia en Chile.
6. **El evaluador (Call B) nunca es visible al aprendiz** — solo se loguea en Firestore vía appendMessage.
7. **Crisis nunca auto-reanuda** — markCrisisInterrupted bloquea canResume hasta confirmación explícita.
8. **Sin `any` en TypeScript** — prohibido en todo el codebase.

---

## Comandos frecuentes

```bash
pnpm install                          # instalar dependencias
pnpm build                            # build todos los paquetes en orden
pnpm typecheck                        # tsc --noEmit en todos los paquetes
pnpm test                             # vitest en todos los paquetes (73 tests)

pnpm --filter @salvador/web dev       # dev server frontend

firebase emulators:start              # Firestore + Functions + Auth emulados
firebase deploy --only functions      # solo functions
firebase deploy --only hosting        # solo frontend
firebase deploy --only firestore:indexes  # índice vectorial RAG

# Seed (ver sección "Qué falta" arriba para comandos completos)
pnpm --filter @salvador/functions seed:no-embeddings
pnpm --filter @salvador/functions seed
```

---

## Deuda técnica abierta

| ID | Severidad | Título | Estado |
|---|---|---|---|
| [0001](debt/0001-embedding-sync.md) | media | Embedding sync no detecta chunks modificados | abierto |
| [0002](debt/0002-vector-search-scale.md) | media | Vector search no testeado a escala (>500 chunks) | abierto |
| [0003](debt/0003-safety-regex-clinical-validation.md) | **alta** | Regex Layer 3 pendiente co-validación clínica | abierto — bloqueante prod |
| [0004](debt/0004-report-generation-stub.md) | media | reportGenerator.ts es stub | abierto |
| [0005](debt/0005-java-path-emulators.md) | baja | Java no en PATH — emulador falla sin export manual | abierto |
| [0006](debt/0006-knowledge-base-not-seeded.md) | **alta** | Knowledge base no poblada | parcialmente resuelto (script listo) |

---

## Próximos pasos sugeridos (en orden de prioridad)

1. **Ejecutar seed contra emulador** — validar que escenario, tags y chunks quedan correctamente en Firestore
2. **Sesión de co-validación clínica con Fundación Summer** — revisar patrones regex Layer 3 (debt-0003)
3. **Deploar índice Firestore** — `firebase deploy --only firestore:indexes`
4. **Ejecutar seed con embeddings** contra un entorno con credenciales GCP reales
5. **Definir formato del reporte de cierre** con equipo clínico (debt-0004)
6. **Test end-to-end en emulador**: login → selección de escenario → sesión completa → reporte
7. **Deploy a producción** (requiere 1–4 completos + revisión manual)

---

## Contactos

| Rol | Persona |
|---|---|
| Responsable técnico | Edmundo Spohr (espohr@gmail.com) |
| Cliente | Fundación Summer (Chile) |
| Revisión clínica | Equipo clínico Fundación Summer |
