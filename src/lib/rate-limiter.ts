/**
 * Basic in-memory rate limiter — plugin's default implementation.
 *
 * Host can override via SensoryPluginConfig.createRateLimiter() for
 * distributed (Redis-backed) rate limiting. This fallback is good enough
 * for single-process deployments.
 */

import type { RequestHandler, Request } from 'express';

interface Entry {
  count: number;
  resetAt: number;
}

interface Opts {
  windowMs: number;
  maxAttempts: number;
  keyGenerator: (req: Request) => string;
  prefix: string;
}

const store = new Map<string, Entry>();

// Cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
}, 60_000).unref();

export function createRateLimiter(opts: Opts): RequestHandler {
  return (req, res, next) => {
    const key = `${opts.prefix}:${opts.keyGenerator(req)}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.maxAttempts) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }
    next();
  };
}
