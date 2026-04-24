/**
 * Plugin logger.
 *
 * Host can inject its own logger via SensoryPluginConfig.logger.
 * Falls back to pino with 'sensory-plugin' tag.
 */

import pino from 'pino';

export interface Logger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

let rootLogger: Logger | null = null;

export function setLogger(logger: Logger): void {
  rootLogger = logger;
}

export function createLogger(service: string): Logger {
  if (rootLogger) {
    return {
      info: (obj, msg) => rootLogger!.info({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
      warn: (obj, msg) => rootLogger!.warn({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
      error: (obj, msg) => rootLogger!.error({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
      debug: (obj, msg) => rootLogger!.debug({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
    };
  }
  // Fallback: pino
  const logger = pino({
    name: 'sensory-plugin',
    level: process.env.LOG_LEVEL || 'info',
  });
  return {
    info: (obj, msg) => logger.info({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
    warn: (obj, msg) => logger.warn({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
    error: (obj, msg) => logger.error({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
    debug: (obj, msg) => logger.debug({ service, ...(typeof obj === 'object' ? obj : { obj }) }, msg),
  };
}
