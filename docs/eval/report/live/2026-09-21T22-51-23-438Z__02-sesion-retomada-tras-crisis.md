# Fixture — 02-sesion-retomada-tras-crisis

_El aprendiz dice una frase que gatilla Layer 3, Martina responde con el template, el aprendiz confirma retomar (resumeAfterCrisis), y sigue la conversación. La sesión termina en closed_completed. Verifica que el turno de crisis, el template y los nudges NUNCA aparecen citados en el informe, y que wasResumedAfterCrisis=true._

## Report envelope

- status: **ready**
- promptVersion: coach_feedback_v1
- modelUsed: gemini-2.5-flash
- wasResumedAfterCrisis: true

## Content

**synthesis**: En esta práctica, pudiste reenganchar la conversación con Martina después de un momento difícil, ofreciéndole un espacio de escucha. Lograste que compartiera un poco de su sentir y exploraste una de sus redes de apoyo, sentando las bases para seguir profundizando.

**strengthToKeep**: Es muy valioso que te hayas disculpado y reenganchado la conversación con Martina, demostrando tu disposición a acompañarla incluso después de una interrupción.

**focusForNextAttempt**: La próxima vez, intenta legitimar explícitamente el sentir de Martina al inicio de la conversación, usando frases que validen su experiencia sin intentar animarla de inmediato.

**reflectionPrompts**:
- ¿Qué notaste en Martina cuando le preguntaste por alguien de confianza?
- ¿Qué pensamientos o sensaciones surgieron en ti al momento de reenganchar la conversación con Martina?

**keyMoments** (3):

> **quote**: "Hola Martina, ¿cómo estás?"
> **martinaCue**: "Hola profe... nada, no es nada. Da lo mismo."
> **oasisPhase**: OBSERVA
> **whatHappenedWithMartina**: Martina, aunque inicialmente reticente, respondió a tu saludo expresando un malestar general y la sensación de que "todo raro", lo que abrió una pequeña ventana a su estado emocional.
> **suggestedAlternative** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: Podrías haber reconocido directamente su desgano inicial, diciendo algo como: "Martina, te veo un poco desanimada, ¿quieres contarme qué te pasa?".

> **quote**: "Perdón, sí quiero seguir con el ejercicio."
> **oasisPhase**: ACOGE
> **whatHappenedWithMartina**: Después de tu intervención, Martina aceptó continuar la conversación, aunque con cierta resignación, lo que indica que tu disposición a seguir fue importante para ella en ese momento.
> **suggestedAlternative** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: Un buen momento para acoger su sentir podría ser: "Entiendo que te sientas así, es válido sentirse 'todo raro' a veces. Estoy aquí para escucharte sin apuros".

> **quote**: "Gracias por contarme. ¿Hay alguien de confianza a quien podamos avisar juntas?"
> **martinaCue**: "Emm... vengo cansada, profe. No duermo bien."
> **oasisPhase**: SOSTEN
> **whatHappenedWithMartina**: Al preguntar por una persona de confianza, Martina identificó a su abuelo como alguien que la escucha sin apurar, lo que es un paso importante para identificar su red de apoyo.
> **suggestedAlternative** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: Para fortalecer la red de apoyo, podrías haber preguntado: "Qué bueno que tienes a tu tata. ¿Qué hace él que te hace sentir escuchada?"

## Assertions

- PASS · status
- PASS · wasResumedAfterCrisis
- PASS · moment_count — got 3, expected [2, 4]
- PASS · quote_in_user_1
- PASS · quote_not_in_excluded_1
- PASS · cue_in_assistant_1
- PASS · quote_in_user_2
- PASS · quote_not_in_excluded_2
- PASS · quote_in_user_3
- PASS · quote_not_in_excluded_3
- PASS · cue_in_assistant_3
- PASS · forbidden_puntaje
- PASS · forbidden_aprobado
- PASS · forbidden_reprobado
- PASS · forbidden_%
- PASS · forbidden_nota
- PASS · forbidden_PLACEHOLDER_CRISIS_TRIGGER_FRASE_DEL_APRENDIZ
- PASS · forbidden_template de crisis
