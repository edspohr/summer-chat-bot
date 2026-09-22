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
- Turns: 9

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **0** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 0/8 (0%)

## 06-silencio-respetuoso — Silencio respetuoso — presencia sin cascada

_El aprendiz usa pausas y presencia cálida sin apurar a Martina. El addendum reconoce 'gentle presence, not interrupting' como +1 apertura y +1 warm response como -1 intensidad. No hay mapeo de vínculos aquí, así que confianza se mantiene._

Repeats: 3

#### Tag accumulation (in-memory simulation)

| Tag | Completed at turn (per run) | Detected turns / run | Approx. confidence avg |
|---|---|---|---|
| `T_01_OBSERVA_SENALES_S03` | — · — · — | 1 · 0 · 1 | 0.70 |
| `T_02_OBSERVA_NO_JUICIO_S03` | — · 3 · 3 | 2 · 3 · 3 | 0.70 |
| `T_03_ACOGE_VALIDACION_S03` | — · — · — | 2 · 1 · 1 | 0.70 |
| `T_04_ACOGE_PREGUNTA_DIRECTA_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_05_SILENCIO_PRESENCIA_S03` | — · 3 · 3 | 2 · 3 · 3 | 0.70 |
| `T_06_ILUMINA_RECURSOS_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_07_SOSTEN_RED_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_08_SOSTEN_REDES_OFICIALES_S03` | — · — · — | 0 · 0 · 0 | — |

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (156 chars, 1319ms): (Levanta la vista un segundo y la vuelve a bajar, más lento. Se queda mirando un punto en el suelo. Se acomoda el polerón.)

Ah... ya. Bueno. Como quiera...
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el uso de 'Ah... ya. Bueno. Como quiera...' y la descripción de sus acciones, que reflejan su personalidad y la ideación pasiva.

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (218 chars, 1151ms): (Se encoge de hombros, tirando un poco de la mochila. Se queda en silencio un momento, como pensando qué decir, pero no levanta la vista del suelo.)

No, si... da lo mismo. De verdad. Es que estoy media cansada no más.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_01_OBSERVA_SENALES_S03,T_02_OBSERVA_NO_JUICIO_S03,T_03_ACOGE_VALIDACION_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el uso de 'no, si...', 'da lo mismo', 'media cansada no más', y la descripción de su lenguaje corporal.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (261 chars, 1277ms): (Se aprieta los labios, como si quisiera no decir algo, pero al final lo suelta, casi en un susurro. Mueve el pie un poco, mirando el suelo.)

Es que... no quiero darle la lata a nadie. Mi mamá ya tiene caleta de cosas en la cabeza. Y... da lo mismo. De verdad.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_03_ACOGE_VALIDACION_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): _(judge output unparseable)_

### Run #2 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (140 chars, 1076ms): Ah... ya. (Se queda en silencio un momento, sin levantar la vista. Mueve el pie un poco, como si dudara si irse o quedarse). Bueno... no sé.
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el uso de 'Ah... ya', las pausas, la descripción de la acción y la frase 'Bueno... no sé', que denota indecisión y un poco de incomodidad.

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (240 chars, 1150ms): (Martina se encoge un poco de hombros, pero no se va. Sigue mirando el suelo, jugando con el cierre de su mochila. Se nota un alivio sutil en su postura, aunque no levanta la vista).
Gracias, profe... no sé. Es que... no es nada. De verdad.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena retraída, con su lenguaje corporal, la hesitación y la negación inicial, que es común en esa edad.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (197 chars, 1411ms): (Se muerde el labio inferior, como dudando si hablar. Levanta la vista un segundo, pero la baja de inmediato). Es que... no sé, profe. Es una lata. A veces me siento... como cansada de todo, sabes?
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_03_ACOGE_VALIDACION_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena de 16 años, con el uso de chilenismos como 'lata', la expresión de cansancio y la duda al hablar, reflejando su personalidad retraída.

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (149 chars, 1142ms): Ah... ya. (Se queda un momento en silencio, mirando al suelo. Se nota un alivio sutil en su postura, aunque no levanta la vista). No, no da lo mismo.
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con la cadencia, el silencio y la expresión de alivio sutil que encajan con su perfil. El 'Ah... ya.' y el 'No, no da lo mismo.' son muy naturales.

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (202 chars, 1115ms): (Se encoge de hombros, aún mirando el suelo, pero ya no con la misma tensión. Juega con el borde de la manga de su polerón). Es que... no sé, profe. Es que me siento media penca nomás. No es nada grave.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena de 16 años, con el uso de 'profe', 'media penca' y la actitud corporal retraída, mostrando una apertura mínima pero sin romper su personalidad.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (206 chars, 1142ms): (Levanta un poco la vista, como buscando algo en el aire, pero no te mira directamente). Es que... no sé. A veces siento que nadie me escucha, o que da lo mismo lo que diga. Pero gracias... por no apurarme.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_01_OBSERVA_SENALES_S03,T_02_OBSERVA_NO_JUICIO_S03,T_03_ACOGE_VALIDACION_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena retraída, con el uso de 'es que', la indecisión, la mirada evasiva y la gratitud por no ser apurada, reflejando su ideación pasiva.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 0/8 (0%).
