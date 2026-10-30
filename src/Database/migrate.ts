import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@libsql/client";
import logger from "../utils/logger.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function resolveSchemaPath(): string {
    const candidates = [
        path.join(moduleDir, "schema.sql"),
        path.join(process.cwd(), "src", "Database", "schema.sql"),
    ];

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) {
        throw new Error("No se encontró el archivo schema.sql de la base de datos");
    }
    return found;
}

/**
 * Divide el script SQL en sentencias ejecutables.
 * Tiene en cuenta que los triggers contienen `;` en su interior.
 */
export function splitSqlStatements(sql: string): string[] {
    const lines = sql
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"));

    const statements: string[] = [];
    let current = "";
    let inTrigger = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "") continue;

        current += `${line}\n`;

        if (/^CREATE\s+(TEMP\s+)?TRIGGER\b/i.test(trimmed)) {
            inTrigger = true;
        }

        if (inTrigger) {
            if (/^END\s*;?\s*$/i.test(trimmed)) {
                statements.push(current.trim());
                current = "";
                inTrigger = false;
            }
        } else if (trimmed.endsWith(";")) {
            statements.push(current.trim());
            current = "";
        }
    }

    if (current.trim() !== "") {
        statements.push(current.trim());
    }

    return statements;
}

/** Aplica el esquema de forma idempotente (todas las sentencias usan IF NOT EXISTS). */
export async function runMigrations(client: Client): Promise<void> {
    const sql = fs.readFileSync(resolveSchemaPath(), "utf8");
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
        await client.execute(statement);
    }

    logger.info("Esquema de base de datos verificado", { statements: statements.length });
}
