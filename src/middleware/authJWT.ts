import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { CustomJwtPayload, IAuthRepository, RequestModel as Request } from "../models/types.js";
import { verifyJwtToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { normalizeEmail } from "../utils/validateUserData.js";

function respondTokenError(err: unknown, next: NextFunction): void {
    if (err instanceof jwt.TokenExpiredError) {
        next(new AppError(401, "No autorizado: token expirado", undefined, "TOKEN_EXPIRED"));
        return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
        next(new AppError(403, "Prohibido: firma de token inválida", undefined, "TOKEN_INVALID"));
        return;
    }

    next(new AppError(401, "No autorizado: falló la verificación del token", undefined, "TOKEN_VERIFICATION_FAILED"));
}

export async function authJWT(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
        return next(new AppError(401, "No autorizado: no se proporcionó token", undefined, "TOKEN_MISSING"));
    }

    try {
        const user: CustomJwtPayload = verifyJwtToken(token);

        if (user.typ !== "session") {
            return next(new AppError(401, "No autorizado: se requiere un token de sesión", undefined, "TOKEN_TYPE_INVALID"));
        }

        req.userEmail = normalizeEmail(user.userEmail);
        next();
    } catch (err) {
        respondTokenError(err, next);
    }
}

export async function verifySendToEmail(req: Request, res: Response, next: NextFunction) {
    if (!req.cookies?.emailSendToVerifyUser) {
        return next(new AppError(401, "No autorizado: no hay sesión de verificación", undefined, "VERIFICATION_SESSION_MISSING"));
    }

    let tokenParser: { token?: string };
    try {
        tokenParser = JSON.parse(req.cookies.emailSendToVerifyUser);
    } catch {
        return next(new AppError(401, "No autorizado: sesión de verificación inválida", undefined, "VERIFICATION_SESSION_INVALID"));
    }

    const token = tokenParser?.token;
    if (!token) {
        return next(new AppError(401, "No autorizado: no hay token de verificación", undefined, "VERIFICATION_TOKEN_MISSING"));
    }

    const bodyEmail = normalizeEmail(req.body?.email);
    if (!bodyEmail) {
        // Falla cerrado: sin email no se puede comprobar que el token corresponda.
        return next(new AppError(401, "No autorizado: el email es obligatorio", undefined, "EMAIL_REQUIRED"));
    }

    try {
        const decoded = verifyJwtToken(token);

        if (decoded.typ !== "email_verification") {
            return next(new AppError(401, "No autorizado: se requiere un token de verificación", undefined, "TOKEN_TYPE_INVALID"));
        }

        if (normalizeEmail(decoded.userEmail) !== bodyEmail) {
            return next(new AppError(403, "Prohibido: el token no corresponde al email indicado", undefined, "TOKEN_EMAIL_MISMATCH"));
        }

        next();
    } catch (err) {
        respondTokenError(err, next);
    }
}

/**
 * Comprueba que el usuario del token siga existiendo, tenga el email
 * verificado y la cuenta activa. Debe usarse después de `authJWT`.
 */
export function requireActiveUser(repository: Pick<IAuthRepository, "findByEmail">) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const email = req.userEmail;
        if (!email) {
            return next(new AppError(401, "No autorizado: no se proporcionó token", undefined, "TOKEN_MISSING"));
        }

        try {
            const user = await repository.findByEmail(email);
            if (!user) {
                return next(new AppError(401, "No autorizado: usuario no encontrado", undefined, "USER_NOT_FOUND"));
            }

            if (Number(user.email_verified) !== 1) {
                return next(new AppError(403, "Prohibido: el email no está verificado", undefined, "EMAIL_NOT_VERIFIED"));
            }

            if (user.account_active !== undefined && user.account_active !== null && Number(user.account_active) === 0) {
                return next(new AppError(403, "Prohibido: la cuenta está desactivada", undefined, "ACCOUNT_INACTIVE"));
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}
