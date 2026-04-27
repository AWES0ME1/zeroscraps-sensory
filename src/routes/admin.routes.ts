/**
 * Admin operational routes for the sensory plugin.
 *
 * Mounted at `${mountPrefix}/admin` (default: /api/sensory/admin).
 * Gated behind host's authMiddleware + requireAdmin.
 */

import { Router, type RequestHandler, type Request, type Response } from 'express';
import type { HostAdapter } from '../host';
import { createLogger } from '../lib/logger';
import { composeRecipeSensoryV2, persistV2Result } from '../services/compound-engine';

const log = createLogger('admin-routes');

export interface AdminRoutesContext {
  host: HostAdapter;
  authMiddleware: RequestHandler;
  requireAdmin: RequestHandler;
  rateLimiter: RequestHandler;
}

export function createAdminRouter(ctx: AdminRoutesContext): Router {
  const r = Router();
  r.use(ctx.authMiddleware);
  r.use(ctx.requireAdmin);
  r.use(ctx.rateLimiter);

  /**
   * POST /admin/recompute-all
   *
   * Drains every recipe through the plugin's compute engine to refresh
   * RecipeSensorySnapshot rows. Returns immediately after queueing — work
   * runs in-process with a small concurrency cap so we don't hammer the DB.
   *
   * Body (optional): { batchSize?: number, concurrency?: number, limit?: number }
   */
  r.post('/recompute-all', async (req: Request, res: Response): Promise<void> => {
    const batchSize = Math.min(Number(req.body?.batchSize ?? 50), 500);
    const concurrency = Math.min(Math.max(Number(req.body?.concurrency ?? 4), 1), 16);
    const limit = req.body?.limit ? Number(req.body.limit) : undefined;

    log.info({ batchSize, concurrency, limit }, 'recompute-all kickoff');

    // Fire-and-forget so the HTTP request returns immediately.
    void (async () => {
      let offset = 0;
      let processed = 0;
      let failed = 0;
      const startedAt = Date.now();
      while (true) {
        const ids = await ctx.host.listRecipeIds({ limit: batchSize, offset });
        if (ids.length === 0) break;
        if (limit && processed >= limit) break;

        // Concurrency-limited Promise.all over the batch
        let i = 0;
        const workers = Array.from({ length: concurrency }, async () => {
          while (true) {
            const idx = i++;
            if (idx >= ids.length) return;
            if (limit && processed >= limit) return;
            const recipeId = ids[idx];
            try {
              const recipe = await ctx.host.getRecipe(recipeId);
              if (!recipe) return;
              const result = await composeRecipeSensoryV2(
                recipe.ingredients.map((ing) => ({
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit,
                  role: ing.role ?? undefined,
                })),
                recipe.instructions.map((inst) => ({ stepNumber: inst.stepNumber, text: inst.text })),
                recipe.title
              );
              await persistV2Result(recipeId, recipe.title, result);
              processed++;
            } catch (err) {
              failed++;
              log.warn({ err, recipeId }, 'recompute-all: per-recipe failure (skipped)');
            }
          }
        });
        await Promise.all(workers);
        offset += ids.length;
      }
      log.info(
        { processed, failed, durationMs: Date.now() - startedAt },
        'recompute-all complete'
      );
    })().catch((err) => log.error({ err }, 'recompute-all worker crashed'));

    res.status(202).json({
      status: 'accepted',
      message: 'Recompute started in background. Watch logs for progress.',
      batchSize,
      concurrency,
      limit: limit ?? null,
    });
  });

  /**
   * GET /admin/snapshot-stats
   *
   * Quick health check: total snapshots, ruleset versions, vector populated count.
   * Useful before/after recompute-all to verify progress.
   */
  r.get('/snapshot-stats', async (_req: Request, res: Response): Promise<void> => {
    try {
      // Lazy-import prisma so this module can be imported in environments
      // that haven't initialized DATABASE_URL yet (e.g. when index.ts re-exports).
      const { default: prisma } = await import('../lib/prisma');
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE sensory_vector IS NOT NULL)::int AS with_vector,
           COUNT(*) FILTER (WHERE harmony_score_universal IS NOT NULL)::int AS with_harmony,
           COUNT(DISTINCT computed_by_ruleset_version)::int AS distinct_versions,
           MAX(computed_at)::text AS latest_computed_at
         FROM sensory.recipe_snapshots`
      )) as Array<{
        total: number;
        with_vector: number;
        with_harmony: number;
        distinct_versions: number;
        latest_computed_at: string | null;
      }>;
      res.json(rows[0]);
    } catch (err) {
      log.error({ err }, 'snapshot-stats failed');
      res.status(500).json({ error: 'snapshot stats unavailable' });
    }
  });

  return r;
}
