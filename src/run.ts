import app from "./main.js";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";

const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
        url: `http://localhost:${config.port}`,
        environment: config.nodeEnv || "development",
    });
});

server.on("error", (error) => {
    logger.error("No se pudo iniciar el servidor", { error: error.message, stack: error.stack });
    process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Cerrando servidor (${signal})...`);

    const forceExit = setTimeout(() => {
        logger.error("Cierre forzado: el servidor no respondió a tiempo");
        process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close((error) => {
        clearTimeout(forceExit);
        if (error) {
            logger.error("Error al cerrar el servidor", { error: error.message });
            process.exit(1);
        }
        logger.info("Servidor cerrado correctamente");
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection", { reason });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
    process.exit(1);
});
