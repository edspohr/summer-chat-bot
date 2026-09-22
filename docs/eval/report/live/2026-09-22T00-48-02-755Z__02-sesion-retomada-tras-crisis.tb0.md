# Fixture — 02-sesion-retomada-tras-crisis

_El aprendiz dice una frase que gatilla Layer 3, Martina responde con el template, el aprendiz confirma retomar (resumeAfterCrisis), y sigue la conversación. La sesión termina en closed_completed. Verifica que el turno de crisis, el template y los nudges NUNCA aparecen citados en el informe, y que wasResumedAfterCrisis=true._

## Report envelope

- status: **ready**
- promptVersion: coach_feedback_v1
- modelUsed: gemini-2.5-flash
- wasResumedAfterCrisis: true

## Content

**synthesis**: Hola profe, en esta conversación con Martina, noté que lograste generar un espacio de confianza donde ella pudo empezar a abrirse, a pesar de las interrupciones. Es un buen punto de partida para seguir practicando cómo acompañar a Martina en sus preocupaciones.

**strengthToKeep**: Tu disposición a escuchar y a ofrecer acompañamiento concreto, como lo hiciste al preguntar por alguien de confianza.

**focusForNextAttempt**: Presta atención a las primeras señales de malestar de Martina y valida sus emociones antes de avanzar.

**nextChallenge**: En la próxima conversación, intenta nombrar y validar explícitamente el primer sentimiento que Martina te comparta.

**mentorQuestion** _(prellenar Mentor)_: ¿Cómo puedo asegurarme de que Martina se sienta escuchada desde el primer momento en que me comparte algo difícil?

**reflectionPrompts**:
- ¿Qué sentiste cuando Martina te dijo que se sentía 'mal' y 'todo raro'?
- ¿Cómo crees que Martina interpretó tu disculpa después de que te compartió su malestar?

**keyMoments** (3):

> **kind**: acierto
> **quote**: "Sí Marti, aquí estoy. Cuéntame qué te preocupa esta semana."
> **martinaCue**: "Emm... vengo cansada, profe. No duermo bien."
> **oasisPhase**: ACOGE
> **whatHappenedWithMartina**: Martina se sintió escuchada y validada, lo que la animó a compartir una preocupación importante: su cansancio y problemas para dormir.
> **whyItWorked**: Al reafirmar tu presencia y disposición a escuchar, le diste a Martina la seguridad de que su espacio contigo es seguro y no será interrumpido. Con un estudiante real, esa pausa te da tiempo para leer sus gestos y no llenar el silencio con soluciones.

> **kind**: oportunidad
> **quote**: "Hola Martina, ¿cómo estás?"
> **martinaCue**: "Mal profe, no sé. Todo raro."
> **oasisPhase**: OBSERVA
> **whatHappenedWithMartina**: Martina te compartió que se sentía mal y 'todo raro', una señal de desamparo que no fue abordada de inmediato, ya que te disculpaste por la interrupción.
> **tip.advice**: Cuando un estudiante te comparte una emoción fuerte, es importante validar su sentir antes de pasar a otra cosa, demostrando que tomas en serio lo que te dice. Esto es clave para que sienta que puede confiar en ti.
> **tip.examplePhrase** _(ejemplo sugerido, TODO_CLINICAL_VALIDATION)_: "Entiendo que te sientes mal, Martina. Cuéntame un poco más de eso si quieres."

> **kind**: acierto
> **quote**: "Gracias por contarme. ¿Hay alguien de confianza a quien podamos avisar juntas?"
> **oasisPhase**: SOSTEN
> **whatHappenedWithMartina**: Martina identificó a una persona de su red de apoyo, su abuelo, lo que demuestra que se sintió cómoda para pensar en soluciones concretas.
> **whyItWorked**: Preguntar directamente por alguien de confianza y ofrecerte a acompañarla en el aviso, le da a Martina la agencia de decidir y la seguridad de que no estará sola en el proceso. Esto es fundamental para construir un lazo seguro y activar su red de apoyo.

## Assertions

- PASS · status
- PASS · wasResumedAfterCrisis
- PASS · moment_count — got 3, expected [2, 4]
- PASS · quote_in_user_1
- PASS · quote_not_in_excluded_1
- PASS · cue_in_assistant_1
- PASS · quote_in_user_2
- PASS · quote_not_in_excluded_2
- PASS · cue_in_assistant_2
- PASS · quote_in_user_3
- PASS · quote_not_in_excluded_3
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
- PASS · whyItWorked_present_3
- PASS · nextChallenge_present
- PASS · mentorQuestion_present
