import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { CustomJwtPayload, JwtTokenType } from "../models/types.js";

const JWT_SECRET = config.jwtSecret;
const JWT_ISSUER = "shortener-url";
const JWT_AUDIENCE = "shortener-url-api";

function signToken(userEmail: string, typ: JwtTokenType, expiresIn: string): string {
    return jwt.sign({ userEmail, typ }, JWT_SECRET, {
        expiresIn,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithm: "HS256",
    } as jwt.SignOptions);
}

/** Token de sesión: se envía en `Authorization: Bearer <token>`. */
export const userAuthJWToken = (userEmail: string): string =>
    signToken(userEmail, "session", "2d");

/** Token temporal para completar la verificación de email (2 minutos). */
export const emailValidJWToken = (userEmail: string): string =>
    signToken(userEmail, "email_verification", "2m");

/**
 * Verifica firma, expiración, emisor y audiencia de un token.
 * No valida el tipo: eso lo decide cada consumidor.
 */
export function verifyJwtToken(token: string): CustomJwtPayload {
    const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        algorithms: ["HS256"],
    });

    if (typeof decoded === "string" || typeof decoded.userEmail !== "string") {
        throw new jwt.JsonWebTokenError("Token sin userEmail");
    }

    return decoded as CustomJwtPayload;
}
