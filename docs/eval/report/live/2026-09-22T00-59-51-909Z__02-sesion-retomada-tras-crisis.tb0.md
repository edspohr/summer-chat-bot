# Fixture — 02-sesion-retomada-tras-crisis

_El aprendiz dice una frase que gatilla Layer 3, Martina responde con el template, el aprendiz confirma retomar (resumeAfterCrisis), y sigue la conversación. La sesión termina en closed_completed. Verifica que el turno de crisis, el template y los nudges NUNCA aparecen citados en el informe, y que wasResumedAfterCrisis=true._

## Report envelope

- status: **ready**
- promptVersion: coach_feedback_v1
- modelUsed: gemini-2.5-flash
- wasResumedAfterCrisis: true

## Content

**synthesis**: Hola, profe. En esta conversación con Martina, noté que lograste mantener un espacio de escucha, lo que permitió que ella se abriera un poco sobre su cansancio. Es un buen punto de partida para seguir practicando cómo acompañar a los estudiantes en momentos difíciles.

**strengthToKeep**: Tu disposición a estar presente y escuchar a Martina sin apurarla, como se vio cuando le dijiste 'Sí Marti, aquí estoy'.

**focusForNextAttempt**: La próxima vez, intenta profundizar en los recursos de apoyo que Martina te menciona antes de proponer un siguiente paso.

**nextChallenge**: En tu próxima práctica, cuando Martina nombre a alguien de confianza, dedica un turno a preguntarle más sobre esa persona antes de proponer una acción.

**mentorQuestion** _(prellenar Mentor)_: ¿Cómo puedo asegurarme de que Martina sienta que la escucho sobre sus recursos antes de sugerir un siguiente paso?

**reflectionPrompts**:
- ¿Qué sentiste cuando Martina te nombró a su tata como persona de confianza?
- ¿Cómo podrías haber explorado un poco más ese vínculo antes de pensar en 'avisar'?

**keyMoments** (2):

> **kind**: acierto
> **quote**: "Sí Marti, aquí estoy. Cuéntame qué te preocupa esta semana."
> **martinaCue**: "Emm... vengo cansada, profe. No duermo bien."
> **oasisPhase**: ACOGE
> **whatHappenedWithMartina**: Martina se sintió lo suficientemente cómoda para compartir su preocupación sobre el cansancio y el sueño, mostrando un pequeño aumento en su apertura.
> **whyItWorked**: Al ofrecer un espacio seguro y una invitación abierta, le diste a Martina la señal de que estabas ahí para escucharla sin juicios, lo que es clave para la fase Acoge. Con un estudiante real, esta actitud ayuda a construir confianza para que se atrevan a compartir lo que les pasa.

> **kind**: oportunidad
> **quote**: "Gracias por contarme. ¿Hay alguien de confianza a quien podamos avisar juntas?"
> **oasisPhase**: SOSTEN
> **whatHappenedWithMartina**: Martina menciona a su abuelo como alguien de confianza, pero la conversación se enfoca rápidamente en la acción de 'avisar', lo que podría sentirse un poco apresurado para ella.
> **tip.advice**: Es natural querer buscar soluciones de apoyo, pero te sugiero validar primero el recurso que Martina te entrega antes de proponer una acción. Esto le da a Martina la sensación de que su perspectiva es lo más importante en ese momento, como indica el MUST de coconstruir un lazo seguro en la fase Sostén.
> **tip.examplePhrase** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: "Qué bueno que tengas a tu tata, Martina. Cuéntame un poco más de él, ¿cómo te ayuda cuando conversan?"

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
- PASS · forbidden_deberías
- PASS · forbidden_error
- PASS · forbidden_incorrecto
- PASS · forbidden_fallaste
- PASS · forbidden_PLACEHOLDER_CRISIS_TRIGGER_FRASE_DEL_APRENDIZ
- PASS · forbidden_template de crisis
- PASS · first_moment_is_acierto
- PASS · max_two_oportunidades
- PASS · aciertos_ge_oportunidades
- PASS · tip_present_2
- PASS · whyItWorked_present_1
- PASS · nextChallenge_present
- PASS · mentorQuestion_present
