import { UrlRepository, ShortUrlCollisionError } from "../repository/urlRepository.js";
import { validateDomain } from "../utils/validateUserData.js";
import { generateShortId } from "../utils/nanoidTool.js";
import { AppError } from "../utils/AppError.js";
import logger from "../utils/logger.js";

const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;
const MAX_GENERATION_ATTEMPTS = 3;

export function isValidShortId(value: unknown): value is string {
    return typeof value === "string" && SHORT_ID_PATTERN.test(value);
}

export class UrlService {
    constructor(private repository: UrlRepository) { }

    async shorten(orig_url: string): Promise<string> {
        if (typeof orig_url !== "string" || orig_url.trim() === "") {
            throw new AppError(400, "La URL es obligatoria", undefined, "URL_REQUIRED");
        }

        const normalizedUrl = orig_url.trim();
        const urlComproved = validateDomain(normalizedUrl);
        if (!urlComproved.isValid) {
            throw new AppError(400, "URL no permitida", urlComproved.error, "URL_NOT_ALLOWED");
        }

        for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            const urlID = generateShortId(8);
            try {
                return await this.repository.create(urlID, normalizedUrl);
            } catch (error) {
                if (error instanceof ShortUrlCollisionError) {
                    logger.warn("Colisión de short_url, reintentando", { urlID, attempt });
                    continue;
                }
                throw error;
            }
        }

        throw new AppError(503, "No se pudo generar un identificador único. Inténtalo de nuevo.", undefined, "SHORT_ID_GENERATION_FAILED");
    }

    async redirect(shortUrl: string): Promise<string> {
        if (!isValidShortId(shortUrl)) {
            throw new AppError(400, "Debe ingresar una URL válida.", undefined, "INVALID_SHORT_URL");
        }

        const originalUrl = await this.repository.findById(shortUrl);
        if (!originalUrl) {
            throw new AppError(404, "URL acortada no encontrada.", undefined, "SHORT_URL_NOT_FOUND");
        }

        const revalidated = validateDomain(originalUrl);
        if (!revalidated.isValid) {
            throw new AppError(410, "URL de destino no permitida.", undefined, "DESTINATION_URL_NOT_ALLOWED");
        }

        // El conteo de visitas no debe bloquear ni romper la redirección.
        void this.repository.incrementViews(shortUrl).catch((error) => {
            logger.error("No se pudo incrementar el contador de visitas", { shortUrl, error });
        });

        return originalUrl;
    }
}
