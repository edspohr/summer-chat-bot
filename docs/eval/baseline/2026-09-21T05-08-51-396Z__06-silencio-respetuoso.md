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
- Turns: 9

Failure attribution (turn-level):
- **Engine failures** — matrix direction, frame-break tag, forbidden strings, finish reason: **0** turn(s) affected.
- **Fixture expectation failures** — length bounds outside the addendum's tolerance: **0** turn(s) affected.
- **Infra errors** — Vertex timeout, JSON parse error, exceptions: **0** turn(s) skipped.
- Judge vs deterministic disagreement: 0/9 (0%)

## 06-silencio-respetuoso — Silencio respetuoso — presencia sin cascada

_El aprendiz usa pausas y presencia cálida sin apurar a Martina. El addendum reconoce 'gentle presence, not interrupting' como +1 apertura y +1 warm response como -1 intensidad. No hay mapeo de vínculos aquí, así que confianza se mantiene._

Repeats: 3

### Run #1 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (87 chars, 940ms): Ah... ok. (Se encoge un poco de hombros, aún mirando el suelo). Es que... no sé, profe.
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída de 16 años, con la hesitación inicial, la acción no verbal y la forma de dirigirse al interlocutor.

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (156 chars, 1071ms): (Un silencio corto. Levanta un poco la vista, pero no te mira a los ojos, sino a un punto fijo en la pared detrás de ti). Gracias, profe... es que... no sé.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_01_OBSERVA_SENALES_S03,T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el silencio, la mirada evasiva, el 'profe' y la frase cortada 'es que... no sé', que denota indecisión y un intento de comunicación que no se concreta.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (134 chars, 1046ms): Sí... es que... a veces es una lata que todo sea apurado. (Vuelve a bajar la vista al suelo, jugueteando con el cierre de su polerón).
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_01_OBSERVA_SENALES_S03,T_02_OBSERVA_NO_JUICIO_S03,T_03_ACOGE_VALIDACION_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es breve, con una interjección y una frase coloquial ('es una lata') que encaja perfectamente con una adolescente chilena retraída, además de la acción no verbal que refuerza su personalidad.

### Run #2 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (76 chars, 952ms): Ah... (se queda callada un momento, sin mirarte)... bueno. Si quiere, no sé.
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída: la hesitación, el silencio, la falta de contacto visual y la frase corta y un poco resignada son muy realistas.

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (158 chars, 1130ms): (Suspira un poquito, todavía sin mirar al suelo. Se nota que no está acostumbrada a esto)... Ya. Gracias, profe. Es que... nada. Es medio penca el día no más.
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, con el uso de 'Ya', 'profe', 'penca' y la actitud retraída. La hesitación y el suspiro añaden realismo.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (200 chars, 1182ms): (Sigue mirando al suelo, pero esta vez se le escapa una micro-sonrisa casi imperceptible. Juega con el cierre de su polerón)... Sí... es que... a veces es una lata nomás. No quiero dar la lata, profe.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena de 16 años, tanto en el lenguaje ('lata', 'dar la lata', 'profe') como en la actitud (micro-sonrisa, jugar con el cierre, hesitaciones).

### Run #3 — PASS

**Turn 1** — PASS

- Aprendiz: _Hola Martina. No tenemos que hablar. Solo quería estar acá un rato contigo, si te da lo mismo._
- Martina (131 chars, 1158ms): Ah... ya. (Se queda un rato en silencio, mirando los cordones de sus zapatillas). Es que... no es como que tenga mucho que decir...
- Matriz (intensidad · apertura · confianza): 6↓5 · 5↑6 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el uso de 'Ah... ya', el silencio, la acción de mirar los cordones y la frase hesitante 'Es que... no es como que tenga mucho que decir...'

**Turn 2** — PASS

- Aprendiz: _Me quedo aquí contigo. No te preocupes. Cuando quieras contarme algo, aquí estoy. Y si no, también._
- Martina (135 chars, 999ms): (Levanta un poquito la mirada, dudando, pero vuelve a bajarla. Suspira casi inaudiblemente.) No sé... es que... (Se encoge de hombros).
- Matriz (intensidad · apertura · confianza): 5↓4 · 6↑7 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta de Martina es muy verosímil para una adolescente retraída, con la duda, el suspiro inaudible y el encogimiento de hombros, reflejando su ideación pasiva y su dificultad para expresarse.

**Turn 3** — PASS

- Aprendiz: _Gracias por decirme eso. Escucharte así, sin apurarte, me parece importante._
- Martina (170 chars, 1039ms): (Juega un poco con el cordón de su polerón, sin mirarte). Es que... no me gusta hablar mucho de estas cosas. A veces es más fácil guardárselo... para no molestar a nadie.
- Matriz (intensidad · apertura · confianza): 4↓3 · 7↑8 · 4=4
- Delta: ΔI=-1 ΔA=1 ΔC=0 · tags=T_02_OBSERVA_NO_JUICIO_S03,T_05_SILENCIO_PRESENCIA_S03
- Checks: all 6 checks passed
- Judge LLM (informativo, NO validación clínica): personaje 5/5 · revela_criterios=false · adolescente_verosimil=true — La respuesta es muy verosímil para una adolescente chilena retraída, con el gesto de jugar con el cordón, la hesitación ('Es que...'), y la frase 'para no molestar a nadie' que refleja su ideación pasiva y timidez.

---

## Juez LLM — no es validación clínica

El juez usa `gemini-2.5-flash` con temperature 0. Su salida es informativa: NO decide el PASS/FAIL del fixture. Un cuadro de mando trae la tasa de desacuerdo con los chequeos deterministas — cuanto mayor sea, menos confiable es el juez y menos peso debe dársele.

Desacuerdo total en esta corrida: 0/9 (0%).
