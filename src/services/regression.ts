/**
 * Sensory Regression + Drift Detection
 *
 * Two related purposes:
 *   1. REGRESSION — locked "gold standard" recipes with expected profiles.
 *      Run after any rule/data change to confirm we haven't broken anything.
 *
 *   2. DRIFT — scheduled comparison of current recipe profiles vs baseline.
 *      Flags unexpected changes for admin review.
 *
 * Both use the SensoryRegressionFixture table (created in Phase 1 schema).
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { getHost } from '../lib/host-adapter';
import { composeRecipeSensoryV2 } from './compound-engine';

const log = createLogger('sensory-regression');

// ── Types ────────────────────────────────────────────────────────────────

export interface FixtureLockInput {
  recipeId: string;
  expectedArchetype?: string;
  toleranceOverrides?: Record<number, number>; // dimIdx → custom tolerance
  description?: string;
  lockedBy: string; // admin userId
}

export interface RegressionResult {
  recipeId: string;
  title: string;
  status: 'pass' | 'fail' | 'drift_warning';
  dimFailures: Array<{
    dimIdx: number;
    dimName: string;
    expected: number;
    actual: number;
    tolerance: number;
    delta: number;
  }>;
  archetypeFailure?: { expected: string; actual: string | null };
  harmonyFailure?: { expected: number; actual: number; tolerance: number };
  totalDeviationScore: number; // sum of |delta| / tolerance, normalized
  checkedAt: Date;
}

// ── Lock a fixture ───────────────────────────────────────────────────────

/**
 * Lock a recipe as a regression fixture. Its current profile becomes
 * the expected profile going forward.
 */
export async function lockFixture(input: FixtureLockInput): Promise<void> {
  const recipe = await prisma.recipeSensorySnapshot.findUnique({
    where: { recipeId: input.recipeId },
    select: {
      recipeId: true,
      recipeTitle: true,
      sensoryProfile: true,
      harmonyScoreUniversal: true,
      dominantArchetype: true,
      detectedClashes: true,
      detectedEmergences: true,
    },
  });
  if (!recipe) throw new Error(`Recipe ${input.recipeId} not found`);
  if (!recipe.sensoryProfile || recipe.sensoryProfile.length === 0) {
    throw new Error(`Recipe ${input.recipeId} has no sensory profile (run v2 pipeline first)`);
  }

  // Default tolerance: 0.3 per dim (realistic variance for float values 0-6)
  // Finer for dims with low values, coarser for high-intensity dims
  const tolerance = new Array(recipe.sensoryProfile.length).fill(0);
  for (let i = 0; i < recipe.sensoryProfile.length; i++) {
    const v = recipe.sensoryProfile[i];
    tolerance[i] = input.toleranceOverrides?.[i] ?? Math.max(0.3, v * 0.15); // 15% of value or 0.3, whichever is larger
  }

  await prisma.sensoryRegressionFixture.upsert({
    where: { recipeId: recipe.recipeId },
    update: {
      expectedProfile: recipe.sensoryProfile,
      tolerance,
      expectedArchetype: input.expectedArchetype ?? recipe.dominantArchetype,
      expectedHarmony: recipe.harmonyScoreUniversal,
      expectedClashes: (recipe.detectedClashes as object) ?? undefined,
      expectedEmergences: (recipe.detectedEmergences as object) ?? undefined,
      lockedAt: new Date(),
      lockedBy: input.lockedBy,
      description: input.description,
    },
    create: {
      recipeId: recipe.recipeId,
      expectedProfile: recipe.sensoryProfile,
      tolerance,
      expectedArchetype: input.expectedArchetype ?? recipe.dominantArchetype,
      expectedHarmony: recipe.harmonyScoreUniversal,
      expectedClashes: (recipe.detectedClashes as object) ?? undefined,
      expectedEmergences: (recipe.detectedEmergences as object) ?? undefined,
      lockedAt: new Date(),
      lockedBy: input.lockedBy,
      description: input.description,
    },
  });

  log.info({ recipeId: recipe.recipeId, title: recipe.recipeTitle }, 'Locked as regression fixture');
}

// ── Run regression checks ────────────────────────────────────────────────

/**
 * Run all locked fixtures. For each: recompute profile, compare to expected.
 * Returns pass/fail details.
 */
export async function runRegressionSuite(
  options: { recompute?: boolean } = {}
): Promise<RegressionResult[]> {
  const fixtures = await prisma.sensoryRegressionFixture.findMany({
    select: {
      recipeId: true,
      expectedProfile: true,
      tolerance: true,
      expectedArchetype: true,
      expectedHarmony: true,
    },
  });

  const dimNames = await prisma.sensoryDimensionConfig.findMany({
    where: { isActive: true },
    select: { dimension: true, name: true },
  });
  const nameMap = new Map(dimNames.map((d) => [d.dimension, d.name]));

  const results: RegressionResult[] = [];

  for (const fixture of fixtures) {
    const recipe = await prisma.recipeSensorySnapshot.findUnique({
      where: { recipeId: fixture.recipeId },
      select: {
        recipeId: true,
        recipeTitle: true,
        sensoryProfile: true,
        harmonyScoreUniversal: true,
        dominantArchetype: true,
      },
    });
    if (!recipe) {
      log.warn({ recipeId: fixture.recipeId }, 'Fixture recipe not found');
      continue;
    }

    // Recompute if requested (otherwise use stored)
    let actualProfile = recipe.sensoryProfile;
    let actualHarmony = recipe.harmonyScoreUniversal;
    let actualArchetype = recipe.dominantArchetype;

    if (options.recompute) {
      const hostRecipe = await getHost().getRecipe(recipe.recipeId);
      if (!hostRecipe) {
        log.warn({ recipeId: recipe.recipeId }, 'Host recipe missing for recompute — skipping');
        continue;
      }
      const result = await composeRecipeSensoryV2(
        hostRecipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, role: i.role ?? null })),
        hostRecipe.instructions,
        hostRecipe.title
      );
      actualProfile = result.profile;
      actualHarmony = result.harmonyUniversal;
      actualArchetype = result.dominantArchetype;
    }

    const dimFailures: RegressionResult['dimFailures'] = [];
    let totalDeviationScore = 0;
    let dimsChecked = 0;

    for (let i = 0; i < fixture.expectedProfile.length; i++) {
      const expected = fixture.expectedProfile[i];
      const actual = actualProfile[i] ?? 0;
      const tolerance = fixture.tolerance[i] ?? 0.3;
      const delta = Math.abs(actual - expected);

      if (expected > 0 || actual > 0) dimsChecked++;

      if (delta > tolerance) {
        dimFailures.push({
          dimIdx: i,
          dimName: nameMap.get(i) ?? `dim${i}`,
          expected,
          actual,
          tolerance,
          delta,
        });
        totalDeviationScore += delta / tolerance;
      }
    }

    totalDeviationScore = dimsChecked > 0 ? totalDeviationScore / dimsChecked : 0;

    const archetypeFailure =
      fixture.expectedArchetype && fixture.expectedArchetype !== actualArchetype
        ? { expected: fixture.expectedArchetype, actual: actualArchetype }
        : undefined;

    const harmonyTolerance = 0.1;
    const harmonyFailure =
      fixture.expectedHarmony != null &&
      Math.abs((actualHarmony ?? 1.0) - fixture.expectedHarmony) > harmonyTolerance
        ? { expected: fixture.expectedHarmony, actual: actualHarmony ?? 0, tolerance: harmonyTolerance }
        : undefined;

    let status: 'pass' | 'fail' | 'drift_warning';
    if (dimFailures.length === 0 && !archetypeFailure && !harmonyFailure) {
      status = 'pass';
    } else if (dimFailures.length < 3 && !archetypeFailure && !harmonyFailure) {
      status = 'drift_warning';
    } else {
      status = 'fail';
    }

    results.push({
      recipeId: recipe.recipeId,
      title: recipe.recipeTitle,
      status,
      dimFailures,
      archetypeFailure,
      harmonyFailure,
      totalDeviationScore,
      checkedAt: new Date(),
    });

    // Update fixture with verification status
    await prisma.sensoryRegressionFixture.update({
      where: { recipeId: recipe.recipeId },
      data: {
        lastVerifiedAt: new Date(),
        lastVerifiedStatus: status === 'pass' ? 'pass' : 'fail',
      },
    });
  }

  return results;
}

// ── Drift detection (scheduled) ──────────────────────────────────────────

/**
 * Detect drift across all recipes with stored profiles.
 * Compares current profile vs last-computed by the same ruleset version.
 * If ruleset version changed, profile changes are expected — not drift.
 *
 * Returns only recipes whose current profile diverges significantly
 * from their stored profile at same ruleset version.
 */
export interface DriftReport {
  recipeId: string;
  title: string;
  changedDims: Array<{ dimName: string; before: number; after: number; delta: number }>;
  maxDelta: number;
  driftSeverity: 'minor' | 'moderate' | 'major';
}

export async function detectDrift(options: { thresholdDelta?: number } = {}): Promise<DriftReport[]> {
  const threshold = options.thresholdDelta ?? 0.5;

  const recipes = await prisma.recipeSensorySnapshot.findMany({
    where: { computedByRulesetVersion: { not: null }, sensoryProfile: { isEmpty: false } },
    select: {
      recipeId: true,
      recipeTitle: true,
      sensoryProfile: true,
      computedByRulesetVersion: true,
    },
    take: 100, // cap per run
  });

  const dimNames = await prisma.sensoryDimensionConfig.findMany({
    where: { isActive: true },
    select: { dimension: true, name: true },
  });
  const nameMap = new Map(dimNames.map((d) => [d.dimension, d.name]));

  const reports: DriftReport[] = [];

  const host = getHost();
  for (const recipe of recipes) {
    // Fetch host recipe for recompute
    const hostRecipe = await host.getRecipe(recipe.recipeId);
    if (!hostRecipe) {
      log.debug({ recipeId: recipe.recipeId }, 'Host recipe missing — skipping drift check');
      continue;
    }
    const result = await composeRecipeSensoryV2(
      hostRecipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, role: i.role ?? null })),
      hostRecipe.instructions,
      hostRecipe.title
    );

    const changedDims: DriftReport['changedDims'] = [];
    let maxDelta = 0;

    for (let i = 0; i < recipe.sensoryProfile.length; i++) {
      const before = recipe.sensoryProfile[i];
      const after = result.profile[i] ?? 0;
      const delta = Math.abs(after - before);
      if (delta > threshold) {
        changedDims.push({
          dimName: nameMap.get(i) ?? `dim${i}`,
          before,
          after,
          delta,
        });
        if (delta > maxDelta) maxDelta = delta;
      }
    }

    if (changedDims.length === 0) continue;

    const driftSeverity: DriftReport['driftSeverity'] =
      maxDelta > 2 ? 'major' : maxDelta > 1 ? 'moderate' : 'minor';

    reports.push({
      recipeId: recipe.recipeId,
      title: recipe.recipeTitle,
      changedDims,
      maxDelta,
      driftSeverity,
    });
  }

  return reports;
}

// ── Bulk fixture creation ────────────────────────────────────────────────

/**
 * Auto-lock top N recipes by harmony score as regression fixtures.
 * Useful for bootstrapping the regression suite.
 */
export async function bootstrapFixtures(
  adminUserId: string,
  options: { count?: number; minHarmony?: number } = {}
): Promise<number> {
  const count = options.count ?? 10;
  const minHarmony = options.minHarmony ?? 0.8;

  const topRecipes = await prisma.recipeSensorySnapshot.findMany({
    where: {
      computedByRulesetVersion: 2,
      harmonyScoreUniversal: { gte: minHarmony },
      sensoryProfile: { isEmpty: false },
    },
    orderBy: { harmonyScoreUniversal: 'desc' },
    take: count,
    select: { recipeId: true, recipeTitle: true },
  });

  let locked = 0;
  for (const recipe of topRecipes) {
    try {
      await lockFixture({
        recipeId: recipe.recipeId,
        lockedBy: adminUserId,
        description: `Auto-bootstrap: ${recipe.recipeTitle}`,
      });
      locked++;
    } catch (err) {
      log.warn({ err, recipeId: recipe.recipeId }, 'Failed to lock fixture');
    }
  }

  return locked;
}

log.info('sensory-regression service loaded');
