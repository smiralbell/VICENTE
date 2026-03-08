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

## Despliegue en EasyPanel

1. Subir el proyecto a GitHub.

2. En EasyPanel, crear una nueva aplicación:
   - Tipo: **Node.js** / **Next.js**
   - Repositorio: tu repo de GitHub
   - Build command: `npm run build`
   - Start command: `npm start`
   - Puerto: `3000`

3. Añadir variables de entorno en EasyPanel (no usar `NEXT_PUBLIC_` para secretos):
   - `DATABASE_URL`
   - `DASHBOARD_PASSWORD`
   - `SESSION_SECRET`
   - `NODE_ENV=production`

4. Desplegar. La conexión a PostgreSQL debe ser accesible desde el servidor (EasyPanel suele permitir variables de entorno y redes internas).

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
