import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { config } from "../config.js";
import { Request, Response } from "express";
import { AppError } from "./AppError.js";
import { buildErrorBody } from "./responseFormat.js";

const { isProduction } = config;
const isStressTest = process.env.STRESS_TEST === "true";

function rateLimitErrorHandler(message: string) {
    return (req: Request, res: Response) => {
        const error = new AppError(429, message, undefined, "RATE_LIMITED");
        return res.status(error.statusCode).json(buildErrorBody(error));
    };
}

function clientKey(req: Request): string {
    return ipKeyGenerator(req.ip ?? "");
}

// Rate limit para la creación de URLs (POST /api/v1/short)
export const shortenRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: isStressTest ? 10_000_000 : (isProduction ? 5_000 : 1_000_000),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isStressTest,
    handler: rateLimitErrorHandler("Has alcanzado el límite de generación de URLs. Por favor, inténtalo de nuevo en una hora."),
    keyGenerator: clientKey,
});

// Rate limit para las redirecciones (GET /:shortUrl)
export const redirectRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: isStressTest ? 10_000_000 : (isProduction ? 50_000 : 1_000_000),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isStressTest,
    handler: rateLimitErrorHandler("Has alcanzado el límite de redirecciones. Por favor, inténtalo de nuevo en una hora."),
    keyGenerator: clientKey,
});

// Rate limit para los endpoints de autenticación (registro, login y verificación).
export const limitAuthButton = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: isStressTest ? 10_000_000 : (isProduction ? 20 : 2_000),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isStressTest,
    handler: rateLimitErrorHandler("Has alcanzado el límite de intentos de autenticación. Por favor, inténtalo de nuevo más tarde."),
    keyGenerator: clientKey,
});
