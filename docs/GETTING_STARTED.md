# Guía de inicio rápido

> Instalación, configuración y puesta en marcha de **ERDL URL Shortener API**.

---

## Requisitos

| Requisito | Detalle |
|-----------|---------|
| **Node.js** | v18 o superior (ESM) |
| **npm** | Incluido con Node.js |
| **Base de datos** | SQLite local (desarrollo) o cuenta en [Turso](https://turso.tech) (producción) |
| **SMTP** | Credenciales para el envío de emails de verificación |

---

## Instalación

```bash
git clone https://github.com/Joel-RD/erdl-backend.git
cd erdl-backend
npm install
```

---

## Configuración

Copia el archivo de ejemplo y edítalo con tus valores:

```bash
cp .env.example .env
```

> **Nota:** consulta la sección [Variables de entorno](#variables-de-entorno) para el detalle de cada variable.

---

## Ejecución

### Desarrollo (hot-reload)

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`.

### Producción

```bash
npm run build
npm start
```

---

## Variables de entorno

Todas las variables se leen desde `.env` a través de `dotenv`. La configuración central vive en `src/config.ts`.

### Servidor y aplicación

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno: `development` o `production` | `development` |
| `FRONTEND_ORIGIN` | Origen permitido por CORS (y base de las URLs cortas) | `http://localhost:3000` |
| `DOMAIN_FOR_FRONTEND` | Alias de compatibilidad de `FRONTEND_ORIGIN` | — |
| `CORS_ORIGINS` | Lista de orígenes separados por comas | `FRONTEND_ORIGIN` |
| `SHORT_URL_BASE` | Base usada al construir la URL corta | `FRONTEND_ORIGIN` |
| `TRUST_PROXY` | Proxies de confianza (`1`, `true`, `loopback`…) para obtener la IP real | `false` |

### Base de datos (LibSQL)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `DB_TURSO_URL` | URL de la base de datos Turso (solo producción) | Ruta SQLite local |
| `DB_TURSO_AUTH_TOKEN` | Token de autenticación de Turso (solo producción) | — |
| `DB_FILE` | Ruta/URL de la base local en desarrollo | `src/Database/databases.db` |

> El esquema se aplica automáticamente al arrancar (`src/Database/migrate.ts` lee `schema.sql`), por lo que no hace falta ejecutar SQL a mano.

### Autenticación y cookies

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `JWT_SECRET` | Secreto para firmar JWT (obligatorio en producción) | Secreto aleatorio de desarrollo |
| `HTTP_ONLY` | Flag `HttpOnly` para cookies | `true` |
| `SECURE` | Flag `Secure` para cookies | `true` en producción |
| `SAME_SITE` | Política `SameSite` de cookies (`lax`, `strict`, `none`) | `lax` |
| `MAX_AGE` | Tiempo de vida de las cookies (milisegundos) | 7 días (`604800000`) |
| `COOKIE_PATH` | Ruta de las cookies | `/` |

> **Nota:** estas opciones de cookie aplican únicamente a la cookie temporal de verificación `emailSendToVerifyUser`. El JWT de sesión no se guarda en cookies: se devuelve en el body de `POST /api/v1/auth/verify-email` y se envía en el header `Authorization: Bearer <token>`.

### Email (Nodemailer / SMTP)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `EMAIL_HOST` | Host SMTP (ej: `smtp.gmail.com`) | — |
| `EMAIL_PORT` | Puerto SMTP | `587` |
| `EMAIL_SECURE` | Usar TLS implícito para SMTP | `false` |
| `EMAIL_USER` | Email/usuario SMTP | — |
| `EMAIL_PASS` | Contraseña SMTP | — |

---

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con hot-reload (Nodemon) |
| `npm run build` | Compilar TypeScript a JavaScript en `dist/` y copiar el esquema SQL |
| `npm start` | Ejecutar el build de producción |
| `npm run typecheck` | Comprobar tipos sin emitir archivos |
| `npm test` | Ejecutar la suite de tests con Jest |
| `npm run stress` | Tests de estrés en modo desarrollo |
| `npm run stress:full` | Tests de estrés en modo producción |

---

## Siguientes pasos

- [Documentación de la API](API.md) — endpoints, cuerpos y formatos de respuesta
- [Arquitectura del sistema](ARCHITECTURE.md) — patrones, base de datos y flujos internos
- [Seguridad](SECURITY.md) — mecanismos de protección implementados
- [Testing](TESTING.md) — suite de tests y tests de estrés