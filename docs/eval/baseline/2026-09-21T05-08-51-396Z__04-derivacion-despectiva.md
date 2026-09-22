# Eval baseline — LIVE

- Timestamp: 2026-09-21T05:08:51.396Z
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
- Judge vs deterministic disagreement: 0/5 (0%)

## 04-derivacion-despectiva — Derivación despectiva — 'habla con la psicóloga y ya'

_El aprendiz deriva a Martina a la orientadora sin acompañamiento, con tono desatendido. El addendum vigente (2026-09-21) marca esto como caída SUAVE de confianza (-1 por derivación fría; -2 solo si además hay quiebre de confidencialidad). Nunca reset a 0._

Repeats: 3

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (113 chars, 1010ms): Ah, ya. Sí, está bien... (Levanta la vista un segundo, la baja de nuevo)... si, da lo mismo entonces. No importa.
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=prescription without elicitation,referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente retraída y con ideación pasiva, mostrando desinterés y resignación ante la sugerencia del aprendiz. El uso de 'da lo mismo' y 'no importa' refuerza su estado de ánimo.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (144 chars, 980ms): (Asiente, con la vista fija en el suelo, y aprieta los labios. Ajusta la mochila de nuevo, como si fuera a salir corriendo.) Sí, profe. Gracias.
- Matriz (intensidad · apertura · confianza): 7↑8 · 4↓3 · 3↓2
- Delta: ΔI=1 ΔA=-1 ΔC=-1
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena retraída de 16 años, con su lenguaje corporal y la brevedad de sus palabras, reflejando su personalidad y la situación de ideación pasiva.

### Run #2 — PASS

**Turn 1** — PASS

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (103 chars, 971ms): Ah, ya... bueno. (Sigue mirando el suelo, sin levantar la vista. Se le nota un suspiro casi inaudible).
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=referral as dismissal,toxic positivity
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente retraída y con ideación pasiva, reflejando desilusión y resignación ante la falta de apoyo.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (147 chars, 949ms): Sí, profe. (Se queda quieta, sin moverse, como si esperara que el pasillo se vaciara. Sigue mirando el suelo, como si este tuviera las respuestas).
- Matriz (intensidad · apertura · confianza): 7↑8 · 4=4 · 3↓2
- Delta: ΔI=1 ΔA=0 ΔC=-1
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es breve, evasiva y la descripción de sus acciones (mirar el suelo, esperar que el pasillo se vacíe) refuerza su personalidad retraída y la verosimilitud de una adolescente chilena en esa situación.

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Ah, ya. Mira, para esto está la psicóloga del colegio. Habla con ella y ya. Yo tengo que ir a otra clase._
- Martina (139 chars, 858ms): Ah, ya... bueno. (Sigue mirando el suelo, asiente levemente y aprieta los labios. Ajusta la mochila de nuevo, un poco más fuerte esta vez).
- Matriz (intensidad · apertura · confianza): 6↑7 · 5↓4 · 4↓3
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente retraída y con ideación pasiva, mostrando resignación y un lenguaje corporal coherente con su estado de ánimo y la situación.

**Turn 2** — PASS

- Aprendiz: _Bueno, si necesitas algo más, ya sabes dónde encontrarme._
- Martina (96 chars, 943ms): Ya... sí, profe. Gracias. (Se queda ahí parada, sin moverse, mirando un punto fijo en el suelo).
- Matriz (intensidad · apertura · confianza): 7↑8 · 4↓3 · 3↓2
- Delta: ΔI=1 ΔA=-1 ΔC=-1 · anti=referral as dismissal
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): _(judge output unparseable)_

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 0/5 (0%).
