/**
 * Sensory Compound v2 — 113-dim pipeline with full interaction model.
 *
 * Implements the 17-step pipeline documented in
 * docs/sensory-compound-knowledge-base.md section 7.
 *
 * INPUT:  recipe ingredients + instructions
 * OUTPUT: 113-dim profile + harmony + clashes + emergences + derived metrics
 *
 * This is a ground-up replacement for sensory-compound.service.ts (v1, 25-dim).
 * Runs alongside v1 during Phase 4 migration. Callers switch via feature flag
 * (or Recipe.computedByRulesetVersion).
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { allCandidates, resolveNames, basicNormalize } from './ingredient-name-normalizer';

const log = createLogger('sensory-v2');

export const SENSORY_DIM_COUNT_V2 = 113;
export const AFTERTASTE_DIM_COUNT = 8;
export const RULESET_VERSION = 2; // bumped whenever rule schema changes

// ── Types ────────────────────────────────────────────────────────────────

export interface V2IngredientInput {
  name: string;
  quantity: number;
  unit: string;
  role?: string | null;
}

export interface V2Instruction {
  stepNumber?: number;
  text: string;
}

export interface DoseMetrics {
  totalGrams: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  sugarGrams: number;
  fiberGrams: number;
  acidGrams: number; // approx from Sour × fraction
  saltGrams: number;
  waterGrams: number;
  // Ratios
  acidToDairyRatio: number; // for acid-in-dairy clash/interaction
  fatPct: number;
  saltPct: number;
  sugarPct: number;
  proteinPct: number;
  estimatedPH: number;
}

export interface ClashMatch {
  reason: string;
  severity: number; // 0-1
  source: 'ingredient_pair' | 'category_pair' | 'dim_combination';
  trigger: string;
  cultures: string[];
}

export interface EmergenceMatch {
  name: string;
  cuisineContext: string | null;
  boosts: Record<number, number>;
  tags: string[];
  harmonyBonus: number;
}

export interface DerivedMetrics {
  intensity: number; // sum of top 5 dims, normalized 0-1
  balance: number; // 0-1, 1 = evenly distributed
  complexity: number; // count of non-trivial dims normalized 0-1
}

export interface V2Result {
  profile: number[]; // 113 dims
  aftertaste: number[]; // 8 dims
  bodyWeight: number; // 0-6
  harmonyUniversal: number; // 0-1
  harmonyCuisine: Record<string, number>; // { western: 0.85, ... }
  clashes: ClashMatch[];
  emergences: EmergenceMatch[];
  derived: DerivedMetrics;
  dominantArchetype: string | null;
  archetypeConfidence: number | null;
  rulesetVersion: number;
  flags: Record<string, boolean>; // isCrunchy, isRich, etc.
}

// ── Constants for dim indices (see docs/sensory-dimension-reference.md) ──
const DIM_SWEET = 0;
const DIM_SALTY = 1;
const DIM_SOUR = 2;
const DIM_UMAMI = 4;
const DIM_FATTY = 6;
const DIM_SPICY = 7;
const DIM_CRUNCHY = 86;
const DIM_CRISPY = 87;
const DIM_JUICY = 92;
const DIM_CREAMY = 95;
const DIM_RICH = 106;
const DIM_FRESH = 108;
const DIM_BODY = 112;

// Dairy cluster for acid-in-dairy detection
const DAIRY_DIMS = [59, 60, 61, 62]; // FreshMilkCream, Butter, CulturedDairy, AgedCheese

// Top search flag dims
const FLAG_DIMS = {
  isCrunchy: DIM_CRUNCHY,
  isCreamy: DIM_CREAMY,
  isRich: DIM_RICH,
  isSpicy: DIM_SPICY,
  isSweet: DIM_SWEET,
  isUmami: DIM_UMAMI,
  isFresh: DIM_FRESH,
  isSmoky: 48, // HardWoodSmoke
  isBright: DIM_FRESH, // approximated
  isHearty: DIM_RICH,
};

// ── In-memory caches (10-minute TTL) ─────────────────────────────────────

let rulesCache: {
  tier1: Array<{ dimA: number | null; dimB: number | null; ruleType: string; doseCurve: { points: { dose: number; effect: number }[] } | null; description: string | null }>;
  tier4: Array<{ dimA: number | null; effectDim: number | null; doseCurve: { points: { dose: number; effect: number }[] } | null; description: string | null }>;
  clashes: Array<{
    scopeType: string;
    ingredientA: string | null;
    ingredientB: string | null;
    categoryA: string | null;
    categoryB: string | null;
    severityCurve: { points: { dose: number; effect: number }[] };
    cultures: string[];
    exceptions: string[];
    reason: string;
  }>;
  emergences: Array<{
    name: string;
    cuisineContext: string | null;
    triggers: Array<{ ingredient?: string; category?: string; minDose: number }>;
    minTriggerCount: number;
    emergentBoosts: Record<string, number>;
    emergentTags: string[];
    harmonyBonus: number;
  }>;
  archetypes: Array<{ name: string; keywords: string[]; expectedProfile: number[]; tolerances: number[] }>;
  loadedAt: number;
} | null = null;

const CACHE_TTL_MS = 10 * 60 * 1000;

async function loadRules() {
  if (rulesCache && Date.now() - rulesCache.loadedAt < CACHE_TTL_MS) {
    return rulesCache;
  }

  const [tier1Raw, tier4Raw, clashRaw, emergenceRaw, archetypeRaw] = await Promise.all([
    prisma.sensoryInteractionRule.findMany({
      where: { isActive: true, tier: 'perceptual' },
      select: { dimA: true, dimB: true, ruleType: true, doseCurve: true, description: true },
    }),
    prisma.sensoryInteractionRule.findMany({
      where: { isActive: true, tier: 'carrier' },
      select: { dimA: true, effectDim: true, doseCurve: true, description: true },
    }),
    prisma.flavorClashRule.findMany({
      where: { isActive: true },
      select: {
        scopeType: true,
        ingredientA: true,
        ingredientB: true,
        categoryA: true,
        categoryB: true,
        severityCurve: true,
        cultures: true,
        exceptions: true,
        reason: true,
      },
    }),
    prisma.combinationEmergence.findMany({
      where: { isActive: true },
      select: {
        name: true,
        cuisineContext: true,
        triggers: true,
        minTriggerCount: true,
        emergentBoosts: true,
        emergentTags: true,
        harmonyBonus: true,
      },
    }),
    prisma.dishArchetype.findMany({
      where: { isActive: true },
      select: { name: true, keywords: true, expectedProfile: true, tolerances: true },
    }),
  ]);

  rulesCache = {
    tier1: tier1Raw.map((r) => ({
      dimA: r.dimA,
      dimB: r.dimB,
      ruleType: r.ruleType,
      doseCurve: r.doseCurve as { points: { dose: number; effect: number }[] } | null,
      description: r.description,
    })),
    tier4: tier4Raw.map((r) => ({
      dimA: r.dimA,
      effectDim: r.effectDim,
      doseCurve: r.doseCurve as { points: { dose: number; effect: number }[] } | null,
      description: r.description,
    })),
    clashes: clashRaw.map((c) => ({
      scopeType: c.scopeType,
      ingredientA: c.ingredientA,
      ingredientB: c.ingredientB,
      categoryA: c.categoryA,
      categoryB: c.categoryB,
      severityCurve: c.severityCurve as { points: { dose: number; effect: number }[] },
      cultures: c.cultures,
      exceptions: c.exceptions,
      reason: c.reason,
    })),
    emergences: emergenceRaw.map((e) => ({
      name: e.name,
      cuisineContext: e.cuisineContext,
      triggers: e.triggers as Array<{ ingredient?: string; category?: string; minDose: number }>,
      minTriggerCount: e.minTriggerCount,
      emergentBoosts: e.emergentBoosts as Record<string, number>,
      emergentTags: e.emergentTags,
      harmonyBonus: e.harmonyBonus,
    })),
    archetypes: archetypeRaw.map((a) => ({
      name: a.name,
      keywords: a.keywords,
      expectedProfile: a.expectedProfile,
      tolerances: a.tolerances,
    })),
    loadedAt: Date.now(),
  };

  return rulesCache;
}

export function invalidateV2Cache(): void {
  rulesCache = null;
}

// ── Dose curve evaluator ─────────────────────────────────────────────────

/** Linear interpolation over piecewise dose curve. */
function evaluateCurve(curve: { points: { dose: number; effect: number }[] } | null, dose: number): number {
  if (!curve || !curve.points || curve.points.length === 0) return 0;
  const pts = curve.points;
  if (dose <= pts[0].dose) return pts[0].effect;
  if (dose >= pts[pts.length - 1].dose) return pts[pts.length - 1].effect;
  for (let i = 1; i < pts.length; i++) {
    if (dose <= pts[i].dose) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const t = (dose - prev.dose) / (curr.dose - prev.dose);
      return prev.effect + t * (curr.effect - prev.effect);
    }
  }
  return pts[pts.length - 1].effect;
}

// ── Unit conversion (simplified; reuse v1 full conversion where available) ──

const GENERIC_UNIT_GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000,
  oz: 28.35, ounce: 28.35, ounces: 28.35,
  lb: 454, pound: 454, pounds: 454,
  cup: 240, cups: 240,
  tbsp: 15, tablespoon: 15, tablespoons: 15,
  tsp: 5, teaspoon: 5, teaspoons: 5,
  ml: 1, milliliter: 1,
  l: 1000, liter: 1000,
  piece: 50, pieces: 50, whole: 50,
  clove: 5, cloves: 5,
  slice: 30, slices: 30,
};

function convertToGrams(quantity: number, unit: string): number {
  const u = (unit || '').toLowerCase().trim();
  const factor = GENERIC_UNIT_GRAMS[u] ?? 30; // default 30g for unknown
  return quantity * factor;
}

// ── Helper: ingredient categorization ────────────────────────────────────

/** Classify ingredient by name keywords into aroma family categories. */
function categorizeIngredient(name: string): string[] {
  const n = name.toLowerCase();
  const cats: string[] = [];

  if (/\b(mint|menthol|eucalyptus)\b/.test(n)) cats.push('Cooling');
  if (/\b(parmesan|cheddar|gruyere|gruyère|gouda|pecorino|manchego|aged.*cheese)\b/.test(n)) cats.push('AgedCheese');
  if (/\b(milk|cream|butter|yogurt|ricotta|mozzarella|cheese|dairy|sour.cream|crème|creme)\b/.test(n)) cats.push('Dairy');
  if (/\b(lemon|lime|orange|grapefruit|yuzu|bergamot|citrus)\b/.test(n)) cats.push('Citrusy');
  if (/\b(beef|pork|chicken|lamb|turkey|duck|veal|bacon|ham|prosciutto|sausage|steak|roast)\b/.test(n)) cats.push('Meaty');
  if (/\b(venison|lamb|duck|rabbit|game)\b/.test(n)) cats.push('Gamey');
  if (/\b(salmon|tuna|cod|fish|trout|halibut|sardine|anchovy)\b/.test(n)) cats.push('Fish');
  if (/\b(shrimp|crab|lobster|oyster|clam|mussel|scallop)\b/.test(n)) cats.push('Shellfish');
  if (/\b(rose|jasmine|elderflower|violet|lavender|chamomile)\b/.test(n)) cats.push('FloralDelicate');
  if (/\b(cabbage|broccoli|cauliflower|kale|brussels|radish|mustard.green)\b/.test(n)) cats.push('Brassica');
  if (/\b(garlic|onion|leek|shallot|chive|scallion)\b/.test(n)) cats.push('Allium');
  if (/\b(chocolate|cocoa|cacao)\b/.test(n)) cats.push('DarkCocoa');
  if (/\b(blue.cheese|gorgonzola|roquefort|stilton)\b/.test(n)) cats.push('BlueMoldyCheese');
  if (/\b(fish.sauce|anchovy|bottarga|shrimp.paste)\b/.test(n)) cats.push('FishFermented');
  if (/\b(kimchi|sauerkraut|pickled|kombucha)\b/.test(n)) cats.push('LactoPickled');
  if (/\b(miso|soy.sauce|tempeh|natto|doubanjiang)\b/.test(n)) cats.push('BeanFermented');
  if (/\b(mushroom|shiitake|porcini|truffle)\b/.test(n)) cats.push('Mushroom');
  if (/\b(cinnamon|clove|nutmeg|cardamom|allspice|mace)\b/.test(n)) cats.push('WarmSweetSpice');
  if (/\b(tomato|tomatoes)\b/.test(n)) cats.push('Tomato');
  if (/\b(carrot|carrots)\b/.test(n)) cats.push('Carrot');
  if (/\b(celery)\b/.test(n)) cats.push('Celery');
  if (/\b(basil)\b/.test(n)) cats.push('Basil');
  if (/\b(mozzarella)\b/.test(n)) cats.push('Mozzarella');
  if (/\b(kombu|seaweed|nori|wakame)\b/.test(n)) cats.push('Seaweed');
  if (/\b(bonito|dashi|katsuobushi)\b/.test(n)) cats.push('Bonito');
  if (/\b(flour|wheat)\b/.test(n)) cats.push('Flour');
  if (/\b(ginger)\b/.test(n)) cats.push('Ginger');
  if (/\b(cumin)\b/.test(n)) cats.push('Cumin');
  if (/\b(bell.pepper|red.pepper|yellow.pepper|green.pepper)\b/.test(n)) cats.push('BellPepper');

  return cats;
}

// ── Dose analysis ────────────────────────────────────────────────────────

async function analyzeDose(
  ingredients: V2IngredientInput[],
  gramsList: number[]
): Promise<DoseMetrics> {
  const names = ingredients.map((i) => basicNormalize(i.name));
  const chemProps = await prisma.ingredientChemProperties.findMany({
    where: { ingredientName: { in: names } },
    select: {
      ingredientName: true,
      proteinContent: true,
      fatContent: true,
      sugarContent: true,
      fiberContent: true,
      moistureContent: true,
      starchContent: true,
      acidPh: true,
    },
  });
  const chemMap = new Map(chemProps.map((c) => [c.ingredientName, c]));

  let totalGrams = 0;
  let proteinGrams = 0;
  let fatGrams = 0;
  let carbsGrams = 0;
  let sugarGrams = 0;
  let fiberGrams = 0;
  let waterGrams = 0;
  let saltGrams = 0;
  let acidGrams = 0;
  let dairyGrams = 0;
  let phSum = 0;
  let phWeight = 0;

  for (let i = 0; i < ingredients.length; i++) {
    const name = names[i];
    const g = gramsList[i];
    totalGrams += g;

    const chem = chemMap.get(name);
    if (chem) {
      proteinGrams += (chem.proteinContent ?? 0) * g / 100;
      fatGrams += (chem.fatContent ?? 0) * g / 100;
      sugarGrams += (chem.sugarContent ?? 0) * g / 100;
      fiberGrams += (chem.fiberContent ?? 0) * g / 100;
      waterGrams += (chem.moistureContent ?? 0) * g / 100;
      carbsGrams += ((chem.sugarContent ?? 0) + (chem.fiberContent ?? 0) + (chem.starchContent ?? 0)) * g / 100;
      if (chem.acidPh != null && chem.acidPh < 7) {
        phSum += chem.acidPh * g;
        phWeight += g;
      }
    }

    // Heuristics for acid/salt/dairy detection
    if (/\b(salt|kosher.salt|sea.salt)\b/i.test(name)) saltGrams += g;
    else if (/\b(soy.sauce|fish.sauce|miso)\b/i.test(name)) saltGrams += g * 0.15;
    if (/\b(lemon|lime|vinegar|citrus.juice|tamarind)\b/i.test(name)) acidGrams += g * 0.5;
    const cats = categorizeIngredient(name);
    if (cats.includes('Dairy') || cats.includes('AgedCheese')) dairyGrams += g;
  }

  const estimatedPH = phWeight > 0 ? phSum / phWeight : 6.5;
  const totalSafe = Math.max(totalGrams, 1);

  return {
    totalGrams,
    proteinGrams,
    fatGrams,
    carbsGrams,
    sugarGrams,
    fiberGrams,
    acidGrams,
    saltGrams,
    waterGrams,
    acidToDairyRatio: dairyGrams > 0 ? acidGrams / dairyGrams : 0,
    fatPct: fatGrams / totalSafe,
    saltPct: saltGrams / totalSafe,
    sugarPct: sugarGrams / totalSafe,
    proteinPct: proteinGrams / totalSafe,
    estimatedPH,
  };
}

// ── Clash detection ──────────────────────────────────────────────────────

function detectClashes(
  ingredients: V2IngredientInput[],
  rules: NonNullable<typeof rulesCache>['clashes']
): ClashMatch[] {
  const names = ingredients.map((i) => basicNormalize(i.name));
  const allCats = new Set<string>();
  const ingrToCats = new Map<string, string[]>();
  for (const name of names) {
    const cats = categorizeIngredient(name);
    ingrToCats.set(name, cats);
    cats.forEach((c) => allCats.add(c));
  }

  const matches: ClashMatch[] = [];

  for (const rule of rules) {
    // Skip if any exception ingredient is present
    if (rule.exceptions.some((ex) => names.some((n) => n.includes(ex.toLowerCase())))) continue;

    if (rule.scopeType === 'ingredient_pair' && rule.ingredientA && rule.ingredientB) {
      const hasA = names.some((n) => n.includes(rule.ingredientA!.toLowerCase()));
      const hasB = names.some((n) => n.includes(rule.ingredientB!.toLowerCase()));
      if (hasA && hasB) {
        const severity = evaluateCurve(rule.severityCurve, 1.0); // simplified: fixed dose=1
        matches.push({
          reason: rule.reason,
          severity: Math.min(severity, 1.0),
          source: 'ingredient_pair',
          trigger: `${rule.ingredientA} + ${rule.ingredientB}`,
          cultures: rule.cultures,
        });
      }
    } else if (rule.scopeType === 'category_pair' && rule.categoryA && rule.categoryB) {
      if (allCats.has(rule.categoryA) && allCats.has(rule.categoryB)) {
        const severity = evaluateCurve(rule.severityCurve, 1.0);
        matches.push({
          reason: rule.reason,
          severity: Math.min(severity, 1.0),
          source: 'category_pair',
          trigger: `${rule.categoryA} + ${rule.categoryB}`,
          cultures: rule.cultures,
        });
      }
    }
  }

  return matches;
}

// ── Emergence detection ──────────────────────────────────────────────────

function detectEmergences(
  ingredients: V2IngredientInput[],
  gramsList: number[],
  patterns: NonNullable<typeof rulesCache>['emergences']
): EmergenceMatch[] {
  const names = ingredients.map((i) => basicNormalize(i.name));
  const ingrToGrams = new Map<string, number>();
  for (let i = 0; i < names.length; i++) {
    ingrToGrams.set(names[i], (ingrToGrams.get(names[i]) || 0) + gramsList[i]);
  }

  const matches: EmergenceMatch[] = [];

  for (const pattern of patterns) {
    let triggersMatched = 0;
    for (const trig of pattern.triggers) {
      const targetName = trig.ingredient?.toLowerCase();
      const targetCat = trig.category;
      if (targetName) {
        const found = names.find((n) => n.includes(targetName));
        if (found) triggersMatched++;
      } else if (targetCat) {
        const found = names.find((n) => categorizeIngredient(n).includes(targetCat));
        if (found) triggersMatched++;
      }
    }

    if (triggersMatched >= pattern.minTriggerCount) {
      const boosts: Record<number, number> = {};
      for (const [dim, val] of Object.entries(pattern.emergentBoosts)) {
        boosts[parseInt(dim, 10)] = val as number;
      }
      matches.push({
        name: pattern.name,
        cuisineContext: pattern.cuisineContext,
        boosts,
        tags: pattern.emergentTags,
        harmonyBonus: pattern.harmonyBonus,
      });
    }
  }

  return matches;
}

// ── Harmony score (3 passes) ─────────────────────────────────────────────

function computeHarmonyScore(
  clashes: ClashMatch[],
  emergences: EmergenceMatch[],
  culture: string = 'universal'
): number {
  let score = 1.0;

  for (const c of clashes) {
    // Apply only if culture matches (or clash is universal)
    if (c.cultures.includes('universal') || c.cultures.includes(culture)) {
      score -= c.severity * 0.15;
    }
  }

  for (const e of emergences) {
    if (!e.cuisineContext) {
      score += e.harmonyBonus;
    } else if (e.cuisineContext === culture) {
      score += e.harmonyBonus * 1.5; // cuisine-specific bonus
    } else {
      score += e.harmonyBonus * 0.5; // weaker bonus for cross-cuisine
    }
  }

  return Math.max(0, Math.min(1, score));
}

// ── Derived metrics ──────────────────────────────────────────────────────

function computeDerivedMetrics(profile: number[]): DerivedMetrics {
  const values = profile.slice();
  // Intensity: sum of top 5 dims normalized to 0-1
  const sorted = [...values].sort((a, b) => b - a);
  const top5Sum = sorted.slice(0, 5).reduce((s, v) => s + v, 0);
  const intensity = Math.min(1, top5Sum / 30); // max ~30 (5 dims × 6 max each)

  // Balance: 1 - std_dev / max
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const maxVal = Math.max(...values);
  const balance = maxVal > 0 ? 1 - stdDev / maxVal : 0;

  // Complexity: count of dims > 1.0, normalized
  const nonTrivial = values.filter((v) => v > 1.0).length;
  const complexity = Math.min(1, nonTrivial / 20); // cap at 20 non-trivial dims

  return { intensity, balance, complexity };
}

// ── Body computation ─────────────────────────────────────────────────────

function computeBody(dose: DoseMetrics, profile: number[]): number {
  // Body derived from: fat %, protein %, starch %, creamy dim, body dim
  const fatComponent = Math.min(dose.fatPct * 10, 2.0);
  const proteinComponent = Math.min(dose.proteinPct * 5, 1.5);
  const starchComponent = Math.min(dose.carbsGrams / Math.max(dose.totalGrams, 1) * 4, 1.5);
  const textureComponent = Math.min((profile[DIM_CREAMY] + profile[95 /* Silky */]) / 3, 1.5);
  return Math.min(6, fatComponent + proteinComponent + starchComponent + textureComponent);
}

// ── Aftertaste computation ───────────────────────────────────────────────

function computeAftertaste(profile: number[]): number[] {
  // 8 dims: finishSweet, finishBitter, finishUmami, finishAstringent,
  // finishWarming, finishCooling, finishAromatic, finishComplexity
  const aftertaste = [
    profile[DIM_SWEET] * 0.4, // sweet fades fast
    profile[3 /* Bitter */] * 0.9, // bitter persists
    profile[DIM_UMAMI] * 0.9, // umami persists
    profile[10 /* Astringent */] * 1.0, // astringency lingers
    profile[13 /* Warming */] * 0.8,
    profile[9 /* Cooling */] * 0.8,
    // Aromatic: average of top aroma dims
    (profile.slice(14, 86).reduce((s, v) => s + v, 0) / 72) * 0.6,
    // Complexity: count of non-trivial aromatics × 0.3
    Math.min(profile.slice(14, 86).filter((v) => v > 1).length * 0.3, 6),
  ];
  return aftertaste.map((v) => Math.max(0, Math.min(6, v)));
}

// ── Archetype matching ───────────────────────────────────────────────────

function matchArchetype(
  profile: number[],
  recipeTitle: string,
  archetypes: NonNullable<typeof rulesCache>['archetypes']
): { name: string; confidence: number } | null {
  let bestMatch: { name: string; confidence: number } | null = null;
  const title = recipeTitle.toLowerCase();

  for (const arch of archetypes) {
    const keywordMatch = arch.keywords.some((kw) => title.includes(kw.toLowerCase()));
    if (!keywordMatch) continue;

    // Score by RMSE vs expected profile (only for matching dims)
    if (arch.expectedProfile.length === 0) {
      // No profile to compare, just accept on keyword match with 0.5 confidence
      if (!bestMatch || bestMatch.confidence < 0.5) {
        bestMatch = { name: arch.name, confidence: 0.5 };
      }
      continue;
    }

    let sqErr = 0;
    let dims = 0;
    const expDims = Math.min(arch.expectedProfile.length, profile.length);
    for (let i = 0; i < expDims; i++) {
      if (arch.expectedProfile[i] > 0 || profile[i] > 0) {
        const tol = arch.tolerances[i] ?? 0.3;
        const diff = Math.abs(profile[i] - arch.expectedProfile[i]) / Math.max(tol, 0.1);
        sqErr += diff * diff;
        dims++;
      }
    }
    const rmse = dims > 0 ? Math.sqrt(sqErr / dims) : 10;
    const confidence = Math.max(0, 1 - rmse / 3);

    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = { name: arch.name, confidence };
    }
  }

  return bestMatch;
}

// ── Denormalized flags ───────────────────────────────────────────────────

function computeFlags(profile: number[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const [flagName, dimIdx] of Object.entries(FLAG_DIMS)) {
    flags[flagName] = (profile[dimIdx] ?? 0) >= 3.0; // threshold
  }
  return flags;
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ══════════════════════════════════════════════════════════════════════

/**
 * The 17-step pipeline. Takes recipe ingredients + instructions,
 * returns full 113-dim sensory result with harmony, clashes, emergences.
 */
export async function composeRecipeSensoryV2(
  ingredients: V2IngredientInput[],
  instructions?: V2Instruction[],
  recipeTitle: string = ''
): Promise<V2Result> {
  const empty: V2Result = {
    profile: new Array(SENSORY_DIM_COUNT_V2).fill(0),
    aftertaste: new Array(AFTERTASTE_DIM_COUNT).fill(0),
    bodyWeight: 0,
    harmonyUniversal: 1.0,
    harmonyCuisine: {},
    clashes: [],
    emergences: [],
    derived: { intensity: 0, balance: 0, complexity: 0 },
    dominantArchetype: null,
    archetypeConfidence: null,
    rulesetVersion: RULESET_VERSION,
    flags: {},
  };

  if (!ingredients || ingredients.length === 0) return empty;

  const rules = await loadRules();

  // ── Step 1-2: Ingredient lookup + mass fractions ──
  const names = ingredients.map((i) => basicNormalize(i.name));
  const gramsList = ingredients.map((i) => convertToGrams(i.quantity, i.unit));
  const totalGrams = gramsList.reduce((s, g) => s + g, 0) || 1;

  // ── Lookup potencies with alias fallback ──
  const candidates = allCandidates(names);
  const profiles = await prisma.ingredientSensoryProfile.findMany({
    where: { name: { in: candidates } },
    select: { name: true, potency: true, adminOverride: true },
  });
  const dbNameSet = new Set(profiles.map((p) => p.name));
  const resolution = resolveNames(names, dbNameSet);
  const byDbName = new Map(profiles.map((p) => [p.name, p]));

  // ── Step 4: Aggregate raw profile (113 dims) ──
  // If potency array has 25 dims (v1), pad with zeros to 113.
  const rawProfile = new Array(SENSORY_DIM_COUNT_V2).fill(0);
  for (let i = 0; i < ingredients.length; i++) {
    const inputName = names[i];
    const dbName = resolution.get(inputName);
    if (!dbName) continue;
    const profile = byDbName.get(dbName);
    if (!profile) continue;

    const potency = profile.potency;
    if (!potency || potency.length === 0) continue;

    const massFraction = gramsList[i] / totalGrams;
    const dimsToRead = Math.min(potency.length, SENSORY_DIM_COUNT_V2);

    // Apply admin override if present (for the dims that have it)
    const override = profile.adminOverride ?? [];

    for (let d = 0; d < dimsToRead; d++) {
      const overrideVal = override[d];
      const val = overrideVal != null && overrideVal >= 0 ? overrideVal : potency[d];
      if (val > 0) {
        rawProfile[d] += val * massFraction;
      }
    }
  }

  // ── Step 5: Dose analysis ──
  const dose = await analyzeDose(ingredients, gramsList);

  // ── Step 6: Tier 1 perceptual rules (enhance/mask/synergy/reinforce) ──
  const profile = rawProfile.slice();
  for (const rule of rules.tier1) {
    if (rule.dimA == null || rule.dimB == null) continue;
    const sourceVal = profile[rule.dimA] ?? 0;
    if (sourceVal <= 0) continue;
    const effect = evaluateCurve(rule.doseCurve, sourceVal);
    profile[rule.dimB] = Math.max(0, Math.min(6, (profile[rule.dimB] ?? 0) + effect));
  }

  // ── Step 9: Tier 4 carrier effects ──
  for (const rule of rules.tier4) {
    if (rule.dimA == null || rule.effectDim == null) continue;
    const sourceVal = profile[rule.dimA] ?? 0;
    if (sourceVal <= 0) continue;
    const effect = evaluateCurve(rule.doseCurve, sourceVal);
    profile[rule.effectDim] = Math.max(0, Math.min(6, (profile[rule.effectDim] ?? 0) + effect));
  }

  // ── Step 10: Emergence detection ──
  const emergences = detectEmergences(ingredients, gramsList, rules.emergences);

  // ── Apply emergence boosts to profile ──
  for (const em of emergences) {
    for (const [dimStr, boost] of Object.entries(em.boosts)) {
      const dim = parseInt(dimStr, 10);
      profile[dim] = Math.max(0, Math.min(6, (profile[dim] ?? 0) + boost));
    }
  }

  // ── Step 11: Clash detection ──
  const clashes = detectClashes(ingredients, rules.clashes);

  // ── Step 13: Aftertaste ──
  const aftertaste = computeAftertaste(profile);

  // ── Step 14: Body ──
  const bodyWeight = computeBody(dose, profile);
  profile[DIM_BODY] = bodyWeight;

  // ── Step 15: Derived metrics ──
  const derived = computeDerivedMetrics(profile);

  // ── Step 16: Harmony (universal + cuisine) ──
  const harmonyUniversal = computeHarmonyScore(clashes, emergences, 'universal');
  const harmonyCuisine: Record<string, number> = {};
  for (const cuisine of ['western', 'italian', 'japanese', 'indian', 'mexican', 'french']) {
    harmonyCuisine[cuisine] = computeHarmonyScore(clashes, emergences, cuisine);
  }

  // ── Archetype matching ──
  const archetypeMatch = matchArchetype(profile, recipeTitle, rules.archetypes);

  // ── Flags ──
  const flags = computeFlags(profile);

  return {
    profile,
    aftertaste,
    bodyWeight,
    harmonyUniversal,
    harmonyCuisine,
    clashes,
    emergences,
    derived,
    dominantArchetype: archetypeMatch?.name ?? null,
    archetypeConfidence: archetypeMatch?.confidence ?? null,
    rulesetVersion: RULESET_VERSION,
    flags,
  };
}

/**
 * Persist a V2Result to RecipeSensorySnapshot (plugin-owned table).
 * Uses upsert — creates snapshot if missing, updates if existing.
 * `recipeTitle` is denormalised from the host so plugin can render without cross-schema joins.
 */
export async function persistV2Result(
  recipeId: string,
  recipeTitle: string,
  result: V2Result
): Promise<void> {
  const data = {
    recipeTitle,
    sensoryProfile: result.profile,
    aftertasteProfile: result.aftertaste,
    bodyWeight: result.bodyWeight,
    harmonyScoreUniversal: result.harmonyUniversal,
    harmonyScoreCuisine: result.harmonyCuisine,
    detectedClashes: result.clashes as unknown as object,
    detectedEmergences: result.emergences as unknown as object,
    dominantArchetype: result.dominantArchetype,
    archetypeConfidence: result.archetypeConfidence,
    balanceScore: result.derived.balance,
    complexityScore: result.derived.complexity,
    intensityScore: result.derived.intensity,
    isCrunchy: result.flags.isCrunchy ?? false,
    isCreamy: result.flags.isCreamy ?? false,
    isRich: result.flags.isRich ?? false,
    isSpicy: result.flags.isSpicy ?? false,
    isSweet: result.flags.isSweet ?? false,
    isUmami: result.flags.isUmami ?? false,
    isFresh: result.flags.isFresh ?? false,
    isSmoky: result.flags.isSmoky ?? false,
    isBright: result.flags.isBright ?? false,
    isHearty: result.flags.isHearty ?? false,
    computedByRulesetVersion: result.rulesetVersion,
    computedAt: new Date(),
  };

  await prisma.recipeSensorySnapshot.upsert({
    where: { recipeId },
    update: data,
    create: { recipeId, ...data },
  });

  // Populate pgvector column separately — Prisma can't handle `Unsupported("vector(N)")`
  // types through its upsert path. Keeps sensoryVector in sync with sensoryProfile so
  // pgvector-based cosine similarity queries work alongside the Float[] cosine path.
  if (result.profile.length > 0) {
    const vectorLiteral = `[${result.profile.join(',')}]`;
    await prisma.$executeRawUnsafe(
      `UPDATE sensory.recipe_snapshots SET sensory_vector = $1::vector WHERE recipe_id = $2`,
      vectorLiteral,
      recipeId
    );
  }
}

log.info('compound-engine module loaded');
