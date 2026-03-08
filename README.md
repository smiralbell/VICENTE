# Dashboard — EliasyMuñoz Abogados

Panel privado para ver leads y conversaciones. Next.js + TypeScript + Tailwind CSS + PostgreSQL.

## Requisitos

- Node.js 18+
- PostgreSQL con las tablas `eliasymunozabogados_leads` y `eliasymunozabogados_chat_histories`

## Instalación local

1. Clonar el repositorio e instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
cp .env.example .env
```

3. Editar `.env` y rellenar:

- `DATABASE_URL`: URL de conexión a PostgreSQL (ej. `postgresql://user:pass@host:5432/dbname`)
- `DASHBOARD_PASSWORD`: Contraseña única para acceder al dashboard
- `SESSION_SECRET`: Cadena aleatoria larga para firmar la cookie de sesión (ej. `openssl rand -hex 32`)
- `NODE_ENV`: `development` o `production`

4. Arrancar en desarrollo:

```bash
npm run dev
```

5. Abrir [http://localhost:3000](http://localhost:3000). Serás redirigido al login; introduce `DASHBOARD_PASSWORD`.

## Scripts

- `npm run dev` — Desarrollo con hot reload
- `npm run build` — Build de producción
- `npm run start` — Servidor de producción (tras `npm run build`)
- `npm run lint` — Linter

## Despliegue en Easypanel (Dockerfile)

1. Subir el proyecto a GitHub.

2. En Easypanel, crear un nuevo servicio desde GitHub:
   - Método de compilación: **Dockerfile**
   - Repositorio: tu repo (ej. `smiralbell/VICENTE`)
   - Puerto: `3000`

3. **Importante:** Configurar las variables de entorno **del contenedor en ejecución** (no solo “Build args”). En el servicio, en la sección **Variables de entorno** / **Environment**, añadir:
   - `DATABASE_URL` — URL de PostgreSQL
   - `DASHBOARD_PASSWORD` — Contraseña del panel
   - `SESSION_SECRET` — Cadena aleatoria (ej. `openssl rand -hex 32`)
   - `WEBHOOK_OFFWORK_URL` — URL del webhook n8n (opcional)
   - `NODE_ENV=production`

   Si solo se configuran como *build args*, el login fallará porque en runtime no existirán y la cookie de sesión no se creará.

4. Desplegar. La base de datos debe ser accesible desde el servidor donde corre Easypanel.

## Estructura

- `app/(dashboard)/` — Rutas protegidas: inicio, leads, conversaciones
- `app/login/` — Pantalla de login
- `app/api/login` y `app/api/logout` — Autenticación
- `lib/db.ts` — Conexión y consultas a PostgreSQL
- `lib/auth.ts` — Sesión por cookie
- `middleware.ts` — Protección de rutas y redirección al login

## Seguridad

- Credenciales solo en variables de entorno.
- Conexión a la base de datos solo en servidor.
- Consultas parametrizadas con `pg`.
- Login por contraseña única y cookie de sesión segura (httpOnly, sameSite, secure en producción).
- Cabeceras de seguridad básicas (X-Content-Type-Options, X-Frame-Options, etc.).
