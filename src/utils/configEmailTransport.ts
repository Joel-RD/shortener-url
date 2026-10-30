import nodemailer, { TransportOptions } from "nodemailer";
import { config } from "../config.js";
import logger from "./logger.js";

const { configSendEmail, isProduction } = config;

function createTransport() {
    if (configSendEmail.emailHost) {
        return nodemailer.createTransport({
            host: configSendEmail.emailHost,
            port: configSendEmail.emailPort,
            secure: configSendEmail.emailSecure,
            auth: {
                user: configSendEmail.emailUser,
                pass: configSendEmail.emailPass
            }
        } as TransportOptions);
    }

    if (isProduction) {
        throw new Error("EMAIL_HOST is required in production");
    }

    logger.warn("EMAIL_HOST no configurado: los correos se registrarán en consola (jsonTransport)");
    return nodemailer.createTransport({ jsonTransport: true });
}

export const transport = createTransport();
