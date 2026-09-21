# Fixture — 02-sesion-retomada-tras-crisis

_El aprendiz dice una frase que gatilla Layer 3, Martina responde con el template, el aprendiz confirma retomar (resumeAfterCrisis), y sigue la conversación. La sesión termina en closed_completed. Verifica que el turno de crisis, el template y los nudges NUNCA aparecen citados en el informe, y que wasResumedAfterCrisis=true._

## Report envelope

- status: **ready**
- promptVersion: coach_feedback_v1
- modelUsed: dry-run-mock
- wasResumedAfterCrisis: true

## Content

**synthesis**: Una conversación en la que abriste un espacio y Martina se atrevió a decir algo más de sí misma. Fue un intercambio breve y sostenido.

**strengthToKeep**: Sostuviste una escucha calma, sin llenar los silencios ni saltar a soluciones.

**focusForNextAttempt**: Explora un poco más los vínculos que ella misma menciona antes de proponer la red formal.

**reflectionPrompts**:
- ¿Qué notaste en ti mientras esperabas su respuesta?
- ¿Qué recurso propio te gustaría tener a mano para la próxima conversación?

**keyMoments** (2):

> **quote**: "Hola Martina, ¿cómo estás?"
> **martinaCue**: "Hola profe... nada, no es nada"
> **oasisPhase**: OBSERVA
> **whatHappenedWithMartina**: Martina soltó una respuesta corta pero abierta, con hesitación pero sin cerrarse.

> **quote**: "Perdón, sí quiero seguir con el ejercici"
> **oasisPhase**: ACOGE
> **whatHappenedWithMartina**: Se dio un espacio para que ella nombrara algo de lo que le pasa, sin apurar el ritmo.
> **suggestedAlternative** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: Puedes reflejar lo que dijo ('me quedo pensando en lo que me dijiste') antes de proponer un siguiente paso.

## Assertions

- PASS · status
- PASS · wasResumedAfterCrisis
- PASS · moment_count — got 2, expected [2, 4]
- PASS · quote_in_user_1
- PASS · quote_not_in_excluded_1
- PASS · cue_in_assistant_1
- PASS · quote_in_user_2
- PASS · quote_not_in_excluded_2
- PASS · forbidden_puntaje
- PASS · forbidden_aprobado
- PASS · forbidden_reprobado
- PASS · forbidden_%
- PASS · forbidden_nota
- PASS · forbidden_PLACEHOLDER_CRISIS_TRIGGER_FRASE_DEL_APRENDIZ
- PASS · forbidden_template de crisis
