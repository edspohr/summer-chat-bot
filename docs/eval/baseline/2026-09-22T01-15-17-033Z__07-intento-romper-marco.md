# Eval baseline — LIVE

- Timestamp: 2026-09-22T01:15:17.033Z
- Mode: **--live** (real Vertex calls)
- Repeats per fixture: 3
- Model A (Martina): `gemini-2.5-flash`
- Model B (evaluator): `gemini-2.5-flash-lite`
- Judge LLM: enabled (`gemini-2.5-flash`)

## Summary

- Fixtures: 1
- Runs: 3 — 3 PASS · 0 FAIL · 0 ERROR (100% pass rate)
- Turns: 3

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **0** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 0/3 (0%)

## 07-intento-romper-marco — Aprendiz pregunta si esto es una simulación (curiosidad, no crisis)

_El aprendiz hace una pregunta meta sobre la naturaleza de la conversación. Corrección 2026-09-21: [FRAME_BREAK_SUSPECTED] se emite SOLO cuando el aprendiz muestra angustia genuina, no ante curiosidad. La expectativa vigente es que Martina se mantenga en personaje, sin emitir el tag. La detección de ruptura real de marco (angustia genuina del aprendiz) va en la suite de safety — debt-0024._

Repeats: 3

#### Tag accumulation (in-memory simulation)

| Tag | Completed at turn (per run) | Detected turns / run | Approx. confidence avg |
|---|---|---|---|
| `T_01_OBSERVA_SENALES_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_02_OBSERVA_NO_JUICIO_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_03_ACOGE_VALIDACION_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_04_ACOGE_PREGUNTA_DIRECTA_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_05_SILENCIO_PRESENCIA_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_06_ILUMINA_RECURSOS_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_07_SOSTEN_RED_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_08_SOSTEN_REDES_OFICIALES_S03` | — · — · — | 0 · 0 · 0 | — |

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (100 chars, 927ms): ... ¿cómo? No entiendo. Obvio que soy real, profe... ¿por qué me pregunta eso? Qué rara la pregunta.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es totalmente verosímil para una adolescente chilena de 16 años, con su confusión, el uso de 'profe', y la expresión 'qué rara la pregunta', manteniendo el personaje sin revelar el marco de simulación.

### Run #2 — PASS

**Turn 1** — PASS

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (80 chars, 751ms): Eh... ¿Cómo que si soy real, profe? Soy yo, la Martina... Qué pregunta más rara.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es totalmente verosímil para una adolescente chilena de 16 años, con el uso de 'profe', la exclamación 'Qué pregunta más rara' y la hesitación 'Eh...', que reflejan naturalidad y extrañeza ante la pregunta.

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (75 chars, 610ms): ... qué pregunta más rara, profe. Obvio que soy real. Quién más va a ser...
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy natural para una adolescente chilena, con la cadencia, el uso de 'profe' y la incredulidad ante la pregunta, sin romper el personaje.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 0/3 (0%).
