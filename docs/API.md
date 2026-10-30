# Referencia de la API

> Base URL: `http://localhost:3000/api/v1`

---

## Resumen de endpoints

### Acortamiento de URLs

| Método | Ruta | Descripción | Rate limit |
|--------|------|-------------|------------|
| `POST` | `/api/v1/short` | Acortar una URL | 5.000/h (prod) |
| `GET` | `/:shortUrl` | Redirigir a la URL original (302) | 50.000/h (prod) |

### Autenticación

| Método | Ruta | Descripción | Protegido | Rate limit |
|--------|------|-------------|-----------|------------|
| `POST` | `/api/v1/auth/register` | Registrar usuario | No | 20/15 min (prod) |
| `POST` | `/api/v1/auth/login` | Iniciar sesión | No | 20/15 min (prod) |
| `POST` | `/api/v1/auth/verify-email` | Verificar código de email | Temporal | 20/15 min (prod) |
| `GET` | `/api/v1/auth/user/profile` | Consultar perfil del usuario | JWT | — |

---

## Acortamiento de URLs

<img src="diagrams/url-flow.svg" width="100%" alt="Flujo de acortado y redirección de URLs: validación anti-SSRF, nanoid, INSERT en LibSQL y redirección 302">

### `POST /api/v1/short` — Acortar una URL

Valida la URL de destino (anti-SSRF), genera un identificador único de 8 caracteres con `nanoid` y lo persiste en LibSQL.

**Cuerpo de la solicitud:**

```json
{ "orig_url": "https://ejemplo.com/un/recurso/muy/largo" }
```

**Respuesta `200 OK`:**

```json
{
  "success": true,
  "message": "URL acortada con éxito.",
  "data": {
    "url_acortada": "http://localhost:3000/abc12345"
  }
}
```

### `GET /:shortUrl` — Redirigir a la URL original

Busca la URL acortada y redirige con un `302 Found`. Si no existe o está inactiva, responde `404`.

| Resultado | Respuesta |
|-----------|-----------|
| URL encontrada | `302` con cabecera `Location: <original_url>` |
| Formato de código inválido | `400` (`INVALID_SHORT_URL`) |
| URL no encontrada | `404` (`SHORT_URL_NOT_FOUND`) |
| Destino ya no permitido | `410` (`DESTINATION_URL_NOT_ALLOWED`) |

---

## Autenticación

El sistema usa un proceso de **3 pasos** con verificación de email por código:

<img src="diagrams/auth-flow.svg" width="100%" alt="Secuencia de autenticación: registro/login, código por email y JWT de sesión">

1. **Registro o Login** → se envía un código de 6 caracteres (A-Z0-9) por email y se establece la cookie temporal `emailSendToVerifyUser` (JWT, 2 minutos).
2. **Verificación del código** → el cliente envía el código (se normaliza a mayúsculas) y, si es correcto, recibe el JWT de sesión `authToken` en el body de la respuesta (2 días de duración).
3. **Rutas protegidas** → el middleware `authJWT` valida el `authToken` en el header `Authorization: Bearer <token>` de cada petición.

> **Notas:**
> - Los emails se normalizan (`trim` + minúsculas) antes de almacenarse y compararse.
> - Un login con email inexistente o contraseña incorrecta devuelve el mismo `401 Credenciales no válidas` para no revelar qué cuentas existen.
> - Si el usuario intenta login mientras tiene un código de verificación activo, recibe un error `429` con el tiempo restante en minutos.

### `POST /api/v1/auth/register` — Registrar usuario

**Cuerpo de la solicitud:**

```json
{
  "username": "mi_usuario",
  "email": "correo@ejemplo.com",
  "password": "MiContraseña123!"
}
```

**Respuesta `201 Created`:**

```json
{
  "success": true,
  "message": "Usuario creado correctamente, código enviado al email"
}
```

> Se establece la cookie `emailSendToVerifyUser` (2 minutos de duración, contiene un JWT temporal).

### `POST /api/v1/auth/login` — Iniciar sesión

**Cuerpo de la solicitud:**

```json
{
  "email": "correo@ejemplo.com",
  "password": "MiContraseña123!"
}
```

**Respuesta `200 OK`:**

```json
{
  "success": true,
  "message": "Inicio de sesión correcto, código enviado al email",
  "data": {
    "user": {
      "id": 1,
      "username": "mi_usuario",
      "email": "correo@ejemplo.com"
    }
  }
}
```

> Se establece la cookie `emailSendToVerifyUser` (2 minutos de duración).

### `POST /api/v1/auth/verify-email` — Verificar código de email

Requiere la cookie `emailSendToVerifyUser` previamente establecida (por registro o login).

**Cuerpo de la solicitud:**

```json
{
  "email": "correo@ejemplo.com",
  "code": "AB3XY9"
}
```

**Respuesta `200 OK`:**

```json
{
  "success": true,
  "message": "Inicio de sesión correcto.",
  "data": {
    "authToken": "<jwt>"
  }
}
```

> El token de sesión se devuelve en el campo `data.authToken` y debe enviarse en el header `Authorization: Bearer <token>` en las rutas protegidas.

### `GET /api/v1/auth/user/profile` — Consultar perfil

Requiere el header `Authorization: Bearer <authToken>`.

**Respuesta `200 OK`:**

```json
{
  "success": true,
  "message": "Perfil consultado correctamente",
  "data": {
    "user": {
      "email": "correo@ejemplo.com"
    }
  }
}
```

---

## Formato de respuestas

Todas las respuestas de la API usan un envoltorio unificado construido por `src/utils/responseFormat.ts` (helpers `sendOk` y `buildErrorBody`). El campo `message` se mantiene en la raíz por compatibilidad con clientes existentes.

**Éxito:**

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { }
}
```

> `data` solo se incluye cuando el endpoint devuelve un payload (p. ej. `user`, `url_acortada`).

**Error de aplicación (`AppError`):**

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": {
    "code": "BAD_REQUEST",
    "message": "Descripción del error"
  }
}
```

**Error con detalles:**

```json
{
  "success": false,
  "message": "Descripción del error",
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Descripción del error",
    "details": { "retryAfterMinutes": 45 }
  }
}
```

**Ruta no encontrada:**

```json
{
  "success": false,
  "message": "Ruta POST /ruta/inexistente no encontrada",
  "error": {
    "code": "NOT_FOUND",
    "message": "Ruta POST /ruta/inexistente no encontrada"
  }
}
```

**Error interno:**

```json
{
  "success": false,
  "message": "Ocurrió un error inesperado",
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Ocurrió un error inesperado"
  }
}
```

> **Nota de compatibilidad:** en errores el antiguo campo raíz `string error` ("Not Found") ahora es un objeto `error` estructurado (`{ code, message }`). Los payloads `user` y `url_acortada` migraron a `data`.

### Códigos de error estándar

| `error.code` | Status | Significado |
|--------------|--------|-------------|
| `BAD_REQUEST` | `400` | Solicitud incorrecta (validación, código incorrecto o JSON malformado) |
| `UNAUTHORIZED` | `401` | No autorizado (token faltante, expirado, tipo incorrecto o credenciales inválidas) |
| `FORBIDDEN` | `403` | Prohibido (token no corresponde al email, email no verificado o cuenta inactiva) |
| `NOT_FOUND` | `404` | Recurso no encontrado |
| `CONFLICT` | `409` | Conflicto (email ya registrado) |
| `GONE` | `410` | Gone (URL de destino no permitida) |
| `TOO_MANY_REQUESTS` | `429` | Demasiadas solicitudes (rate limit o límite de intentos) |
| `INTERNAL_SERVER_ERROR` | `500` | Error interno del servidor |
| `EMAIL_SEND_FAILED` | `502` | El correo de verificación no pudo enviarse |

Los `AppError` pueden además definir códigos semánticos específicos (p. ej. `TOKEN_EXPIRED`, `TOKEN_MISSING`, `TOKEN_TYPE_INVALID`, `RATE_LIMITED`, `EMAIL_ALREADY_REGISTERED`, `INVALID_JSON`).

### Códigos de estado

| Código | Significado |
|--------|-------------|
| `200` / `201` | Operación exitosa |
| `400` | Solicitud incorrecta (validación, código incorrecto o JSON malformado) |
| `401` | No autorizado (token faltante, expirado, tipo incorrecto o credenciales inválidas) |
| `403` | Prohibido (token no corresponde al email, email no verificado o cuenta inactiva) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (email ya registrado) |
| `410` | Gone (URL de destino no permitida) |
| `429` | Demasiadas solicitudes (rate limit o límite de intentos) |
| `500` | Error interno del servidor |
| `502` | Fallo al enviar el correo de verificación |

---

## Siguientes pasos

- [Guía de inicio rápido](GETTING_STARTED.md) — instalación y variables de entorno
- [Arquitectura del sistema](ARCHITECTURE.md) — patrones, base de datos y flujos internos
- [Seguridad](SECURITY.md) — mecanismos de protección implementados
- [Testing](TESTING.md) — suite de tests y tests de estrés