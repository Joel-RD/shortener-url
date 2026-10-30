# Seguridad

> Mecanismos de protección implementados en **ERDL URL Shortener API**.

---

## Resumen

| Mecanismo | Detalle |
|-----------|---------|
| **Helmet** | Cabeceras HTTP seguras (CSP y cross-origin en producción) |
| **CORS** | Solo permite los orígenes configurados en `CORS_ORIGINS` / `FRONTEND_ORIGIN` |
| **Rate limiting** | Por IP: 5.000/h shorten, 50.000/h redirect, 20/15 min auth (producción) |
| **Bloqueo de intentos** | 5 intentos máximos → bloqueo de 2 h (email/contraseña) o 1 h (código) |
| **Cookie HttpOnly (verificación)** | El código de verificación usa la cookie temporal `emailSendToVerifyUser` (HttpOnly, SameSite, Secure en producción); el JWT de sesión viaja en el header `Authorization: Bearer` |
| **Contraseñas** | Bcryptjs con 10 rounds; mínimo 12 caracteres con requisitos de complejidad |
| **Validación de URLs** | Anti-SSRF: solo http/https, sin IPs privadas/localhost, sin credenciales, TLD válido |
| **JWT de dos tipos** | Temporal (2 min, para verificación en cookie) y de sesión (2 días, para autenticación en header) |
| **Entorno** | `JWT_SECRET` obligatorio en producción; en desarrollo se genera uno aleatorio |

---

## Middlewares de seguridad

Configurados en `src/main.ts`:

| Middleware | Función |
|-----------|---------|
| **Helmet** | Cabeceras HTTP seguras (CSP y cross-origin solo en producción) |
| **CORS** | Origen restringido a `CORS_ORIGINS` / `FRONTEND_ORIGIN` con `credentials: true` |
| **Cookie Parser** | Parseo de cookies para la verificación temporal de email |
| **express.json** | Parseo de cuerpos JSON |
| **express.urlencoded** | Parseo de cuerpos URL-encoded |
| **Morgan** | Logging HTTP en desarrollo (se omite con `SKIP_LOGS=true`) |
| **notFoundHandler** | Captura rutas inexistentes (404) |
| **errorHandler** | Manejo centralizado de errores (`AppError` → respuesta consistente) |

Middlewares específicos de rutas:

- **`limitAuthButton`** — rate limiting en endpoints de auth
- **`shortenRateLimit`** — rate limiting en `POST /api/v1/short`
- **`redirectRateLimit`** — rate limiting en `GET /:shortUrl`
- **`authJWT`** — validación del `Authorization: Bearer <token>` en rutas protegidas
- **`requireActiveUser`** — comprueba en BD que el usuario siga verificado y activo
- **`verifySendToEmail`** — validación de la cookie temporal de verificación

---

## Rate limiting

Configurado en `src/utils/limitClick.ts` usando `express-rate-limit`:

| Endpoint | Ventana | Límite (producción) | Límite (desarrollo) | Alias en código |
|----------|---------|---------------------|---------------------|-----------------|
| `POST /api/v1/short` | 1 hora | 5.000 | 1.000.000 | `shortenRateLimit` |
| `GET /:shortUrl` | 1 hora | 50.000 | 1.000.000 | `redirectRateLimit` |
| Auth (register, login, verify-email) | 15 minutos | 20 | 2.000 | `limitAuthButton` |

- En modo stress test (`STRESS_TEST=true`), los rate limits se deshabilitan.
- Se usa `ipKeyGenerator` de `express-rate-limit` como generador de claves.
- Configura `TRUST_PROXY` cuando la API esté detrás de un proxy o balanceador; sin ello `req.ip` sería la IP del proxy y el límite se compartiría entre todos los clientes.
- El store por defecto es en memoria; para despliegues con varias instancias usa un store externo (Redis).

---

## Límite de intentos (`attemptLimiter`)

Configurado en `src/utils/attemptLimiter.ts`:

| Scope | Tabla | Columna de intentos | Columna de bloqueo | Intentos máximos | Bloqueo |
|-------|-------|---------------------|--------------------|-----------------|---------|
| `email` | `users` | `email_attempt_count` | `email_blocked_until` | 5 | 2 horas |
| `password` | `users` | `password_attempt_count` | `password_blocked_until` | 5 | 2 horas |
| `code` | `verification_codes` | `attempt_count` | `blocked_until` | 5 | 1 hora |

**Comportamiento:** al alcanzar 5 intentos, se resetea el contador y se establece la fecha de bloqueo. Las operaciones `checkBlocked`, `registerAttempt` y `resetAttempts` están implementadas en `AuthRepository`.

---

## Cookies y transporte del JWT de sesión

Solo el **código temporal de verificación** se almacena en una cookie:

| Cookie | Contenido | Duración | HttpOnly | Secure | SameSite |
|--------|-----------|----------|----------|--------|----------|
| `emailSendToVerifyUser` | JSON `{ token: <JWT temporal> }` | 2 minutos | Sí | Sí (prod) | `lax` |

El **JWT de sesión** no se guarda en cookies: se devuelve en el campo `data.authToken` de la respuesta de `POST /api/v1/auth/verify-email` y el cliente debe enviarlo en el header `Authorization: Bearer <token>` en las rutas protegidas.

Configuración base en `src/config.ts` → `configCookiesParams` (aplica a la cookie temporal):

- `httpOnly`: `true` (a menos que `HTTP_ONLY=false`)
- `secure`: valor de `SECURE`; por defecto `true` en producción
- `sameSite`: `lax` por defecto (valores admitidos: `lax`, `strict`, `none`)
- `path`: `/`

---

## JWT

Dos tipos de token, ambos firmados con `JWT_SECRET` y con `iss`/`aud` fijos:

| Token | Función | Expiración | Payload |
|-------|---------|------------|---------|
| `emailValidJWToken` | Temporal para verificación de email (se envía dentro de la cookie `emailSendToVerifyUser`) | 2 minutos | `{ userEmail, typ: "email_verification" }` |
| `userAuthJWToken` | Sesión de autenticación (viaja en el header `Authorization: Bearer`) | 2 días | `{ userEmail, typ: "session" }` |

`authJWT` rechaza cualquier token cuyo `typ` no sea `session`, y `verifySendToEmail` exige `typ: "email_verification"`. Así un token temporal de verificación no puede usarse para acceder a rutas protegidas.

---

## Política de contraseñas (`validatePassword`)

- Mínimo 12 caracteres
- Al menos: 1 minúscula, 1 mayúscula, 1 número, 1 carácter especial
- Sin espacios
- Sin secuencias numéricas/alfabéticas (123, abc, etc.)
- Fortaleza clasificada: débil (≤3), media (≤5), fuerte (≤10), muy fuerte (>10)

El hash se realiza con **bcryptjs** (10 rounds).

---

## Validación de URLs (anti-SSRF)

Función `validateDomain` en `src/utils/validateUserData.ts`:

1. **Formato** — debe ser string no vacío, ≤2048 caracteres
2. **Caracteres** — sin espacios, sin caracteres de control, sin barras invertidas
3. **Parsing** — debe ser una URL válida (constructor `URL`)
4. **Protocolo** — solo `http:` o `https:`
5. **Hostname** — obligatorio
6. **Credenciales** — no se permiten (`user:password@`)
7. **Longitud del hostname** — ≤253 caracteres
8. **IPs privadas** — detecta IPv4 (10.x, 172.16-31.x, 192.168.x, loopback, CGNAT, multicast) e IPv6 (loopback, ULA, link-local, IPv4-mapped)
9. **Hosts locales** — rechaza `localhost`, `*.localhost`, `*.local`, `*.internal`
10. **IPs literales** — solo se permiten IPs públicas; las privadas, reservadas y multicast se rechazan
11. **Formato del dominio** — solo alfanumérico, guiones, puntos; sin `..`
12. **Labels del dominio** — ≤63 caracteres, sin guiones al inicio/final
13. **TLD** — ≥2 letras

---

## Siguientes pasos

- [Guía de inicio rápido](GETTING_STARTED.md) — instalación y variables de entorno
- [Referencia de la API](API.md) — endpoints, cuerpos y formatos de respuesta
- [Arquitectura del sistema](ARCHITECTURE.md) — patrones, base de datos y flujos internos
- [Testing](TESTING.md) — suite de tests y tests de estrés