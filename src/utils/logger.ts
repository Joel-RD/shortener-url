import winston from 'winston';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const logsDir = path.join(process.cwd(), 'logs');

// Formato para desarrollo - legible y con colores
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      msg += `\n${stack}`;
    }
    return msg;
  })
);

// Formato para producción - JSON estructurado
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configuración de archivos rotativos
const getFileTransportOptions = (filename: string): winston.transports.FileTransportOptions => ({
  filename,
  dirname: logsDir,
  maxsize: 5 * 1024 * 1024, // 5MB
  maxFiles: 5,
});

// Crear el logger
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'shortener-url' },
  transports: [
    // Transport para errores
    new winston.transports.File({
      ...getFileTransportOptions('error.log'),
      level: 'error',
      silent: process.env.STRESS_TEST === 'true'
    }),
    // Transport para todos los logs
    new winston.transports.File({
      ...getFileTransportOptions('combined.log'),
      silent: process.env.STRESS_TEST === 'true'
    }),
  ],
});

// Agregar transport de consola en desarrollo (no en tests)
if (!isProduction && process.env.NODE_ENV !== 'test') {
  logger.add(
    new winston.transports.Console({
      format: devFormat,
    })
  );
}

// Logger personalizado que exporta métodos convenientes
export const log = {
  info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
  error: (message: string, meta?: Record<string, unknown>) => logger.error(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta),
};

// Exportar logger completo
export { logger };
export default logger;
