import dotenv from "dotenv";
import { ConfigCookiesParams } from "./models/types.js";
import logger from "./utils/logger.js";

dotenv.config();

const {
    NODE_ENV,
    JWT_SECRET,
    DB_TURSO_URL,
    DB_TURSO_AUTH_TOKEN,
    DB_FILE,
    PORT,
    DOMAIN_FOR_FRONTEND,
    FRONTEND_ORIGIN,
    CORS_ORIGINS,
    SHORT_URL_BASE,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    HTTP_ONLY,
    SECURE,
    SAME_SITE,
    MAX_AGE,
    COOKIE_PATH,
    TRUST_PROXY,
} = process.env;

const isProduction = NODE_ENV === "production";

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === "") return fallback;
    return value.trim().toLowerCase() === "true";
}

function parsePort(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function parseSameSite(value: string | undefined): ConfigCookiesParams["sameSite"] {
    const normalized = (value ?? "lax").trim().toLowerCase();
    if (normalized === "lax" || normalized === "strict" || normalized === "none") {
        return normalized;
    }
    logger.warn(`SAME_SITE inválido ("${value}"). Se usará "lax".`);
    return "lax";
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
    if (value === undefined || value.trim() === "") return false;
    const normalized = value.trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (/^\d+$/.test(normalized)) return Number(normalized);
    return normalized;
}

const port = parsePort(PORT, 3000);
const frontendOrigin = (FRONTEND_ORIGIN || DOMAIN_FOR_FRONTEND || "http://localhost:3000").replace(/\/+$/, "");
const shortBaseUrl = (SHORT_URL_BASE || frontendOrigin).replace(/\/+$/, "");

const corsOrigins = (CORS_ORIGINS || frontendOrigin)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

if (isProduction && (!EMAIL_USER || !EMAIL_PASS || !EMAIL_HOST)) {
    logger.warn("Configuración SMTP incompleta: los correos de verificación no podrán enviarse.");
}

export const config = {
    port,
    isProduction,
    nodeEnv: NODE_ENV,
    trustProxy: parseTrustProxy(TRUST_PROXY),
    frontendOrigin,
    shortBaseUrl,
    corsOrigins,
    jwtSecret: (() => {
        if (!JWT_SECRET) {
            if (isProduction) {
                throw new Error("JWT_SECRET is required in production");
            }
            logger.warn("WARNING: Using development JWT secret - DO NOT USE IN PRODUCTION");
            return `dev_only_secret_${Math.random().toString(36).slice(2)}`;
        }
        return JWT_SECRET;
    })(),
    configCookiesParams: {
        httpOnly: parseBoolean(HTTP_ONLY, true),
        secure: parseBoolean(SECURE, isProduction),
        sameSite: parseSameSite(SAME_SITE),
        maxAge: Number(MAX_AGE) > 0 ? Number(MAX_AGE) : 7 * 24 * 60 * 60 * 1000,
        path: COOKIE_PATH || "/",
    } as ConfigCookiesParams,
    configSendEmail: {
        emailUser: EMAIL_USER || "",
        emailPass: EMAIL_PASS || "",
        emailHost: EMAIL_HOST || "",
        emailPort: parsePort(EMAIL_PORT, 587),
        emailSecure: parseBoolean(EMAIL_SECURE, false),
    },
    db: {
        url: DB_TURSO_URL,
        authToken: DB_TURSO_AUTH_TOKEN,
    },
    localDbFile: DB_FILE,
};
