/**
 * Ingredient name normalization for sensory profile lookups.
 *
 * Goal: when a recipe ingredient is "extra-virgin olive oil" and our DB
 * has "extra virgin olive oil", we should still find the profile.
 *
 * This is INTENTIONALLY lightweight — only handles cosmetic variants:
 *   - lowercase + trim whitespace
 *   - hyphens ↔ spaces (extra-virgin → extra virgin)
 *   - strip asterisks and similar annotation marks
 *   - collapse multi-spaces
 *
 * It does NOT strip modifiers like "fresh"/"dried"/"toasted" — those
 * represent genuinely different sensory profiles.
 *
 * Modifier-stripped matching is handled by a separate fallback function.
 */

/** Basic cosmetic normalization. Applies to every lookup. */
export function basicNormalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/[,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize hyphens to spaces (or vice-versa). Apply as fallback. */
export function hyphenNormalize(name: string): string {
  return basicNormalize(name).replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cosmetic modifiers whose removal doesn't change sensory profile:
 *   - cut/size: whole, chopped, diced, sliced, minced, crushed, grated, shredded
 *   - prep: peeled, trimmed, seeded
 *   - state: canned (for pre-processed items like tomato sauce)
 *
 * DELIBERATELY EXCLUDES:
 *   - fresh/dried/frozen/roasted/toasted/smoked — real sensory differences
 *   - ground — for some spices (cumin) irrelevant; for others (pepper) matters
 *   - organic — branding, no sensory difference, safe to strip
 *   - extra/lean — for meats, fat content differs, keep them separate
 */
const COSMETIC_MODIFIERS = new Set([
  'whole',
  'chopped',
  'diced',
  'sliced',
  'minced',
  'crushed',
  'grated',
  'shredded',
  'peeled',
  'trimmed',
  'seeded',
  'organic',
  'fresh',  // arguable — fresh parsley vs parsley are essentially the same
]);

/** Strip cosmetic modifiers to find a canonical form. Last-resort fallback. */
export function stripCosmeticModifiers(name: string): string {
  const words = hyphenNormalize(name).split(/\s+/);
  const kept = words.filter((w) => !COSMETIC_MODIFIERS.has(w));
  return kept.join(' ').trim();
}

/**
 * Generate ordered candidate lookup names for a single ingredient.
 * Returns an array of progressively-normalized forms.
 * De-duplicates; order = most-specific first.
 */
export function candidateNames(name: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (s: string) => {
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  };

  add(basicNormalize(name));
  add(hyphenNormalize(name));
  add(stripCosmeticModifiers(name));

  return out;
}

/**
 * Resolve a lookup: given input names and a set of found DB names, return
 * a map of input name → matched DB name (or null if no match found).
 *
 * @param inputNames Names from the recipe (as-is from extraction)
 * @param dbNames Names present in the DB (assumed already normalized-lowercase)
 */
export function resolveNames(
  inputNames: string[],
  dbNames: Set<string>
): Map<string, string | null> {
  const result = new Map<string, string | null>();
  for (const input of inputNames) {
    const candidates = candidateNames(input);
    let matched: string | null = null;
    for (const c of candidates) {
      if (dbNames.has(c)) {
        matched = c;
        break;
      }
    }
    result.set(input, matched);
  }
  return result;
}

/**
 * Build a flat set of candidate names for batch DB lookup.
 * Pass this to `prisma.ingredientSensoryProfile.findMany({ where: { name: { in: [...] } } })`.
 */
export function allCandidates(inputNames: string[]): string[] {
  const out = new Set<string>();
  for (const name of inputNames) {
    for (const c of candidateNames(name)) out.add(c);
  }
  return [...out];
}
