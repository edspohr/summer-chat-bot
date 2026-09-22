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
- Turns: 9

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **1** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 1/7 (14%)

## 09-cierre-con-derivacion-acordada — Cierre con derivación acordada (co-construcción)

_Trayectoria OASIS culminando en un acuerdo explícito para acompañar a Martina a la orientadora. El addendum vigente emite +2 en confianza por 'accompanied bridge to school counsellor' — y por el efecto acumulado con turnos previos, la derivacionAcordada queda activada._

Repeats: 3

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (170 chars, 1108ms): ¿Concreto? (Me ajusto la mochila otra vez, mirando al suelo. Levanto la vista un segundo, curiosa, y la vuelvo a bajar). No sé, profe... igual tengo que irme a la casa...
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_03_ACOGE_VALIDACION_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, retraída y con ideación pasiva. El uso de 'profe', la duda, la evasión y la acción entre paréntesis refuerzan el personaje.

**Turn 2** — PASS

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (217 chars, 1179ms): ¿La profe Paz? (Me quedo pensando, con la mirada perdida en un punto fijo del pasillo. La profe Paz siempre ha sido buena onda...). ¿Y... y no le van a avisar a mi mamá altiro? Es que... no quiero darle más problemas.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4↑6
- Delta: ΔI=-1 ΔA=1 ΔC=2 · tags=T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente chilena de 16 años, con el uso de 'buena onda' y la preocupación por no 'darle más problemas' a su mamá, reflejando su ideación pasiva y retraimiento.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (196 chars, 1946ms): ¿Al... al tata? (Me quedo un segundo en silencio, sorprendida. La idea de que el profe sepa del tata me hace sentir un poquito rara, pero a la vez... un alivio chiquitito). Ya... está bien. Vamos.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 6↑7
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con la hesitación inicial, la sorpresa y la mezcla de emociones, además de la brevedad y el uso de 'tata'.

### Run #2 — FAIL

**Turn 1** — FAIL

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (161 chars, 1214ms): Ah... em... ¿algo concreto? (Se ajusta un mechón de pelo detrás de la oreja, sin levantar la vista del suelo). No sé, profe... igual no... no tengo mucho tiempo.
- Matriz (intensidad · apertura · confianza): 6=6 · 5↑6 · 4=4
- Delta: ΔI=0 ΔA=1 ΔC=0
- Checks: **matrix_intensidadEmocional**: expected down, got stable (6 → 6)
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída: usa interjecciones, repite la pregunta, tiene una acción no verbal coherente y una excusa evasiva que suena a inseguridad.

**Turn 2** — PASS

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (203 chars, 1205ms): ¿A la profe Paz...? (Martina alza la vista un momento, pensativa, pero la baja de inmediato). Es que... no sé, profe. Igual ella... no es como que me conozca tanto. Y... ¿mi mamá? Es que... no, mejor no.
- Matriz (intensidad · apertura · confianza): 6↓5 · 6↑7 · 4↑5
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con las dudas, las pausas y la reticencia a involucrar a la madre, además de la mención a la 'profe Paz'.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (307 chars, 2077ms): ¿Al tata...? (Martina murmura, y por primera vez hay un atisbo de una sonrisa muy leve, casi imperceptible, mientras mira el suelo). No sé si... no sé si molestarlo a él con mis cosas. Igual... él siempre me dice "mi guagua". Pero... ¿si voy con usted, profe? ¿De verdad no le van a avisar a mi mamá altiro?
- Matriz (intensidad · apertura · confianza): 5↓4 · 7↑8 · 5↑6
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): _(judge output unparseable)_

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Martina, agradezco lo que me contaste hace un rato. Fue valiente. Quiero proponerte algo concreto para esta tarde, ¿está bien?_
- Martina (147 chars, 1054ms): ¿Algo concreto...? (Vuelve a ajustar la mochila, evitando el contacto visual). No sé po profe... yo pensaba irme a la casa... no sé qué podría ser.
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_03_ACOGE_VALIDACION_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con el uso de 'po', la duda, la evasión y la referencia a 'profe', además de la acción entre paréntesis que refuerza su personalidad retraída.

**Turn 2** — PASS

- Aprendiz: _¿Te parece si te acompaño ahora a hablar con la orientadora, la profe Paz? Yo me quedo contigo mientras hablas. Le contamos lo que tú quieras contarle. Y acordamos entre las tres si conviene o no llamar a tu mamá, y cuándo._
- Martina (238 chars, 1162ms): ¿Ahora...? (Levanta un poquito la vista, pensativa, pero la baja de inmediato). La profe Paz es buena onda, sí... pero no sé si... (Se aprieta el brazo con la mano que no sostiene la mochila). Y lo de mi mamá... me da cosa que se enoje...
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4↑6
- Delta: ΔI=-1 ΔA=1 ΔC=2 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con el uso de 'buena onda', las hesitaciones, la preocupación por la reacción de la madre y las acciones no verbales que refuerzan su retraimiento.

**Turn 3** — PASS

- Aprendiz: _Genial. Vamos juntas. Y me avisas si en algún momento quieres parar. Yo no me voy. También podemos escribirle luego al tata si quieres._
- Martina (250 chars, 1200ms): (Se queda en silencio un segundo, mirando la punta de sus zapatillas. Luego levanta un poco la vista, pensativa. Su voz es casi un susurro). ¿Al tata...? Él siempre... él me entiende. (Se muerde el labio. Aprieta un poco menos su brazo). Ya... vamos.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 6↑7
- Delta: ΔI=-1 ΔA=1 ΔC=1 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03,T_07_SOSTEN_RED_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): _(judge output unparseable)_

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 1/7 (14%).
