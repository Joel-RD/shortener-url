import crypto from "crypto";

/**
 * Caracteres usados para los códigos de verificación.
 * Solo mayúsculas y dígitos para que el usuario pueda escribirlos
 * sin ambigüedad de mayúsculas/minúsculas.
 */
export const DEFAULT_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Genera un código aleatorio criptográficamente seguro.
 * Usa `crypto.randomInt` para evitar el sesgo del módulo.
 */
export const generateVerificationCode = (
    length: number = 6,
    chars: string = DEFAULT_CODE_CHARS
): string => {
    if (!Number.isInteger(length) || length <= 0) {
        throw new RangeError("La longitud del código debe ser un entero positivo");
    }
    if (chars.length === 0) {
        throw new RangeError("El conjunto de caracteres no puede estar vacío");
    }

    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[crypto.randomInt(chars.length)];
    }

    return result;
};

/**
 * Normaliza el código introducido por el usuario para compararlo
 * de forma consistente con el almacenado.
 */
export const normalizeVerificationCode = (code: string): string =>
    typeof code === "string" ? code.trim().toUpperCase() : "";
