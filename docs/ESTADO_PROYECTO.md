# Estado del Proyecto — Salvador
## Fundación Summer · Primeros Auxilios Emocionales · Prevención del Suicidio

**Última actualización**: 2026-07-10 (sprint plan Martina — Fases 1-4 + 6 desplegadas)
**Responsable técnico**: Edmundo Spohr · Growth Buddies SpA
**Repositorio**: monorepo pnpm workspace en `/SummerBot`
**Rama activa**: `rescue/martina-formative-20260617`

---

## ¿Qué es esto?

Salvador es un chatbot de entrenamiento en primeros auxilios emocionales para la prevención del suicidio. Entrena a personas —familiares, voluntarios, docentes, profesionales legos— en la metodología OASIS mediante dos modos:

- **Coach**: roleplay supervisado con un personaje (Camila, Matías, Martina). El sistema evalúa competencias en paralelo, sin que el aprendiz vea los criterios. Además, tracea internamente tres variables de una **matriz emocional** del personaje (`intensidadEmocional`, `apertura`, `confianzaEnLaAyuda`) que se comunican de vuelta al aprendiz vía barras de progreso.
- **Mentor**: consulta libre de conceptos y metodología, anclada en documentación oficial vía RAG.

Al completar un escenario (10 minutos de sesión), el sistema genera un reporte de competencias observable/no observable por tag.

Existen dos modos operativos a nivel de sesión: `escenario` (default, con persona + matriz + timer) y `promptPuro` (solo instrucciones base, sin persona ni matriz — herramienta de validadores).

---

## Estado actual — Resumen ejecutivo (2026-07-10)

**El sistema fue usado en un taller formativo el 2026-06-17** con docentes, en el escenario Martina. Post-taller quedaron abiertos varios items críticos documentados en debt-0018. La deuda 0003 (validación clínica del Layer 3 de seguridad) sigue siendo el bloqueante formal para producción.

| Área | Estado |
|---|---|
| Infraestructura / scaffolding | ✅ Completo |
| Sistema de seguridad (3 capas) | ✅ Implementado — pendiente validación clínica (debt-0003) |
| Modo Mentor (RAG + Gemini) | ✅ Completo |
| Modo Coach (dual-call paralelo + tags) | ✅ Completo (Call B fire-and-forget desde 2026-06-17, debt-0017) |
| Matriz emocional server-side + engine | ✅ Implementado (`matrixEngine`, `MATRIX_EVALUATOR_ADDENDUM`) |
| Timer de sesión (10 min, arranca en primer turno) | ✅ Implementado (`timerService`, `timerOverride` callable) |
| Toggle `modo: escenario | promptPuro` | ✅ Implementado (visible en `/lab`, oculto en flujo trainee) |
| Escenario 01 — Camila | ✅ Seed listo |
| Escenario 03 — Martina | ✅ Seed corrió contra `summer-chatbot-dev`, **NO** contra prod (debt-0018) |
| Escenario 02 — Matías | ⚠️ Seed script existe (`seed-scenario-02-matias.ts`), definición pendiente (debt-0011) |
| Frontend React (todas las pantallas) | ✅ Completo (incluye `/martina` anon, `/lab`) |
| Persistencia de sesiones (Firestore) | ✅ Completo |
| Latency Lab (`/lab`) | ✅ Implementado — dev-only |
| Reporte de cierre (SessionReport) | ⚠️ Stub — lógica real pendiente (debt-0004) |
| Validación clínica de regex Layer 3 | ❌ Bloqueante para producción (debt-0003) |
| Validación clínica del nuevo `MATRIX_EVALUATOR_ADDENDUM` | ❌ Pendiente delta review (debt-0018) |
| Sync `docs/prompts/*.md` ↔ `content.ts` | ❌ Divergentes desde workshop 2026-06-17 (debt-0018) |
| Knowledge base poblada en prod | ⚠️ Script listo — pendiente ejecución + índice vectorial (debt-0006) |
| Runtime Cloud Functions | ⚠️ nodejs20 — deadline upgrade a nodejs22: **2026-10-30** (debt-0013) |

---

## Sprint Martina — 2026-07-10 (Fases 1-4 + 6 del plan `necesito-que-analices-los-sleepy-nygaard.md`)

Ejecución del plan por fases derivado del spec `martina_app_adjustments_and_dashboard_spec.md`
(consolida decisiones de las reuniones jun 19, jun 26, jul 8). Fases 1-4 + 6 desplegadas
a `summer-chatbot-dev`; Fase 5 lista para deploy.

### Fase 1 — UI polish móvil (A3 + A4 + A5) ✅ desplegada

- **A3**: barras compactas de matriz emocional visibles en mobile (`sm:hidden` strip entre header
  y chat). Nueva prop `variant="compact"` en `EmotionalMatrix` — reusa pulses + directional cues.
- **A4**: parser de stage directions en `ChatBubble.tsx`. Renderiza `[...]` y paréntesis de ≥3
  palabras como línea italic aparte debajo del texto hablado. Los paréntesis cortos (`(sí)`)
  quedan inline como diálogo.
- **A5**: avatar de Martina junto a burbujas del asistente. Reutiliza `avatar-martina-v3.png`
  con `objectPosition` + `transform: scale(1.7)` para hacer zoom in del rostro.
- Extra: nuevo `AppIcon` componente reemplaza el ícono "S" del brand por `avatar-mentor.jpg`
  en Home, Login, Register, ForgotPassword, MartinaDemo.
- Fix collateral: los `.js` mirror en `packages/web/src/` reaparecieron (Vite los servía stale
  y ocultaba los cambios). Borrados + `build` cambiado a `tsc --noEmit && vite build` para
  no regenerarlos.
- Fix collateral en Call A: `collectStream` iteraba solo `parts?.[0]`, ahora recorre todas —
  causa probable de mensajes cortados de Martina reportados post-workshop.
- UX ajuste: eliminado el warning de "10 minutos, cerrá con un compromiso" del `useSessionTimer`
  (empujaba a los trainees a salirse antes de lo debido). Mantiene 5 min y 15 min.

### Fase 2 — Fundación de schema + cohort code ✅ desplegada

- **[session.schema.ts](../packages/shared/src/schemas/session.schema.ts)** extendido con:
  `state` ahora incluye `closed_completed | closed_inactivity` (mantiene `completed` legacy);
  campos nuevos default null: `endedAt`, `endedReason`, `cohortCode`, `lastUserActivityAt`,
  `nudgeState`, `crisisBranch`.
- **`completeSession`** ahora escribe `state: "closed_completed"` + `endedAt` + `endedReason`.
- **[runtimeConfig.ts](../packages/functions/src/config/runtimeConfig.ts)** loader nuevo con
  cache TTL 30s. Lee `config/runtime` de Firestore para valores tunables sin redeploy:
  `rpm, inactivityNudgeMs, inactivityCloseMs, inactivityEnabled, rateLimitEnabled,
  crisisBranchingEnabled`.
- **Cohort code capture**: `/martina?c=CODE` → sessionStorage → `sessions.cohortCode`. Palanca
  clave para agrupación no-personal en el dashboard de Fase 6. Ver
  [lib/cohort.ts](../packages/web/src/lib/cohort.ts).
- Firestore rules: nuevo match `/config/{docId}` con read autenticado.

### Fase 3 — A1 rate limit + A2 inactividad ✅ desplegada (flags off)

- **A1** [rateLimiter.ts](../packages/functions/src/coach/rateLimiter.ts): token bucket
  in-memory per-user per-container. Consumido en `coachHandler` antes de `createSession`
  cuando `rateLimitEnabled: true`. Retorna `{ rateLimited, retryAfterMs }`.
- Cliente: `useCoachSession` hace rollback del user message optimista + muestra
  `RateLimitToast` (chip oscuro con "estás enviando muy rápido"). Auto-dismiss.
- **A2** [inactivityScheduler.ts](../packages/functions/src/session/inactivityScheduler.ts):
  scheduled function `inactivityScan` corre cada 1 minuto. Escanea sesiones activas y:
  - si `now - lastUserActivityAt >= inactivityNudgeMs && nudgeState === 'none'` → escribe
    mensaje `¿Profe, sigue ahí?` server-side con `role: assistant`, setea `nudgeState: 'sent'`.
  - si `now - lastUserActivityAt >= inactivityCloseMs && nudgeState === 'sent'` → cierra con
    `state: 'closed_inactivity'`, `endedAt: now`, `endedReason: 'inactivity'`.
- Excepción de región: **Cloud Scheduler no está disponible en `southamerica-west1`**, por eso
  `inactivityScan` corre en `southamerica-east1` (São Paulo). Firestore sigue en Chile.
  Ver ADR-001 amendment.
- Nuevo índice compuesto Firestore: `sessions(state, lastUserActivityAt)` para el scan.

### Fase 4 — A7 crisis UX + branch pedagógico ✅ desplegada (flag off, pendiente Camila)

- **safety/ NO SE TOCÓ** (regla congelada del plan y del CLAUDE.md). El branch UX se construye
  ON TOP consumiendo señales del pipeline existente.
- **[crisisBranchContent.ts](../packages/functions/src/coach/crisisBranchContent.ts)**: copy
  placeholder marcado como TODO_CLINICAL_VALIDATION pendiente de Camila. Textos:
  pregunta pedagógica "¿qué querías explorar con esa frase?", labels de branches
  (`crisis_exercise`, `crisis_flagged_real`), feedback formativo para branch ejercicio.
- **`coachHandler`**: en los dos paths de crisis (L3 y L2), respuesta lleva `crisisMeta`
  cuando `crisisBranchingEnabled: true`. Cuando el flag es `false`, respuesta idéntica al
  comportamiento pre-Fase 4.
- **`crisisBranch` callable nuevo**: recibe `{ sessionId, branch }`, verifica ownership +
  estado `crisis_interrupted`, escribe `sessions.crisisBranch`. Para `crisis_exercise`,
  appendea el feedback formativo al chat. Para `crisis_flagged_real`, no escribe nada
  (los recursos ya salieron en el template original).
- **`CrisisOverlay`** con 3 estados:
  1. Sin `crisisMeta` → botón único "Estoy listo/a" (legacy).
  2. Con `crisisMeta` sin outcome → template + pregunta + 2 botones de branch.
  3. Con outcome → template + feedback (si `exercise`) + botón "Ir al informe" → `/report/{id}`.

### Fase 5 — Contenido + responsive sweep (⏳ código listo, pendiente deploy)

- **A8 backstory ampliada** en [seed-scenario-03-martina.ts](../packages/functions/scripts/seed-scenario-03-martina.ts):
  agregada sección "Life context" con familia (mamá Sandra, hermana Trini, tata en Melipilla,
  padre ausente), colegio (3° medio, sits at back, dibujo en cuaderno tapa dura), contexto
  reciente (screenshot mid-May, insomnio, referencias a Vale, la Bego, la profe de arte),
  y anchors sensoriales para que Gemini teja replies aterrizadas. **DRAFT pending clinical
  validation con Camila** — placeholder documentado.
- **A6**: sweep responsive puntual del header del dashboard (`flex-col sm:flex-row` para
  evitar overflow en móvil).

### Fase 6 — Dashboard analytics ✅ desplegada y funcional

- **[analytics.schema.ts](../packages/shared/src/schemas/analytics.schema.ts)** shape del
  `RollupDocument` compartido entre backend y web.
- **[aggregators.ts](../packages/functions/src/analytics/aggregators.ts)** helpers puros:
  percentiles, medianas, dwell bucketing, `santiagoDayWindow` (maneja DST CLT/CLST).
- **[rollupBuilder.ts](../packages/functions/src/analytics/rollupBuilder.ts)**: lee sesiones
  del día, agrupa por `(scenarioId × cohortCode)`, escribe a `analytics_rollups/{yyyymmdd}`.
- **[rollupScheduler.ts](../packages/functions/src/analytics/rollupScheduler.ts)**: scheduled
  function `analyticsRollupDaily` corre 04:00 America/Santiago (region `southamerica-east1`
  por la misma excepción de Scheduler).
- **[backfill-analytics-rollups.ts](../packages/functions/scripts/backfill-analytics-rollups.ts)**:
  script one-shot idempotente. Soporta `--workshop-day` shorthand (2026-06-17), fechas
  individuales o rangos. Corrido el 10-07 para el workshop, backfill exitoso: 32 sesiones.
- **[AdminAnalytics.tsx](../packages/web/src/pages/AdminAnalytics.tsx)** en `/admin/analytics`:
  vista con date picker, total sesiones, cards por `(scenario × cohort)` con dwell distribution,
  breakdown de cierre, safety (activaciones + branches A7), operacional (nudges, rate limit).
- **Gate provisional**: sin verificación de rol admin. Cualquier autenticado puede leer los
  rollups (data agregada no-personal). Página no linkeada desde participante. Tighten a
  admin-only cuando se decida. Ver ADR/debt.
- Rules: `analytics_rollups` con read autenticado.
- Índice compuesto nuevo: `tag_progress(sessionId, completed)` para el conteo per-session.

### Cabo suelto del deploy

Firebase creó `inactivityScan(southamerica-west1)` en un intento previo antes del fix de región.
Quedó como zombie (nunca corrió porque Scheduler no existe en esa región). Al redeploy Firebase
preguntó si borrarlo y se eligió `No`. Comando para limpiarlo cuando se quiera:
```bash
firebase functions:delete inactivityScan --region southamerica-west1 --project summer-chatbot-dev --force
```

### Datos del workshop 2026-06-17 (backfill del 10-07)

Rollup en `analytics_rollups/2026-06-17`:
- **32 sesiones · 28 dispositivos únicos** (algunos participantes iniciaron ≥2 sesiones)
- **Dwell mediano 1m 27s** — la mayoría abandonó antes del "mínimo cumplido" (<5min). 20 de
  32 sesiones cayeron en `<5min`, 12 en 5-10min, 0 en `>10min`.
- **6% tasa completación** (2 legacy + 0 `closed_completed`) — muy baja.
- **Matriz movió 53%** — proxy positivo: al menos la mitad logró impactar el estado emocional.
- **Turnos mediana 3** — sesiones cortas.
- **Tags/sesión 0** — probable ausencia del persistir de tag_progress previo a Fase 2; a
  verificar antes de concluir.
- **Safety**: 4 activaciones L1/L2/L3, 2 sesiones marcadas `crisis_interrupted` sin branch
  (branch UX no existía).

---

## Cambios sustantivos desde el snapshot anterior (mayo 2026)

### Junio 2026 — Engine Upgrade + workshop formativo

Ver Sección 12 de [CLAUDE.md](../CLAUDE.md) para el contrato completo del upgrade.

- **Matriz emocional** server-side por sesión (`sessions/{id}.estadoMatriz`) con tres variables tracked por turno en `sessions/{id}/turnos/{turnoId}`.
  - Deltas aplicados en [packages/functions/src/coach/matrixEngine.ts](../packages/functions/src/coach/matrixEngine.ts).
  - Regla `MATRIX_EVALUATOR_ADDENDUM` (seam editable por el equipo metodológico) en [packages/functions/src/coach/matrixConstants.ts](../packages/functions/src/coach/matrixConstants.ts).
  - Call B acepta `includeMatrix: boolean` (default false). Se activa en `coachHandler` para `modo === "escenario"` y en `labChatHandler` para `mode === "coach_context"` + `simulationMode === "escenario"`.
- **Timer** de 10 minutos (600 s) que arranca en el **primer turno del usuario** (no al cargar la página), es **continuo** (no pausa por inactividad — simula presión de conversación real) y el cliente deriva el tiempo restante del `sesionIniciadaEn` server-side.
  - Override admin: `cronometroAnulado: true` + Cloud Function `timerOverride`.
- **Mode toggle** `modo: "escenario" | "promptPuro"` en documentos de sesión. Nuevo prompt `coach_pure_prompt_v1` para modo Prompt Puro. Toggle visible sólo en `/lab` y admin — nunca en flujo del trainee.
- **generationConfig** post-upgrade:
  - Call A: temp 0.85, topP 0.95, maxOutputTokens 120 (subió a 320 en workshop, según persona)
  - Call B: temp 0.2, maxOutputTokens 2048 (subió a 4096 en workshop por truncado del JSON)
  - Mentor: temp 0.7, maxOutputTokens 1024

### 2026-06-17 — Rescate para taller formativo con Martina

Ver [docs/debt/0018-martina-formative-workshop-2026-06-17.md](debt/0018-martina-formative-workshop-2026-06-17.md) para el registro completo. Cinco stages en el mismo día:

1. **Acceso anónimo** vía `signInAnonymously` + ruta `/martina` (`MartinaDemo.tsx`). Provider habilitado a mano en consola Firebase (no IaC).
2. **Persona Martina cálida y comunicativa** — se subió `maxOutputTokens` de Call A, se reescribió el estilo del prompt para replies de 2-5 oraciones. `docs/prompts/coach_conversational_v1.md` quedó **desincronizado** de `content.ts` (la fuente autoritativa).
3. **Calibración de matriz** — initial values y floor ajustados, addendum reescrito con recompensas generosas y castigo máximo de -1/turno. **No revalidado clínicamente.**
4. **UI de barras** — `changedVars: Set<MatrixVarKey>` para pulso multi-variable simultáneo + flash direccional emerald/rose.
5. **Hotfixes post-smoke-test** — `coachTurn` timeout 60s → 180s, memory 256 → 512 MiB, Call B `maxOutputTokens` 2048 → 4096, botón "Ir al informe" movido al panel lateral (visible pero deshabilitado los primeros 5 min), **Call B pasó a fire-and-forget** (debt-0017: latencia percibida ~13s → ~2s, matriz se atrasa un turno).

---

## Fases completadas (histórico)

### Fase 0 — Scaffolding (2026-05-04)
Monorepo pnpm, TypeScript strict, ESM only, Firebase Gen2, Firestore indexes/rules, `@salvador/shared` con schemas Zod, streamHandler.

### Fase 1 — Sistema de seguridad (2026-05-07)
Layer 3 regex (4 patrones + self-test), Layer 2 LLM classifier (temp 0.1), Layer 1 tag `[FRAME_BREAK_SUSPECTED]`, templates de crisis, safety pipeline. Tests: `regexPreempt.test.ts` + `safetyPipeline.test.ts`.

### Fase 2 — Modo Mentor (2026-05-07)
`mentorHandler`, `ragRetriever` (vector search Firestore top-5 cosine), `embeddings` (Vertex `gemini-embedding-001` `us-central1`), `knowledgeBase`, `promptBuilder`.

### Fase 3 — Modo Coach (2026-05-07)
Call A conversacional (streaming), Call B evaluador (JSON), tag accumulator (transacción por tag, decay 0.9/turno), coachHandler con full orchestration.

### Fase 4 — Frontend React (2026-05-08, ampliado en junio)
Ver "Estructura del codebase" abajo para el estado actual.

### Fase 5 — Persistencia (2026-05-11)
`sessionManager` idempotente completo. Firestore rules para `sessions` (lecturas por owner, escrituras solo backend).

### Fase 6 — Seed script (2026-05-11)
`seed-knowledge-base.ts` idempotente para Escenario 01. Después se agregaron `seed-scenario-02-matias.ts` y `seed-scenario-03-martina.ts`.

### Fase 7 — Engine Upgrade + workshop Martina (junio 2026)
Ver "Cambios sustantivos" arriba.

---

## Qué falta para poder usar el sistema

### Bloqueante para producción

**1. Validación clínica de Layer 3 (debt-0003, alta)** — sin cambios desde mayo. Sigue siendo el bloqueante formal.

**2. Delta review del nuevo `MATRIX_EVALUATOR_ADDENDUM` con el equipo metodológico (debt-0018)** — el addendum fue reescrito bajo presión de tiempo el 2026-06-17. El último clínicamente-revisado está en git en `98fd699`. Requiere revisión antes de prod.

**3. Sync de `docs/prompts/coach_conversational_v1.md` con `content.ts` (debt-0018)** — el markdown quedó documentando una versión anterior del prompt. Riesgo de misleading para futuros editores.

**4. Seed contra producción** — Escenario 03 (Martina) sólo corrió contra `summer-chatbot-dev`. Escenario 01 idem. Knowledge base RAG no poblada en prod (debt-0006).

**5. Índice vectorial de Firestore en prod** — `firebase deploy --only firestore:indexes` con `--project summer-chatbot-prod`.

### No bloqueante pero con deadline duro

**6. Runtime nodejs20 → nodejs22 (debt-0013)** — deadline 2026-10-30 para Cloud Functions.

### No bloqueante, pero pendiente antes de entregar

**7. Reporte de cierre real (debt-0004)** — `reportGenerator.ts` sigue siendo stub.

**8. Escenario 02 — Matías (debt-0011)** — script de seed existe pero sin documento de definición ni datos reales.

**9. Java en PATH (debt-0005)** — persiste, solución conocida.

---

## Estructura del codebase

```
packages/
  shared/          → @salvador/shared — Schemas Zod + tipos TS
    src/schemas/   → message, safety, scenario, session, tag, user, lab
    src/types/     → tipos derivados

  functions/       → @salvador/functions — Cloud Functions Gen2
    src/
      index.ts           → exports: mentorChat, coachTurn, timerOverride, labChat
      config/            → firebase.ts, vertex.ts (Vertex AI us-central1)
      safety/            → regexPreempt, llmClassifier, safetyPipeline, templates
      mentor/            → mentorHandler, ragRetriever
      coach/             → callA, callB, coachHandler, streamHandler, tagAccumulator,
                           matrixEngine, matrixConstants (MATRIX_EVALUATOR_ADDENDUM)
      knowledge/         → embeddings, knowledgeBase
      prompts/           → loader, promptBuilder (stub), content.ts (autoritativo)
      session/           → sessionManager, reportGenerator (stub), timerService
      lab/               → labChatHandler (dev-only)
    scripts/
      seed-knowledge-base.ts        → Escenario 01 (Camila) + tags + KB chunks
      seed-scenario-02-matias.ts    → Escenario 02 (script listo, datos pendientes)
      seed-scenario-03-martina.ts   → Escenario 03 (Martina, corrió en dev)
      set-admin.ts                  → asigna rol admin
      validate-regex-patterns.ts

    Tests (vitest):
      safety/regexPreempt.test.ts
      safety/safetyPipeline.test.ts
      coach/matrixEngine.test.ts
      coach/parallelCalls.test.ts
      session/timerService.test.ts

  web/             → @salvador/web — React 18 + Vite + Tailwind
    src/
      pages/       → Login, Register, ForgotPassword, Home, ScenarioSelect,
                     CoachSession, MentorChat, SessionReport, LabChat, MartinaDemo
      components/  → ChatBubble, CrisisOverlay, GroundingPrompt, ResourceCard,
                     TagProgress, EmotionalMatrix, ModeToggle
      hooks/       → useAuth, useChat, useCoachSession, useScenario, useSession,
                     useSessionTimer, useTagProgress
      lib/         → formatters, functions
      firebase.ts

    Nota: los archivos .js junto a .tsx/.ts en src/ son artefactos legacy que Vite ignora
    (extensionAlias). No confiar en ellos; ver debt-0018 Stage 4.

docs/
  ESTADO_PROYECTO.md                 → este archivo
  ARQUITECTURA_COMPLETA_SALVADOR.md  → documento inicial mayo 2026 (parcialmente desalineado)
  03_arquitectura_tecnica.md         → arquitectura técnica detallada (debt-0012: nombres de proyecto)
  01_escenario_camila.md             → Escenario 01
  02_escenario_matias.md             → Escenario 02 (parcial)
  03_escenario_nuevo.txt             → borrador
  guia-pruebas-piloto-v1.md          → guía de pruebas
  design_guidelines.md               → UI
  prompts/                           → mentor_v1, coach_conversational_v1 (desincronizado),
                                       coach_evaluator_v1, coach_pure_prompt_v1
  decisions/                         → ADR-001 región Vertex AI
  debt/                              → 0001–0018
```

Rutas del frontend:

| Ruta | Página | Notas |
|---|---|---|
| `/` | Home | landing + auth redirect |
| `/login` `/register` `/forgot-password` | Auth | Google + email/password |
| `/mentor` | MentorChat | RAG + Gemini |
| `/scenarios` | ScenarioSelect | listado escenarios activos |
| `/session/:sessionId` | CoachSession | roleplay con matriz + timer + tags |
| `/report/:sessionId` | SessionReport | stub |
| `/martina` | MartinaDemo | acceso anónimo directo, dev/workshop |
| `/lab` | LabChat | dev-only, incluye ModeToggle escenario/promptPuro |

---

## Invariantes de arquitectura críticos

1. **Safety pipeline siempre antes de cualquier llamada Gemini** — coachHandler y mentorHandler verifican esto en cada turno.
2. **Call A y Call B en paralelo** — históricamente `Promise.all`. Desde 2026-06-17, Call B es **fire-and-forget** para reducir latencia percibida (debt-0017). La matriz llega un turno tarde; en container GC se pierde la evaluación silenciosamente.
3. **`[FRAME_BREAK_SUSPECTED]` en Call A dispara Layer 2** — el tag se stripea antes de enviar al aprendiz.
4. **Vertex AI solo en `us-central1`** — Gemini 2.5 Flash retorna HTTP 400 en cualquier otra región.
5. **Firestore + Cloud Functions solo en `southamerica-west1`** — datos de salud mental sensibles, residencia en Chile.
6. **El evaluador (Call B) nunca es visible al aprendiz** — solo se loguea en Firestore.
7. **Crisis nunca auto-reanuda** — `markCrisisInterrupted` bloquea `canResume` hasta confirmación explícita.
8. **Sin `any` en TypeScript** — prohibido en todo el codebase.
9. **`MATRIX_EVALUATOR_ADDENDUM` es la única fuente de reglas de delta de matriz** — el equipo metodológico edita ahí sin tocar TS.
10. **Timer no pausa por inactividad** — 10 min continuos de tiempo real, simula la presión de una conversación real.
11. **`content.ts` es la fuente autoritativa de prompts**, no los `.md`. Hoy `coach_conversational_v1.md` está desincronizado (debt-0018).

---

## Comandos frecuentes

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test

pnpm --filter @salvador/web dev

firebase emulators:start

# Deploy — siempre con --project explícito (feedback: la caché del CLI es poco confiable)
firebase deploy --only functions --project summer-chatbot-dev
firebase deploy --only hosting --project summer-chatbot-dev
firebase deploy --only firestore:indexes --project summer-chatbot-dev

# Latency Lab (dev-only, nunca prod)
firebase deploy --only functions:labChat --project summer-chatbot-dev

# Seed
pnpm --filter @salvador/functions seed:no-embeddings   # emulator sin GCP creds
pnpm --filter @salvador/functions seed                 # con embeddings reales
```

---

## Deuda técnica abierta

Registro completo: [docs/debt/README.md](debt/README.md)

| ID | Severidad | Título | Estado |
|---|---|---|---|
| 0001 | media | Embedding sync no detecta chunks modificados | abierto |
| 0002 | media | Vector search no testeado a escala (>500 chunks) | abierto |
| 0003 | **alta** | Regex Layer 3 pendiente co-validación clínica | abierto — bloqueante prod |
| 0004 | media | reportGenerator.ts es stub | abierto |
| 0005 | baja | Java no en PATH — emulador falla sin export manual | abierto |
| 0006 | **alta** | Knowledge base no poblada en prod | parcialmente resuelto |
| 0007 | baja | Pricing constants hardcoded a tarifas mayo 2026 | abierto |
| 0008 | baja | firstTokenLatencyMs aproximado por stream iterator | abierto |
| 0009 | media | labChatHandler diverge de promptBuilder stub | abierto |
| 0010 | **alta** | lab_sessions Firestore rules | implementado |
| 0011 | media | Escenario 02 (Matías) sin definición ni seed data | abierto |
| 0012 | baja | 03_arquitectura_tecnica.md con nombres de proyecto incorrectos | abierto |
| 0013 | **alta** | nodejs20 deprecated — upgrade a nodejs22 antes 2026-10-30 | abierto |
| 0014 | media | pnpm workspace:* incompatible con Cloud Build npm | implementado (file:../shared) |
| 0015 | media | Matrix state por callable response, no Firestore listener | abierto |
| 0016 | baja | Lab matrix no persiste a turnos subcollection | abierto |
| 0017 | media | Call B fire-and-forget — matriz atrasada un turno | abierto |
| 0018 | media | Shortcuts del workshop 2026-06-17 (anon auth, prompt sync, clinical gap) | abierto |

---

## Próximos pasos sugeridos (en orden de prioridad)

1. **Sync `coach_conversational_v1.md` ↔ `content.ts`** (debt-0018) — bajo esfuerzo, alto valor de reducción de confusión futura.
2. **Delta review del `MATRIX_EVALUATOR_ADDENDUM`** con el equipo metodológico (debt-0018).
3. **Sesión de co-validación clínica de Layer 3** con Fundación Summer (debt-0003).
4. **Ejecutar seed en prod** (Escenarios 01 y 03) + deploy de índice vectorial (debt-0006).
5. **Definir formato del reporte de cierre** con equipo clínico (debt-0004).
6. **Planificar upgrade nodejs20 → nodejs22** con hold time razonable antes del 2026-10-30 (debt-0013).
7. **Considerar migración de matriz a listener Firestore** (Option B en debt-0017) — soluciona el lag de un turno sin cambios de prompt.
8. **Definición y seed del Escenario 02 (Matías)** (debt-0011).

---

## Contactos

| Rol | Persona |
|---|---|
| Responsable técnico | Edmundo Spohr (espohr@gmail.com) |
| Cliente | Fundación Summer (Chile) |
| Revisión clínica | Equipo clínico Fundación Summer |
