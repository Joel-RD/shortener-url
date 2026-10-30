import autocannon from 'autocannon';
import log from "../../src/utils/logger.js"
import { generateShortId } from "../../src/utils/nanoidTool.js"

const BASE_URL = 'http://localhost:3000';

async function runHeavyStress() {
  log.info('\n🔥 INICIANDO TEST DE ESTRÉS EXTREMO (Punto de Ruptura) 🔥');
  log.info('Configuración: 500 conexiones | 10 Pipelining | 60 segundos');
  log.info('Flujo: POST (Crear con URL aleatoria) -> GET (Redirigir)\n');

  const instance = autocannon({
    url: BASE_URL,
    connections: 500, // Carga masiva
    pipelining: 1,  // Estresa el event loop de Node al máximo
    duration: 60,
    requests: [
      {
        method: 'POST',
        path: '/api/v1/short',
        headers: { 'content-type': 'application/json' },
        // Usamos una URL dinámica para forzar que Nanoid siempre trabaje
        setupRequest: (req) => {
          req.body = JSON.stringify({ orig_url: `https://stress-test.com/${generateShortId(8)}` });
          return req;
        },
        // @ts-ignore
        onResponse: (status, body, context: any) => {
          if (status === 200 || status === 201) {
            try {
              const data = JSON.parse(body.toString());
              context.shortPath = new URL(data.data.url_acortada).pathname;
            } catch (e) {
              context.shortPath = null;
            }
          }
        }
      },
      {
        method: 'GET', 
        // @ts-ignore
        setupRequest: (request, context: any) => {
          request.path = context.shortPath || '/error-no-id';
          return request;
        }
      }
    ]
  }, (err, result) => {
    if (err) {
      log.error('❌ Error crítico durante el ataque de estrés:', err);
    } else {
      log.info('\n💀 INFORME FINAL DE DAÑOS (POST+GET Encadenados):');
      log.info(`- Peticiones Totales: ${result.requests.total}`);
      log.info(`- Rendimiento: ${result.requests.average} peticiones/seg`);
      log.info(`- Latencia Promedio: ${result.latency.average} ms`);
      log.info(`- Latencia Máxima: ${result.latency.max} ms`);
      
      log.info('\n🔍 ESTADO DE RESPUESTAS:');
      log.info(`- [2xx] Creaciones Exitosas: ${result['2xx']}`);
      log.info(`- [3xx] Redirecciones Exitosas: ${result['3xx']}`);
      log.info(`- [4xx] Client Errors (Rate Limits, etc): ${result['4xx']}`);
      log.info(`- [5xx] Server Errors (DB Busy, Nanoid Fail): ${result['5xx']}`);
      
      if (result['5xx'] > 0 || result.errors > 0) {
        log.error(`\n🚨 ¡EL SISTEMA SE HA RENDIDO! Se detectaron ${result['5xx']} errores de servidor.`);
        log.info('Tip: Revisa los logs de "Database is locked" o "Too many open files".');
      } else if (result['4xx'] > 0) {
        log.warn(`\n⚠️  El sistema está bloqueando peticiones (4xx). Revisa tus middlewares de Rate Limiting.`);
      } else {
        log.info('\n🛡️  ¡IMPRESIONANTE! Tu lógica de Nanoid y persistencia ha aguantado el ataque sin un solo fallo.');
      }
    }
  });

  autocannon.track(instance, { renderProgressBar: true });
}

runHeavyStress();
