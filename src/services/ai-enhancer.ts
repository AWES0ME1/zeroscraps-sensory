/**
 * Sensory AI Enhancer (Phase 9: mini handoff)
 *
 * Autonomous pipeline that uses gpt-4.1-mini to fill gaps in the sensory
 * system under strict safeguards:
 *
 *   GAP DISCOVERY — find ingredients with empty/sparse potency, missing
 *                   chem properties, missing aroma coverage
 *   ANCHOR CONTEXT — prompt includes 10 most-similar existing ingredients
 *                    as calibration anchors
 *   GUARDRAILS     — never overwrite admin overrides or manual_expert /
 *                    wageningen_panel sources
 *   INVARIANT CHECK— proposals pass CalibrationRule validation before write
 *   QUEUE FOR      — proposals below 0.85 confidence queued for admin review
 *   APPROVAL       — (Recipe preference matches table reused for staging)
 *   AUDIT          — every change logged to IngredientChangeLog
 *   DRIFT TRACKING — output reported in regression fixtures next run
 *
 * Runs on-demand (admin trigger) or on schedule (future: nightly cron).
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { generateJson, isOpenAIEnabled } from '../lib/openai';

const log = createLogger('sensory-ai-enhancer');
const SENSORY_DIM_COUNT = 113;

// Sources we NEVER overwrite (sacred)
const PROTECTED_SOURCES = new Set(['admin', 'manual_expert', 'wageningen_panel']);
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.85;

// ── Types ────────────────────────────────────────────────────────────────

export interface EnhancementRun {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  scope: 'all' | 'category' | 'specific';
  categoryFilter?: string;
  ingredientFilter?: string[];
  gapsFound: number;
  autoApplied: number;
  queuedForReview: number;
  invariantFailures: number;
  aiFailures: number;
  cost: number; // USD estimate
  triggeredBy: string; // userId or 'system' or 'cron'
  notes?: string;
}

export interface GeneratedPotency {
  ingredientName: string;
  potency: number[]; // 113 dims
  confidence: number; // 0-1
  reasoning: string;
  sourceAnchors: string[]; // which peers the AI used
}

// ── Gap discovery ────────────────────────────────────────────────────────

export async function findGaps(options: {
  category?: string;
  minSparseDim?: number;
} = {}): Promise<Array<{ name: string; reason: string; potency: number[] }>> {
  const minSparse = options.minSparseDim ?? 3;

  const where: Record<string, unknown> = {
    potencySource: { notIn: ['admin', 'manual_expert', 'wageningen_panel'] },
  };
  if (options.category) where.category = options.category;

  const profiles = await prisma.ingredientSensoryProfile.findMany({
    where,
    select: { name: true, potency: true, potencySource: true },
    take: 500,
  });

  const gaps: Array<{ name: string; reason: string; potency: number[] }> = [];

  for (const p of profiles) {
    // Criterion 1: empty potency
    if (!p.potency || p.potency.length === 0) {
      gaps.push({ name: p.name, reason: 'empty_potency', potency: [] });
      continue;
    }

    // Criterion 2: wrong length
    if (p.potency.length < SENSORY_DIM_COUNT) {
      gaps.push({ name: p.name, reason: 'undersized_potency', potency: p.potency });
      continue;
    }

    // Criterion 3: sparse (too few non-trivial dims)
    const nonTrivial = p.potency.filter((v) => v > 0.5).length;
    if (nonTrivial < minSparse) {
      gaps.push({ name: p.name, reason: 'sparse_potency', potency: p.potency });
    }
  }

  return gaps;
}

// ── Anchor selection ─────────────────────────────────────────────────────

/**
 * Find 10 most-similar (by name+category) ingredient profiles to seed prompt.
 * Uses PROTECTED sources as authoritative anchors.
 */
async function selectAnchors(targetName: string, count: number = 10): Promise<Array<{
  name: string;
  potency: number[];
}>> {
  // Strategy: get anchors (PROTECTED sources) — name similarity sorting
  const anchors = await prisma.ingredientSensoryProfile.findMany({
    where: {
      potencySource: { in: [...PROTECTED_SOURCES] },
      potency: { isEmpty: false },
    },
    select: { name: true, potency: true },
    take: 100,
  });

  // Sort by name token overlap (poor-man's similarity for MVP)
  const targetTokens = new Set(targetName.toLowerCase().split(/\s+/));
  const scored = anchors.map((a) => {
    const aTokens = new Set(a.name.toLowerCase().split(/\s+/));
    const intersection = [...targetTokens].filter((t) => aTokens.has(t)).length;
    return { ...a, score: intersection };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((a) => ({ name: a.name, potency: a.potency }));
}

// ── AI prompt builder ────────────────────────────────────────────────────

function buildPotencyPrompt(targetName: string, anchors: Array<{ name: string; potency: number[] }>): { system: string; user: string } {
  const DIM_NAMES = [
    'Sweet','Salty','Sour','Bitter','Umami','Kokumi','Fatty',
    'Spicy','Pungent','Cooling','Astringent','Numbing','Carbonated','Warming',
    'Citrusy','Tropical','Berry','OrchardStone','OrchardPomme','Melon','DriedFruit',
    'FloralDelicate','FloralBold','BlossomCitrus','FloralHerbal',
    'FreshHerb','WoodyHerb','Grassy','Vegetal',
    'Resinous','BarrelAged','BarkWood',
    'WarmSweetSpice','SavorySpice','Pepper','ExoticCurry',
    'TreeNut','GroundNut','Seed',
    'CoffeeRoast','BreadCrust','MeatRoast','GrainToast','CocoaRoast',
    'ToffeeCaramel','BurntSugar','MapleSyrup','MolassesDark',
    'HardWoodSmoke','SoftWoodSmoke','Charred','ColdSmoke',
    'Allium','Brassica','ProteinSulfur',
    'Mushroom','RootTuber','Mineral','Musty',
    'FreshMilkCream','Butter','CulturedDairy','AgedCheese','BlueMoldyCheese',
    'LactoPickled','AceticVinegar','FishFermented','BeanFermented','SourdoughStarter',
    'BreadYeast','BeerBrewery','UmamiYeast',
    'Seaweed','Fish','Shellfish','Briny',
    'CookedMeat','CuredPreserved','Gamey','BrothStock',
    'Honey','TreeSyrup','MolassesCane',
    'Vanilla','DarkCocoa','MilkChocolate',
    'Crunchy','Crispy','Chewy','Tender','Firm','Fibrous',
    'Juicy','Moist','Dry',
    'Creamy','Silky','Oily','Grainy','Gummy','Starchy','Gelatinous','Foamy','Powdery','Sticky',
    'Temperature',
    'Rich','Complex','Fresh','Aged','Delicate','Bold','Body',
  ];

  const system = `You are a food science expert calibrating sensory profiles for a recipe matching system.

The system uses 113 independent sensory dimensions on a 0-6 scale (except Temperature which is -6 to +6, where 0 = room temperature).

Your task: given an ingredient and anchor ingredients (whose values are expert-validated), predict the target ingredient's values across all 113 dimensions.

STRICT REQUIREMENTS:
- Return a JSON object with: potency (array of exactly 113 floats 0-6, except index 105 which can be -6 to 6), confidence (0-1), reasoning (short text), sourceAnchors (array of anchor names you drew from).
- Most dimensions will be 0 for most ingredients — only non-zero on dims that actually apply.
- Base values on what a trained sensory panel would perceive.
- Cite which anchors informed your decision.
- Use conservative confidence: 0.9+ = certain from peer match, 0.75-0.89 = reasonable inference, 0.5-0.74 = uncertain.

Dimension names (0-112): ${DIM_NAMES.join(', ')}`;

  const anchorRows = anchors.map((a) => {
    const nonZero = a.potency
      .map((v, i) => (v > 0.5 ? `${DIM_NAMES[i]}=${v.toFixed(1)}` : ''))
      .filter(Boolean)
      .join(', ');
    return `  - ${a.name}: ${nonZero || '(all near-zero)'}`;
  }).join('\n');

  const user = `Target ingredient: "${targetName}"

Anchor ingredients (expert-validated):
${anchorRows}

Return calibrated 113-dim potency for "${targetName}" as JSON: { "potency": [...113 floats], "confidence": 0.0-1.0, "reasoning": "...", "sourceAnchors": [...names...] }`;

  return { system, user };
}

// ── Category inference from ingredient name ──────────────────────────────

/**
 * Infer an ingredient category from its name for calibration rule lookup.
 * Matches the categories used in docs/sensory-calibration-rules.md.
 */
function inferCategory(name: string): string | null {
  const n = name.toLowerCase();
  if (/\b(parmesan|cheddar|gruyere|gruyère|manchego|pecorino|aged.*cheese|gouda|comte|asiago)\b/.test(n)) return 'aged_cheese';
  if (/\b(blue|gorgonzola|roquefort|stilton|cabrales|danish blue)\b/.test(n)) return 'blue_cheese';
  if (/\b(mozzarella|ricotta|cottage|mascarpone|fromage.?blanc|queso.?fresco|burrata|paneer)\b/.test(n)) return 'fresh_cheese';
  if (/\b(cheese)\b/.test(n)) return 'cheese';

  if (/\b(garlic|onion|shallot|leek|chive|scallion|ramp)\b/.test(n)) {
    if (/\b(sauté|sautéed|caramelized|roasted|fried|cooked|boiled)\b/.test(n)) return 'cooked_allium';
    return 'raw_allium';
  }

  if (/\b(tomato|bell.?pepper|chili.?pepper|eggplant|tomatillo)\b/.test(n)) return 'nightshade';
  if (/\b(lemon|lime|orange|grapefruit|yuzu|bergamot|mandarin|kumquat|pomelo|citrus)\b/.test(n)) return 'citrus';
  if (/\b(basil|cilantro|parsley|dill|chive|tarragon|mint|fresh.?herb|oregano|thyme|sage|rosemary|bay)\b/.test(n) && /\bfresh\b/.test(n)) return 'fresh_herb';
  if (/\b(dried.?herb|dried.?basil|dried.?oregano|cumin|coriander|turmeric|cinnamon|clove|nutmeg|cardamom|allspice|paprika)\b/.test(n)) return 'dried_herb_spice';

  if (/\b(cabbage|broccoli|cauliflower|kale|brussels|radish|mustard.?greens|bok.?choy|collards)\b/.test(n)) return 'brassica';

  if (/\b(raw|uncooked)\b/.test(n) && /\b(beef|pork|chicken|lamb|turkey|duck|veal|fish|salmon|tuna)\b/.test(n)) return 'raw_protein';
  if (/\b(roasted|grilled|seared|braised|fried|smoked|cooked)\b/.test(n) && /\b(beef|pork|chicken|lamb|turkey|duck)\b/.test(n)) return 'cooked_protein';

  if (/\b(olive.?oil|butter|ghee|coconut.?oil|vegetable.?oil|lard|tallow|schmaltz|sesame.?oil)\b/.test(n)) return 'fats_oils';

  if (/\b(vinegar|miso|soy.?sauce|fish.?sauce|kimchi|sauerkraut|yogurt|kombucha|tempeh|natto|sourdough)\b/.test(n)) return 'fermented';

  if (/\b(bacon|prosciutto|pancetta|salami|jerky|pepperoni|chorizo|guanciale|ham)\b/.test(n)) return 'cured_meats';

  if (/\b(rice|pasta|bread|quinoa|oats|polenta|couscous|bulgur|farro|barley|flour)\b/.test(n)) return 'grains';
  if (/\b(sugar|honey|maple.?syrup|agave|molasses|date.?syrup|rice.?syrup|stevia|brown.?sugar)\b/.test(n)) return 'sweeteners';
  if (/\b(milk|cream|yogurt|sour.?cream|buttermilk|kefir|crème.?fraîche)\b/.test(n)) return 'dairy';
  if (/\b(apple|pear|banana|berry|strawberry|blueberry|peach|mango|pineapple|raspberry)\b/.test(n) && !/\b(juice|jam|sauce)\b/.test(n)) return 'fruits';
  if (/\b(mushroom|shiitake|porcini|truffle|cremini|oyster.?mushroom)\b/.test(n)) return 'mushrooms';
  if (/\b(shrimp|crab|lobster|clam|oyster|mussel|scallop|fish|salmon|tuna|cod|seaweed|nori|kombu)\b/.test(n)) return 'seafood';
  if (/\b(chocolate|cocoa|cacao)\b/.test(n)) return 'chocolate';

  return null;
}

// ── Validation (against CalibrationRule) ─────────────────────────────────

async function validateAgainstInvariants(ingredient: string, potency: number[]): Promise<{ valid: boolean; violations: string[] }> {
  // Derive category from ingredient name heuristically (no dedicated category column)
  const category = inferCategory(ingredient);
  if (!category) return { valid: true, violations: [] };

  const rules = await prisma.calibrationRule.findMany({
    where: {
      category,
      isActive: true,
    },
  });

  const violations: string[] = [];

  for (const rule of rules) {
    if (rule.dimensionIdx == null) continue;
    const val = potency[rule.dimensionIdx] ?? 0;
    let violated = false;

    switch (rule.operator) {
      case '>=':
        violated = rule.threshold != null && val < rule.threshold;
        break;
      case '<=':
        violated = rule.threshold != null && val > rule.threshold;
        break;
      case 'between':
        violated = (rule.threshold != null && val < rule.threshold) ||
                   (rule.thresholdHigh != null && val > rule.thresholdHigh);
        break;
      case '==':
        violated = rule.threshold != null && Math.abs(val - rule.threshold) > 0.1;
        break;
    }

    if (violated && rule.severity === 'error') {
      violations.push(`${rule.description} (got ${val.toFixed(2)}, expected ${rule.operator} ${rule.threshold})`);
    }
  }

  return { valid: violations.length === 0, violations };
}

// ── AI generation wrapper ────────────────────────────────────────────────

async function generatePotency(targetName: string): Promise<GeneratedPotency | null> {
  if (!isOpenAIEnabled()) {
    log.warn('Azure OpenAI not configured — skipping generation');
    return null;
  }

  const anchors = await selectAnchors(targetName, 10);
  if (anchors.length < 3) {
    log.warn({ targetName, anchorCount: anchors.length }, 'Too few anchors');
    return null;
  }

  const { system, user } = buildPotencyPrompt(targetName, anchors);
  const result = await generateJson(system, user);
  if (!result) return null;

  try {
    const parsed = JSON.parse(result.content) as {
      potency: number[];
      confidence: number;
      reasoning: string;
      sourceAnchors: string[];
    };

    // Validate structure
    if (!Array.isArray(parsed.potency) || parsed.potency.length !== SENSORY_DIM_COUNT) {
      log.warn({ targetName, len: parsed.potency?.length }, 'AI returned wrong potency length');
      return null;
    }
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      log.warn({ targetName, conf: parsed.confidence }, 'Invalid confidence');
      return null;
    }

    // Clamp values to scale bounds
    parsed.potency = parsed.potency.map((v, i) => {
      if (i === 105) return Math.max(-6, Math.min(6, v)); // Temperature bipolar
      return Math.max(0, Math.min(6, v));
    });

    return {
      ingredientName: targetName,
      potency: parsed.potency,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning || '',
      sourceAnchors: parsed.sourceAnchors || [],
    };
  } catch (err) {
    log.error({ err, targetName }, 'Failed to parse AI response');
    return null;
  }
}

// ── Main pipeline ────────────────────────────────────────────────────────

export interface EnhancementReport {
  gapsFound: number;
  autoApplied: number;
  queuedForReview: number;
  invariantFailures: number;
  aiFailures: number;
  duration: number; // ms
  details: Array<{
    ingredient: string;
    status: 'applied' | 'queued' | 'invariant_failed' | 'ai_failed';
    confidence?: number;
    violations?: string[];
  }>;
}

/**
 * Main entry point for autonomous enhancement.
 * Admin triggers via route; cron triggers via scheduler.
 */
export async function runEnhancement(options: {
  triggeredBy: string;
  category?: string;
  limit?: number;
  dryRun?: boolean;
}): Promise<EnhancementReport> {
  const start = Date.now();
  const limit = options.limit ?? 20;

  log.info({ options }, 'Starting enhancement run');

  const gaps = await findGaps({ category: options.category });
  const targets = gaps.slice(0, limit);

  const report: EnhancementReport = {
    gapsFound: gaps.length,
    autoApplied: 0,
    queuedForReview: 0,
    invariantFailures: 0,
    aiFailures: 0,
    duration: 0,
    details: [],
  };

  for (const gap of targets) {
    const generated = await generatePotency(gap.name);

    if (!generated) {
      report.aiFailures++;
      report.details.push({ ingredient: gap.name, status: 'ai_failed' });
      continue;
    }

    // Validate against invariants
    const validation = await validateAgainstInvariants(gap.name, generated.potency);
    if (!validation.valid) {
      report.invariantFailures++;
      report.details.push({
        ingredient: gap.name,
        status: 'invariant_failed',
        confidence: generated.confidence,
        violations: validation.violations,
      });
      continue;
    }

    // Auto-apply if confidence high enough, otherwise queue
    const shouldAutoApply = generated.confidence >= AUTO_APPLY_CONFIDENCE_THRESHOLD;

    if (options.dryRun) {
      report.details.push({
        ingredient: gap.name,
        status: shouldAutoApply ? 'applied' : 'queued',
        confidence: generated.confidence,
      });
      if (shouldAutoApply) report.autoApplied++;
      else report.queuedForReview++;
      continue;
    }

    if (shouldAutoApply) {
      // Apply: update profile with AI-generated values
      const existing = await prisma.ingredientSensoryProfile.findUnique({
        where: { name: gap.name },
        select: { id: true, potency: true, potencySource: true },
      });

      // Safety check: never overwrite protected sources
      if (existing && PROTECTED_SOURCES.has(existing.potencySource || '')) {
        log.warn({ ingredient: gap.name, source: existing.potencySource }, 'Refusing to overwrite protected source');
        continue;
      }

      await prisma.ingredientSensoryProfile.update({
        where: { name: gap.name },
        data: {
          potency: generated.potency,
          potencySource: 'ai_calibrated',
          confidenceScore: generated.confidence,
          compoundEvidence: {
            method: 'gpt-4.1-mini-gap-filler',
            reasoning: generated.reasoning,
            sourceAnchors: generated.sourceAnchors,
            generatedAt: new Date().toISOString(),
          } as object,
        },
      });

      // Audit log
      await prisma.ingredientChangeLog.create({
        data: {
          ingredientName: gap.name,
          changeType: 'potency_update',
          beforeJson: { potency: existing?.potency ?? [] } as object,
          afterJson: { potency: generated.potency, confidence: generated.confidence } as object,
          changedBy: `ai:gpt-4.1-mini`,
          reason: `Auto-enhancement: ${gap.reason}. ${generated.reasoning.slice(0, 200)}`,
        },
      });

      report.autoApplied++;
      report.details.push({
        ingredient: gap.name,
        status: 'applied',
        confidence: generated.confidence,
      });
    } else {
      // Queue for admin review (stored in changeLog with special type)
      await prisma.ingredientChangeLog.create({
        data: {
          ingredientName: gap.name,
          changeType: 'queued_proposal',
          beforeJson: { potency: gap.potency } as object,
          afterJson: {
            potency: generated.potency,
            confidence: generated.confidence,
            reasoning: generated.reasoning,
            sourceAnchors: generated.sourceAnchors,
          } as object,
          changedBy: `ai:gpt-4.1-mini`,
          reason: `Below auto-apply threshold (${generated.confidence.toFixed(2)} < ${AUTO_APPLY_CONFIDENCE_THRESHOLD})`,
        },
      });

      report.queuedForReview++;
      report.details.push({
        ingredient: gap.name,
        status: 'queued',
        confidence: generated.confidence,
      });
    }
  }

  report.duration = Date.now() - start;
  log.info(
    {
      gapsFound: report.gapsFound,
      autoApplied: report.autoApplied,
      queuedForReview: report.queuedForReview,
      invariantFailures: report.invariantFailures,
      aiFailures: report.aiFailures,
      duration: report.duration,
    },
    'Enhancement run complete'
  );

  return report;
}

log.info('sensory-ai-enhancer service loaded');
