/**
 * Host interface.
 *
 * The plugin doesn't import anything from the host's codebase.
 * Instead, the host provides a `HostAdapter` at plugin construction time.
 * All cross-boundary calls go through this interface.
 */

import type { RequestHandler, Request } from 'express';

export interface HostRecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  role?: string | null;
}

export interface HostRecipeInstruction {
  stepNumber?: number;
  text: string;
}

export interface HostRecipe {
  id: string;
  title: string;
  ingredients: HostRecipeIngredient[];
  instructions: HostRecipeInstruction[];
}

/**
 * An audit event the plugin asks the host to record. The host owns the audit
 * table, retention, and dashboards; the plugin only emits semantic events with
 * a stable action namespace.
 *
 * Action conventions: SCREAMING_SNAKE prefixed with SENSORY_ so the host can
 * filter plugin events from native ones. Plugin should never emit unprefixed
 * actions.
 */
export interface SensoryAuditEvent {
  action: string;                                // e.g. "SENSORY_RECOMPUTE_ALL_TRIGGERED"
  actorId?: string;                              // userId of the requester (omit if system/cron)
  targetId?: string;                             // recipeId / userId being acted on
  ip?: string;                                   // client IP for forensics
  userAgent?: string;
  metadata?: Record<string, unknown>;            // action-specific context
}

export interface HostAdapter {
  /**
   * Fetch a recipe by ID from the host's database.
   * Plugin uses this to read Recipe.ingredients + instructions for profile computation.
   * Return null if recipe not found or not accessible.
   */
  getRecipe(recipeId: string): Promise<HostRecipe | null>;

  /**
   * Fetch recipe IDs matching basic filters (for enumeration during bulk jobs).
   */
  listRecipeIds(filter?: { limit?: number; offset?: number }): Promise<string[]>;

  /**
   * Extract userId from a request. Used for rate limiting, auth-dependent features.
   * Return undefined for anonymous requests.
   */
  getUserId(req: Request): string | undefined;

  /**
   * Optional: record an audit event in the host's audit log.
   * Plugin emits these on admin actions and write paths; host owns
   * persistence/retention/forensics. If unset, plugin falls back to its own
   * pino log (visibility only — no durable trail).
   */
  audit?: (event: SensoryAuditEvent) => void | Promise<void>;

  /**
   * Optional: per-user/system budget check before the plugin spends OpenAI tokens.
   * Implementations should be cheap (Redis incr) — called on every AI call site.
   * Return `{ allowed: false, reason }` to short-circuit and avoid the API call.
   * If unset, plugin allows all calls (existing OpenAI client circuit breaker
   * remains the only backstop).
   */
  checkAiBudget?: (input: {
    userId?: string;
    operation: 'enhance' | 'embed' | 'parse';
    estimatedCostUsd?: number;
  }) => Promise<{ allowed: boolean; reason?: string }>;
}

export interface SensoryPluginConfig {
  /** PostgreSQL connection string. Plugin creates its own Prisma client against this DB. */
  databaseUrl: string;

  /** Host adapter — plugin calls host for recipe data, user ID, etc. */
  host: HostAdapter;

  /** Auth middleware from host. Applied to plugin's protected routes. */
  authMiddleware: RequestHandler;

  /** Optional: Azure OpenAI config for AI enhancer. Without it, AI features no-op. */
  azureOpenAI?: {
    endpoint: string;
    apiKey: string;
    deployment?: string;
    apiVersion?: string;
    timeoutMs?: number;
  };

  /** Optional: rate limiter factory. If not provided, plugin uses a basic in-memory limiter. */
  createRateLimiter?: (opts: {
    windowMs: number;
    maxAttempts: number;
    keyGenerator: (req: Request) => string;
    prefix: string;
  }) => RequestHandler;

  /** Optional: admin gate middleware. Required to expose admin routes (recompute-all, etc.). */
  requireAdmin?: RequestHandler;

  /**
   * Optional: step-up auth gate (e.g. host's `requireAdminElevation()`).
   * Applied AFTER requireAdmin to destructive admin routes such as recompute-all.
   * Read-only admin routes (like snapshot-stats) skip this so dashboards don't
   * trigger re-elevation every poll.
   */
  requireAdminElevation?: RequestHandler;

  /** Optional: custom logger. Default: pino with 'sensory-plugin' tag. */
  logger?: import('./lib/logger').Logger;

  /** Optional: mount prefix for plugin routes. Default: '/api/sensory'. */
  mountPrefix?: string;

  /** Optional: disable specific features. */
  features?: {
    search?: boolean;
    preferences?: boolean;
    aiEnhancer?: boolean;
    admin?: boolean;
  };
}
