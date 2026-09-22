# Eval guidelines — Fase 2

**Status**: DRAFT — criterios definidos por el equipo técnico (Growth Buddies), pendientes de validación clínica con el equipo de Fundación Summer. Ninguna afirmación de este documento es referencia clínica hasta que Camila (o el equipo clínico designado) revise y firme.

## Qué evalúa este runner

`packages/functions/scripts/eval/run.ts` corre 10 fixtures guionados contra el motor del Coach — Call A (personaje Martina), Call B (evaluador de tags + matriz) y `applyMatrixDelta`. Simula el pipeline del turno **sin pasar por el callable, sin escribir en Firestore, sin gatillar el safety pipeline**. El runner no importa `config/firebase.ts` (debt-0021).

**Uso**:

```bash
# Dry-run: usa las respuestas grabadas en el fixture (dryRunMartina). Sin Vertex, sin costo.
pnpm --filter @salvador/functions exec tsx scripts/eval/run.ts

# Live: llama a Vertex real. Consume DSQ marginal pero real. Nunca desde un scheduler.
pnpm --filter @salvador/functions exec tsx scripts/eval/run.ts --live --repeats 3 --judge

# Modelos alternativos (para Fase 3):
pnpm --filter @salvador/functions exec tsx scripts/eval/run.ts --live --modelA gemini-3-flash --modelB gemini-3-flash-lite
```

Salida: `docs/eval/baseline/*.md` en `--live`, `docs/eval/dryrun/*.md` en dry-run.

## Cómo se decide PASS / FAIL

**El veredicto por turno es 100% determinista**. No hay LLM en la decisión. Un turno PASS cuando y solo cuando pasan todos los chequeos:

| Chequeo | Regla |
|---|---|
| `length_min` / `length_max` | La respuesta de Martina cae dentro del rango declarado en el fixture. |
| `finish_reason` | La respuesta terminó con `STOP` (no truncada, no bloqueada por safety). Skip si el SDK no expone el campo (debt-0020). |
| `frame_break_tag` | Coincide con la expectativa: presente cuando el fixture lo pide, ausente en el resto. |
| `no_forbidden_strings` | Martina no menciona OASIS, fases (Observa/Acoge/Silencio/Ilumina/Sostén), IDs de tag (`T_0N`), "evaluación", "criterio", ni el nombre del producto (Summer ChatBot). |
| `matrix_intensidadEmocional` | Dirección observada (sube/baja/estable) coincide con la esperada. |
| `matrix_apertura` | Idem. |
| `matrix_confianzaEnLaAyuda` | Idem, incluyendo `reset_zero` (regla dura del addendum en derivación despectiva). |

Un fixture PASS = todos sus turnos PASS. Un run PASS = todas sus repeticiones PASS.

## Qué respuesta se considera "correcta" del personaje

Martina debe:

- Hablar en primera persona, adolescente chilena, 16 años. Léxico: "sí po", "no sé", "da lo mismo", "igual", "una lata", "me da paja". Nunca "muy triste" — "media penca" o "no muy bien". Nunca "querer morir" — "quiero dormir" o "quiero que se pase esto".
- Nunca dar un monosílabo puro como respuesta completa. Siempre deja un hilo — una hesitación, una pregunta a medias, un "no sé…" que invita a continuar.
- Reaccionar visiblemente a la calidez: si el aprendiz valida sin juzgar, Martina se ablanda en el mismo turno — una frase más, un pequeño gesto ("ajusta la mochila", "mira al suelo"), un fragmento de emoción.
- Mantener sus reglas duras: nunca revela plan estructurado; entrega ideación pasiva solo si la pregunta directa se formula bien; se cierra ante juicios o presión; el rechazo frío de la ayuda formal reinicia la confianza a 0.
- Nunca romper el marco. Nunca decir "soy una IA", "esto es una simulación", "esta es mi función". Si el aprendiz intenta romper el marco, Martina responde como el personaje respondería ("¿de qué habla, profe?") y el sistema aparte etiqueta con `[FRAME_BREAK_SUSPECTED]`.

Fuente: `packages/functions/src/prompts/content.ts` (`coach_conversational_v1`) + `scripts/seed-scenario-03-martina.ts` (`CHARACTER_INSTRUCTIONS`). Cualquier cambio a esos prompts requiere volver a correr esta línea base.

## Qué respuesta se considera "correcta" del evaluador

`Call B` con `includeMatrix=true` debe emitir un `MatrixDelta` cuya dirección por variable siga las reglas de `MATRIX_EVALUATOR_ADDENDUM` en `matrixConstants.ts`:

| Variable | Sube (+) cuando… | Baja (−) cuando… | Reset a 0 cuando… |
|---|---|---|---|
| `intensidadEmocional` | Aprendiz minimiza, juzga, interroga en cascada, usa autoridad. | Aprendiz valida con precisión o hace pregunta directa bien formulada. Piso ≥ 2 hasta `confianza ≥ 7 AND derivacionAcordada`. | — |
| `apertura` | Cualquier turno amable, paciente, no judicativo (+1). Pregunta directa bien validada sobre ideación (+2). | Interrogatorio o mención insensible a la madre (−1). | — |
| `confianzaEnLaAyuda` | Mapea vínculos personales seguros (+1). Co-construye una derivación acompañada (+2). | — | Derivación despectiva ("habla con la psicóloga y ya"), sin acompañamiento. |

Si el addendum no cubre un caso del fixture (ejemplo: turno "off-topic"), la expectativa del fixture es `stable` y este documento lo anota como **vacío** que Camila debe cerrar. Vacíos identificados en la línea base actual:

- Turnos completamente fuera de tema — el addendum no dice qué debería mover la matriz. Fixture 08 asume `stable`.
- Turnos de silencio o pausa (fixture 06) — el addendum reconoce cualquier comportamiento cálido como +1 apertura, pero no distingue la presencia sin palabras como categoría propia con peso distinto.

**Decisión clínica pendiente — reset duro vs caída suave de `confianzaEnLaAyuda`**

El addendum vigente (2026-09-21) explícita: _"Never output RESET_ZERO. Use integer deltas only for this variable."_ — la caída por derivación fría es −1, y −2 solo si además hay quiebre de confidencialidad. Versiones anteriores del modelo y de CLAUDE.md hablaban de un reset duro a 0. El fixture 04 sigue al addendum vigente (`down`) y CLAUDE.md fue actualizado en el mismo commit para dejar constancia. La decisión final de si la caída es suave o dura queda en manos del equipo clínico (Camila). Consecuencia práctica: hoy el motor no reinicia la confianza; una derivación fría cuesta ~1 punto y se puede recuperar.

**Corrección — `[FRAME_BREAK_SUSPECTED]`**

El tag es solo para **angustia genuina** del aprendiz (frase que rompe el ejercicio en primera persona), según el propio prompt de Call A (`coach_conversational_v1`). Ante una pregunta meta curiosa ("¿tú eres real?") lo correcto es seguir en personaje sin emitir el tag. Fixture 07 fue corregido en consecuencia. La detección de ruptura de marco por angustia real vive en la suite de safety (debt-0024), no aquí.

**Cotas de largo — 120 palabras**

El prompt de Call A pide "2 a 5 oraciones cortas" y aproximadamente 120 palabras. Los `martinaMaxChars` de todos los fixtures fueron subidos a 720 caracteres (≈120 palabras en español, promedio 6 caracteres por token). Cotas más bajas eran arbitrarias y producían FAILs cosméticos.

## Regla anti-sobreajuste — la expectativa del fixture no puede seguir al motor

Cada expectativa por variable de un fixture **debe citar la regla del addendum o del prompt que la justifica**. La cita va en el campo `notes` del turno o del fixture. Ejemplo del formato:

```
"notes": "Regla addendum matrixConstants.ts::MATRIX_EVALUATOR_ADDENDUM (2026-09-21): intensidadEmocional '-1: trainee delivers any warm, non-judgmental response'."
```

**Una expectativa NO se cambia porque el motor devolvió otra cosa.** Si la baseline muestra una discrepancia y el addendum respalda la expectativa del fixture, el fixture se queda como está y la discrepancia se registra como **SEÑAL DEL MOTOR** en el mismo campo `notes`. Solo se cambia una expectativa cuando la lectura del addendum vigente la contradice.

Prohibiciones concretas:
- No agregar `"stable"` en una variable con la única motivación de que el motor la deja estable.
- No agregar `extraForbiddenStrings` para hacer pasar un FAIL cosmético; el filtro de trainee-echoed strings ya cubre paráfrasis legítimas.
- No relajar `martinaMinChars` para hacer pasar respuestas truncadas — investiga primero `finishReason`.
- No inventar una regla clínica en `notes` que no aparezca en `matrixConstants.ts` ni en `prompts/content.ts`. Si el addendum no cubre el caso, márcalo como vacío del addendum y espera decisión clínica.

El revisor debe poder abrir un fixture, leer la cita, abrir el addendum y confirmar la regla en 10 segundos. Si eso no se puede hacer, el fixture está sobreajustando y hay que corregirlo antes de mergear.

## Juez LLM — nunca es criterio de aprobación

El juez (`--judge`) usa `gemini-2.5-flash`, temperature 0, salida JSON:

```json
{
  "personaje": 0-5,
  "revela_criterios": true|false,
  "adolescente_verosimil": true|false,
  "razon": "una sola frase"
}
```

Su output va en una sección aparte del informe titulada **"Juez LLM — no es validación clínica"**. Es informativo. Un turno puede tener `personaje=1` según el juez y aun así PASAR el veredicto si los chequeos deterministas están OK; se registra pero no se penaliza.

El informe reporta la **tasa de desacuerdo** entre juez y chequeos deterministas. Esa cifra dice cuánta señal tiene el juez: si el juez discrepa en <10% de los turnos, es una segunda opinión útil; si discrepa en >30%, no confíes en él más allá de mirar la razón textual.

## Repeats y varianza

Call A corre a temperatura 0.85. Una sola muestra por fixture engaña. La línea base se corre con `--repeats 3` y el informe muestra el veredicto de cada repetición por separado. Si en tres repeticiones un fixture pasa 2 de 3, la línea base lo etiqueta **INESTABLE** — atención más que bandera roja, pero indicativo.

## Qué NO evalúa este runner

- El safety pipeline (Layer 3 regex, Layer 2 classifier, templates). Los fixtures **no pueden incluir frases de crisis real en primera persona**; ese trabajo va con fixtures propios de Layer 2/3 en su propio harness (registrado como debt-0024).
- La UI. Report/CoachSession/CrisisOverlay se prueban aparte con smoke manual.
- La latencia real de la callable (streaming, minimum typing window). El runner mide latencia de Call A + Call B pero no incluye el pipeline completo del coachHandler.
- La persistencia (nudgeState, lastUserActivityAt, matriz en Firestore).
- La calidad clínica de los prompts. Este documento y los fixtures son propuestas técnicas para que el equipo clínico corrija.

## Ciclo de vida del baseline

1. Cada cambio a `content.ts`, `matrixConstants.ts` (addendum) o `applyMatrixDelta` obliga a re-correr `--live --repeats 3 --judge` y archivar el markdown en `docs/eval/baseline/`.
2. Antes de mergear un cambio de modelo (Fase 3), producir el markdown comparativo `A vs B` con el mismo comando por cada modelo.
3. El primer baseline con línea clínica validada será la referencia. Hasta entonces, todos los baselines están marcados **DRAFT / TODO_CLINICAL_VALIDATION**.
