import { Response, Request, NextFunction } from "express";
import { AuthService } from "../services/authService.js";
import { config } from "../config.js";
import { AppError } from "../utils/AppError.js";
import { sendOk } from "../utils/responseFormat.js";

const { configCookiesParams } = config;
const VERIFICATION_COOKIE = "emailSendToVerifyUser";
const VERIFICATION_COOKIE_MAX_AGE = 2 * 60 * 1000;

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

export class AuthController {
    constructor(private authService: AuthService) { }

    private setVerificationCookie(res: Response, token: string): void {
        res.cookie(VERIFICATION_COOKIE, JSON.stringify({ token }), {
            ...configCookiesParams,
            maxAge: VERIFICATION_COOKIE_MAX_AGE,
        });
    }

    private clearVerificationCookie(res: Response): void {
        res.clearCookie(VERIFICATION_COOKIE, {
            httpOnly: configCookiesParams.httpOnly,
            secure: configCookiesParams.secure,
            sameSite: configCookiesParams.sameSite,
            path: configCookiesParams.path,
        });
    }

    authRegisterController = async (req: Request, res: Response, next: NextFunction) => {
        const { username, email, password } = req.body ?? {};

        if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
            return next(new AppError(400, "El nombre de usuario, el email y la contraseña son obligatorios", undefined, "MISSING_REGISTRATION_FIELDS"));
        }

        const { tempToken } = await this.authService.register({ username, email, password });
        this.setVerificationCookie(res, tempToken);

        return sendOk(res, undefined, "Usuario creado correctamente, código enviado al email", 201);
    }

    authLoginController = async (req: Request, res: Response, next: NextFunction) => {
        const { email, password } = req.body ?? {};

        if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
            return next(new AppError(400, "El email y la contraseña son obligatorios", undefined, "MISSING_LOGIN_FIELDS"));
        }

        const { tempToken, user } = await this.authService.login({ email, password });
        this.setVerificationCookie(res, tempToken);

        return sendOk(res, { user }, "Inicio de sesión correcto, código enviado al email");
    }

    postAuthVerifyEmailController = async (req: Request, res: Response, next: NextFunction) => {
        const { code, email } = req.body ?? {};

        if (!isNonEmptyString(email) || !isNonEmptyString(code)) {
            return next(new AppError(400, "El código y el email son obligatorios", undefined, "MISSING_VERIFICATION_FIELDS"));
        }

        const { authToken } = await this.authService.verifyEmailCode({ email, code });
        this.clearVerificationCookie(res);

        return sendOk(res, { authToken }, "Inicio de sesión correcto.");
    }
}
