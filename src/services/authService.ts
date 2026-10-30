import { AuthRepository, DuplicateUserError } from "../repository/authRepository.js";
import { emailService } from "./sendEmails.js";
import { hashPassword, comparePassword } from "../utils/password_encrypt.js";
import { generateVerificationCode, normalizeVerificationCode } from "../utils/codeValidatedEmail.js";
import { emailValidJWToken, userAuthJWToken } from "../utils/jwt.js";
import { normalizeEmail, validateEmail, validateRegistration } from "../utils/validateUserData.js";
import { AppError } from "../utils/AppError.js";
import logger from "../utils/logger.js";

interface LoginUser {
    id: number;
    username: string;
    email: string;
}

/** Convierte una fecha `DATETIME` de SQLite (UTC sin zona) a `Date`. */
function parseSqliteDate(value: string): Date {
    const normalized = value.includes("T") ? value : value.replace(" ", "T");
    return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
}

export class AuthService {
    constructor(private repository: AuthRepository) { }

    async register(input: { username: string; email: string; password: string }): Promise<{ tempToken: string }> {
        const username = typeof input.username === "string" ? input.username.trim() : "";
        const email = normalizeEmail(input.email);
        const password = typeof input.password === "string" ? input.password : "";

        const validation = validateRegistration({ username, email, password });
        if (!validation.isValid) {
            throw new AppError(400, "Los datos de registro no son válidos", validation.errors, "INVALID_REGISTRATION_DATA");
        }

        const emailBlock = await this.repository.checkBlocked("email", email);
        if (emailBlock.blocked) {
            throw new AppError(429, "Demasiados intentos de comprobación de email. Inténtalo de nuevo más tarde.", {
                retryAfterMinutes: emailBlock.retryAfterMinutes
            });
        }

        const existingEmail = await this.repository.findByEmail(email);
        if (existingEmail) {
            throw new AppError(409, "El email ya está registrado", undefined, "EMAIL_ALREADY_REGISTERED");
        }

        const passwordHash = await hashPassword(password);
        try {
            await this.repository.create({ username, email, passwordHash });
        } catch (error) {
            if (error instanceof DuplicateUserError) {
                throw new AppError(409, "El email ya está registrado", undefined, "EMAIL_ALREADY_REGISTERED");
            }
            throw error;
        }

        await this.repository.resetAttempts("email", email);
        await this.createAndSendVerificationCode(email);

        return { tempToken: emailValidJWToken(email) };
    }

    async login(input: { email: string; password: string }): Promise<{ tempToken: string; user: LoginUser }> {
        const email = normalizeEmail(input.email);
        const password = typeof input.password === "string" ? input.password : "";

        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid || password.trim() === "") {
            throw new AppError(401, "Credenciales no válidas", emailValidation.isValid ? undefined : [emailValidation.error], "INVALID_CREDENTIALS");
        }

        const emailBlock = await this.repository.checkBlocked("email", email);
        if (emailBlock.blocked) {
            throw new AppError(429, "Demasiados intentos de comprobación de email. Inténtalo de nuevo más tarde.", {
                retryAfterMinutes: emailBlock.retryAfterMinutes
            });
        }

        const user = await this.repository.findByEmail(email);
        if (!user) {
            // Misma respuesta que una contraseña incorrecta para no filtrar qué emails existen.
            throw new AppError(401, "Credenciales no válidas", undefined, "INVALID_CREDENTIALS");
        }

        const passwordBlock = await this.repository.checkBlocked("password", email);
        if (passwordBlock.blocked) {
            throw new AppError(429, "Demasiados intentos de contraseña. Cuenta temporalmente bloqueada.", {
                retryAfterMinutes: passwordBlock.retryAfterMinutes
            });
        }

        const passwordMatch = await comparePassword(password, user.password_hash);
        if (!passwordMatch) {
            await this.repository.registerAttempt("email", email);
            await this.repository.registerAttempt("password", email);
            throw new AppError(401, "Credenciales no válidas", undefined, "INVALID_CREDENTIALS");
        }

        await this.repository.resetAttempts("email", email);
        await this.repository.resetAttempts("password", email);

        const activeCode = await this.repository.getActiveVerificationCode(email);
        if (activeCode) {
            const expiresAt = parseSqliteDate(activeCode.expires_at);
            const minutesLeft = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 60000));
            throw new AppError(429, "Ya hay un código de verificación activo.", { remainingMinutes: minutesLeft }, "VERIFICATION_CODE_ACTIVE");
        }

        await this.createAndSendVerificationCode(email);

        return {
            tempToken: emailValidJWToken(email),
            user: { id: user.id, username: user.username, email: user.email }
        };
    }

    async verifyEmailCode(input: { email: string; code: string }): Promise<{ authToken: string }> {
        const email = normalizeEmail(input.email);
        const code = normalizeVerificationCode(input.code);

        if (!email || code.length === 0) {
            throw new AppError(400, "El código y el email son obligatorios", undefined, "INVALID_VERIFICATION_DATA");
        }

        const codeBlock = await this.repository.checkBlocked("code", email);
        if (codeBlock.blocked) {
            throw new AppError(429, "Demasiados intentos de código de verificación. Inténtalo de nuevo más tarde.", {
                retryAfterMinutes: codeBlock.retryAfterMinutes
            });
        }

        const user = await this.repository.findByEmail(email);
        if (!user) {
            throw new AppError(400, "Código de verificación incorrecto", undefined, "INCORRECT_VERIFICATION_CODE");
        }

        if (user.account_active !== undefined && user.account_active !== null && Number(user.account_active) === 0) {
            throw new AppError(403, "La cuenta está desactivada", undefined, "ACCOUNT_INACTIVE");
        }

        const codeMatch = await this.repository.verifyVerificationCode(email, code);
        if (!codeMatch) {
            await this.repository.registerAttempt("code", email);
            throw new AppError(400, "Código de verificación incorrecto", undefined, "INCORRECT_VERIFICATION_CODE");
        }

        await this.repository.resetAttempts("code", email);
        await this.repository.updateUsedVerificationCode(email);
        await this.repository.markEmailVerified(email);

        return { authToken: userAuthJWToken(email) };
    }

    /**
     * Guarda un código nuevo y espera a que el correo se envíe.
     * Si el envío falla, elimina el código para que el usuario pueda
     * reintentar sin quedar bloqueado por un "código activo".
     */
    private async createAndSendVerificationCode(email: string): Promise<void> {
        const code = generateVerificationCode();
        await this.repository.savedVerificationCode(email, code);

        try {
            await emailService.sendVerificationEmail(email, code);
        } catch (error) {
            logger.error("No se pudo enviar el email de verificación", { email, error });
            await this.repository.deleteVerificationCode(email);
            throw new AppError(502, "No se pudo enviar el correo de verificación. Inténtalo de nuevo.", undefined, "EMAIL_SEND_FAILED");
        }
    }
}
