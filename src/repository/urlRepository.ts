import { IUrlRepository } from "../models/types.js";
import { Client } from "@libsql/client";
import logger from "../utils/logger.js";

/** Se lanza cuando el `short_url` generado ya existe (colisión de nanoid). */
export class ShortUrlCollisionError extends Error {
    constructor(shortUrl: string) {
        super(`El identificador corto "${shortUrl}" ya existe`);
        this.name = "ShortUrlCollisionError";
    }
}

function isUniqueConstraintError(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    if (typeof code === "string" && code.includes("CONSTRAINT_UNIQUE")) return true;
    const message = error instanceof Error ? error.message : String(error);
    return /unique constraint failed/i.test(message);
}

export class UrlRepository implements IUrlRepository {
    constructor(private DB: Client) { }

    async findById(short_url: string): Promise<string | null> {
        try {
            const result = await this.DB.execute({
                sql: "SELECT original_url FROM urls WHERE short_url = ? AND is_active = 1",
                args: [short_url]
            });

            if (!result.rows || result.rows.length === 0) {
                return null;
            }

            return result.rows[0].original_url as string;
        } catch (error) {
            logger.error('Error en findById repository', { error, short_url });
            throw new Error(`Error buscando la URL en el repositorio: ${error}`);
        }
    }

    async create(short_url: string, original_url: string): Promise<string> {
        try {
            await this.DB.execute({
                sql: "INSERT INTO urls (original_url, short_url) VALUES (?, ?)",
                args: [original_url, short_url]
            });
            return short_url;
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new ShortUrlCollisionError(short_url);
            }
            logger.error('Error en create repository', { error, short_url, original_url });
            throw new Error(`Error creando la URL en el repositorio: ${error}`);
        }
    }

    async incrementViews(short_url: string): Promise<void> {
        try {
            await this.DB.execute({
                sql: "UPDATE urls SET views = views + 1 WHERE short_url = ?",
                args: [short_url]
            });
        } catch (error) {
            logger.error('Error en incrementViews repository', { error, short_url });
            throw new Error(`Error incrementando las visitas: ${error}`);
        }
    }
}
