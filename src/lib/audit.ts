/**
 * Audit emitter — bridges plugin events to host's audit pipeline.
 *
 * Use `auditEmit({ action, ... })` everywhere the plugin does something
 * worth a forensic trail (admin actions, user preference writes, AI calls).
 * If the host didn't supply an `audit` adapter method, we fall through to
 * the plugin's pino logger so devs still see the event in console — but
 * there's no durable trail.
 *
 * Action namespace convention: `SENSORY_*`. Examples:
 *   SENSORY_RECOMPUTE_ALL_TRIGGERED
 *   SENSORY_RECOMPUTE_ALL_FINISHED
 *   SENSORY_SNAPSHOT_PERSISTED
 *   SENSORY_PREFERENCE_ONBOARDED
 *   SENSORY_PREFERENCE_LIKE
 *   SENSORY_PREFERENCE_DISLIKE
 *   SENSORY_PREFERENCE_AVOID_SET
 *   SENSORY_AI_ENHANCEMENT_RUN
 */

import type { Request } from 'express';
import { getHost } from './host-adapter';
import { createLogger } from './logger';
import type { SensoryAuditEvent } from '../host';

const log = createLogger('audit');

/**
 * Emit a single audit event. Never throws — audit must not break the
 * underlying business operation.
 */
export async function auditEmit(event: SensoryAuditEvent): Promise<void> {
  try {
    const host = getHost();
    if (host.audit) {
      await Promise.resolve(host.audit(event));
      return;
    }
    // Fallback: log the event so dev sees it. Production should always
    // configure host.audit so we have a durable trail.
    log.info({ event }, 'audit event (no host.audit configured — pino-only)');
  } catch (err) {
    log.warn({ err, event }, 'audit emit failed (non-fatal)');
  }
}

/** Pull standard request context (actorId, ip, userAgent) into an event. */
export function withRequestContext(
  req: Request,
  partial: Omit<SensoryAuditEvent, 'actorId' | 'ip' | 'userAgent'>
): SensoryAuditEvent {
  const host = getHost();
  return {
    ...partial,
    actorId: host.getUserId(req),
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  };
}
