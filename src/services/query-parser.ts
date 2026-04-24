/**
 * Sensory Query Parser — turns natural language into target vector.
 *
 * Input:  "funky and crunchy, not too spicy"
 * Output: { positiveVector: [...], avoidanceVector: [...], mustHave: [...], modifiers }
 *
 * Pipeline:
 *   1. Tokenize into words
 *   2. Detect modifier prefixes (very, slightly, not, without, mostly, lightly)
 *   3. Resolve each descriptor via SensoryDescriptor table
 *   4. Apply modifier weights
 *   5. Aggregate into target vector + avoidance filter
 *
 * The target vector is used for pgvector similarity search.
 * The avoidance filter removes recipes that score high on forbidden dims.
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('sensory-query');
const SENSORY_DIM_COUNT = 113;
const CACHE_TTL_MS = 10 * 60 * 1000;

// ── Types ────────────────────────────────────────────────────────────────

export interface ParsedQuery {
  positiveVector: number[];      // 113 dims
  avoidanceVector: number[];     // 113 dims, used to filter recipes
  mustHave: string[];            // descriptors resolved (for explanation)
  mustAvoid: string[];           // avoidance terms (for explanation)
  unresolved: string[];          // descriptors we didn't recognize
  cuisineContext: string | null; // if query includes cuisine hint
  courseHint: string | null;     // starter/main/dessert/etc.
  temperatureHint: 'hot' | 'cold' | 'warm' | 'room' | null;
}

// ── Descriptor cache ─────────────────────────────────────────────────────

interface DescriptorCacheEntry {
  term: string;
  category: string | null;
  dimMappings: Record<string, number>;
  aliases: string[];
}

let descriptorCache: {
  byTerm: Map<string, DescriptorCacheEntry>;
  loadedAt: number;
} | null = null;

async function loadDescriptors(): Promise<Map<string, DescriptorCacheEntry>> {
  if (descriptorCache && Date.now() - descriptorCache.loadedAt < CACHE_TTL_MS) {
    return descriptorCache.byTerm;
  }

  const all = await prisma.sensoryDescriptor.findMany({
    where: { isActive: true },
    select: { term: true, category: true, dimMappings: true, aliases: true },
  });

  const map = new Map<string, DescriptorCacheEntry>();
  for (const d of all) {
    const entry: DescriptorCacheEntry = {
      term: d.term,
      category: d.category,
      dimMappings: d.dimMappings as Record<string, number>,
      aliases: d.aliases,
    };
    map.set(d.term.toLowerCase(), entry);
    for (const alias of d.aliases) {
      map.set(alias.toLowerCase(), entry);
    }
  }

  descriptorCache = { byTerm: map, loadedAt: Date.now() };
  return map;
}

export function invalidateQueryCache(): void {
  descriptorCache = null;
}

// ── Modifier detection ───────────────────────────────────────────────────

const MODIFIERS: Record<string, { multiplier: number; avoidance: boolean }> = {
  very: { multiplier: 1.3, avoidance: false },
  intensely: { multiplier: 1.5, avoidance: false },
  richly: { multiplier: 1.3, avoidance: false },
  super: { multiplier: 1.4, avoidance: false },
  extremely: { multiplier: 1.5, avoidance: false },
  slightly: { multiplier: 0.5, avoidance: false },
  lightly: { multiplier: 0.6, avoidance: false },
  barely: { multiplier: 0.3, avoidance: false },
  mostly: { multiplier: 1.0, avoidance: false },
  not: { multiplier: 1.0, avoidance: true },
  no: { multiplier: 1.0, avoidance: true },
  without: { multiplier: 1.0, avoidance: true },
  never: { multiplier: 1.0, avoidance: true },
  avoid: { multiplier: 1.0, avoidance: true },
};

const CUISINE_TERMS = new Set([
  'italian', 'french', 'japanese', 'chinese', 'indian', 'mexican', 'thai',
  'mediterranean', 'asian', 'american', 'spanish', 'greek', 'vietnamese',
  'korean', 'middle-eastern', 'cajun', 'creole', 'southern',
]);

const COURSE_TERMS: Record<string, string> = {
  starter: 'starter', appetizer: 'starter', 'hors d\'oeuvre': 'starter',
  main: 'main', entree: 'main', 'entrée': 'main', dinner: 'main',
  side: 'side',
  dessert: 'dessert', pudding: 'dessert', sweet: 'dessert',
  snack: 'snack',
  breakfast: 'breakfast', brunch: 'breakfast',
  sauce: 'sauce',
  soup: 'main',
  salad: 'starter',
};

const TEMPERATURE_TERMS: Record<string, 'hot' | 'cold' | 'warm' | 'room'> = {
  hot: 'hot', piping: 'hot', steaming: 'hot',
  cold: 'cold', chilled: 'cold', icy: 'cold', frozen: 'cold',
  warm: 'warm',
  'room-temperature': 'room', 'room-temp': 'room',
};

// ── Tokenizer ────────────────────────────────────────────────────────────

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[,;]/g, ' ')  // commas/semicolons → space
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t.length > 0 && t !== 'and' && t !== 'or' && t !== 'a' && t !== 'an' && t !== 'the');
}

// ── Main parser ──────────────────────────────────────────────────────────

export async function parseQuery(query: string): Promise<ParsedQuery> {
  const descriptors = await loadDescriptors();
  const tokens = tokenize(query);

  const positive = new Array(SENSORY_DIM_COUNT).fill(0);
  const avoidance = new Array(SENSORY_DIM_COUNT).fill(0);
  const mustHave: string[] = [];
  const mustAvoid: string[] = [];
  const unresolved: string[] = [];

  let cuisineContext: string | null = null;
  let courseHint: string | null = null;
  let temperatureHint: 'hot' | 'cold' | 'warm' | 'room' | null = null;

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    // Modifier?
    const modifier = MODIFIERS[token];
    if (modifier && i + 1 < tokens.length) {
      // Check if next token is "too" (e.g., "not too spicy" — still avoidance, dampened)
      let nextIdx = i + 1;
      let additionalDampen = 1.0;
      if (tokens[nextIdx] === 'too') {
        additionalDampen = 0.7;
        nextIdx++;
      }
      if (nextIdx >= tokens.length) {
        i++;
        continue;
      }
      const targetToken = tokens[nextIdx];
      const desc = descriptors.get(targetToken);
      if (desc) {
        applyDescriptor(
          desc,
          modifier.multiplier * additionalDampen,
          modifier.avoidance ? avoidance : positive,
          modifier.avoidance
        );
        if (modifier.avoidance) mustAvoid.push(targetToken);
        else mustHave.push(targetToken);
        i = nextIdx + 1;
        continue;
      }
      unresolved.push(targetToken);
      i = nextIdx + 1;
      continue;
    }

    // Cuisine?
    if (CUISINE_TERMS.has(token)) {
      cuisineContext = token;
      // Also apply as descriptor if mapped
      const desc = descriptors.get(token);
      if (desc) applyDescriptor(desc, 0.7, positive, false);
      i++;
      continue;
    }

    // Course?
    if (COURSE_TERMS[token]) {
      courseHint = COURSE_TERMS[token];
      i++;
      continue;
    }

    // Temperature?
    if (TEMPERATURE_TERMS[token]) {
      temperatureHint = TEMPERATURE_TERMS[token];
      i++;
      continue;
    }

    // Plain descriptor
    const desc = descriptors.get(token);
    if (desc) {
      applyDescriptor(desc, 1.0, positive, false);
      mustHave.push(token);
      i++;
      continue;
    }

    unresolved.push(token);
    i++;
  }

  // Normalize positive vector: cap values at 1.0 (representing max preference)
  for (let d = 0; d < SENSORY_DIM_COUNT; d++) {
    if (positive[d] > 1.0) positive[d] = 1.0;
    if (avoidance[d] > 1.0) avoidance[d] = 1.0;
  }

  return {
    positiveVector: positive,
    avoidanceVector: avoidance,
    mustHave,
    mustAvoid,
    unresolved,
    cuisineContext,
    courseHint,
    temperatureHint,
  };
}

function applyDescriptor(
  desc: DescriptorCacheEntry,
  multiplier: number,
  target: number[],
  isAvoidance: boolean
): void {
  for (const [dimStr, weight] of Object.entries(desc.dimMappings)) {
    const dim = parseInt(dimStr, 10);
    if (isNaN(dim) || dim < 0 || dim >= SENSORY_DIM_COUNT) continue;
    let w = weight as number;

    // Temperature descriptors have special meaning: set absolute target
    if (desc.term in { hot: 1, cold: 1, warm: 1, frozen: 1, icy: 1 } && dim === 105) {
      target[dim] = w;
      continue;
    }

    // For avoidance, preserve positive weights (we filter against them)
    if (isAvoidance) {
      target[dim] = Math.max(target[dim] ?? 0, Math.abs(w) * multiplier);
    } else {
      target[dim] = (target[dim] ?? 0) + w * multiplier;
    }
  }

  // Bump popularity counter (fire-and-forget)
  prisma.sensoryDescriptor
    .update({
      where: { term: desc.term },
      data: { searchCount: { increment: 1 } },
    })
    .catch(() => void 0);
}

// ── Query explanation ────────────────────────────────────────────────────

export function explainQuery(parsed: ParsedQuery): string {
  const parts: string[] = [];

  if (parsed.mustHave.length > 0) {
    parts.push(`wants: ${parsed.mustHave.join(', ')}`);
  }
  if (parsed.mustAvoid.length > 0) {
    parts.push(`avoids: ${parsed.mustAvoid.join(', ')}`);
  }
  if (parsed.cuisineContext) {
    parts.push(`cuisine: ${parsed.cuisineContext}`);
  }
  if (parsed.courseHint) {
    parts.push(`course: ${parsed.courseHint}`);
  }
  if (parsed.temperatureHint) {
    parts.push(`temp: ${parsed.temperatureHint}`);
  }
  if (parsed.unresolved.length > 0) {
    parts.push(`unrecognized: ${parsed.unresolved.join(', ')}`);
  }

  return parts.join(' | ') || 'empty query';
}

log.info('sensory-query-parser module loaded');
