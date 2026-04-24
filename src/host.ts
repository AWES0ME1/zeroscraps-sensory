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

  /** Optional: custom logger. Default: pino with 'sensory-plugin' tag. */
  logger?: import('./lib/logger').Logger;

  /** Optional: mount prefix for plugin routes. Default: '/api/sensory'. */
  mountPrefix?: string;

  /** Optional: disable specific features. */
  features?: {
    search?: boolean;
    preferences?: boolean;
    aiEnhancer?: boolean;
  };
}
