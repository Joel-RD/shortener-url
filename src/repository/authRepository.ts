import { Client } from "@libsql/client";
import { CreateUser, IAuthRepository, UserAuthData } from "../models/types.js";
import { AttemptScope, BLOCK_DURATION_HOURS, MAX_ATTEMPTS } from "../utils/attemptLimiter.js";
import logger from "../utils/logger.js";

interface AttemptColumns {
    table: string;
    countColumn: string;
    blockedColumn: string;
}

/** Se lanza cuando el email o el username ya existen (violación de UNIQUE). */
export class DuplicateUserError extends Error {
    constructor(message = "El usuario ya existe") {
        super(message);
        this.name = "DuplicateUserError";
    }
}

function isUniqueConstraintError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    if (typeof code === "string" && code.includes("CONSTRAINT_UNIQUE")) return true;
    const message = error instanceof Error ? error.message : String(error);
    return /unique constraint failed/i.test(message);
}

export class AuthRepository implements IAuthRepository {
    constructor(private DB: Client) { }

    async findByEmail(email: string): Promise<UserAuthData | null> {
        try {
            const result = await this.DB.execute({
                sql: "SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1",
                args: [email]
            });
            return result.rows[0] ? result.rows[0] as unknown as UserAuthData : null;
        } catch (error) {
            logger.error("Error search user by email: ", error);
            throw new Error(`Error search user by email: ${error}`);
        }
    }

    async create(user: CreateUser): Promise<UserAuthData> {
        try {
            await this.DB.execute({
                sql: "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                args: [
                    user.username,
                    user.email,
                    user.passwordHash,
                ]
            });

            const created = await this.findByEmail(user.email);
            if (!created) {
                throw new Error("Usuario no encontrado después de la inserción");
            }
            return created;
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new DuplicateUserError();
            }
            logger.error("Error creating user in repository:", error);
            throw new Error(`Error creating user in repository: ${error}`);
        }
    }

    async savedVerificationCode(email: string, code: string): Promise<void> {
        try {
            await this.DB.execute({
                sql: `INSERT INTO verification_codes (email, code, expires_at)
                      VALUES (?, ?, DATETIME('now', '+10 minutes'))
                      ON CONFLICT(email) DO UPDATE SET
                          code = excluded.code,
                          expires_at = excluded.expires_at,
                          used = 0,
                          used_at = NULL,
                          attempt_count = 0,
                          blocked_until = NULL`,
                args: [email, code]
            });
        } catch (error) {
            logger.error("Error saving verification code in repository:", error);
            throw new Error(`Error saving verification code in repository ${error}`);
        }
    }

    async verifyVerificationCode(email: string, code: string): Promise<boolean> {
        try {
            const result = await this.DB.execute({
                sql: `SELECT * FROM verification_codes
                      WHERE email = ? AND code = ? AND used = 0 AND expires_at > DATETIME('now')`,
                args: [email, code]
            });
            return !!result.rows[0];
        } catch (error) {
            logger.error("Error verifying verification code in repository:", error);
            throw new Error(`Error verifying verification code in repository: ${error}`);
        }
    }

    async markEmailVerified(email: string): Promise<void> {
        try {
            await this.DB.execute({
                sql: "UPDATE users SET email_verified = 1 WHERE email = ?",
                args: [email]
            });
        } catch (error) {
            logger.error("Error marking email as verified in repository:", error);
            throw new Error(`Error marking email as verified in repository: ${error}`);
        }
    }

    async updateUsedVerificationCode(email: string): Promise<void> {
        try {
            await this.DB.execute({
                sql: "UPDATE verification_codes SET used = 1, used_at = DATETIME('now') WHERE email = ?",
                args: [email]
            });
        } catch (error) {
            logger.error("Error updating used verification code in repository:", error);
            throw new Error(`Error updating used verification code in repository ${error}`);
        }
    }

    async deleteVerificationCode(email: string): Promise<void> {
        try {
            await this.DB.execute({
                sql: "DELETE FROM verification_codes WHERE email = ?",
                args: [email]
            });
        } catch (error) {
            logger.error("Error deleting verification code in repository:", error);
            throw new Error(`Error deleting verification code in repository ${error}`);
        }
    }

    async getActiveVerificationCode(email: string): Promise<{ expires_at: string } | null> {
        try {
            const result = await this.DB.execute({
                sql: `SELECT * FROM verification_codes
                      WHERE email = ? AND used = 0 AND expires_at > DATETIME('now')`,
                args: [email]
            });
            return result.rows[0] ? result.rows[0] as unknown as { expires_at: string } : null;
        } catch (error) {
            logger.error("Error getting active verification code:", error);
            throw new Error(`Error getting active verification code ${error}`);
        }
    }

    async checkBlocked(scope: AttemptScope, email: string): Promise<{ blocked: boolean; retryAfterMinutes: number }> {
        try {
            const { table, blockedColumn } = this.attemptColumns(scope);
            const result = await this.DB.execute({
                sql: `SELECT CAST((julianday(${blockedColumn}) - julianday('now')) * 1440 AS INTEGER) + 1 AS minutes_left
                      FROM ${table}
                      WHERE email = ? AND ${blockedColumn} > DATETIME('now')`,
                args: [email]
            });

            const minutesLeft = result.rows[0]?.minutes_left;
            return minutesLeft !== undefined && minutesLeft !== null
                ? { blocked: true, retryAfterMinutes: Number(minutesLeft) }
                : { blocked: false, retryAfterMinutes: 0 };
        } catch (error) {
            logger.error("Error checking blocked attempts in repository:", error);
            throw new Error(`Error checking blocked attempts in repository ${error}`);
        }
    }

    /**
     * Incrementa el contador de intentos y fija el bloqueo en una sola
     * sentencia atómica (evita condiciones de carrera entre peticiones).
     */
    async registerAttempt(scope: AttemptScope, email: string): Promise<{ blocked: boolean; attemptsLeft: number }> {
        try {
            const { table, countColumn, blockedColumn } = this.attemptColumns(scope);
            const hours = BLOCK_DURATION_HOURS[scope];

            const result = await this.DB.execute({
                sql: `UPDATE ${table}
                      SET ${countColumn} = ${countColumn} + 1,
                          ${blockedColumn} = CASE
                              WHEN ${countColumn} + 1 >= ? THEN DATETIME('now', ?)
                              ELSE ${blockedColumn}
                          END
                      WHERE email = ?
                      RETURNING ${countColumn} AS attempt_count`,
                args: [MAX_ATTEMPTS, `+${hours} hours`, email]
            });

            const row = result.rows[0];
            if (!row) {
                return { blocked: false, attemptsLeft: MAX_ATTEMPTS };
            }

            const count = Number(row.attempt_count ?? 0);
            if (count >= MAX_ATTEMPTS) {
                await this.DB.execute({
                    sql: `UPDATE ${table} SET ${countColumn} = 0 WHERE email = ?`,
                    args: [email]
                });
                return { blocked: true, attemptsLeft: 0 };
            }

            return { blocked: false, attemptsLeft: Math.max(0, MAX_ATTEMPTS - count) };
        } catch (error) {
            logger.error("Error registering attempt in repository:", error);
            throw new Error(`Error registering attempt in repository ${error}`);
        }
    }

    async resetAttempts(scope: AttemptScope, email: string): Promise<void> {
        try {
            const { table, countColumn, blockedColumn } = this.attemptColumns(scope);
            await this.DB.execute({
                sql: `UPDATE ${table} SET ${countColumn} = 0, ${blockedColumn} = NULL WHERE email = ?`,
                args: [email]
            });
        } catch (error) {
            logger.error("Error resetting attempts in repository:", error);
            throw new Error(`Error resetting attempts in repository ${error}`);
        }
    }

    private attemptColumns(scope: AttemptScope): AttemptColumns {
        switch (scope) {
            case "email":
                return { table: "users", countColumn: "email_attempt_count", blockedColumn: "email_blocked_until" };
            case "password":
                return { table: "users", countColumn: "password_attempt_count", blockedColumn: "password_blocked_until" };
            case "code":
                return { table: "verification_codes", countColumn: "attempt_count", blockedColumn: "blocked_until" };
        }
    }
}
