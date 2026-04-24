/**
 * Sensory search routes — factory that takes plugin context.
 *
 * Endpoints (mounted under `${mountPrefix}`):
 *   POST /search                — query-based recipe search
 *   GET  /similar/:recipeId     — "more like this"
 *   GET  /substitutes/:ingredient
 *   GET  /complements/:ingredient
 */

import { Router, type Response, type Request, type RequestHandler } from 'express';
import type { HostAdapter } from '../host';
import {
  findRecipesByQuery,
  findSimilarRecipes,
  findSubstitutes,
  findComplements,
} from '../services/match';
import { createLogger } from '../lib/logger';

const log = createLogger('search-routes');

export interface SearchRoutesContext {
  host: HostAdapter;
  authMiddleware: RequestHandler;
  rateLimiter: RequestHandler;
}

export function createSearchRouter(ctx: SearchRoutesContext): Router {
  const router = Router();
  const { host, authMiddleware, rateLimiter } = ctx;

  router.use(authMiddleware);

  // ── POST /search ──
  router.post('/search', rateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      const { query, limit, cuisineFilter, courseFilter, minHarmony } = req.body as {
        query?: string;
        limit?: number;
        cuisineFilter?: string;
        courseFilter?: string;
        minHarmony?: number;
      };

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query required' });
      }
      if (query.length > 500) {
        return res.status(400).json({ error: 'Query too long (max 500 chars)' });
      }

      const { parsed, results } = await findRecipesByQuery(query, {
        userId,
        limit: Math.min(limit ?? 20, 50),
        cuisineFilter,
        courseFilter,
        minHarmony,
        includeExplanation: true,
      });

      return res.json({
        query,
        parsed: {
          mustHave: parsed.mustHave,
          mustAvoid: parsed.mustAvoid,
          unresolved: parsed.unresolved,
          cuisineContext: parsed.cuisineContext,
          courseHint: parsed.courseHint,
          temperatureHint: parsed.temperatureHint,
        },
        results,
        count: results.length,
      });
    } catch (err) {
      log.error({ err }, 'Search endpoint failed');
      return res.status(500).json({ error: 'Search failed' });
    }
  });

  // ── GET /similar/:recipeId ──
  router.get('/similar/:recipeId', rateLimiter, async (req: Request, res: Response) => {
    try {
      const recipeId = String(req.params.recipeId ?? '');
      const limit = Math.min(parseInt(String(req.query.limit ?? ''), 10) || 10, 30);
      const userId = host.getUserId(req);

      if (!recipeId || recipeId.length < 10) {
        return res.status(400).json({ error: 'Valid recipeId required' });
      }

      const results = await findSimilarRecipes(recipeId, { limit, userId });
      return res.json({ recipeId, count: results.length, results });
    } catch (err) {
      log.error({ err }, 'Similar endpoint failed');
      return res.status(500).json({ error: 'Similar search failed' });
    }
  });

  // ── GET /substitutes/:ingredient ──
  router.get('/substitutes/:ingredient', rateLimiter, async (req: Request, res: Response) => {
    try {
      const ingredient = decodeURIComponent(String(req.params.ingredient ?? '')).trim();
      const limit = Math.min(parseInt(String(req.query.limit ?? ''), 10) || 5, 20);

      if (!ingredient || ingredient.length > 100) {
        return res.status(400).json({ error: 'Valid ingredient name required' });
      }

      const substitutes = await findSubstitutes(ingredient, { limit });
      return res.json({ ingredient, count: substitutes.length, substitutes });
    } catch (err) {
      log.error({ err }, 'Substitutes endpoint failed');
      return res.status(500).json({ error: 'Substitute search failed' });
    }
  });

  // ── GET /complements/:ingredient ──
  router.get('/complements/:ingredient', rateLimiter, async (req: Request, res: Response) => {
    try {
      const ingredient = decodeURIComponent(String(req.params.ingredient ?? '')).trim();
      const limit = Math.min(parseInt(String(req.query.limit ?? ''), 10) || 10, 25);

      if (!ingredient || ingredient.length > 100) {
        return res.status(400).json({ error: 'Valid ingredient name required' });
      }

      const complements = await findComplements(ingredient, limit);
      return res.json({ ingredient, count: complements.length, complements });
    } catch (err) {
      log.error({ err }, 'Complements endpoint failed');
      return res.status(500).json({ error: 'Complement search failed' });
    }
  });

  return router;
}
