import { NextFunction, Request, Response, Router } from "express";
import { UrlController } from "../controllers/urlController.js";
import { UrlRepository } from "../repository/urlRepository.js";
import { UrlService, isValidShortId } from "../services/urlService.js";
import { turso } from "../Database/databases.js";
import { redirectRateLimit, shortenRateLimit } from "../utils/limitClick.js";

const router = Router();
const urlRepository = new UrlRepository(turso);
const urlService = new UrlService(urlRepository);
const urlController = new UrlController(urlService);

/**
 * Solo deja pasar identificadores con el formato esperado. Cualquier otra
 * ruta de un único segmento (p. ej. /favicon.ico o /health) cae al 404
 * general en lugar de consultar la base de datos.
 */
function shortUrlFormatGuard(req: Request, res: Response, next: NextFunction) {
    if (!isValidShortId(req.params.shortUrl)) {
        return next("route");
    }
    next();
}

router.post("/api/v1/short", shortenRateLimit, urlController.shortenerController);
router.get("/:shortUrl", shortUrlFormatGuard, redirectRateLimit, urlController.redirectShortController);

export default router;
