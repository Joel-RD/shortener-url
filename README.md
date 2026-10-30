# ERDL URL Shortener

![Versión](https://img.shields.io/badge/version-1.0.0-2e5aa8)
![Licencia](https://img.shields.io/badge/licencia-ISC-4f5d75)
![Node.js](https://img.shields.io/badge/Node.js-v18%2B-2e5aa8?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-eb6c36?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript&logoColor=white)
![LibSQL](https://img.shields.io/badge/Database-LibSQL-4f5d75?logo=sqlite&logoColor=white)
![Jest](https://img.shields.io/badge/Testing-Jest-3b6b35?logo=jest&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-eb6c36?logo=jsonwebtokens&logoColor=white)

**API de acortamiento de URLs** con sistema de autenticación completo: registro, verificación de email por código y rutas protegidas mediante JWT en el header `Authorization: Bearer`. Construida con **Node.js**, **Express 5**, **TypeScript** y **LibSQL**.

---

## Arquitectura

<img src="docs/diagrams/architecture.svg" width="100%" alt="Arquitectura del backend ERDL: capas Router → Controller → Service → Repository → LibSQL">

- **Cliente** → **API Express** atravesando middlewares de seguridad (Helmet, CORS, rate limiting)
- **Routers** → **Controllers** → **Services** → **Repository** → **LibSQL**
- **Nodemailer** envía los códigos de verificación por SMTP
- Detalle completo en [Arquitectura del sistema](docs/ARCHITECTURE.md) · [versión interactiva](docs/diagrams/architecture.html)

---

## Características

| Área | Detalles |
|------|----------|
| **Acortamiento de URLs** | Identificadores únicos de 8 caracteres con `nanoid` |
| **Autenticación de 3 pasos** | Registro o login → código de verificación por email → token JWT de sesión en `Authorization: Bearer` |
| **Persistencia de datos** | LibSQL (SQLite local en desarrollo, Turso en producción) |
| **Protección anti-SSRF** | Validación exhaustiva de URLs (sin IPs privadas, sin localhost, sin credenciales) |
| **Límite de intentos** | Bloqueo automático tras 5 intentos fallidos (email, contraseña o código) |
| **Rate limiting** | Protección por IP en cada endpoint |
| **Seguridad** | Helmet, CORS configurable, cookie HttpOnly solo para el código temporal de email, bcryptjs (10 rounds) |
| **Logging** | Winston estructurado con archivos rotativos (5 MB) y Morgan en desarrollo |
| **Manejo de errores** | Formato de respuesta unificado `{ success, message, data }` / `{ success, error: { code, message, details } }` vía `AppError` y `responseFormat` |

---

## Documentación

| Guía | Contenido |
|------|-----------|
| [Guía de inicio rápido](docs/GETTING_STARTED.md) | Requisitos, instalación, variables de entorno y scripts |
| [Referencia de la API](docs/API.md) | Endpoints, cuerpos de solicitud, respuestas y códigos de estado |
| [Arquitectura del sistema](docs/ARCHITECTURE.md) | Patrones, base de datos, flujos internos e inicialización |
| [Seguridad](docs/SECURITY.md) | JWT, cookies, rate limiting, límite de intentos y anti-SSRF |
| [Testing](docs/TESTING.md) | Suite de tests unitarios y tests de estrés |

---

## Primeros pasos

```bash
git clone https://github.com/Joel-RD/erdl-backend.git
cd erdl-backend
npm install
cp .env.example .env
npm run dev
```

El servidor arranca en `http://localhost:3000`.

> **Nota:** edita `.env` con tus credenciales SMTP y de Turso. Consulta la [guía de inicio rápido](docs/GETTING_STARTED.md) para el detalle de cada variable.

---

## Estructura del proyecto

```
erdl-backend/
├── src/
│   ├── main.ts                      # Inicialización de Express, middlewares y rutas
│   ├── run.ts                       # Punto de entrada del servidor
│   ├── config.ts                    # Configuración centralizada desde variables de entorno
│   ├── Database/
│   │   ├── databases.ts             # Cliente LibSQL (SQLite local / Turso)
│   │   ├── migrate.ts               # Aplica schema.sql de forma idempotente
│   │   ├── databases.db             # Base de datos local (desarrollo)
│   │   └── schema.sql               # Esquema de la base de datos
│   ├── models/
│   │   └── types.ts                 # Interfaces y tipos TypeScript
│   ├── routers/
│   │   ├── urlRouter.ts             # Rutas de acortamiento y redirección
│   │   ├── userAuthRouter.ts        # Rutas de registro, login y verificación
│   │   └── protectedRoutes.ts       # Rutas protegidas por JWT
│   ├── controllers/
│   │   ├── urlController.ts         # Controlador de URLs
│   │   └── authController.ts        # Controlador de autenticación
│   ├── services/
│   │   ├── urlService.ts            # Lógica de negocio de URLs
│   │   ├── authService.ts           # Lógica de negocio de autenticación
│   │   └── sendEmails.ts            # Servicio de envío de emails (Nodemailer)
│   ├── repository/
│   │   ├── urlRepository.ts         # Acceso a datos de URLs
│   │   └── authRepository.ts        # Acceso a datos de usuarios y verificación
│   ├── middleware/
│   │   ├── authJWT.ts               # Middleware JWT (authJWT, verifySendToEmail)
│   │   └── errorHandler.ts          # Manejador de errores centralizado
│   └── utils/
│       ├── AppError.ts              # Clase de error personalizada
│       ├── attemptLimiter.ts        # Configuración de límite de intentos
│       ├── codeValidatedEmail.ts    # Generación de código de verificación
│       ├── configEmailTransport.ts  # Transporte Nodemailer
│       ├── jwt.ts                   # Generación de tokens JWT
│       ├── limitClick.ts            # Rate limiting por IP
│       ├── logger.ts                # Winston logger
│       ├── nanoidTool.ts            # Generación de IDs cortos
│       ├── password_encrypt.ts      # Hash y comparación con bcryptjs
│       └── validateUserData.ts      # Validación de email, contraseña, registro y dominios
├── test/
│   ├── setup.ts                     # Configuración global de tests
│   ├── src/                         # Tests unitarios (controllers, services, repository, utils)
│   └── stress/
│       └── stress-tester.ts         # Tests de estrés con autocannon
├── docs/
│   ├── GETTING_STARTED.md           # Guía de instalación y configuración
│   ├── API.md                       # Referencia de la API
│   ├── ARCHITECTURE.md              # Documentación de arquitectura
│   ├── SECURITY.md                  # Mecanismos de seguridad
│   ├── TESTING.md                   # Suite de tests
│   └── diagrams/                    # Diagramas SVG y HTML (arquitectura, ER, flujos)
├── jest.config.js                   # Configuración de Jest
├── tsconfig.json                    # Configuración de TypeScript
├── nodemon.json                     # Configuración de Nodemon
├── package.json
├── .env.example
└── .gitignore
```

---

## Referencia rápida de la API

Base URL: `http://localhost:3000/api/v1`

| Método | Ruta | Descripción | Protegido |
|--------|------|-------------|-----------|
| `POST` | `/api/v1/short` | Acortar una URL | No |
| `GET` | `/:shortUrl` | Redirigir a la URL original (302) | No |
| `POST` | `/api/v1/auth/register` | Registrar usuario | No |
| `POST` | `/api/v1/auth/login` | Iniciar sesión | No |
| `POST` | `/api/v1/auth/verify-email` | Verificar código de email | Temporal |
| `GET` | `/api/v1/auth/user/profile` | Consultar perfil del usuario | JWT |

> **Detalle completo** — cuerpos de solicitud, respuestas y códigos de estado: [Referencia de la API](docs/API.md).

---

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo con hot-reload (Nodemon) |
| `npm run build` | Compilar TypeScript a JavaScript en `dist/` |
| `npm start` | Ejecutar el build de producción |
| `npm test` | Ejecutar la suite de tests con Jest |
| `npm run stress` | Tests de estrés en modo desarrollo |
| `npm run stress:full` | Tests de estrés en modo producción |

---

## Diagramas

Diagramas técnicos en SVG autocontenido, incrustados a lo largo de la documentación. Las versiones interactivas (HTML) abren en el navegador:

| Diagrama | Descripción | Interactivo |
|----------|-------------|-------------|
| Arquitectura del sistema | Capas Router → Controller → Service → Repository → LibSQL | [Ver](docs/diagrams/architecture.html) |
| Flujo de autenticación | Registro/login, verificación por código de email y JWT de sesión (Bearer) | [Ver](docs/diagrams/auth-flow.html) |
| Modelo de datos (ER) | Entidades `users`, `urls` y `verification_codes` | [Ver](docs/diagrams/er-model.html) |
| Acortar y redirigir URL | Validación anti-SSRF, `nanoid` y redirección 302 | [Ver](docs/diagrams/url-flow.html) |

<img src="docs/diagrams/er-model.svg" width="100%" alt="Modelo de datos: users, urls y verification_codes">

---

## Licencia

Este proyecto está bajo la [licencia ISC](https://opensource.org/license/isc).