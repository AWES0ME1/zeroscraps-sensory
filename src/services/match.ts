/**
 * Sensory Match Service — the user-facing "find recipes I'll like" engine.
 *
 * Brings together:
 *   - Query parsing (sensory-query-parser.service.ts)
 *   - Stored v2 recipe profiles (Recipe.sensoryProfile 113-dim)
 *   - Harmony scores (universal + cuisine)
 *   - User preferences (UserSensoryPreference) for personalized ranking
 *
 * Four query entry points:
 *   findRecipesByQuery()  — natural language: "funky and crunchy"
 *   findSimilarRecipes()  — "more like this"
 *   findSubstitutes()     — "what can I swap for X?"
 *   findComplements()     — "what pairs with X?"
 *
 * Each returns a ranked list with explanations.
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { parseQuery, type ParsedQuery } from './query-parser';

const log = createLogger('sensory-match');
const SENSORY_DIM_COUNT = 113;

// ── Types ────────────────────────────────────────────────────────────────

export interface MatchedRecipe {
  recipeId: string;
  title: string;
  similarity: number;          // cosine sim vs query vector (0-1)
  harmonyScore: number;        // 0-1 (universal or cuisine-specific)
  personalBoost: number;       // 0 if no user profile, else +/- contribution
  finalScore: number;          // combined rank score
  explanation: {
    matchingDims: Array<{ name: string; recipeValue: number; queryValue: number }>;
    archetype: string | null;
    emergences: string[];
    clashes: string[];
    penaltyFromAvoidance: number;
  };
  // Snapshot of stored metadata
  dominantArchetype: string | null;
  cuisineTags: string[];
  courseType: string | null;
  isRich: boolean;
  isCrunchy: boolean;
  isSpicy: boolean;
  isCreamy: boolean;
}

export interface MatchOptions {
  limit?: number;
  cuisineFilter?: string;        // restrict to recipes with this tag
  courseFilter?: string;
  userId?: string;               // apply UserSensoryPreference if set
  minHarmony?: number;           // exclude recipes below this harmony score
  includeExplanation?: boolean;  // default true
}

export interface DimName {
  idx: number;
  name: string;
}

// Load dim names once at startup (cached)
let dimNameCache: Map<number, string> | null = null;
async function getDimNames(): Promise<Map<number, string>> {
  if (dimNameCache) return dimNameCache;
  const dims = await prisma.sensoryDimensionConfig.findMany({
    where: { isActive: true },
    select: { dimension: true, name: true },
  });
  dimNameCache = new Map(dims.map((d) => [d.dimension, d.name]));
  return dimNameCache;
}

// ── Cosine similarity ────────────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Avoidance penalty calculator ─────────────────────────────────────────

function computeAvoidancePenalty(avoidanceVector: number[], recipeProfile: number[]): number {
  let penalty = 0;
  const len = Math.min(avoidanceVector.length, recipeProfile.length);
  for (let i = 0; i < len; i++) {
    if (avoidanceVector[i] > 0.3 && recipeProfile[i] > 2.0) {
      // Penalty scales with both avoidance weight and recipe dim intensity
      penalty += avoidanceVector[i] * (recipeProfile[i] / 6) * 0.5;
    }
  }
  return Math.min(penalty, 1.0);
}

// ── Personalized boost ───────────────────────────────────────────────────

async function computePersonalBoost(
  userId: string,
  recipeProfile: number[],
  recipeId: string
): Promise<number> {
  const pref = await prisma.userSensoryPreference.findUnique({
    where: { userId },
    select: { preferences: true, weights: true, likedRecipeIds: true, dislikedRecipeIds: true },
  });

  if (!pref || pref.preferences.length === 0) return 0;

  // If user has explicitly liked this recipe, max boost
  if (pref.likedRecipeIds.includes(recipeId)) return 0.3;
  if (pref.dislikedRecipeIds.includes(recipeId)) return -0.3;

  // Compute weighted dot product
  let boost = 0;
  const len = Math.min(pref.preferences.length, recipeProfile.length);
  for (let i = 0; i < len; i++) {
    const weight = pref.weights[i] ?? 0.5;
    const userPref = pref.preferences[i] ?? 0;
    const recipeVal = recipeProfile[i] ?? 0;
    // Positive when user likes and recipe has it, negative when user dislikes but recipe has it
    boost += userPref * (recipeVal / 6) * weight * 0.1;
  }

  return Math.max(-0.3, Math.min(0.3, boost));
}

// ── Query-based recipe search ────────────────────────────────────────────

/**
 * Primary entry point: natural language query → ranked recipes.
 *
 * Uses pgvector's `<=>` cosine-distance operator for an indexable ANN scan
 * over candidates, then re-ranks the top-K in JS to apply harmony,
 * personalization, and avoidance penalties (which need the full Float[]).
 *
 * Example:
 *   findRecipesByQuery("funky and crunchy, not too spicy", { userId: "..." })
 */
export async function findRecipesByQuery(
  query: string,
  options: MatchOptions = {}
): Promise<{ parsed: ParsedQuery; results: MatchedRecipe[] }> {
  const limit = options.limit ?? 20;
  const minHarmony = options.minHarmony ?? 0.3;

  // 1. Parse query
  const parsed = await parseQuery(query);

  // 2. Use cuisine from query if not overridden
  const effectiveCuisine = options.cuisineFilter ?? parsed.cuisineContext;
  const effectiveCourse = options.courseFilter ?? parsed.courseHint;

  // 3. ANN candidate fetch via pgvector cosine distance.
  //    Fetch ~5x the requested limit so the JS re-rank has room to apply
  //    harmony/personalization/avoidance scoring without truncating good hits.
  const candidatePool = Math.max(limit * 5, 60);
  const queryVectorLiteral = `[${parsed.positiveVector.join(',')}]`;

  // Build dynamic WHERE without leaking string interpolation into SQL.
  // Each filter value is bound through $N placeholders.
  const params: unknown[] = [queryVectorLiteral];
  const whereClauses: string[] = [
    `computed_by_ruleset_version = 2`,
    `sensory_vector IS NOT NULL`,
    `array_length(sensory_profile, 1) > 0`,
  ];
  if (minHarmony > 0) {
    params.push(minHarmony);
    whereClauses.push(`harmony_score_universal >= $${params.length}`);
  }
  if (effectiveCourse) {
    params.push(effectiveCourse);
    whereClauses.push(`course_type = $${params.length}`);
  }
  if (effectiveCuisine) {
    params.push(effectiveCuisine);
    whereClauses.push(`$${params.length} = ANY(cuisine_tags)`);
  }
  params.push(candidatePool);

  const sql = `
    SELECT
      recipe_id          AS "recipeId",
      recipe_title       AS "recipeTitle",
      sensory_profile    AS "sensoryProfile",
      harmony_score_universal AS "harmonyScoreUniversal",
      harmony_score_cuisine   AS "harmonyScoreCuisine",
      detected_emergences AS "detectedEmergences",
      detected_clashes    AS "detectedClashes",
      dominant_archetype  AS "dominantArchetype",
      cuisine_tags        AS "cuisineTags",
      course_type         AS "courseType",
      is_rich    AS "isRich",
      is_crunchy AS "isCrunchy",
      is_spicy   AS "isSpicy",
      is_creamy  AS "isCreamy",
      is_umami   AS "isUmami",
      is_sweet   AS "isSweet",
      is_fresh   AS "isFresh"
    FROM sensory.recipe_snapshots
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY sensory_vector <=> $1::vector
    LIMIT $${params.length}
  `;

  type Row = {
    recipeId: string;
    recipeTitle: string;
    sensoryProfile: number[];
    harmonyScoreUniversal: number | null;
    harmonyScoreCuisine: Record<string, number> | null;
    detectedEmergences: Array<{ name: string }> | null;
    detectedClashes: Array<{ reason: string }> | null;
    dominantArchetype: string | null;
    cuisineTags: string[];
    courseType: string | null;
    isRich: boolean;
    isCrunchy: boolean;
    isSpicy: boolean;
    isCreamy: boolean;
    isUmami: boolean;
    isSweet: boolean;
    isFresh: boolean;
  };
  const recipes = (await prisma.$queryRawUnsafe(sql, ...params)) as Row[];

  const dimNames = await getDimNames();
  const results: MatchedRecipe[] = [];

  // 4. Score each recipe
  for (const recipe of recipes) {
    const similarity = cosineSim(parsed.positiveVector, recipe.sensoryProfile);
    const avoidancePenalty = computeAvoidancePenalty(parsed.avoidanceVector, recipe.sensoryProfile);

    // Choose harmony source
    let harmonyScore = recipe.harmonyScoreUniversal ?? 1.0;
    if (effectiveCuisine && recipe.harmonyScoreCuisine) {
      const cuisineHarmony = (recipe.harmonyScoreCuisine as Record<string, number>)[effectiveCuisine];
      if (cuisineHarmony != null) harmonyScore = cuisineHarmony;
    }

    const personalBoost = options.userId
      ? await computePersonalBoost(options.userId, recipe.sensoryProfile, recipe.recipeId)
      : 0;

    // Final score: weighted combination
    const finalScore = Math.max(
      0,
      similarity * 0.5 +
        harmonyScore * 0.2 +
        personalBoost +
        -avoidancePenalty * 0.3
    );

    // Build explanation (matching dims sorted by contribution)
    const matchingDims: MatchedRecipe['explanation']['matchingDims'] = [];
    if (options.includeExplanation !== false) {
      const contributions = parsed.positiveVector
        .map((qv, i) => ({
          idx: i,
          name: dimNames.get(i) ?? `dim${i}`,
          queryValue: qv,
          recipeValue: recipe.sensoryProfile[i] ?? 0,
          contribution: qv * (recipe.sensoryProfile[i] ?? 0),
        }))
        .filter((c) => c.contribution > 0.1)
        .sort((a, b) => b.contribution - a.contribution)
        .slice(0, 5);

      for (const c of contributions) {
        matchingDims.push({ name: c.name, recipeValue: c.recipeValue, queryValue: c.queryValue });
      }
    }

    const emergences = ((recipe.detectedEmergences as Array<{ name: string }> | null) ?? []).map((e) => e.name);
    const clashes = ((recipe.detectedClashes as Array<{ reason: string }> | null) ?? []).map((c) => c.reason);

    results.push({
      recipeId: recipe.recipeId,
      title: recipe.recipeTitle,
      similarity,
      harmonyScore,
      personalBoost,
      finalScore,
      explanation: {
        matchingDims,
        archetype: recipe.dominantArchetype,
        emergences,
        clashes,
        penaltyFromAvoidance: avoidancePenalty,
      },
      dominantArchetype: recipe.dominantArchetype,
      cuisineTags: recipe.cuisineTags,
      courseType: recipe.courseType,
      isRich: recipe.isRich,
      isCrunchy: recipe.isCrunchy,
      isSpicy: recipe.isSpicy,
      isCreamy: recipe.isCreamy,
    });
  }

  // 5. Sort and slice
  results.sort((a, b) => b.finalScore - a.finalScore);

  return { parsed, results: results.slice(0, limit) };
}

// ── "More like this" recipe similarity ───────────────────────────────────

/**
 * Find recipes similar to a reference recipe.
 * Uses pgvector cosine distance for ANN, then blends with harmony in JS.
 */
export async function findSimilarRecipes(
  recipeId: string,
  options: MatchOptions = {}
): Promise<MatchedRecipe[]> {
  const limit = options.limit ?? 10;
  const ref = await prisma.recipeSensorySnapshot.findUnique({
    where: { recipeId },
    select: { sensoryProfile: true, cuisineTags: true, courseType: true },
  });
  if (!ref || ref.sensoryProfile.length === 0) return [];

  const refVectorLiteral = `[${ref.sensoryProfile.join(',')}]`;
  const courseFilter = options.courseFilter ?? ref.courseType ?? null;
  const candidatePool = Math.max(limit * 5, 30);

  const params: unknown[] = [refVectorLiteral, recipeId];
  const whereClauses = [
    `recipe_id <> $2`,
    `computed_by_ruleset_version = 2`,
    `sensory_vector IS NOT NULL`,
    `array_length(sensory_profile, 1) > 0`,
  ];
  if (courseFilter) {
    params.push(courseFilter);
    whereClauses.push(`course_type = $${params.length}`);
  }
  params.push(candidatePool);

  const sql = `
    SELECT
      recipe_id          AS "recipeId",
      recipe_title       AS "recipeTitle",
      sensory_profile    AS "sensoryProfile",
      harmony_score_universal AS "harmonyScoreUniversal",
      detected_emergences AS "detectedEmergences",
      dominant_archetype  AS "dominantArchetype",
      cuisine_tags        AS "cuisineTags",
      course_type         AS "courseType",
      is_rich    AS "isRich",
      is_crunchy AS "isCrunchy",
      is_spicy   AS "isSpicy",
      is_creamy  AS "isCreamy",
      1 - (sensory_vector <=> $1::vector) AS similarity
    FROM sensory.recipe_snapshots
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY sensory_vector <=> $1::vector
    LIMIT $${params.length}
  `;

  type Row = {
    recipeId: string;
    recipeTitle: string;
    sensoryProfile: number[];
    harmonyScoreUniversal: number | null;
    detectedEmergences: Array<{ name: string }> | null;
    dominantArchetype: string | null;
    cuisineTags: string[];
    courseType: string | null;
    isRich: boolean;
    isCrunchy: boolean;
    isSpicy: boolean;
    isCreamy: boolean;
    similarity: number;
  };
  const candidates = (await prisma.$queryRawUnsafe(sql, ...params)) as Row[];

  const results: MatchedRecipe[] = candidates.map((c) => {
    const similarity = c.similarity;
    const harmonyScore = c.harmonyScoreUniversal ?? 1.0;
    return {
      recipeId: c.recipeId,
      title: c.recipeTitle,
      similarity,
      harmonyScore,
      personalBoost: 0,
      finalScore: similarity * 0.8 + harmonyScore * 0.2,
      explanation: {
        matchingDims: [],
        archetype: c.dominantArchetype,
        emergences: (c.detectedEmergences ?? []).map((e) => e.name),
        clashes: [],
        penaltyFromAvoidance: 0,
      },
      dominantArchetype: c.dominantArchetype,
      cuisineTags: c.cuisineTags,
      courseType: c.courseType,
      isRich: c.isRich,
      isCrunchy: c.isCrunchy,
      isSpicy: c.isSpicy,
      isCreamy: c.isCreamy,
    };
  });

  results.sort((a, b) => b.finalScore - a.finalScore);
  return results.slice(0, limit);
}

// ── Ingredient substitution ──────────────────────────────────────────────

export interface SubstituteResult {
  name: string;
  similarity: number;
  reason: string;
  role: string | null;
  category: string | null;
}

/**
 * Find ingredients similar in sensory profile + matching role.
 * Uses IngredientSensoryProfile.potency cosine similarity.
 */
export async function findSubstitutes(
  ingredientName: string,
  options: { limit?: number; sameRoleOnly?: boolean } = {}
): Promise<SubstituteResult[]> {
  const limit = options.limit ?? 5;
  const sameRoleOnly = options.sameRoleOnly ?? true;

  const target = await prisma.ingredientSensoryProfile.findUnique({
    where: { name: ingredientName.toLowerCase().trim() },
    select: { name: true, potency: true },
  });
  if (!target || target.potency.length === 0) {
    log.warn({ ingredientName }, 'Substitution target not found');
    return [];
  }

  // Fetch all other ingredients
  const all = await prisma.ingredientSensoryProfile.findMany({
    where: { name: { not: target.name }, potency: { isEmpty: false } },
    select: { name: true, potency: true },
  });

  const scored = all
    .map((ing) => ({
      name: ing.name,
      similarity: cosineSim(target.potency, ing.potency),
    }))
    .filter((s) => s.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map((s) => ({
    name: s.name,
    similarity: s.similarity,
    reason: s.similarity > 0.8 ? 'Very similar profile' : s.similarity > 0.6 ? 'Similar profile' : 'Related profile',
    role: null,
    category: null,
  }));
}

// ── Ingredient complement ("what pairs with X?") ─────────────────────────

export interface ComplementResult {
  ingredient: string;
  source: 'synergy_pair' | 'emergence_partner';
  boost: string; // human-readable description
  strength: number; // 0-1
}

/**
 * Find ingredients that pair well with the given ingredient.
 * Uses IngredientSynergyPair records.
 */
export async function findComplements(
  ingredientName: string,
  limit: number = 10
): Promise<ComplementResult[]> {
  const normName = ingredientName.toLowerCase().trim();

  const synergies = await prisma.ingredientSynergyPair.findMany({
    where: {
      OR: [{ ingredientA: normName }, { ingredientB: normName }],
      isActive: true,
    },
    select: {
      ingredientA: true,
      ingredientB: true,
      synergyType: true,
      sensoryBoosts: true,
      description: true,
    },
  });

  const results: ComplementResult[] = synergies.map((s) => {
    const partner = s.ingredientA === normName ? s.ingredientB : s.ingredientA;
    const totalBoost = s.sensoryBoosts.reduce((sum, v) => sum + Math.abs(v), 0);
    return {
      ingredient: partner,
      source: 'synergy_pair' as const,
      boost: s.description ?? s.synergyType,
      strength: Math.min(1, totalBoost / 5),
    };
  });

  // Also find emergence patterns that include this ingredient
  const emergences = await prisma.combinationEmergence.findMany({
    where: { isActive: true },
    select: { name: true, triggers: true, emergentTags: true, harmonyBonus: true, description: true },
  });

  for (const em of emergences) {
    const triggers = em.triggers as Array<{ ingredient?: string; minDose?: number }>;
    const included = triggers.some((t) => t.ingredient?.toLowerCase() === normName);
    if (!included) continue;

    // Every other trigger ingredient in the pattern is a complement
    for (const t of triggers) {
      if (!t.ingredient || t.ingredient.toLowerCase() === normName) continue;
      results.push({
        ingredient: t.ingredient,
        source: 'emergence_partner' as const,
        boost: `Part of ${em.name} (${em.description ?? ''})`.trim(),
        strength: em.harmonyBonus * 2, // 0.1-0.3 → 0.2-0.6
      });
    }
  }

  // Dedupe by partner name, keeping strongest
  const byName = new Map<string, ComplementResult>();
  for (const r of results) {
    const existing = byName.get(r.ingredient);
    if (!existing || r.strength > existing.strength) {
      byName.set(r.ingredient, r);
    }
  }

  return [...byName.values()].sort((a, b) => b.strength - a.strength).slice(0, limit);
}

log.info('sensory-match service loaded');
