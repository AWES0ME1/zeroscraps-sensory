/**
 * Seed script for Sensory Compound interaction model v2 (Phase 2).
 *
 * Seeds the CORE ruleset (~150 rules) for all 6 tiers. The full ~245-rule
 * catalog grows iteratively — this version covers the highest-impact rules
 * that make the pipeline work end-to-end.
 *
 * Tables populated:
 *   1. SensoryInteractionRule — Tier 1 (perceptual), Tier 3 (temporal), Tier 4 (carrier)
 *   2. PhysicalInteractionRule — Tier 2 chemistry rules
 *   3. FlavorClashRule — Tier 6 clash rules
 *   4. CombinationEmergence — Tier 5 named classical patterns
 *   5. DimensionDoseThreshold — per-dim dose ranges
 *
 * Run: cd server && npx ts-node src/scripts/seed-interaction-rules-v2.ts
 *      --dry-run to preview without writing
 *      --tier=N to seed only one tier (1/2/3/4/5/6/thresholds)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');
const TIER_ARG = process.argv.find((a) => a.startsWith('--tier='));
const TIER_FILTER = TIER_ARG ? TIER_ARG.split('=')[1] : null;

// ══════════════════════════════════════════════════════════════════════
// DIMENSION INDEX MAP (0-112)
// ══════════════════════════════════════════════════════════════════════

const DIM = {
  // TASTE (0-6)
  Sweet: 0, Salty: 1, Sour: 2, Bitter: 3, Umami: 4, Kokumi: 5, Fatty: 6,
  // CHEMESTHETIC (7-13)
  Spicy: 7, Pungent: 8, Cooling: 9, Astringent: 10, Numbing: 11, Carbonated: 12, Warming: 13,
  // FRUITY (14-20)
  Citrusy: 14, Tropical: 15, Berry: 16, OrchardStone: 17, OrchardPomme: 18, Melon: 19, DriedFruit: 20,
  // FLORAL (21-24)
  FloralDelicate: 21, FloralBold: 22, BlossomCitrus: 23, FloralHerbal: 24,
  // HERBAL/GREEN (25-28)
  FreshHerb: 25, WoodyHerb: 26, Grassy: 27, Vegetal: 28,
  // WOODY (29-31)
  Resinous: 29, BarrelAged: 30, BarkWood: 31,
  // SPICY-AROMATIC (32-35)
  WarmSweetSpice: 32, SavorySpice: 33, Pepper: 34, ExoticCurry: 35,
  // NUTTY (36-38)
  TreeNut: 36, GroundNut: 37, Seed: 38,
  // ROASTED (39-43)
  CoffeeRoast: 39, BreadCrust: 40, MeatRoast: 41, GrainToast: 42, CocoaRoast: 43,
  // CARAMELIZED (44-47)
  ToffeeCaramel: 44, BurntSugar: 45, MapleSyrup: 46, MolassesDark: 47,
  // SMOKY (48-51)
  HardWoodSmoke: 48, SoftWoodSmoke: 49, Charred: 50, ColdSmoke: 51,
  // SULFUROUS (52-54)
  Allium: 52, Brassica: 53, ProteinSulfur: 54,
  // EARTHY (55-58)
  Mushroom: 55, RootTuber: 56, Mineral: 57, Musty: 58,
  // DAIRY (59-63)
  FreshMilkCream: 59, Butter: 60, CulturedDairy: 61, AgedCheese: 62, BlueMoldyCheese: 63,
  // FERMENTED (64-68)
  LactoPickled: 64, AceticVinegar: 65, FishFermented: 66, BeanFermented: 67, SourdoughStarter: 68,
  // YEASTY (69-71)
  BreadYeast: 69, BeerBrewery: 70, UmamiYeast: 71,
  // MARINE (72-75)
  Seaweed: 72, Fish: 73, Shellfish: 74, Briny: 75,
  // MEATY (76-79)
  CookedMeat: 76, CuredPreserved: 77, Gamey: 78, BrothStock: 79,
  // SWEET-AROMATIC (80-82)
  Honey: 80, TreeSyrup: 81, MolassesCane: 82,
  // SPECIAL (83-85)
  Vanilla: 83, DarkCocoa: 84, MilkChocolate: 85,
  // TEXTURE MECHANICAL (86-91)
  Crunchy: 86, Crispy: 87, Chewy: 88, Tender: 89, Firm: 90, Fibrous: 91,
  // TEXTURE MOISTURE (92-94)
  Juicy: 92, Moist: 93, Dry: 94,
  // TEXTURE MOUTHFEEL (95-104)
  Creamy: 95, Silky: 96, Oily: 97, Grainy: 98, Gummy: 99, Starchy: 100,
  Gelatinous: 101, Foamy: 102, Powdery: 103, Sticky: 104,
  // TEMPERATURE (105)
  Temperature: 105,
  // CHARACTER (106-112)
  Rich: 106, Complex: 107, Fresh: 108, Aged: 109, Delicate: 110, Bold: 111, Body: 112,
};

// ══════════════════════════════════════════════════════════════════════
// TIER 1 — Perceptual dim math (reinforce, enhance, mask, synergy)
// ══════════════════════════════════════════════════════════════════════

const TIER1_RULES = [
  // --- ENHANCE: one dim amplifies another ---
  { ruleType: 'enhance', dimA: DIM.Salty, dimB: DIM.Sweet,
    doseCurve: [[0.001,0.1],[0.005,0.3],[0.015,0.2],[0.025,-0.1]],
    description: 'Salt at trace enhances Sweet (pinch in desserts); high salt clashes.' },
  { ruleType: 'enhance', dimA: DIM.Salty, dimB: DIM.Umami,
    doseCurve: [[0.001,0.1],[0.005,0.3],[0.015,0.5],[0.025,0.6]],
    description: 'Salt enhances Umami perception (MSG-NaCl synergy).' },
  { ruleType: 'enhance', dimA: DIM.Fatty, dimB: DIM.Rich,
    doseCurve: [[0.5,0.2],[1.0,0.4],[2.0,0.7],[3.0,0.9],[5.0,1.0]],
    description: 'Fat directly projects Rich character.' },
  { ruleType: 'enhance', dimA: DIM.Fatty, dimB: DIM.Spicy,
    doseCurve: [[0.5,0.12],[1.0,0.25],[2.0,0.40],[3.0,0.45],[5.0,0.40]],
    description: 'Fat carries capsaicin and amplifies initial spicy perception.' },
  { ruleType: 'enhance', dimA: DIM.Fatty, dimB: DIM.WarmSweetSpice,
    doseCurve: [[0.5,0.15],[1.0,0.30],[2.0,0.45],[3.0,0.55]],
    description: 'Fat carries warm spices (cinnamon in cream).' },
  { ruleType: 'enhance', dimA: DIM.Sour, dimB: DIM.Fresh,
    doseCurve: [[1.0,0.15],[2.0,0.30],[3.0,0.45],[5.0,0.55],[7.0,0.45]],
    description: 'Acid projects Fresh (ceviche, vinaigrettes).' },
  { ruleType: 'enhance', dimA: DIM.Cooling, dimB: DIM.Fresh,
    doseCurve: [[0.5,0.15],[1.0,0.30],[2.0,0.50],[3.0,0.65]],
    description: 'Menthol enhances Fresh (mojitos, mint sauces).' },
  { ruleType: 'enhance', dimA: DIM.Spicy, dimB: DIM.Warming,
    doseCurve: [[0.5,0.10],[1.0,0.22],[2.0,0.40],[3.0,0.55]],
    description: 'Capsaicin engages TRPV1 (thermal-hot perception).' },
  { ruleType: 'enhance', dimA: DIM.Umami, dimB: DIM.Kokumi,
    doseCurve: [[1.0,0.15],[2.0,0.30],[3.0,0.40],[5.0,0.50]],
    description: 'High-glutamate foods often carry γ-glutamyl peptides (kokumi).' },
  { ruleType: 'enhance', dimA: DIM.Sweet, dimB: DIM.ToffeeCaramel,
    doseCurve: [[1.0,0.15],[2.0,0.30],[3.0,0.40]],
    description: 'Sweet lifts caramelized-sugar aromatics.' },
  { ruleType: 'enhance', dimA: DIM.Salty, dimB: DIM.Briny,
    doseCurve: [[0.003,0.10],[0.008,0.22],[0.015,0.35]],
    description: 'Salt amplifies briny aromatics (raw bar, oyster liquor).' },

  // --- MASK: one dim suppresses another ---
  { ruleType: 'mask', dimA: DIM.Sweet, dimB: DIM.Bitter,
    doseCurve: [[1.0,-0.15],[2.0,-0.30],[3.0,-0.45],[5.0,-0.55]],
    description: 'Sweet masks Bitter (sugar in coffee).' },
  { ruleType: 'mask', dimA: DIM.Fatty, dimB: DIM.Spicy,
    doseCurve: [[0.5,-0.10],[1.0,-0.25],[2.0,-0.40],[3.0,-0.50]],
    description: 'Fat coats TRPV1 receptors, suppressing spicy over time (milk + chili).' },
  { ruleType: 'mask', dimA: DIM.Sour, dimB: DIM.Sweet,
    doseCurve: [[1.0,-0.05],[2.0,-0.12],[3.0,-0.20],[5.0,-0.30]],
    description: 'Acid cuts perceived sweetness.' },
  { ruleType: 'mask', dimA: DIM.Astringent, dimB: DIM.Sweet,
    doseCurve: [[1.0,-0.10],[2.0,-0.18],[3.0,-0.25]],
    description: 'Tannins suppress sweet perception.' },
  { ruleType: 'mask', dimA: DIM.Fatty, dimB: DIM.Astringent,
    doseCurve: [[1.0,-0.15],[2.0,-0.30],[3.0,-0.45]],
    description: 'Fat binds tannins, reducing astringency (cheese with wine).' },
  { ruleType: 'mask', dimA: DIM.Salty, dimB: DIM.Sour,
    doseCurve: [[0.010,-0.10],[0.020,-0.20]],
    description: 'High salt dampens sour perception.' },

  // --- SYNERGY: multiplicative combinations ---
  { ruleType: 'synergy', dimA: DIM.Umami, dimB: DIM.Umami,
    doseCurve: [[1.0,0.3],[2.0,0.7],[3.0,1.5],[5.0,2.5]],
    description: 'Glutamate + nucleotide (IMP/GMP) → 7-8x umami (dashi effect).',
    citations: ['Yamaguchi & Ninomiya (2000) J Nutr 130'] },
  { ruleType: 'synergy', dimA: DIM.Sweet, dimB: DIM.Sour,
    doseCurve: [[1.0,0.1],[2.0,0.2],[3.0,0.3]],
    description: 'Sweet-sour balance creates satisfying contrast.' },
  { ruleType: 'synergy', dimA: DIM.Kokumi, dimB: DIM.Rich,
    doseCurve: [[1.0,0.2],[2.0,0.4],[3.0,0.55]],
    description: 'Kokumi extends and amplifies Rich.' },

  // --- REINFORCE: same dim stacking (Stevens saturation) ---
  { ruleType: 'reinforce', dimA: DIM.Sweet, dimB: DIM.Sweet,
    doseCurve: [[2.0,0.9],[4.0,0.7],[6.0,0.5]],
    description: 'Multiple sweet sources saturate per Stevens Power Law.' },
  { ruleType: 'reinforce', dimA: DIM.Spicy, dimB: DIM.Spicy,
    doseCurve: [[2.0,1.0],[4.0,0.9],[6.0,0.7]],
    description: 'Multiple chili sources stack supralinearly at low dose.' },
  { ruleType: 'reinforce', dimA: DIM.Bitter, dimB: DIM.Bitter,
    doseCurve: [[2.0,0.6],[4.0,0.4],[6.0,0.25]],
    description: 'Bitter saturates faster than other tastes.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 3 — Temporal (order/timing effects)
// ══════════════════════════════════════════════════════════════════════

const TIER3_RULES = [
  { ruleType: 'temporal', ingredientA: 'garlic',
    doseCurve: [[10,-0.5],[30,-0.8],[45,-1.2]],
    description: 'Garlic mellows dramatically with prolonged cooking (>10min low heat).' },
  { ruleType: 'temporal', ingredientA: 'onion',
    doseCurve: [[15,-0.3],[30,-0.6],[60,-1.0]],
    description: 'Onion loses Sulfurous, gains Sweet during long sauté.' },
  { ruleType: 'temporal', ingredientA: 'fresh basil',
    doseCurve: [[5,-0.3],[15,-0.6],[30,-0.9]],
    description: 'Fresh basil loses volatile top notes early in cooking.' },
  { ruleType: 'temporal', ingredientA: 'lemon zest',
    doseCurve: [[5,-0.2],[15,-0.5],[30,-0.8]],
    description: 'Citrus zest volatiles burn off; add late for brightness.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 4 — Carrier effects
// ══════════════════════════════════════════════════════════════════════

const TIER4_RULES = [
  { ruleType: 'carry', dimA: DIM.Fatty, effectDim: DIM.Allium,
    doseCurve: [[0.5,0.15],[1.0,0.30],[2.0,0.40]],
    description: 'Fat carries allium sulfur compounds (garlic in oil).' },
  { ruleType: 'carry', dimA: DIM.Fatty, effectDim: DIM.WarmSweetSpice,
    doseCurve: [[0.5,0.15],[1.0,0.30],[2.0,0.45]],
    description: 'Fat extracts and carries warm spices (tadka, bloomed spices).' },
  { ruleType: 'carry', dimA: DIM.Sour, effectDim: DIM.Citrusy,
    doseCurve: [[1.0,0.10],[2.0,0.20],[3.0,0.30]],
    description: 'Acid brightens citrusy aromatics (ceviche).' },
  { ruleType: 'carry', dimA: DIM.Temperature, effectDim: DIM.WarmSweetSpice,
    doseCurve: [[2.0,0.15],[4.0,0.35],[6.0,0.50]],
    description: 'Heat releases volatile aromatics from dried spices (blooming).' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 2 — Physical/chemical interactions
// ══════════════════════════════════════════════════════════════════════

const TIER2_RULES = [
  { name: 'acid_in_dairy', category: 'denaturation',
    triggerA: { chemProp: 'acid', minValue: 0.5 },
    triggerB: { categoryB: 'Dairy' },
    doseCurve: [[0.005,0.1],[0.02,0.3],[0.05,0.5],[0.10,-0.8],[0.15,-1.5]],
    doseUnit: 'grams_ratio',
    effectDims: { [DIM.Silky]: 0, [DIM.Grainy]: 0 },
    stabilizers: ['egg yolk', 'mustard', 'high fat content', 'cold temperature'],
    description: 'Acid in dairy: trace brightens (Silky+), heavy curdles (Silky-, Grainy+).',
    citations: ['McGee (2004) On Food and Cooking ch 1.2'] },
  { name: 'enzyme_tenderize', category: 'denaturation',
    triggerA: { ingredientA: 'pineapple', minValue: 0.1 },
    triggerB: { categoryB: 'Meaty' },
    doseCurve: [[15,0.3],[30,0.5],[60,0.5],[120,-0.2],[240,-1.0]],
    doseUnit: 'time_minutes',
    effectDims: { [DIM.Tender]: 0 },
    stabilizers: [],
    description: 'Bromelain/papain tenderize meat; prolonged contact turns to mush.',
    citations: ['Maehashi et al. (2007) J Food Sci'] },
  { name: 'emulsion_stabilize', category: 'emulsion',
    triggerA: { chemProp: 'fat', minValue: 20 },
    triggerB: { chemProp: 'acid', minValue: 1 },
    doseCurve: [[0.1,0.3],[0.5,0.5],[1.0,0.6]],
    doseUnit: 'grams_ratio',
    effectDims: { [DIM.Silky]: 0, [DIM.Creamy]: 0 },
    stabilizers: ['egg yolk', 'mustard', 'lecithin'],
    description: 'Stable emulsion requires fat+water+emulsifier (mayo, hollandaise).' },
  { name: 'maillard_activation', category: 'browning',
    triggerA: { chemProp: 'protein', minValue: 5 },
    triggerB: { chemProp: 'sugar', minValue: 1 },
    doseCurve: [[140,0.3],[160,0.7],[180,1.0],[200,1.2]],
    doseUnit: 'temperature_celsius',
    effectDims: { [DIM.MeatRoast]: 0, [DIM.Umami]: 0, [DIM.Complex]: 0 },
    stabilizers: [],
    description: 'Maillard reaction: protein+sugar+heat produces flavor compounds.',
    citations: ['Hodge (1953) J Agric Food Chem'] },
  { name: 'caramelization', category: 'browning',
    triggerA: { chemProp: 'sugar', minValue: 5 },
    triggerB: { chemProp: 'moisture', minValue: 0 },
    doseCurve: [[160,0.4],[180,0.8],[200,1.1]],
    doseUnit: 'temperature_celsius',
    effectDims: { [DIM.ToffeeCaramel]: 0, [DIM.Sweet]: 0, [DIM.Complex]: 0 },
    stabilizers: [],
    description: 'Sugar + dry heat → caramelization.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 5 — Emergent patterns
// ══════════════════════════════════════════════════════════════════════

const EMERGENCES = [
  { name: 'mirepoix', cuisineContext: 'french',
    triggers: [{ ingredient: 'onion', minDose: 0.5 }, { ingredient: 'carrot', minDose: 0.3 }, { ingredient: 'celery', minDose: 0.3 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Complex]: 0.8, [DIM.BrothStock]: 0.5, [DIM.Umami]: 0.3 },
    emergentTags: ['french-base', 'savory-foundation'],
    harmonyBonus: 0.2,
    description: 'Classic French flavor base — sautéed onion, carrot, celery create complex umami foundation.',
    requiresMethod: ['sauté'] },
  { name: 'sofrito', cuisineContext: 'italian',
    triggers: [{ ingredient: 'onion', minDose: 0.5 }, { ingredient: 'garlic', minDose: 0.1 }, { ingredient: 'tomato', minDose: 0.5 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Complex]: 0.7, [DIM.Umami]: 0.5, [DIM.Sweet]: 0.3 },
    emergentTags: ['italian-base', 'mediterranean'],
    harmonyBonus: 0.2,
    description: 'Italian soffritto — onion+garlic+tomato simmered in olive oil.' },
  { name: 'holy_trinity', cuisineContext: 'creole',
    triggers: [{ ingredient: 'onion', minDose: 0.4 }, { ingredient: 'celery', minDose: 0.3 }, { ingredient: 'bell pepper', minDose: 0.4 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Complex]: 0.7, [DIM.Vegetal]: 0.4, [DIM.Umami]: 0.3 },
    emergentTags: ['cajun', 'creole', 'southern'],
    harmonyBonus: 0.2,
    description: 'Cajun/Creole holy trinity — onion+celery+bell pepper.' },
  { name: 'dashi_stack', cuisineContext: 'japanese',
    triggers: [{ ingredient: 'kombu', minDose: 0.1 }, { ingredient: 'bonito', minDose: 0.1 }],
    minTriggerCount: 2,
    emergentBoosts: { [DIM.Umami]: 2.0, [DIM.Kokumi]: 1.0, [DIM.BrothStock]: 0.8 },
    emergentTags: ['japanese-base', 'umami-foundation'],
    harmonyBonus: 0.3,
    description: 'Kombu (glutamate) + bonito (inosinate) → 7-8x umami synergy.',
    citations: ['Yamaguchi (1991) Physiology & Behavior'] },
  { name: 'bechamel', cuisineContext: 'french',
    triggers: [{ ingredient: 'butter', minDose: 0.1 }, { ingredient: 'flour', minDose: 0.1 }, { ingredient: 'milk', minDose: 0.5 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Creamy]: 1.5, [DIM.Silky]: 1.0, [DIM.Rich]: 0.8 },
    emergentTags: ['mother-sauce', 'french-classic'],
    harmonyBonus: 0.25,
    description: 'Béchamel: butter+flour roux finished with milk → silky mother sauce.',
    requiresMethod: ['simmer'] },
  { name: 'caprese', cuisineContext: 'italian',
    triggers: [{ ingredient: 'tomato', minDose: 0.3 }, { ingredient: 'mozzarella', minDose: 0.2 }, { ingredient: 'basil', minDose: 0.05 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Complex]: 1.0, [DIM.Fresh]: 0.5, [DIM.FreshHerb]: 0.3 },
    emergentTags: ['italian-classic', 'summer-salad'],
    harmonyBonus: 0.25,
    description: 'Tomato + mozzarella + basil + olive oil — emergent Italian classic.' },
  { name: 'umami_bomb',
    triggers: [{ category: 'Umami_source', minDose: 1.0 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Umami]: 1.5, [DIM.Kokumi]: 1.0, [DIM.Complex]: 0.5 },
    emergentTags: ['umami-forward', 'savory-intense'],
    harmonyBonus: 0.2,
    description: '3+ glutamate-rich ingredients (tomato+parmesan+mushroom+soy+miso) → multiplicative umami.' },
  { name: 'brown_butter',
    triggers: [{ ingredient: 'butter', minDose: 0.1 }],
    minTriggerCount: 1,
    emergentBoosts: { [DIM.TreeNut]: 1.5, [DIM.ToffeeCaramel]: 0.5, [DIM.MeatRoast]: 0.3 },
    emergentTags: ['technique', 'beurre-noisette'],
    harmonyBonus: 0.15,
    description: 'Butter cooked >120°C produces nutty, toffee-like beurre-noisette.',
    requiresMethod: ['sauté'], requiresTempRange: 'hot' },
  { name: 'caramelized_onion',
    triggers: [{ ingredient: 'onion', minDose: 0.5 }],
    minTriggerCount: 1,
    emergentBoosts: { [DIM.Sweet]: 2.0, [DIM.ToffeeCaramel]: 1.0, [DIM.Complex]: 0.5 },
    emergentTags: ['technique', 'long-cook'],
    harmonyBonus: 0.15,
    description: 'Onion slow-cooked >30min develops deep caramelization, losing sulfur.',
    requiresMethod: ['sauté'] },
  { name: 'masala_base', cuisineContext: 'indian',
    triggers: [{ ingredient: 'onion', minDose: 0.4 }, { ingredient: 'ginger', minDose: 0.05 }, { ingredient: 'garlic', minDose: 0.05 }, { ingredient: 'cumin', minDose: 0.01 }],
    minTriggerCount: 3,
    emergentBoosts: { [DIM.Complex]: 0.9, [DIM.WarmSweetSpice]: 0.5, [DIM.ExoticCurry]: 0.4 },
    emergentTags: ['indian-base', 'warming'],
    harmonyBonus: 0.25,
    description: 'Indian masala base: sautéed onion+ginger+garlic+warm spices.' },
];

// ══════════════════════════════════════════════════════════════════════
// TIER 6 — Clashes
// ══════════════════════════════════════════════════════════════════════

const CLASH_RULES = [
  // Category-level clashes
  { scopeType: 'category_pair', categoryA: 'Cooling', categoryB: 'Gamey',
    severityCurve: [[1.0,0.3],[2.0,0.5],[3.0,0.7]],
    cultures: ['western'], exceptions: ['lamb'],
    reason: 'Mint/menthol cooling clashes with aged/gamey meat (except lamb — classical pairing).' },
  { scopeType: 'category_pair', categoryA: 'FloralDelicate', categoryB: 'Brassica',
    severityCurve: [[1.0,0.2],[2.0,0.4],[3.0,0.5]],
    cultures: ['universal'], exceptions: [],
    reason: 'Delicate florals (rose, jasmine) clash with sulfurous brassicas.' },
  { scopeType: 'category_pair', categoryA: 'FloralDelicate', categoryB: 'FishFermented',
    severityCurve: [[1.0,0.4],[2.0,0.7],[3.0,0.8]],
    cultures: ['universal'], exceptions: [],
    reason: 'Delicate florals crushed by fermented fish funk.' },
  { scopeType: 'category_pair', categoryA: 'DarkCocoa', categoryB: 'Fish',
    severityCurve: [[1.0,0.4],[2.0,0.7],[3.0,0.9]],
    cultures: ['universal'], exceptions: ['oyster'],
    reason: 'Chocolate + fish clash (rare exceptions in avant-garde).' },
  { scopeType: 'category_pair', categoryA: 'BlueMoldyCheese', categoryB: 'Fish',
    severityCurve: [[1.0,0.3],[2.0,0.6],[3.0,0.7]],
    cultures: ['universal'], exceptions: [],
    reason: 'Blue cheese overpowers delicate fish.' },
  { scopeType: 'category_pair', categoryA: 'WarmSweetSpice', categoryB: 'FishFermented',
    severityCurve: [[1.0,0.3],[2.0,0.5],[3.0,0.7]],
    cultures: ['western'], exceptions: [],
    reason: 'Cinnamon/clove clash with fish sauce/anchovy in Western palate.' },

  // Ingredient-specific clashes
  { scopeType: 'ingredient_pair', ingredientA: 'mint', ingredientB: 'bacon',
    severityCurve: [[0.5,0.3],[1.0,0.5],[2.0,0.6]],
    cultures: ['western'], exceptions: [],
    reason: 'Mint + bacon clash — cooling vs smoky-cured meat.' },
  { scopeType: 'ingredient_pair', ingredientA: 'mint', ingredientB: 'salmon',
    severityCurve: [[0.5,0.2],[1.0,0.4],[2.0,0.5]],
    cultures: ['universal'], exceptions: [],
    reason: 'Mint overpowers delicate salmon.' },
  { scopeType: 'ingredient_pair', ingredientA: 'cinnamon', ingredientB: 'fresh fish',
    severityCurve: [[0.5,0.4],[1.0,0.6],[2.0,0.8]],
    cultures: ['universal'], exceptions: [],
    reason: 'Warm baking spice clashes with fresh fish.' },
  { scopeType: 'ingredient_pair', ingredientA: 'chocolate', ingredientB: 'tuna',
    severityCurve: [[0.5,0.7],[1.0,0.9]],
    cultures: ['universal'], exceptions: [],
    reason: 'Strong chocolate + fish flavor clash.' },
  { scopeType: 'ingredient_pair', ingredientA: 'lavender', ingredientB: 'garlic',
    severityCurve: [[0.5,0.2],[1.0,0.4]],
    cultures: ['universal'], exceptions: [],
    reason: 'Subtle floral clash with pungent sulfur — Provençal herb mix avoids this.' },
];

// ══════════════════════════════════════════════════════════════════════
// THRESHOLDS — per-dim dose ranges
// ══════════════════════════════════════════════════════════════════════

const THRESHOLDS = [
  { dimensionIdx: DIM.Sweet, context: 'savory', traceDose: 0.005, noticeable: 0.02, dominant: 0.05, overwhelming: 0.10 },
  { dimensionIdx: DIM.Sweet, context: 'dessert', traceDose: 0.02, noticeable: 0.08, dominant: 0.20, overwhelming: 0.35 },
  { dimensionIdx: DIM.Salty, context: 'savory', traceDose: 0.002, noticeable: 0.008, dominant: 0.015, overwhelming: 0.025 },
  { dimensionIdx: DIM.Salty, context: 'dessert', traceDose: 0.0005, noticeable: 0.002, dominant: 0.008, overwhelming: 0.015 },
  { dimensionIdx: DIM.Sour, context: 'any', traceDose: 0.001, noticeable: 0.005, dominant: 0.015, overwhelming: 0.030 },
  { dimensionIdx: DIM.Bitter, context: 'any', traceDose: 0.0003, noticeable: 0.001, dominant: 0.005, overwhelming: 0.015 },
  { dimensionIdx: DIM.Umami, context: 'any', traceDose: 0.001, noticeable: 0.005, dominant: 0.015, overwhelming: 0.030 },
  { dimensionIdx: DIM.Spicy, context: 'any', traceDose: 0.0001, noticeable: 0.0005, dominant: 0.002, overwhelming: 0.005 },
  { dimensionIdx: DIM.Fatty, context: 'any', traceDose: 0.01, noticeable: 0.05, dominant: 0.15, overwhelming: 0.40 },
  { dimensionIdx: DIM.Cooling, context: 'any', traceDose: 0.001, noticeable: 0.003, dominant: 0.010, overwhelming: 0.025 },
  { dimensionIdx: DIM.Astringent, context: 'any', traceDose: 0.001, noticeable: 0.005, dominant: 0.015, overwhelming: 0.030 },
  { dimensionIdx: DIM.Citrusy, context: 'any', traceDose: 0.001, noticeable: 0.005, dominant: 0.020, overwhelming: 0.050 },
  { dimensionIdx: DIM.Allium, context: 'any', traceDose: 0.001, noticeable: 0.005, dominant: 0.020, overwhelming: 0.050 },
  { dimensionIdx: DIM.WarmSweetSpice, context: 'any', traceDose: 0.0005, noticeable: 0.002, dominant: 0.008, overwhelming: 0.020 },
  { dimensionIdx: DIM.Rich, context: 'any', traceDose: 0.05, noticeable: 0.15, dominant: 0.35, overwhelming: 0.60 },
];

// ══════════════════════════════════════════════════════════════════════
// SEED LOGIC
// ══════════════════════════════════════════════════════════════════════

function doseCurveToJson(curve: (number | number[])[]): { points: { dose: number; effect: number }[] } {
  return {
    points: (curve as number[][]).map(([dose, effect]) => ({ dose, effect })),
  };
}

async function seedTier1() {
  console.log(`\n── TIER 1: Perceptual rules (${TIER1_RULES.length}) ──`);
  let created = 0;
  for (const rule of TIER1_RULES) {
    if (DRY_RUN) continue;
    const existing = await prisma.sensoryInteractionRule.findFirst({
      where: { tier: 'perceptual', ruleType: rule.ruleType, dimA: rule.dimA, dimB: rule.dimB },
    });
    const data = {
      tier: 'perceptual',
      ruleType: rule.ruleType,
      dimA: rule.dimA,
      dimB: rule.dimB,
      doseCurve: doseCurveToJson(rule.doseCurve) as object,
      doseUnit: 'dim_value',
      description: rule.description,
      source: 'literature',
      isActive: true,
    };
    if (existing) {
      await prisma.sensoryInteractionRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sensoryInteractionRule.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${TIER1_RULES.length - created}`);
}

async function seedTier2() {
  console.log(`\n── TIER 2: Physical/chemical (${TIER2_RULES.length}) ──`);
  let created = 0;
  for (const rule of TIER2_RULES) {
    if (DRY_RUN) continue;
    const existing = await prisma.physicalInteractionRule.findUnique({ where: { name: rule.name } });
    const data = {
      name: rule.name,
      category: rule.category,
      triggerA: rule.triggerA as object,
      triggerB: rule.triggerB as object,
      doseCurve: doseCurveToJson(rule.doseCurve) as object,
      doseUnit: rule.doseUnit,
      effectDims: rule.effectDims as object,
      stabilizers: rule.stabilizers,
      description: rule.description,
      citations: (rule as { citations?: string[] }).citations ?? [],
      isActive: true,
    };
    if (existing) {
      await prisma.physicalInteractionRule.update({ where: { name: rule.name }, data });
    } else {
      await prisma.physicalInteractionRule.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${TIER2_RULES.length - created}`);
}

async function seedTier3() {
  console.log(`\n── TIER 3: Temporal (${TIER3_RULES.length}) ──`);
  let created = 0;
  for (const rule of TIER3_RULES) {
    if (DRY_RUN) continue;
    const existing = await prisma.sensoryInteractionRule.findFirst({
      where: { tier: 'temporal', ingredientA: rule.ingredientA },
    });
    const data = {
      tier: 'temporal',
      ruleType: rule.ruleType,
      ingredientA: rule.ingredientA,
      doseCurve: doseCurveToJson(rule.doseCurve) as object,
      doseUnit: 'time_minutes',
      description: rule.description,
      source: 'literature',
      isActive: true,
    };
    if (existing) {
      await prisma.sensoryInteractionRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sensoryInteractionRule.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${TIER3_RULES.length - created}`);
}

async function seedTier4() {
  console.log(`\n── TIER 4: Carriers (${TIER4_RULES.length}) ──`);
  let created = 0;
  for (const rule of TIER4_RULES) {
    if (DRY_RUN) continue;
    const existing = await prisma.sensoryInteractionRule.findFirst({
      where: { tier: 'carrier', dimA: rule.dimA, effectDim: rule.effectDim },
    });
    const data = {
      tier: 'carrier',
      ruleType: 'carry',
      dimA: rule.dimA,
      effectDim: rule.effectDim,
      doseCurve: doseCurveToJson(rule.doseCurve) as object,
      doseUnit: 'dim_value',
      description: rule.description,
      source: 'literature',
      isActive: true,
    };
    if (existing) {
      await prisma.sensoryInteractionRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.sensoryInteractionRule.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${TIER4_RULES.length - created}`);
}

async function seedTier5() {
  console.log(`\n── TIER 5: Emergences (${EMERGENCES.length}) ──`);
  let created = 0;
  for (const e of EMERGENCES) {
    if (DRY_RUN) continue;
    const existing = await prisma.combinationEmergence.findUnique({ where: { name: e.name } });
    const data = {
      name: e.name,
      cuisineContext: e.cuisineContext ?? null,
      triggers: e.triggers as object,
      minTriggerCount: e.minTriggerCount,
      requiresMethod: (e as { requiresMethod?: string[] }).requiresMethod ?? [],
      requiresTempRange: (e as { requiresTempRange?: string }).requiresTempRange ?? null,
      emergentBoosts: e.emergentBoosts as object,
      emergentTags: e.emergentTags,
      harmonyBonus: e.harmonyBonus,
      description: e.description,
      citations: (e as { citations?: string[] }).citations ?? [],
      isActive: true,
    };
    if (existing) {
      await prisma.combinationEmergence.update({ where: { name: e.name }, data });
    } else {
      await prisma.combinationEmergence.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${EMERGENCES.length - created}`);
}

async function seedTier6() {
  console.log(`\n── TIER 6: Clashes (${CLASH_RULES.length}) ──`);
  let created = 0;
  for (const c of CLASH_RULES) {
    if (DRY_RUN) continue;
    const existing = await prisma.flavorClashRule.findFirst({
      where: {
        scopeType: c.scopeType,
        ingredientA: c.scopeType === 'ingredient_pair' ? c.ingredientA : undefined,
        ingredientB: c.scopeType === 'ingredient_pair' ? c.ingredientB : undefined,
        categoryA: c.scopeType === 'category_pair' ? c.categoryA : undefined,
        categoryB: c.scopeType === 'category_pair' ? c.categoryB : undefined,
      },
    });
    const data = {
      scopeType: c.scopeType,
      ingredientA: (c as { ingredientA?: string }).ingredientA ?? null,
      ingredientB: (c as { ingredientB?: string }).ingredientB ?? null,
      categoryA: (c as { categoryA?: string }).categoryA ?? null,
      categoryB: (c as { categoryB?: string }).categoryB ?? null,
      severityCurve: doseCurveToJson(c.severityCurve) as object,
      doseUnit: 'dim_value',
      cultures: c.cultures,
      exceptions: c.exceptions,
      reason: c.reason,
      isActive: true,
    };
    if (existing) {
      await prisma.flavorClashRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.flavorClashRule.create({ data });
      created++;
    }
  }
  console.log(`  Created: ${created}, updated: ${CLASH_RULES.length - created}`);
}

async function seedThresholds() {
  console.log(`\n── Dose thresholds (${THRESHOLDS.length}) ──`);
  let created = 0;
  for (const t of THRESHOLDS) {
    if (DRY_RUN) continue;
    await prisma.dimensionDoseThreshold.upsert({
      where: { dimensionIdx_context: { dimensionIdx: t.dimensionIdx, context: t.context } },
      update: { traceDose: t.traceDose, noticeable: t.noticeable, dominant: t.dominant, overwhelming: t.overwhelming },
      create: t,
    });
    created++;
  }
  console.log(`  Upserted: ${created}`);
}

async function main() {
  console.log('\n=== Seed Sensory Interaction Rules v2 ===');
  if (DRY_RUN) console.log('  [DRY RUN — no writes]');
  if (TIER_FILTER) console.log(`  [Tier filter: ${TIER_FILTER}]`);

  if (!TIER_FILTER || TIER_FILTER === '1') await seedTier1();
  if (!TIER_FILTER || TIER_FILTER === '2') await seedTier2();
  if (!TIER_FILTER || TIER_FILTER === '3') await seedTier3();
  if (!TIER_FILTER || TIER_FILTER === '4') await seedTier4();
  if (!TIER_FILTER || TIER_FILTER === '5') await seedTier5();
  if (!TIER_FILTER || TIER_FILTER === '6') await seedTier6();
  if (!TIER_FILTER || TIER_FILTER === 'thresholds') await seedThresholds();

  const total =
    TIER1_RULES.length + TIER2_RULES.length + TIER3_RULES.length +
    TIER4_RULES.length + EMERGENCES.length + CLASH_RULES.length + THRESHOLDS.length;

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  TOTAL RULES SEEDED: ${total}`);
  console.log(`    Tier 1 (perceptual): ${TIER1_RULES.length}`);
  console.log(`    Tier 2 (physical):   ${TIER2_RULES.length}`);
  console.log(`    Tier 3 (temporal):   ${TIER3_RULES.length}`);
  console.log(`    Tier 4 (carrier):    ${TIER4_RULES.length}`);
  console.log(`    Tier 5 (emergence):  ${EMERGENCES.length}`);
  console.log(`    Tier 6 (clash):      ${CLASH_RULES.length}`);
  console.log(`    Thresholds:          ${THRESHOLDS.length}`);
  console.log(`═══════════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
