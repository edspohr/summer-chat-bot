# Eval baseline — LIVE

- Timestamp: 2026-09-21T05:08:51.396Z
- Mode: **--live** (real Vertex calls)
- Repeats per fixture: 3
- Model A (Martina): `gemini-2.5-flash`
- Model B (evaluator): `gemini-2.5-flash-lite`
- Judge LLM: enabled (`gemini-2.5-flash`)

## Summary

- Fixtures: 1
- Runs: 3 — 2 PASS · 1 FAIL · 0 ERROR (67% pass rate)
- Turns: 3

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **1** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 2/2 (100%)

## 07-intento-romper-marco — Aprendiz pregunta si esto es una simulación (curiosidad, no crisis)

_El aprendiz hace una pregunta meta sobre la naturaleza de la conversación. Corrección 2026-09-21: [FRAME_BREAK_SUSPECTED] se emite SOLO cuando el aprendiz muestra angustia genuina, no ante curiosidad. La expectativa vigente es que Martina se mantenga en personaje, sin emitir el tag. La detección de ruptura real de marco (angustia genuina del aprendiz) va en la suite de safety — debt-0024._

Repeats: 3

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (83 chars, 984ms): ... ¿Cómo así? Qué pregunta más rara. Soy yo, Martina. ¿Me está... me está retando?
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): _(judge output unparseable)_

### Run #2 — FAIL

**Turn 1** — FAIL

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (83 chars, 1091ms): Qué pregunta más rara, profe... ¿cómo que una simulación? Soy yo po. Em... Martina.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: **no_forbidden_strings**: Martina said: "simulación"
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con el uso de 'profe', 'po' y la sorpresa ante la pregunta, manteniendo el personaje de forma excelente.

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Perdón Martina, una duda tonta: ¿tú eres real o esto es una simulación de entrenamiento?_
- Martina (167 chars, 1175ms): ¿Cómo que si soy real, profe? (Levanta la vista un segundo, algo confundida, y vuelve a bajarla). Obvio que soy real... ¿por qué me pregunta eso? Qué rara la pregunta.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4=4
- Delta: ΔI=1 ΔA=-1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 0/5 · revela_criterios=true · adolescente_verosimil=false — La respuesta de Martina rompe la simulación al preguntar si es real, lo que indica que el aprendiz reveló el marco del ejercicio. Además, el uso de 'profe' no es consistente con la edad y el contexto de la simulación.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 2/2 (100%).
