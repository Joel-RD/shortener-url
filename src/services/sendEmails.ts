import nodemailer, { Transporter } from "nodemailer";
import { transport as defaultTransport } from "../utils/configEmailTransport.js";
import { config } from "../config.js";
import logger from "../utils/logger.js";

const { configSendEmail } = config;

interface EmailServiceConfig {
    emailUser: string;
}

class EmailService {
    private transport: Transporter;
    private emailConfig: EmailServiceConfig;

    constructor(
        transport: Transporter = defaultTransport,
        emailConfig: EmailServiceConfig = configSendEmail
    ) {
        this.transport = transport;
        this.emailConfig = emailConfig;
    }

    private generateVerificationTemplate(code: string): string {
        return `
  <h1> Verifica tu correo electrónico </h1>
  <p>Para completar el registro, por favor introduce el siguiente código de verificación:</p>
  <h3>${code}</h3>
  <p>El código de verificación es válido por 10 minutos.</p>`;
    }

    private async sendMail(to: string, subject: string, text: string, html: string) {
        try {
            return await this.transport.sendMail({
                from: `"ERDL URL Shortener" <${this.emailConfig.emailUser}>`,
                to, subject, text, html
            });
        } catch (error) {
            logger.error("Error sending email:", error);
            throw error;
        }
    }

    public async sendVerificationEmail(to: string, code: string) {
        const subject = "Verifica tu correo electrónico";
        const text = `Tu código de verificación es: ${code}`;
        return await this.sendMail(to, subject, text, this.generateVerificationTemplate(code));
    }
}

export const emailService = new EmailService();
