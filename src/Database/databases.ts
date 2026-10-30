import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { runMigrations } from "./migrate.js";
import logger from "../utils/logger.js";

const { isProduction, db } = config;

let url: string;
let authToken: string | undefined;

if (!isProduction) {
    const configuredFile = config.localDbFile;
    const normalizedFile = configuredFile && !/^(file:|libsql:|https?:)/.test(configuredFile)
        ? `file:${configuredFile}`
        : configuredFile;

    url = normalizedFile || `file:${path.join(process.cwd(), "src", "Database", "databases.db")}`;

    if (url.startsWith("file:")) {
        const filePath = url.slice("file:".length);
        if (filePath !== ":memory:") {
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
        }
    }
} else {
    if (!db.url) {
        throw new Error("Database URL is not configured (DB_TURSO_URL)");
    }
    url = db.url;
    authToken = db.authToken;
}

export const turso = createClient({ url, authToken });

try {
    await turso.execute("PRAGMA foreign_keys = ON");
} catch (error) {
    logger.warn("No se pudo activar foreign_keys en la base de datos", { error });
}

await runMigrations(turso);
