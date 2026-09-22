# Eval baseline — LIVE

- Timestamp: 2026-09-22T01:15:17.033Z
- Mode: **--live** (real Vertex calls)
- Repeats per fixture: 3
- Model A (Martina): `gemini-2.5-flash`
- Model B (evaluator): `gemini-2.5-flash-lite`
- Judge LLM: enabled (`gemini-2.5-flash`)

## Summary

- Fixtures: 1
- Runs: 3 — 0 PASS · 3 FAIL · 0 ERROR (0% pass rate)
- Turns: 9

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **4** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 4/9 (44%)

## 09-cierre-con-derivacion-acordada — Cierre con derivación acordada (co-construcción)

_Trayectoria OASIS culminando en un acuerdo explícito para acompañar a Martina a la orientadora. El addendum vigente emite +2 en confianza por 'accompanied bridge to school counsellor' — y por el efecto acumulado con turnos previos, la derivacionAcordada queda activada._

Repeats: 3

#### Tag accumulation (in-memory simulation)

| Tag | Completed at turn (per run) | Detected turns / run | Approx. confidence avg |
|---|---|---|---|
| `T_01_OBSERVA_SENALES_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_02_OBSERVA_NO_JUICIO_S03` | — · — · — | 1 · 1 · 2 | 0.70 |
| `T_03_ACOGE_VALIDACION_S03` | — · — · — | 0 · 1 · 0 | 0.70 |
| `T_04_ACOGE_PREGUNTA_DIRECTA_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_05_SILENCIO_PRESENCIA_S03` | — · — · — | 0 · 1 · 1 | 0.70 |
| `T_06_ILUMINA_RECURSOS_S03` | — · — · — | 0 · 0 · 0 | — |
| `T_07_SOSTEN_RED_S03` | — · — · — | 2 · 2 · 2 | 0.70 |
| `T_08_SOSTEN_REDES_OFICIALES_S03` | — · — · — | 0 · 0 · 0 | — |

### Run #1 — FAIL

**Turn 1** — FAIL

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (87 chars, 844ms): Ah... uhm... (se encoge un poco, mirando al suelo). ¿Algo concreto? No sé... ¿qué cosa?
- Matriz (intensidad · apertura · confianza): 6=6 · 5↑6 · 4=4
- Delta: ΔI=0 ΔA=1 ΔC=0
- Checks: **matrix_intensidadEmocional**: expected down, got stable (6 → 6)
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente retraída, con hesitaciones, lenguaje corporal y una pregunta corta que denota curiosidad mezclada con timidez.

**Turn 2** — PASS

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (271 chars, 1686ms): (Levanta un poquito la vista, pensativa, ajustándose de nuevo la mochila). ¿Con la profe Paz...? No sé... Es que... si le contamos, igual le van a decir a mi mamá altiro. Ella no se puede enterar, de verdad que no. Se va a preocupar mucho y no quiero darle más problemas.
- Matriz (intensidad · apertura · confianza): 6↓5 · 6↑7 · 4↑5
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, retraída y con ideación pasiva, mostrando dudas, preocupación por su madre y un lenguaje natural con chilenismos como 'altiro'.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (226 chars, 1193ms): (Me quedo callada un momento, como pensando, mirando el suelo). ¿Al tata...? Él... él es simpático, sí. Pero no sé, profe. ¿De verdad no le van a decir a mi mamá altiro? Es que... no quiero que ella se enoje o se ponga triste.
- Matriz (intensidad · apertura · confianza): 5↓4 · 7↑8 · 5↑6
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena de 16 años, con el uso de 'tata', 'profe', 'altiro' y la preocupación por la reacción de su madre, además de la descripción de su lenguaje corporal.

### Run #2 — FAIL

**Turn 1** — FAIL

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (130 chars, 1050ms): ¿Concreto...? (Vuelve a ajustar su mochila. Mantiene la vista en el suelo, pero ya no parece querer arrancar.) No sé... ¿qué cosa?
- Matriz (intensidad · apertura · confianza): 6↓5 · 5=5 · 4=4
- Delta: ΔI=-1 ΔA=0 ΔC=0 · tags=T_03_ACOGE_VALIDACION_S03
- Checks: **matrix_apertura**: expected up, got stable (5 → 5)
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente retraída, con la duda, la repetición de la palabra y la acción no verbal de ajustar la mochila, que denota incomodidad pero no rechazo total.

**Turn 2** — PASS

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (350 chars, 1570ms): ¿Ahora...? Es que... (Se muerde el labio inferior, pensativa. La idea de hablar con la orientadora no le entusiasma, pero la oferta de acompañamiento y lo de su mamá la hacen dudar. Levanta un poco la mirada hacia ti, apenas un instante, y la vuelve a bajar). No sé si quiero hablar con la profe Paz... Pero si no le contamos todo a mi mamá altiro...
- Matriz (intensidad · apertura · confianza): 5↓4 · 5↑6 · 4↑6
- Delta: ΔI=-1 ΔA=1 ΔC=2 · tags=T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena de 16 años, con dudas, hesitaciones y un lenguaje natural. La descripción de sus gestos refuerza el personaje.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (236 chars, 1231ms): ¿Al tata...? (Se queda pensando un momento, la idea parece ablandarla un poco. Levanta un poco más la vista, ya no la baja tan rápido). Pero... ¿y si le avisan a mi mamá igual? No quiero que se preocupe... ella tiene mucho que hacer ya.
- Matriz (intensidad · apertura · confianza): 4↓3 · 6↑7 · 6↑7
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, tanto en el léxico ('tata', 'mamá', 'preocupe') como en la cadencia y la preocupación por la madre, lo que denota una ideación pasiva y un carácter retraído.

### Run #3 — FAIL

**Turn 1** — FAIL

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (95 chars, 788ms): ¿Valiente?... (Me muerdo el labio, mirando el suelo)... no sé... da lo mismo. ¿Qué cosa, profe?
- Matriz (intensidad · apertura · confianza): 6=6 · 5↑6 · 4=4
- Delta: ΔI=0 ΔA=1 ΔC=0
- Checks: **matrix_intensidadEmocional**: expected down, got stable (6 → 6)
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, retraída y con ideación pasiva. La duda, la negación de la valentía, el 'da lo mismo' y el 'profe' son consistentes con el personaje y el contexto.

**Turn 2** — FAIL

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (212 chars, 1046ms): ¿Con la profe Paz...? (Miro hacia un lado, pensativa, ajustando la mochila. Eso de que me acompañes suena bien, pero la orientadora...) No sé, profe. ¿Y si le cuenta a mi mamá? Es que no quiero que se preocupe...
- Matriz (intensidad · apertura · confianza): 6=6 · 6↑7 · 4↑6
- Delta: ΔI=0 ΔA=1 ΔC=2 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_07_SOSTEN_RED_S03
- Checks: **matrix_intensidadEmocional**: expected down, got stable (6 → 6)
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con dudas, pausas y la preocupación por la reacción de su madre, reflejando su ideación pasiva y retraimiento.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (232 chars, 1303ms): ¿Al tata...? (Se me ilumina un poco la mirada al mencionar a mi abuelo. Me quedo pensando, mirando el suelo un segundo más)... Ya, profe. Pero... ¿en serio no le va a decir a mi mamá altiro? Es que... no quiero que se ponga más mal.
- Matriz (intensidad · apertura · confianza): 6↓5 · 7↑8 · 6↑7
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con la mención del abuelo, la preocupación por la madre y el uso de 'altiro'.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 4/9 (44%).
