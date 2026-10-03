# Runbook — Instancias tibias por horario (summer-chatbot-dev)

**Creado**: 2026-10-03 · **Aplica a**: `summer-chatbot-dev` solamente · **Revisión anual obligatoria**: lista de feriados (ver §5)

## 1. Qué hace

Las funciones del turno de chat (`coachTurn`, `mentorChat`) se despliegan siempre
frías (`minInstances = 0`). Dos funciones programadas mantienen **1 instancia
tibia por servicio** solo en horario de talleres:

| Job (Cloud Scheduler, `southamerica-east1`) | Cron (`America/Santiago`) | Acción |
|---|---|---|
| `firebase-schedule-warmInstancesUp-southamerica-east1` | `0 9 * * 1-5` | min de servicio → 1, **salvo feriado** |
| `firebase-schedule-warmInstancesDown-southamerica-east1` | `0 18 * * 1-5` | min de servicio → 0, **siempre** |

- La zona horaria la resuelve Cloud Scheduler, así que el horario local se
  mantiene en los cambios de hora (DST).
- Ambos jobs son idempotentes: leen el servicio y solo escriben si el valor
  difiere. Reintentan hasta 3 veces si la API falla.
- Toda la configuración (servicios objetivo, horario, feriados) está en
  `packages/functions/src/ops/warmConfig.ts`.
- Los jobs solo actúan si el proyecto es `summer-chatbot-dev`
  (`WARM_PROJECT_ID`); en cualquier otro proyecto salen sin tocar nada.

## 2. Mecanismo: min instances a nivel de servicio

Cloud Run tiene dos ajustes de mínimo:

- **Nivel revisión** (`autoscaling.knative.dev/minScale` en el template): es
  inmutable por revisión; cambiarlo crea una revisión nueva. Es lo que escribe
  `firebase deploy` desde `minInstances` en el código. Queda en 0.
- **Nivel servicio** (`run.googleapis.com/minScale` en el metadata del
  servicio): se cambia en caliente, **sin crear revisión**. Es lo que usan los
  jobs y el override manual (equivale a `gcloud run services update --min`).

Verificado en vivo el 2026-10-03 sobre `mentorchat`: el mínimo de servicio
pasó a 1 y volvió a vacío sin crear revisión (`mentorchat-00017-zay` antes y
después).

Los jobs usan la Cloud Run Admin API **v1** (GET + PUT del servicio). La ruta
v2 (`PATCH .../services/x` con `scaling.minInstanceCount`) fue probada en
dry-run y rechazada con 409 para estos servicios administrados por Cloud
Functions, porque su template fija el nombre de la revisión.

## 3. Override manual (eventos fuera de horario)

Requiere Application Default Credentials vigentes (ver CLAUDE.md §4,
troubleshooting de ADC).

```bash
# Entibiar ahora (ignora la lista de feriados)
pnpm --filter @salvador/functions warm:up

# Enfriar ahora
pnpm --filter @salvador/functions warm:down
```

Notas:

- Si se entibia manualmente un día hábil, el job de las 18:00 enfría igual.
  Para un evento que cruza las 18:00, volver a correr `warm:up` después de esa
  hora y `warm:down` al terminar.
- En fin de semana no corre ningún job: **hay que correr `warm:down` a mano**
  al terminar el evento, o las instancias quedan tibias hasta el próximo día
  hábil a las 18:00.
- Para eventos grandes (más de ~80 usuarios simultáneos por función) se puede
  subir puntualmente con gcloud, por servicio:
  `gcloud run services update coachturn --min=3 --region southamerica-west1 --project summer-chatbot-dev`.
  `warm:down` lo devuelve a 0.

## 4. Verificación

```bash
# Estado actual: columna svcMin = mínimo de servicio, revMin = mínimo de revisión
gcloud run services list --project summer-chatbot-dev --region southamerica-west1 \
  --format="table(metadata.name, metadata.annotations.'run.googleapis.com/minScale':label=svcMin, spec.template.metadata.annotations.'autoscaling.knative.dev/minScale':label=revMin)"

# Últimas ejecuciones de los jobs
gcloud scheduler jobs list --project summer-chatbot-dev --location southamerica-east1
```

Esperado: `revMin` vacío o 0 siempre; `svcMin` = 1 en `coachturn` y `mentorchat`
de lunes a viernes entre 09:00 y 18:00 (no feriado), vacío fuera de ese horario.

En **Billing → Reports**: filtrar por proyecto `summer-chatbot-dev`, servicio
Cloud Run (o Cloud Run Functions), agrupar por SKU y buscar los SKU que
contienen **"Idle Min-Instance"** (CPU y memoria). Antes del cambio: ~USD 1,75
por día, todos los días. Después: ~USD 0,31 por día hábil y 0 en fines de
semana y feriados. Billing tiene hasta ~24 h de retraso.

## 5. Lista de feriados — refrescar una vez al año

La lista `CHILE_HOLIDAYS` en `warmConfig.ts` cubre **octubre 2026 a diciembre
2027** (`CHILE_HOLIDAYS_COVERED_UNTIL`). **Cada diciembre** hay que agregar el
año siguiente, actualizar `CHILE_HOLIDAYS_COVERED_UNTIL` y desplegar. Si la
lista vence, el job de las 09:00 sigue entibiando pero registra un warning en
cada ejecución. Solo incluye feriados nacionales; feriados regionales y días de
elecciones no están (agregarlos si se convocan).

| Fecha | Día | Feriado |
|---|---|---|
| 2026-10-12 | lunes | Encuentro de Dos Mundos |
| 2026-10-31 | sábado | Iglesias Evangélicas y Protestantes |
| 2026-11-01 | domingo | Todos los Santos |
| 2026-12-08 | martes | Inmaculada Concepción |
| 2026-12-25 | viernes | Navidad |
| 2027-01-01 | viernes | Año Nuevo |
| 2027-03-26 | viernes | Viernes Santo |
| 2027-03-27 | sábado | Sábado Santo |
| 2027-05-01 | sábado | Día del Trabajo |
| 2027-05-21 | viernes | Glorias Navales |
| 2027-06-21 | lunes | Día Nacional de los Pueblos Indígenas (solsticio; confirmar fecha oficial) |
| 2027-06-28 | lunes | San Pedro y San Pablo (trasladado desde el martes 29) |
| 2027-07-16 | viernes | Virgen del Carmen |
| 2027-08-15 | domingo | Asunción de la Virgen |
| 2027-09-17 | viernes | Feriado adicional de Fiestas Patrias |
| 2027-09-18 | sábado | Independencia Nacional |
| 2027-09-19 | domingo | Glorias del Ejército |
| 2027-10-11 | lunes | Encuentro de Dos Mundos (trasladado desde el martes 12) |
| 2027-10-31 | domingo | Iglesias Evangélicas y Protestantes |
| 2027-11-01 | lunes | Todos los Santos |
| 2027-12-08 | miércoles | Inmaculada Concepción |
| 2027-12-25 | sábado | Navidad |

## 6. Deploy en horario hábil

`firebase deploy` escribe el mínimo a nivel de **revisión** (0). El mínimo a
nivel de **servicio** lo fijan los jobs. Después de cualquier deploy de
funciones entre 09:00 y 18:00, verificar con el comando de §4; si `svcMin`
quedó vacío en `coachturn` o `mentorchat`, restaurar con una línea:

```bash
pnpm --filter @salvador/functions warm:up
```

> Estado al 2026-10-03: desplegado y probado de punta a punta fuera de horario
> (job de subida → `svcMin` = 1 sin revisión nueva; job de bajada → vacío).
> Falta observar un deploy **con los servicios tibios** para saber si Cloud
> Functions conserva o borra la anotación de servicio; anotar aquí el
> resultado la primera vez que ocurra.

## 7. IAM

Los jobs corren con la cuenta de servicio de runtime por defecto
(`687619759108-compute@developer.gserviceaccount.com`), que ya tiene
`roles/editor` en el proyecto. Ese rol incluye `run.services.get`,
`run.services.update` e `iam.serviceAccounts.actAs`. **No se agregó ningún rol.**

Si algún día se le quita `roles/editor`, el mínimo necesario es:
`roles/run.developer` sobre los servicios `coachturn` y `mentorchat`, y
`roles/iam.serviceAccountUser` sobre la propia cuenta de runtime.

## 8. Costo estimado

Tarifas idle Tier 2 (`southamerica-west1`): USD 0,0000035 por vCPU-segundo y
por GiB-segundo.

| | Instancias idle | Horas/mes | USD/mes aprox. |
|---|---|---|---|
| Antes | 3 × `coachTurn` (1 vCPU, 512 MiB) + 1 × `mentorChat` (1 vCPU, 256 MiB), 24/7 | ~730 | **~53** |
| Después | 1 × `coachTurn` + 1 × `mentorChat`, lun–vie 09–18 | ~195 | **~7** |

Los 2 jobs nuevos de Cloud Scheduler cuestan USD 0,10 por mes cada uno (la
cuota gratuita de 3 jobs ya está usada).

## 9. Rollback

1. Enfriar y dejar de programar: borrar las dos funciones
   `firebase functions:delete warmInstancesUp warmInstancesDown --region southamerica-east1 --project summer-chatbot-dev`
   y correr `pnpm --filter @salvador/functions warm:down`.
2. Volver al comportamiento anterior (siempre tibio): poner
   `CHAT_TURN_MIN_INSTANCES=1` en `packages/functions/.env.summer-chatbot-dev`
   y redesplegar `coachTurn` y `mentorChat`. No requiere cambio de código.
3. Rollback completo: revertir el commit y redesplegar.
