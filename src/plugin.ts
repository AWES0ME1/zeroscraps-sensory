/**
 * Sensory Plugin Factory.
 *
 * This is the single entry point hosts use to integrate the plugin.
 *
 * Example (host's index.ts):
 *
 *   import { createSensoryPlugin } from '@zeroscraps/sensory';
 *   const plugin = createSensoryPlugin({
 *     databaseUrl: process.env.DATABASE_URL,
 *     host: { getRecipe, listRecipeIds, getUserId },
 *     authMiddleware,
 *     azureOpenAI: { endpoint, apiKey, deployment: 'gpt-4.1-mini' },
 *   });
 *   plugin.register(app);
 */

import type { Express, RequestHandler, Request } from 'express';
import type { SensoryPluginConfig } from './host';
import { setHost } from './lib/host-adapter';
import { setLogger, createLogger } from './lib/logger';
import { configureOpenAI } from './lib/openai';
import { createRateLimiter as defaultRateLimiter } from './lib/rate-limiter';
import prisma, { disconnectPrisma } from './lib/prisma';
import { createSearchRouter } from './routes/search.routes';
import { createPreferenceRouter } from './routes/preference.routes';
import { createAdminRouter } from './routes/admin.routes';

// Re-export service-level helpers so hosts can call them directly
export {
  composeRecipeSensoryV2,
  persistV2Result,
  invalidateV2Cache,
} from './services/compound-engine';
export type { V2Result, V2IngredientInput, V2Instruction } from './services/compound-engine';
export {
  findRecipesByQuery,
  findSimilarRecipes,
  findSubstitutes,
  findComplements,
} from './services/match';
export { parseQuery, explainQuery } from './services/query-parser';
export {
  lockFixture,
  runRegressionSuite,
  detectDrift,
  bootstrapFixtures,
} from './services/regression';
export {
  applyOnboardingAnswers,
  recordLike,
  recordDislike,
  getPreferenceSnapshot,
  setAvoidanceList,
  ONBOARDING_QUESTIONS,
} from './services/user-preference';
export { runEnhancement, findGaps } from './services/ai-enhancer';
export type { SensoryPluginConfig, HostAdapter, HostRecipe } from './host';

export interface SensoryPlugin {
  /** Mount routes on the provided Express app. Idempotent within one plugin instance. */
  register(app: Express): void;
  /** Clean disconnect. Call when the plugin is unloaded or the server is shutting down. */
  shutdown(): Promise<void>;
  /** Plugin version string. */
  version: string;
  /** Mount prefix used for route registration. */
  mountPrefix: string;
}

const PLUGIN_VERSION = '0.1.0';

export function createSensoryPlugin(config: SensoryPluginConfig): SensoryPlugin {
  // Load env if caller hasn't already
  if (config.databaseUrl) {
    process.env.DATABASE_URL = config.databaseUrl;
  }

  // Logger
  if (config.logger) {
    setLogger(config.logger);
  }
  const log = createLogger('plugin');

  // Host adapter
  if (!config.host) {
    throw new Error('SensoryPluginConfig.host is required');
  }
  setHost(config.host);

  // Azure OpenAI (optional)
  if (config.azureOpenAI) {
    configureOpenAI({
      endpoint: config.azureOpenAI.endpoint,
      apiKey: config.azureOpenAI.apiKey,
      deployment: config.azureOpenAI.deployment,
      apiVersion: config.azureOpenAI.apiVersion,
      timeoutMs: config.azureOpenAI.timeoutMs,
    });
  }

  // Rate limiter: host-provided or plugin default
  const makeLimiter = (prefix: string, maxAttempts: number): RequestHandler => {
    const keyGenerator = (req: Request) => config.host.getUserId(req) ?? req.ip ?? 'anon';
    if (config.createRateLimiter) {
      return config.createRateLimiter({ windowMs: 60_000, maxAttempts, keyGenerator, prefix });
    }
    return defaultRateLimiter({ windowMs: 60_000, maxAttempts, keyGenerator, prefix });
  };

  const mountPrefix = config.mountPrefix ?? '/api/sensory';
  const features = {
    search: config.features?.search ?? true,
    preferences: config.features?.preferences ?? true,
    aiEnhancer: config.features?.aiEnhancer ?? true,
    admin: (config.features?.admin ?? true) && !!config.requireAdmin,
  };

  let mounted = false;

  const plugin: SensoryPlugin = {
    version: PLUGIN_VERSION,
    mountPrefix,
    register(app: Express) {
      if (mounted) {
        log.warn({}, 'Plugin already registered — skipping duplicate register()');
        return;
      }

      if (features.search) {
        const searchMax = parseInt(process.env.SENSORY_RATE_LIMIT_SEARCH_PER_MIN || '60', 10);
        app.use(
          mountPrefix,
          createSearchRouter({
            host: config.host,
            authMiddleware: config.authMiddleware,
            rateLimiter: makeLimiter('rl:sensory-search', searchMax),
          })
        );
        log.info({ mount: mountPrefix }, 'Search routes registered');
      }

      if (features.preferences) {
        const writeMax = parseInt(process.env.SENSORY_RATE_LIMIT_WRITE_PER_MIN || '30', 10);
        app.use(
          `${mountPrefix}/preferences`,
          createPreferenceRouter({
            host: config.host,
            authMiddleware: config.authMiddleware,
            rateLimiter: makeLimiter('rl:sensory-pref', writeMax),
          })
        );
        log.info({ mount: `${mountPrefix}/preferences` }, 'Preference routes registered');
      }

      if (features.admin && config.requireAdmin) {
        const adminMax = parseInt(process.env.SENSORY_RATE_LIMIT_ADMIN_PER_MIN || '5', 10);
        app.use(
          `${mountPrefix}/admin`,
          createAdminRouter({
            host: config.host,
            authMiddleware: config.authMiddleware,
            requireAdmin: config.requireAdmin,
            requireAdminElevation: config.requireAdminElevation,
            rateLimiter: makeLimiter('rl:sensory-admin', adminMax),
          })
        );
        log.info(
          {
            mount: `${mountPrefix}/admin`,
            elevation: !!config.requireAdminElevation,
          },
          'Admin routes registered'
        );
      } else if (features.admin && !config.requireAdmin) {
        log.warn({}, 'features.admin enabled but config.requireAdmin not provided — admin routes NOT mounted');
      }

      mounted = true;
      log.info(
        {
          version: PLUGIN_VERSION,
          features,
          mountPrefix,
          openaiEnabled: !!config.azureOpenAI,
        },
        '@zeroscraps/sensory plugin registered'
      );
    },
    async shutdown() {
      await disconnectPrisma();
      log.info({}, 'Plugin shutdown complete');
    },
  };

  return plugin;
}

// Expose the prisma client for scripts
export { prisma };
