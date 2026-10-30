import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { buildErrorBody } from "../utils/responseFormat.js";
import logger from "../utils/logger.js";

interface HttpLikeError extends Error {
    status?: number;
    statusCode?: number;
    type?: string;
}

export function notFoundHandler(req: Request, res: Response) {
    const error = new AppError(404, `Ruta ${req.method} ${req.path} no encontrada`);
    res.status(error.statusCode).json(buildErrorBody(error));
}

export function errorHandler(err: HttpLikeError, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        if (err.statusCode >= 500) {
            logger.error("Error de aplicación:", err);
        }
        return res.status(err.statusCode).json(buildErrorBody(err));
    }

    // Errores de parseo del body (JSON malformado) y payloads demasiado grandes.
    if (err instanceof SyntaxError && err.status === 400) {
        const error = new AppError(400, "El cuerpo de la solicitud no es JSON válido", undefined, "INVALID_JSON");
        return res.status(error.statusCode).json(buildErrorBody(error));
    }

    const status = err.status ?? err.statusCode;
    if (status === 413) {
        const error = new AppError(413, "El cuerpo de la solicitud es demasiado grande", undefined, "PAYLOAD_TOO_LARGE");
        return res.status(error.statusCode).json(buildErrorBody(error));
    }

    logger.error("Error no controlado:", err);
    const error = new AppError(500, "Ocurrió un error inesperado");
    res.status(error.statusCode).json(buildErrorBody(error));
}
