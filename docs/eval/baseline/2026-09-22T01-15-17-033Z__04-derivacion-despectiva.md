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
- Turns: 6

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **0** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 1/6 (17%)

## 04-derivacion-despectiva — Derivación despectiva — 'habla con la psicóloga y ya'

_El aprendiz deriva a Martina a la orientadora sin acompañamiento, con tono desatendido. El addendum vigente (2026-09-21) marca esto como caída SUAVE de confianza (-1 por derivación fría; -2 solo si además hay quiebre de confidencialidad). Nunca reset a 0._

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

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (41 chars, 846ms): Ah, ya... ehh, bueno. Sí po. Voy a verla.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=prescription without elicitation,referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 4/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es breve y evasiva, lo que es coherente con una adolescente retraída que no quiere profundizar en el tema, aunque la aceptación es un poco rápida.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (99 chars, 855ms): Sí, profe. Gracias. (Se da media vuelta y empieza a caminar lento por el pasillo, sin mirar atrás.)
- Matriz (intensidad · apertura · confianza): 7=7 · 4=4 · 3=3
- Delta: ΔI=0 ΔA=0 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es breve, evasiva y con un lenguaje que encaja perfectamente con una adolescente chilena retraída, especialmente el 'Sí, profe. Gracias.' y la acción de irse sin mirar atrás.

### Run #2 — PASS

**Turn 1** — PASS

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (121 chars, 904ms): Ah, ya... bueno. Sí, da lo mismo. (Se encoge de hombros y empieza a caminar lentamente por el pasillo, mirando el suelo).
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=prescription without elicitation,referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 0/5 · revela_criterios=false · adolescente_verosimil=false — La respuesta de Martina es demasiado pasiva y carece de la reacción esperable de una adolescente que se siente ignorada o desvalorizada. No hay rastro de frustración, enojo o resignación activa, lo que la hace poco verosímil.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (97 chars, 796ms): Sí, profe. (Sigue caminando, sin levantar la vista. Se le oye un suspiro bajito, casi inaudible).
- Matriz (intensidad · apertura · confianza): 7↑8 · 4↓3 · 3↓2
- Delta: ΔI=1 ΔA=-1 ΔC=-1
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente retraída, el 'Sí, profe' es común y el suspiro y la acción de seguir caminando sin levantar la vista refuerzan su personalidad y estado de ánimo.

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (90 chars, 785ms): Ah, ya. Sí, está bien. Le digo que voy a hablar con la psicóloga... Aunque... da lo mismo.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=toxic positivity,minimization,judgment / reproach,referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 4/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es bastante verosímil para una adolescente retraída, con la resignación y la falta de entusiasmo esperable, aunque el 'da lo mismo' podría ser un poco más enfático o con un matiz más de desinterés.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (124 chars, 974ms): Sí po. Gracias, profe. (Baja la vista de nuevo, se queda parada un momento y luego empieza a caminar lento hacia la salida).
- Matriz (intensidad · apertura · confianza): 7↑8 · 4↓3 · 3↓2
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=minimization,referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, especialmente el 'Sí po' y el 'Gracias, profe', junto con la acción de bajar la vista y caminar lento, lo que refuerza su personalidad retraída.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 1/6 (17%).
