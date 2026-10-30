# Documentación de tablas PostgreSQL — Dashboard G. Elías y Muñoz

Documento de referencia de **todas las tablas** que usa el dashboard: para qué sirve cada una y **qué se guarda en cada columna**.

---

## Resumen

| Tabla | Para qué sirve | Quién escribe | Quién lee |
|-------|----------------|---------------|-----------|
| `eliasymunozabogados_leads` | Contactos / leads captados | n8n, bots, formularios | Dashboard (Leads) |
| `eliasymunozabogados_chat_histories` | Mensajes del chatbot web | Chatbot / n8n | Dashboard (Conversaciones) |
| `eliasmunozabogados_transcripciones` | Transcripciones de llamadas | Sistema de voz / n8n | Dashboard (Transcripciones) |
| `dashboard_settings` | Estado de los toggles ON/OFF del menú | Dashboard | Dashboard (todos los usuarios) |
| `dashboard_tickets` | Incidencias enviadas al CRM Buffalo | Dashboard | Dashboard (Tickets) |
| `dashboard_ticket_updates` | Historial de respuestas y cambios de Buffalo | Callback de Buffalo | Dashboard (seguimiento de tickets) |

**Importante:** las tres primeras tablas son de **negocio** (las rellenan sistemas externos). Las tres últimas las gestiona el **propio dashboard** (scripts en `sql/`).

---

## Mapa de relaciones

```text
eliasymunozabogados_leads.session_id
        │
        └──► eliasymunozabogados_chat_histories.session_id
             (misma conversación de web chat)

eliasymunozabogados_leads (phone / email / name + fecha)
        │
        └──► eliasmunozabogados_transcripciones
             (matching lógico, no FK en Postgres)

dashboard_tickets.id
        │
        └──► dashboard_ticket_updates.ticket_id
             (ON DELETE CASCADE)

dashboard_settings
        └──► una sola fila (id = 1), sin FK
```

---

## 1. `eliasymunozabogados_leads`

### Para qué sirve

Almacena cada **lead / contacto** que entra al sistema: formularios web, chat, llamadas, etc. Es la tabla central de la pantalla **Leads**.

El dashboard **solo lee** esta tabla. No crea ni edita leads desde la UI.

### Columnas

| Columna | Tipo (típico) | Qué se almacena | Para qué sirve |
|---------|---------------|-----------------|----------------|
| `id` | `SERIAL` / entero | Identificador único del lead | Clave primaria. URL de detalle: `/leads/{id}` |
| `created_at` | `TIMESTAMPTZ` | Fecha y hora de creación del registro | Ordenación por defecto, columna “Creado” en la tabla |
| `name` | `VARCHAR` / texto | Nombre de la persona | Mostrar en listado y ficha |
| `email` | `VARCHAR` / texto | Correo electrónico | Contacto, búsqueda, matching con transcripciones |
| `phone` | `VARCHAR` / texto o `NULL` | Teléfono | Contacto, búsqueda, matching con transcripciones |
| `session_id` | `VARCHAR` / texto o `NULL` | ID de la sesión del chatbot | Enlace con `eliasymunozabogados_chat_histories`. Si la fuente es web chat, permite abrir `/conversations/{session_id}` |
| `summary` | `TEXT` o `NULL` | Resumen breve del lead o de la conversación | Vista previa en la tabla de leads (tooltip en escritorio) |
| `source` | `VARCHAR` / texto o `NULL` | Origen del lead (ej. `formulario`, `web chat`) | Decide la navegación: formulario → Transcripciones; web chat → Conversaciones |
| `status` | texto o `NULL` | Estado del lead (ej. `pending_contact`, `contacted`) | Pill de estado en la UI (“Pendiente”, “Contactado”…) |
| `call_attempts` | entero o `NULL` | Número de intentos de llamada | Columna “Intentos” en Leads |
| `fecha` | fecha/hora o texto o `NULL` | Horario de reunión / cita acordada | Columna “Horario reunión”. También se usa para elegir la mejor transcripción o sesión cuando hay varios candidatos |
| `modalidad` | texto o `NULL` | Cómo será la reunión (`videoconferencia`, `presencial`…) | Pill “Modalidad” en Leads y en la ficha del lead |

### Notas de uso en el dashboard

- Búsqueda por `name`, `email` o `phone`.
- Ordenación por `created_at`, `name`, `email` o `source`.
- Si no hay `session_id` y la fuente no es formulario/chat reconocible, al hacer clic se abre la ficha `/leads/{id}`.

---

## 2. `eliasymunozabogados_chat_histories`

### Para qué sirve

Guarda el **historial de mensajes** del chatbot web, mensaje a mensaje. Cada fila es un mensaje de una conversación identificada por `session_id`.

Pantalla del dashboard: **Conversaciones**.

### Schema base

```sql
CREATE TABLE "public"."eliasymunozabogados_chat_histories" (
  "id" SERIAL,
  "session_id" VARCHAR(255) NOT NULL,
  "message" JSONB NOT NULL,
  CONSTRAINT "eliasymunozabogados_chat_histories_pkey" PRIMARY KEY ("id")
);
```

### Columnas

| Columna | Tipo | Qué se almacena | Para qué sirve |
|---------|------|-----------------|----------------|
| `id` | `SERIAL` | ID único del mensaje | Clave primaria. Orden cronológico aproximado (`ORDER BY id ASC`) |
| `session_id` | `VARCHAR(255)` | Identificador de la conversación | Agrupa todos los mensajes de un chat. Se une con `leads.session_id` |
| `message` | `JSONB` | Contenido del mensaje en JSON | Se renderiza como burbuja de chat (rol + texto) |

### Qué hay dentro de `message` (JSONB)

La estructura puede variar según el bot. El dashboard intenta leer:

| Campo habitual en el JSON | Uso |
|---------------------------|-----|
| `role` / `roleName` / `type` | Distinguir usuario (`user`/`human`) vs asistente (`ai`/`assistant`) |
| `text` / `content` / `message` / `body` | Texto visible en la burbuja |

Se ocultan mensajes internos (tools, “Calling … with input”, etc.). Si no hay texto útil, no se muestra burbuja.

### Relación con leads

```text
lead.session_id = chat_histories.session_id
```

Sin `session_id` en el lead, ese contacto **no se puede abrir** como conversación desde Leads (sí se ve el lead en la lista).

---

## 3. `eliasmunozabogados_transcripciones`

### Para qué sirve

Almacena **transcripciones de llamadas** (voz): el texto de lo hablado y datos de la persona.

Pantalla del dashboard: **Transcripciones**.

También se usa al hacer clic en un lead con fuente `formulario`: se busca la transcripción por teléfono, email o nombre (y `fecha` si hay varias).

### Columnas (según uso en el código)

| Columna | Tipo (típico) | Qué se almacena | Para qué sirve |
|---------|---------------|-----------------|----------------|
| `id` | entero | ID único | Clave primaria. URL: `/transcriptions/{id}` |
| `transcription` | texto o `NULL` | Texto completo de la llamada | Contenido principal de la vista de detalle |
| `phone` | texto o `NULL` | Teléfono asociado a la llamada | Matching con `leads.phone` |
| `name` | texto o `NULL` | Nombre de la persona | Listado y matching con `leads.name` |
| `mail` | texto o `NULL` | Email asociado | Matching con `leads.email` (nota: se llama `mail`, no `email`) |
| `fecha` | fecha/hora o `NULL` | Cuándo fue la llamada / cita | Ordenación y matching por fecha con `leads.fecha` |

### Relación con leads

No hay foreign key en Postgres. El matching es **lógico** en código:

1. Por teléfono (`phone`)
2. Si no, por email (`mail` ↔ `email`)
3. Si no, por nombre
4. Si hay varios, se elige el más cercano a `leads.fecha`

---

## 4. `dashboard_settings`

### Para qué sirve

Guarda el **estado global de los dos interruptores** del menú lateral, compartido entre todos los usuarios y ordenadores:

1. Sistema total activo / desactivado (`system_published`)
2. Solo fuera de horario laboral / siempre activo (`offwork_only`)

Hay **una sola fila** (`id = 1`). No es una tabla de historial.

Script: `sql/dashboard_settings.sql`.

### Columnas

| Columna | Tipo | Qué se almacena | Para qué sirve |
|---------|------|-----------------|----------------|
| `id` | `INTEGER` PK, siempre `1` | Identificador fijo | Garantiza una única fila de configuración (`CHECK (id = 1)`) |
| `offwork_only` | `BOOLEAN` (default `false`) | `true` = solo fuera laboral; `false` = siempre activo | Estado del toggle inferior. Al cambiar se llama al webhook de n8n off-work |
| `system_published` | `BOOLEAN` (default `true`) | `true` = sistema publicado/activo; `false` = desactivado | Estado del toggle superior. Al cambiar se envía `publish` / `unpublish` a n8n |
| `updated_at` | `TIMESTAMPTZ` | Última vez que se modificó | Saber cuándo cambió; el frontend hace polling cada ~5 s para sincronizar pantallas |

### Flujo

1. Usuario pulsa un toggle → API del dashboard → webhook n8n.
2. Si el webhook responde OK → se actualiza esta tabla.
3. Otros usuarios/dispositivos leen `GET /api/settings` y ven el mismo estado.

---

## 5. `dashboard_tickets`

### Para qué sirve

Almacena las **incidencias / tickets** creados desde el dashboard y sincronizados con el CRM Buffalo.

Cada fila es un ticket. Al crearlo:

1. Se inserta aquí con un `external_id` propio.
2. Se envía al webhook de Buffalo.
3. Si Buffalo responde, se guarda su `ticket_id` en `buffalo_ticket_id`.

Script: `sql/dashboard_tickets.sql`.

### Columnas

| Columna | Tipo | Qué se almacena | Para qué sirve |
|---------|------|-----------------|----------------|
| `id` | `SERIAL` | ID interno en Postgres | PK local. Usado en API `/api/tickets/{id}` y en el menú Ver/Eliminar |
| `external_id` | `TEXT` UNIQUE NOT NULL | ID generado por el dashboard (ej. `inc-2026-ABC123`) | Identificador estable para crear/borrar/sincronizar con Buffalo |
| `buffalo_ticket_id` | `TEXT` UNIQUE o `NULL` | UUID que devuelve Buffalo al crear | Operaciones directas con Buffalo (delete, matching en callbacks) |
| `project_ref` | `TEXT` NOT NULL | Código del proyecto en Buffalo (ej. `BUF-2026-M7-CON-001`) | Indica a qué cliente/proyecto pertenece el ticket |
| `title` | `TEXT` o `NULL` | Título de la incidencia | Listado y detalle |
| `description` | `TEXT` o `NULL` | Descripción del problema | Detalle y timeline (“Incidencia creada”) |
| `priority` | `TEXT` (default `medium`) | `low`, `medium`, `high`, `critical` | Prioridad mostrada en UI y enviada a Buffalo |
| `status` | `TEXT` (default `open`) | `open`, `in_progress`, `resolved`, `closed` | Estado del ticket; se actualiza con callbacks de Buffalo |
| `reporter_name` | `TEXT` o `NULL` | Nombre de quien reporta | Opcional; contexto en Buffalo y en el detalle |
| `reporter_email` | `TEXT` o `NULL` | Email de quien reporta | Opcional; contacto |
| `fields` | `JSONB` o `NULL` | Datos extra libres (ej. `{ "modulo": "Leads" }`) | Contexto adicional (módulo, URL, etc.) |
| `created_at` | `TIMESTAMPTZ` | Cuándo se creó en el dashboard | Ordenación y columna “Creado” |
| `updated_at` | `TIMESTAMPTZ` | Última modificación local | Se actualiza al cambiar estado o al recibir `buffalo_ticket_id` |

### Valores de `priority`

| Valor en BD | En la UI |
|-------------|----------|
| `low` | Baja |
| `medium` | Media |
| `high` | Alta |
| `critical` | Crítica |

### Valores de `status`

| Valor en BD | En la UI |
|-------------|----------|
| `open` | Pendiente |
| `in_progress` | En revisión |
| `resolved` | Resuelto |
| `closed` | Cerrado |

---

## 6. `dashboard_ticket_updates`

### Para qué sirve

Es el **historial / timeline** de cada ticket: comentarios y cambios de estado que Buffalo envía por callback (`ticket.updated`).

Relación: muchos updates → un ticket (`ticket_id` → `dashboard_tickets.id`). Si se borra el ticket, sus updates se borran en cascada (`ON DELETE CASCADE`).

### Columnas

| Columna | Tipo | Qué se almacena | Para qué sirve |
|---------|------|-----------------|----------------|
| `id` | `SERIAL` | ID del evento | Clave primaria |
| `ticket_id` | `INTEGER` NOT NULL (FK) | ID local del ticket | Une el update con `dashboard_tickets` |
| `buffalo_ticket_id` | `TEXT` o `NULL` | UUID del ticket en Buffalo | Trazabilidad / matching |
| `event` | `TEXT` o `NULL` | Tipo de evento (ej. `ticket.updated`, `comment`, `status_change`) | Etiquetar la entrada en el timeline |
| `status` | `TEXT` o `NULL` | Estado en ese momento | Mostrar pill de estado en el seguimiento |
| `message` | `TEXT` o `NULL` | Texto de la respuesta de soporte | Lo que ve el usuario como “Respuesta de soporte” / comentario |
| `updated_by` | `TEXT` o `NULL` | Quién actualizó (email o nombre en Buffalo) | Autor en el timeline |
| `buffalo_updated_at` | `TIMESTAMPTZ` o `NULL` | Timestamp que manda Buffalo | Ordenar cronológicamente el historial |
| `idempotency_key` | `TEXT` UNIQUE NOT NULL | Hash único del evento | Evitar duplicar el mismo callback si Buffalo lo reenvía |
| `created_at` | `TIMESTAMPTZ` | Cuándo se guardó en el dashboard | Auditoría local |

### Callback `ticket.deleted`

Cuando Buffalo borra un ticket y notifica `ticket.deleted`, el dashboard **elimina la fila** en `dashboard_tickets` (y por cascada sus updates). **No** vuelve a llamar al webhook de Buffalo (evita bucles).

---

## Qué pantalla usa cada tabla

| Pantalla / función | Tablas |
|--------------------|--------|
| Leads (listado y ficha) | `eliasymunozabogados_leads` |
| Conversaciones | `eliasymunozabogados_chat_histories` (+ lead por `session_id`) |
| Transcripciones | `eliasmunozabogados_transcripciones` |
| Toggles del sidebar | `dashboard_settings` |
| Tickets (lista, crear, ver, eliminar) | `dashboard_tickets` |
| Seguimiento / respuestas de soporte | `dashboard_ticket_updates` |

---

## Scripts SQL del propio dashboard

| Archivo | Tablas que crea |
|---------|-----------------|
| `sql/dashboard_settings.sql` | `dashboard_settings` |
| `sql/dashboard_tickets.sql` | `dashboard_tickets`, `dashboard_ticket_updates` |

Las tablas `eliasymunozabogados_*` y `eliasmunozabogados_*` ya existían en Postgres (rellenadas por n8n / bots); el dashboard asume que están creadas.

---

## Notas prácticas

1. **`session_id` vacío en un lead** → el lead no se pierde; se ve en Leads, pero no se puede abrir como chat.
2. **`mail` vs `email`** → en transcripciones la columna se llama `mail`; en leads se llama `email`.
3. **Tickets** → siempre hay dos IDs importantes: `external_id` (vuestro) y `buffalo_ticket_id` (Buffalo).
4. **Settings** → solo una fila; si no existe la tabla, los toggles no se sincronizan entre usuarios.
5. El dashboard **no escribe** en leads, chats ni transcripciones: solo consulta.
