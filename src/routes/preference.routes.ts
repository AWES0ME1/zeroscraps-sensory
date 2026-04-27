/**
 * User preference routes — factory that takes plugin context.
 */

import { Router, type Response, type Request, type RequestHandler } from 'express';
import type { HostAdapter } from '../host';
import {
  ONBOARDING_QUESTIONS,
  applyOnboardingAnswers,
  recordLike,
  recordDislike,
  getPreferenceSnapshot,
  setAvoidanceList,
  type OnboardingAnswer,
} from '../services/user-preference';
import { createLogger } from '../lib/logger';
import { auditEmit, withRequestContext } from '../lib/audit';

const log = createLogger('preference-routes');

export interface PreferenceRoutesContext {
  host: HostAdapter;
  authMiddleware: RequestHandler;
  rateLimiter: RequestHandler;
}

export function createPreferenceRouter(ctx: PreferenceRoutesContext): Router {
  const router = Router();
  const { host, authMiddleware, rateLimiter } = ctx;
  router.use(authMiddleware);

  // ── GET / ──
  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const snapshot = await getPreferenceSnapshot(userId);
      if (!snapshot) return res.json({ hasProfile: false });
      return res.json({ hasProfile: true, snapshot });
    } catch (err) {
      log.error({ err }, 'Get preferences failed');
      return res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  // ── GET /questions ──
  router.get('/questions', (_req: Request, res: Response) => {
    const publicQuestions = ONBOARDING_QUESTIONS.map((q) => ({
      key: q.key,
      text: q.text,
      type: q.type,
    }));
    return res.json({ questions: publicQuestions, count: publicQuestions.length });
  });

  // ── POST /onboard ──
  router.post('/onboard', rateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { answers } = req.body as { answers?: OnboardingAnswer[] };
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'answers[] required' });
      }

      for (const a of answers) {
        if (typeof a.questionKey !== 'string' || typeof a.score !== 'number') {
          return res.status(400).json({ error: 'Each answer needs questionKey + score' });
        }
        if (a.score < -2 || a.score > 2) {
          return res.status(400).json({ error: 'score must be between -2 and +2' });
        }
      }

      const snapshot = await applyOnboardingAnswers(userId, answers);
      await auditEmit(
        withRequestContext(req, {
          action: 'SENSORY_PREFERENCE_ONBOARDED',
          targetId: userId,
          metadata: { answerCount: answers.length },
        })
      );
      return res.json({ success: true, snapshot });
    } catch (err) {
      log.error({ err }, 'Onboarding failed');
      return res.status(500).json({ error: 'Onboarding failed' });
    }
  });

  // ── POST /like ──
  router.post('/like', rateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { recipeId } = req.body as { recipeId?: string };
      if (!recipeId || typeof recipeId !== 'string') {
        return res.status(400).json({ error: 'recipeId required' });
      }
      if (recipeId.length > 64) {
        return res.status(400).json({ error: 'recipeId too long' });
      }

      await recordLike(userId, recipeId);
      await auditEmit(
        withRequestContext(req, {
          action: 'SENSORY_PREFERENCE_LIKE',
          targetId: recipeId,
        })
      );
      return res.json({ success: true });
    } catch (err) {
      log.error({ err }, 'Like failed');
      return res.status(500).json({ error: 'Like failed' });
    }
  });

  // ── POST /dislike ──
  router.post('/dislike', rateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { recipeId } = req.body as { recipeId?: string };
      if (!recipeId || typeof recipeId !== 'string') {
        return res.status(400).json({ error: 'recipeId required' });
      }
      if (recipeId.length > 64) {
        return res.status(400).json({ error: 'recipeId too long' });
      }

      await recordDislike(userId, recipeId);
      await auditEmit(
        withRequestContext(req, {
          action: 'SENSORY_PREFERENCE_DISLIKE',
          targetId: recipeId,
        })
      );
      return res.json({ success: true });
    } catch (err) {
      log.error({ err }, 'Dislike failed');
      return res.status(500).json({ error: 'Dislike failed' });
    }
  });

  // ── PUT /avoid ──
  router.put('/avoid', rateLimiter, async (req: Request, res: Response) => {
    try {
      const userId = host.getUserId(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { avoid } = req.body as { avoid?: string[] };
      if (!Array.isArray(avoid)) {
        return res.status(400).json({ error: 'avoid[] required' });
      }
      if (avoid.length > 50) {
        return res.status(400).json({ error: 'Max 50 avoidance terms' });
      }
      // Each term must be a non-empty string, capped to a sane length.
      // Without this an attacker could submit 50 × 1MB strings.
      for (const term of avoid) {
        if (typeof term !== 'string' || term.length === 0 || term.length > 64) {
          return res.status(400).json({ error: 'Each avoidance term must be 1–64 chars' });
        }
      }

      const normalized = avoid.map((s) => s.toLowerCase().trim());
      await setAvoidanceList(userId, normalized);
      await auditEmit(
        withRequestContext(req, {
          action: 'SENSORY_PREFERENCE_AVOID_SET',
          targetId: userId,
          metadata: { count: normalized.length },
        })
      );
      return res.json({ success: true });
    } catch (err) {
      log.error({ err }, 'Set avoidance failed');
      return res.status(500).json({ error: 'Set avoidance failed' });
    }
  });

  return router;
}
