/**
 * Normaliza un email para almacenarlo y compararlo de forma consistente.
 * SQLite compara TEXT de forma case-sensitive, por lo que sin esto
 * "User@X.com" y "user@x.com" podrían crear cuentas distintas.
 */
export function normalizeEmail(email: string): string {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Valida si un email es válido y pertenece a dominios permitidos
 * @param email - Email a validar
 * @returns objeto con isValid y mensaje de error si aplica
 */
export function validateEmail(rawEmail: string): { isValid: boolean; error?: string } {
    const email = normalizeEmail(rawEmail);

    if (email === '') {
        return { isValid: false, error: 'El email no puede estar vacío' };
    }

    const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Formato de email inválido' };
    }

    if (email.length > 254) {
        return { isValid: false, error: 'El email excede la longitud máxima permitida' };
    }

    const localPart = email.split('@')[0];
    if (localPart.length > 64) {
        return { isValid: false, error: 'La parte local del email es demasiado larga' };
    }

    if (email.includes('..')) {
        return { isValid: false, error: 'El email no puede contener puntos consecutivos' };
    }

    if (localPart.startsWith('.') || localPart.endsWith('.')) {
        return { isValid: false, error: 'El email no puede empezar o terminar con punto' };
    }

    return { isValid: true };
}


/**
 * Valida si una contraseña cumple con los requisitos de seguridad
 * @param password - Contraseña a validar
 * @returns objeto con isValid, strength y errores si aplica
 */
export function validatePassword(password: string): {
    isValid: boolean;
    strength: 'débil' | 'media' | 'fuerte' | 'muy fuerte';
    errors: string[]
} {
    const errors: string[] = [];

    // Requisitos mínimos
    const minLength = 12;

    // Validar que la contraseña no esté vacía
    if (!password || password.trim() === '') {
        return {
            isValid: false,
            strength: 'débil',
            errors: ['La contraseña no puede estar vacía']
        };
    }

    // Validar longitud mínima
    if (password.length < minLength) {
        errors.push(`La contraseña debe tener al menos ${minLength} caracteres`);
    }

    // Validar al menos una letra minúscula
    if (!/[a-z]/.test(password)) {
        errors.push('Debe contener al menos una letra minúscula');
    }

    // Validar al menos una letra mayúscula
    if (!/[A-Z]/.test(password)) {
        errors.push('Debe contener al menos una letra mayúscula');
    }

    // Validar al menos un número
    if (!/\d/.test(password)) {
        errors.push('Debe contener al menos un número');
    }

    // Validar al menos un carácter especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Debe contener al menos un carácter especial (!@#$%^&*...)');
    }

    // Validar que no contenga espacios
    if (/\s/.test(password)) {
        errors.push('La contraseña no debe contener espacios');
    }

    // Validar que no sea una contraseña común
    const commonPasswords = [
        'password', '12345678', 'qwerty', 'abc123', 'password123',
        'admin123', 'letmein', 'welcome', 'monkey', '1234567890'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push('La contraseña es demasiado común');
    }

    // Validar secuencias numéricas o alfabéticas
    if (/(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
        errors.push('Evita secuencias predecibles de números o letras');
    }

    // Determinar fortaleza basada en el puntaje
    let strength: 'débil' | 'media' | 'fuerte' | 'muy fuerte';
    if (password.length <= 3) {
        strength = 'débil';
    } else if (password.length <= 5) {
        strength = 'media';
    } else if (password.length <= 10) {
        strength = 'fuerte';
    } else {
        strength = 'muy fuerte';
    }

    return {
        isValid: errors.length === 0,
        strength,
        errors
    };
}

/**
 * Valida los datos de registro de un usuario
 * @param data - Datos de registro
 * @returns objeto con isValid y posibles errores
 */
export function validateRegistration(data: {
    username?: string;
    email: string;
    password: string;
    name?: string;
    lastName?: string;
}): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar username
    if (!data.username || data.username.trim().length < 3) {
        errors.push('El nombre de usuario debe tener al menos 3 caracteres');
    } else if (data.username.trim().length > 50) {
        errors.push('El nombre de usuario no puede superar los 50 caracteres');
    }

    // Validar email
    const emailValidation = validateEmail(data.email);
    if (!emailValidation.isValid) {
        errors.push(emailValidation.error || 'Email inválido');
    }

    // Validar password
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
    }

    // Validar nombre y apellido si están presentes
    if (data.name && data.name.trim().length < 2) {
        errors.push('El nombre debe tener al menos 2 caracteres');
    }
    if (data.lastName && data.lastName.trim().length < 2) {
        errors.push('El apellido debe tener al menos 2 caracteres');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

import { isIP } from "node:net";

/**
 * Determina si una dirección IPv4 pertenece a rangos privados o reservados
 * @param ip - Dirección IPv4
 */
function isPrivateIPv4(ip: string): boolean {
    const [a, b] = ip.split(".").map(Number);
    if (a === undefined || b === undefined) return false;
    return (
        a === 0 ||                             // 0.0.0.0/8
        a === 10 ||                            // 10.0.0.0/8
        a === 100 && b >= 64 && b <= 127 ||    // 100.64.0.0/10 (CGNAT)
        a === 127 ||                           // 127.0.0.0/8 (loopback)
        a === 169 && b === 254 ||              // 169.254.0.0/16 (link-local)
        a === 172 && b >= 16 && b <= 31 ||     // 172.16.0.0/12
        a === 192 && b === 168 ||              // 192.168.0.0/16
        a >= 224                               // multicast y reservado
    );
}

/**
 * Determina si una dirección IPv6 pertenece a rangos privados o reservados
 * @param ip - Dirección IPv6
 */
function isPrivateIPv6(ip: string): boolean {
    const lower = ip.toLowerCase();

    if (lower === "::" || lower === "::1") return true;                         // unspecified / loopback

    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;          // fc00::/7 (ULA)

    if (lower.startsWith("fe8") || lower.startsWith("fe9") ||                   // fe80::/10 (link-local)
        lower.startsWith("fea") || lower.startsWith("feb")) return true;

    if (lower.startsWith("ff")) return true;                                     // ff00::/8 (multicast)

    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)/);                // IPv4-mapped
    if (mapped && mapped[1]) return isPrivateIPv4(mapped[1]);

    return false;
}

/**
 * Validar urls,para que no sean maliciosos
 * @param original_url - Url
 */
export function validateDomain(original_url: string): { isValid: boolean; error?: string } {
    if (typeof original_url !== "string" || original_url.trim() === "") {
        return {
            isValid: false,
            error: "La URL no puede estar vacía"
        };
    }

    if (original_url.length > 2048) {
        return {
            isValid: false,
            error: "La URL excede la longitud máxima permitida (2048 caracteres)"
        };
    }

    if (/[\s\x00-\x1F\x7F]/.test(original_url)) {
        return {
            isValid: false,
            error: "La URL no puede contener espacios ni caracteres de control"
        };
    }

    if (original_url.includes("\\")) {
        return {
            isValid: false,
            error: "La URL no puede contener barras invertidas"
        };
    }

    let url: URL;
    try {
        url = new URL(original_url);
    } catch {
        return {
            isValid: false,
            error: "La URL no tiene un formato válido"
        };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return {
            isValid: false,
            error: "El Scheme solo permite http/https"
        };
    }

    if (!url.hostname) {
        return {
            isValid: false,
            error: "La URL debe incluir un dominio"
        };
    }

    if (url.username || url.password) {
        return {
            isValid: false,
            error: "La URL no puede incluir credenciales (user:password@)"
        };
    }

    const hostname = url.hostname;

    if (hostname.length > 253) {
        return {
            isValid: false,
            error: "El dominio excede la longitud máxima permitida"
        };
    }

    const ipHost = hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;

    const ipType = isIP(ipHost);
    if (ipType === 4 || ipType === 6) {
        const isPrivate = ipType === 4
            ? isPrivateIPv4(ipHost)
            : isPrivateIPv6(ipHost);

        return isPrivate
            ? { isValid: false, error: "La URL no puede apuntar a IPs privadas o internas" }
            : { isValid: true };
    }

    const lowerHost = hostname.toLowerCase();
    if (
        lowerHost === "localhost" ||
        lowerHost === "localhost.localdomain" ||
        lowerHost.endsWith(".localhost") ||
        lowerHost.endsWith(".local") ||
        lowerHost.endsWith(".internal")
    ) {
        return {
            isValid: false,
            error: "La URL no puede apuntar a hosts locales o internos"
        };
    }

    if (/[^a-z0-9-.]/i.test(hostname) || hostname.includes("..")) {
        return {
            isValid: false,
            error: "El dominio contiene caracteres o formato inválido"
        };
    }

    const labels = hostname.split(".");
    if (labels.some(label => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) {
        return {
            isValid: false,
            error: "El dominio contiene segmentos inválidos"
        };
    }

    const tld = labels[labels.length - 1] ?? "";
    if (!/^[a-z]{2,}$/i.test(tld)) {
        return {
            isValid: false,
            error: "El dominio debe tener un TLD válido (al menos 2 letras)"
        };
    }

    return { isValid: true };
}
