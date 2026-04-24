/**
 * Seed CalibrationRule records
 *
 * Source of truth: docs/sensory-calibration-rules.md
 * Seeds ~100 rules across 22 ingredient categories + cross-category invariants.
 *
 * Run:
 *   cd server && npx ts-node src/scripts/seed-calibration-rules.ts
 *   cd server && npx ts-node src/scripts/seed-calibration-rules.ts --dry-run
 *   cd server && npx ts-node src/scripts/seed-calibration-rules.ts --category=cheese
 *
 * Idempotent — looks up existing rows by (category, subCategory, dimensionIdx, operator) and update-or-creates.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';

// ══════════════════════════════════════════════════════════════════════
// Dimension index reference (see docs/sensory-dimension-reference.md)
// ══════════════════════════════════════════════════════════════════════

// Tastes
const D_SWEET = 0;
const D_SALTY = 1;
const D_SOUR = 2;
const D_BITTER = 3;
const D_UMAMI = 4;
const D_KOKUMI = 5;
const D_FATTY = 6;
// Trigeminal / somatosensory
const D_SPICY = 7;
const D_PUNGENT = 8;
const D_COOLING = 9;
const D_ASTRINGENT = 10;
const D_WARMING = 13;
// Fruit-family aromas
const D_CITRUSY = 14;
const D_TROPICAL = 15;
const D_BERRY = 16;
const D_DRIED_FRUIT = 20;
// Herbal/green aromas
const D_FRESH_HERB = 25;
const D_WOODY_HERB = 26;
const D_GRASSY = 27;
const D_VEGETAL = 28;
const D_RESINOUS = 29;
// Warm sweet / spicy aromatic
const D_WARM_SWEET_SPICE = 32;
const D_SAVORY_SPICE = 33;
const D_PEPPER = 34;
// Nutty
const D_TREE_NUT = 36;
const D_GROUND_NUT = 37;
// Roasted
const D_BREAD_CRUST = 40;
const D_MEAT_ROAST = 41;
const D_GRAIN_TOAST = 42;
const D_COCOA_ROAST = 43;
// Caramelized
const D_TOFFEE_CARAMEL = 44;
const D_BURNT_SUGAR = 45;
const D_MOLASSES_DARK = 47;
// Smoky
const D_HARD_WOOD_SMOKE = 48;
// Sulfurous/veg
const D_ALLIUM = 52;
const D_BRASSICA = 53;
const D_PROTEIN_SULFUR = 54;
const D_MUSHROOM = 55;
const D_MINERAL = 57;
// Dairy
const D_FRESH_MILK_CREAM = 59;
const D_BUTTER = 60;
const D_CULTURED_DAIRY = 61;
const D_AGED_CHEESE = 62;
const D_BLUE_MOLDY = 63;
// Fermented
const D_LACTO_PICKLED = 64;
const D_ACETIC_VINEGAR = 65;
const D_FISH_FERMENTED = 66;
const D_BEAN_FERMENTED = 67;
const D_SOURDOUGH_STARTER = 68;
const D_BREAD_YEAST = 69;
// Marine
const D_SEAWEED = 72;
const D_FISH = 73;
const D_SHELLFISH = 74;
const D_BRINY = 75;
// Meat
const D_COOKED_MEAT = 76;
const D_CURED_PRESERVED = 77;
const D_BROTH_STOCK = 79;
// Sweeteners
const D_HONEY = 80;
const D_MOLASSES_CANE = 82;
// Chocolate
const D_DARK_COCOA = 84;
const D_MILK_CHOCOLATE = 85;
// Textures
const D_CRUNCHY = 86;
const D_CRISPY = 87;
const D_CHEWY = 88;
const D_TENDER = 89;
const D_JUICY = 92;
const D_MOIST = 93;
const D_CREAMY = 95;
const D_SILKY = 96;
const D_OILY = 97;
const D_STARCHY = 100;
// Character
const D_RICH = 106;
const D_FRESH = 108;
const D_AGED = 109;

// ══════════════════════════════════════════════════════════════════════
// Rule type definition
// ══════════════════════════════════════════════════════════════════════

type Severity = 'error' | 'warning';

interface RuleSeed {
  category: string;
  subCategory?: string | null;
  ruleType: 'min' | 'max' | 'range' | 'relation' | 'presence';
  dimensionIdx?: number | null;
  operator: '>=' | '<=' | 'between' | '==' | 'exists' | 'relation';
  threshold?: number | null;
  thresholdHigh?: number | null;
  relatedDim?: number | null;
  appliesWhen?: Record<string, unknown> | null;
  severity: Severity;
  description: string;
  rationale?: string | null;
  examples?: { pass?: string[]; fail?: string[] } | null;
  citations?: string[];
}

// ══════════════════════════════════════════════════════════════════════
// 1. AGED CHEESES (5 rules)
// ══════════════════════════════════════════════════════════════════════

const AGED_CHEESE_RULES: RuleSeed[] = [
  {
    category: 'cheese',
    subCategory: 'aged_cheese',
    ruleType: 'min',
    dimensionIdx: D_AGED_CHEESE, // 62 — Aged Cheese dim explicitly; Fermented character implicit in this dim
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Aged cheeses must have Aged Cheese (fermented character) >= 2.0',
    rationale: 'Aged cheeses are fermented products — enzymatic protein breakdown over months produces the characteristic cheesy/savory fermented notes measured on the Aged Cheese dim (62).',
    examples: { pass: ['parmesan', 'cheddar', 'gruyere', 'manchego', 'pecorino'], fail: ['mozzarella (use fresh_cheese category)'] },
  },
  {
    category: 'cheese',
    subCategory: 'aged_cheese',
    ruleType: 'min',
    dimensionIdx: D_AGED_CHEESE,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Aged cheeses must have Aged Cheese (dim 62) >= 3.0',
    rationale: 'Dimension 62 explicitly defines the aged cheese category.',
    examples: { pass: ['parmesan Aged Cheese=5.0', 'cheddar Aged Cheese=4.0'], fail: ['mozzarella Aged Cheese=0.5'] },
  },
  {
    category: 'cheese',
    subCategory: 'aged_cheese',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Aged cheeses must have Umami >= 2.0',
    rationale: 'Protein breakdown during aging produces free glutamate, driving strong umami.',
    examples: { pass: ['parmesan Umami=4.14 (Wageningen panel)', 'cheddar Umami=4.0'], fail: [] },
    citations: ['Wageningen flavor panel'],
  },
  {
    category: 'cheese',
    subCategory: 'aged_cheese',
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Aged cheeses must have Rich >= 3.0',
    rationale: 'Fat content (28-35g/100g typical) with concentration from moisture loss during aging.',
    examples: { pass: ['parmesan Rich=5.0', 'cheddar Rich=5.0'], fail: [] },
  },
  {
    category: 'cheese',
    subCategory: 'aged_cheese',
    ruleType: 'min',
    dimensionIdx: D_AGED,
    operator: '>=',
    threshold: 2.0,
    severity: 'warning',
    description: 'Aged cheeses should register on the Aged character dim (109) >= 2.0',
    rationale: 'Aged cheeses by definition should map onto the "aged" character dim.',
    examples: { pass: ['parmesan Aged=3.0', 'cheddar Aged=2.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 2. BLUE CHEESES (4 rules)
// ══════════════════════════════════════════════════════════════════════

const BLUE_CHEESE_RULES: RuleSeed[] = [
  {
    category: 'cheese',
    subCategory: 'blue_cheese',
    ruleType: 'min',
    dimensionIdx: D_BLUE_MOLDY, // 63
    operator: '>=',
    threshold: 4.0,
    severity: 'error',
    description: 'Blue cheeses must have Blue-Moldy Cheese (dim 63) >= 4.0',
    rationale: 'Penicillium roqueforti / glaucum colonies produce the characteristic blue-mold aroma; this dim explicitly captures it.',
    examples: { pass: ['gorgonzola', 'roquefort', 'stilton', 'cabrales', 'danish blue'], fail: [] },
  },
  {
    category: 'cheese',
    subCategory: 'blue_cheese',
    ruleType: 'min',
    dimensionIdx: D_AGED_CHEESE, // 62 — blue cheeses are also aged/fermented
    operator: '>=',
    threshold: 4.0,
    severity: 'error',
    description: 'Blue cheeses must have Aged Cheese (fermented character) >= 4.0',
    rationale: 'Blue cheeses undergo primary lactic fermentation PLUS mold fermentation — deeply fermented.',
    examples: { pass: ['gorgonzola', 'roquefort'], fail: [] },
  },
  {
    category: 'cheese',
    subCategory: 'blue_cheese',
    ruleType: 'min',
    dimensionIdx: D_PUNGENT,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Blue cheeses must have Pungent >= 3.0',
    rationale: 'Mold-produced methyl ketones (2-heptanone, 2-nonanone) give blue cheese its sharp, pungent character.',
    examples: { pass: ['roquefort', 'stilton'], fail: [] },
  },
  {
    category: 'cheese',
    subCategory: 'blue_cheese',
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 3.0,
    severity: 'warning',
    description: 'Blue cheeses should have Rich >= 3.0',
    rationale: 'High fat content (28-32g/100g) contributes to richness.',
    examples: { pass: ['gorgonzola Rich=3.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 3. FRESH CHEESES (4 rules)
// ══════════════════════════════════════════════════════════════════════

const FRESH_CHEESE_RULES: RuleSeed[] = [
  {
    category: 'cheese',
    subCategory: 'fresh_cheese',
    ruleType: 'range',
    dimensionIdx: D_AGED_CHEESE, // 62 proxy for fermented character; fresh cheeses have only primary lactic
    operator: 'between',
    threshold: 0.5,
    thresholdHigh: 1.5,
    severity: 'error',
    description: 'Fresh cheeses must have Aged Cheese (fermented character) between 0.5 and 1.5',
    rationale: 'Fresh cheeses undergo minimal aging — only primary lactic fermentation, no enzymatic protein breakdown.',
    examples: { pass: ['mozzarella', 'ricotta', 'cottage', 'mascarpone', 'burrata', 'paneer', 'queso fresco', 'fresh feta'], fail: ['parmesan (use aged_cheese)'] },
  },
  {
    category: 'cheese',
    subCategory: 'fresh_cheese',
    ruleType: 'min',
    dimensionIdx: D_CREAMY, // 95
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Fresh cheeses must have Creamy >= 2.0',
    rationale: 'High moisture content and milky body — fresh cheeses are defined by soft, creamy mouthfeel.',
    examples: { pass: ['mozzarella', 'mascarpone Creamy=4.5', 'ricotta'], fail: [] },
  },
  {
    category: 'cheese',
    subCategory: 'fresh_cheese',
    ruleType: 'max',
    dimensionIdx: D_AGED, // 109
    operator: '<=',
    threshold: 1.0,
    severity: 'warning',
    description: 'Fresh cheeses should have Aged character (109) <= 1.0',
    rationale: 'By definition fresh cheeses are not aged; they should NOT register on the aged character dim.',
    examples: { pass: ['mozzarella Aged=0.3'], fail: ['if mozzarella Aged=3.0 → warning'] },
  },
  {
    category: 'cheese',
    subCategory: 'fresh_cheese',
    ruleType: 'range',
    dimensionIdx: D_RICH,
    operator: 'between',
    threshold: 1.5,
    thresholdHigh: 4.5,
    severity: 'warning',
    description: 'Fresh cheeses: Rich between 1.5 and 4.5 (proportional to fat %)',
    rationale: 'Wide range — low-fat cottage ~1.5, mascarpone ~4.5. Both ends acceptable.',
    examples: { pass: ['cottage cheese Rich=1.8', 'mascarpone Rich=4.3'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 4. ALLIUMS (RAW) (6 rules)
// ══════════════════════════════════════════════════════════════════════

const RAW_ALLIUM_RULES: RuleSeed[] = [
  {
    category: 'allium',
    subCategory: 'raw_allium',
    ruleType: 'min',
    dimensionIdx: D_ALLIUM, // 52
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw alliums must have Allium (dim 52) >= 3.0',
    rationale: 'Diallyl sulfides + allicin release immediately on cutting; raw form hits TRPA1 strongly.',
    examples: { pass: ['raw garlic Allium=6.0', 'raw onion Allium=4.5', 'shallot'], fail: ['cooked garlic (use cooked_allium)'] },
  },
  {
    category: 'allium',
    subCategory: 'raw_allium',
    ruleType: 'min',
    dimensionIdx: D_PROTEIN_SULFUR, // 54 — Protein-Sulfur family aggregate proxy for sulfurous
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw alliums must have sulfurous (Protein-Sulfur family) >= 2.0',
    rationale: 'Sulfur compounds (diallyl disulfide, trisulfide) are the defining character of raw alliums.',
    examples: { pass: ['raw garlic', 'raw onion'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'raw_allium',
    ruleType: 'min',
    dimensionIdx: D_PUNGENT,
    operator: '>=',
    threshold: 1.0,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw alliums must have Pungent >= 1.0',
    rationale: 'TRPA1 agonism from allicin and thiosulfinates drives sharp, nose-pricking pungent character.',
    examples: { pass: ['raw garlic Pungent=5.0', 'raw onion Pungent=3.0'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'raw_garlic',
    ruleType: 'min',
    dimensionIdx: D_PROTEIN_SULFUR, // sulfurous
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'garlic' },
    severity: 'error',
    description: 'Raw garlic specifically: Sulfurous (dim 54) >= 4.0',
    rationale: 'Raw garlic allicin peaks within minutes of crushing; this dim should be near max.',
    examples: { pass: ['raw garlic Sulfurous=5.0'], fail: ['raw garlic Sulfurous=2.0 → ERROR'] },
  },
  {
    category: 'allium',
    subCategory: 'raw_garlic',
    ruleType: 'min',
    dimensionIdx: D_PUNGENT,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'garlic' },
    severity: 'error',
    description: 'Raw garlic specifically: Pungent >= 3.0',
    rationale: 'Crushed garlic hits TRPA1 harder than any other culinary allium.',
    examples: { pass: ['raw garlic Pungent=5.0'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'raw_allium_mild',
    ruleType: 'min',
    dimensionIdx: D_PUNGENT,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'onion|shallot' },
    severity: 'warning',
    description: 'Raw onion/shallot: Pungent >= 2.0',
    rationale: 'Less intense than garlic but should still register on pungent.',
    examples: { pass: ['raw onion Pungent=3.0'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'chive',
    ruleType: 'min',
    dimensionIdx: D_FRESH_HERB, // 25
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { sourceContains: 'chive' },
    severity: 'warning',
    description: 'Chives: Fresh Herb (dim 25) >= 2.0 — milder allium, more herbal',
    rationale: 'Chives have low sulfur, high grassy/herbal character; should register on herbal family, not just allium.',
    examples: { pass: ['chive Fresh Herb=3.0, Allium=2.0'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 5. ALLIUMS (COOKED) (4 rules)
// ══════════════════════════════════════════════════════════════════════

const COOKED_ALLIUM_RULES: RuleSeed[] = [
  {
    category: 'allium',
    subCategory: 'long_sauteed_allium',
    ruleType: 'relation',
    dimensionIdx: D_PROTEIN_SULFUR, // sulfurous
    operator: '<=',
    threshold: 2.0, // reduced from typical raw ~4 — must be at most half of raw
    appliesWhen: { cookingMethod: 'sauté', duration: '>10min' },
    severity: 'error',
    description: 'Long-sautéed alliums (>10 min, low heat): Sulfurous reduced >=50% from raw (<= 2.0)',
    rationale: 'Heat volatilizes allicin and converts sulfur compounds to sweeter sulfides; mellowing is the defining transform.',
    examples: { pass: ['sautéed onion Sulfurous=1.5'], fail: ['onion cooked 20 min still at 4.5 → ERROR'] },
  },
  {
    category: 'allium',
    subCategory: 'long_sauteed_allium',
    ruleType: 'min',
    dimensionIdx: D_SWEET,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'sauté', duration: '>10min' },
    severity: 'error',
    description: 'Long-sautéed alliums: Sweet >= 2.0',
    rationale: 'Cell wall breakdown releases fructose; Maillard early stages convert proteins to sweeter products.',
    examples: { pass: ['sautéed onion Sweet=2.5'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'caramelized_allium',
    ruleType: 'min',
    dimensionIdx: D_TOFFEE_CARAMEL, // 44
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'caramelize', duration: '>30min' },
    severity: 'warning',
    description: 'Caramelized alliums (>30 min): Toffee-Caramel >= 2.0 and Sweet >= 4.0',
    rationale: 'Prolonged low-heat converts fructose to caramelization products (furanones, maltol).',
    examples: { pass: ['caramelized onion Caramelized=3.0, Sweet=4.5'], fail: [] },
  },
  {
    category: 'allium',
    subCategory: 'fried_crisp_allium',
    ruleType: 'min',
    dimensionIdx: D_CRISPY, // 87
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'fry' },
    severity: 'warning',
    description: 'Fried-crisp alliums: Crispy >= 2.0 and Maillard/Roasted >= 1.5',
    rationale: 'Frying drives water out and creates Maillard crust; texture + roasted note both register.',
    examples: { pass: ['fried shallot Crispy=3.0, Meat-Roast=1.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 6. NIGHTSHADES (5 rules)
// ══════════════════════════════════════════════════════════════════════

const NIGHTSHADE_RULES: RuleSeed[] = [
  {
    category: 'nightshade',
    subCategory: 'raw_tomato',
    ruleType: 'range',
    dimensionIdx: D_SOUR,
    operator: 'between',
    threshold: 1.0,
    thresholdHigh: 2.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'tomato' },
    severity: 'error',
    description: 'Raw tomato: Sour between 1.0 and 2.0',
    rationale: 'Citric/malic acid ~0.3-0.5g/100g; noticeable but not intense.',
    examples: { pass: ['raw tomato Sour=1.5'], fail: [] },
  },
  {
    category: 'nightshade',
    subCategory: 'raw_tomato',
    ruleType: 'range',
    dimensionIdx: D_UMAMI,
    operator: 'between',
    threshold: 0.8,
    thresholdHigh: 1.5,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'tomato' },
    severity: 'error',
    description: 'Raw tomato: Umami between 0.8 and 1.5',
    rationale: 'Free glutamate ~140mg/100g gives measurable umami — but well below cooked tomato.',
    examples: { pass: ['raw tomato Umami=1.0'], fail: [] },
  },
  {
    category: 'nightshade',
    subCategory: 'cooked_tomato',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 1.5,
    appliesWhen: { cookingMethod: 'cooked', sourceContains: 'tomato' },
    severity: 'error',
    description: 'Cooked tomato: Umami >= 1.5 (increased from raw), Sour reduced',
    rationale: 'Heat concentrates glutamate via water loss; volatile acids evaporate softening sour note.',
    examples: { pass: ['tomato sauce Umami=2.5', 'roasted tomato Umami=3.0'], fail: [] },
  },
  {
    category: 'nightshade',
    subCategory: 'bell_pepper',
    ruleType: 'min',
    dimensionIdx: D_VEGETAL, // 28
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { sourceContains: 'bell pepper' },
    severity: 'error',
    description: 'Raw bell pepper: Vegetal >= 2.0, Rich <= 1.0, Fresh >= 1.5',
    rationale: 'Bell peppers have ~0.3g fat/100g — LOW Rich (key Wageningen correction). Vegetal/fresh dominate.',
    examples: { pass: ['raw bell pepper Vegetal=3.0, Rich=0.5, Fresh=2.0'], fail: ['AI generated Rich=3.0 → ERROR'] },
    citations: ['Wageningen correction'],
  },
  {
    category: 'nightshade',
    subCategory: 'bell_pepper',
    ruleType: 'max',
    dimensionIdx: D_RICH,
    operator: '<=',
    threshold: 1.0,
    appliesWhen: { sourceContains: 'bell pepper' },
    severity: 'error',
    description: 'Raw bell pepper: Rich <= 1.0',
    rationale: 'Bell peppers contain ~0.3g fat/100g — should NOT register as rich. Major AI error corrected by Wageningen panel.',
    examples: { pass: ['raw bell pepper Rich=0.5'], fail: ['AI bell pepper Rich=3.0 → ERROR'] },
    citations: ['Wageningen correction'],
  },
  {
    category: 'nightshade',
    subCategory: 'bell_pepper',
    ruleType: 'relation',
    dimensionIdx: D_SWEET,
    operator: 'relation',
    relatedDim: D_SWEET,
    appliesWhen: { sourceContains: 'bell pepper' },
    severity: 'warning',
    description: 'Raw bell pepper color ordering: red Sweet > yellow > green > orange (by ripeness/sugar)',
    rationale: 'Red bell peppers are ripest (most sugar); green are underripe (least sugar). Profile sweet values should follow.',
    examples: { pass: ['red bell Sweet=2.5 > yellow=2.0 > green=1.0'], fail: [] },
  },
  {
    category: 'nightshade',
    subCategory: 'chili',
    ruleType: 'relation',
    dimensionIdx: D_SPICY,
    operator: 'relation',
    appliesWhen: { sourceContains: 'chili|pepper|jalapeño|habanero|ghost' },
    severity: 'warning',
    description: 'Chili peppers: Spicy proportional to capsaicin (Scoville) content',
    rationale: 'Bell=0, poblano~2, jalapeño~4, serrano~5, habanero~6. Should scale monotonically.',
    examples: { pass: ['jalapeño Spicy=4, habanero Spicy=6'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 7. CITRUS (5 rules)
// ══════════════════════════════════════════════════════════════════════

const CITRUS_RULES: RuleSeed[] = [
  {
    category: 'citrus',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_CITRUSY,
    operator: '>=',
    threshold: 4.0,
    severity: 'error',
    description: 'Citrus must have Citrusy >= 4.0',
    rationale: 'Limonene + related terpenes define the category; should be near top of the scale.',
    examples: { pass: ['lemon Citrusy=6.0', 'lime', 'orange', 'yuzu', 'bergamot'], fail: [] },
  },
  {
    category: 'citrus',
    subCategory: 'juice_or_pulp',
    ruleType: 'min',
    dimensionIdx: D_SOUR,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'juice|pulp' },
    severity: 'error',
    description: 'Citrus juice/pulp: Sour >= 3.0',
    rationale: 'Citric acid 4-6g/100mL juice — intensely sour; pH ~2.2-2.6.',
    examples: { pass: ['lemon juice Sour=5.0', 'lime juice Sour=5.0'], fail: [] },
  },
  {
    category: 'citrus',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_FRESH,
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Citrus must have Fresh (dim 108) >= 2.0',
    rationale: 'Volatile top-notes create a bright, fresh character.',
    examples: { pass: ['lemon Fresh=4.0'], fail: [] },
  },
  {
    category: 'citrus',
    subCategory: 'grapefruit',
    ruleType: 'min',
    dimensionIdx: D_BITTER,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { sourceContains: 'grapefruit' },
    severity: 'error',
    description: 'Grapefruit specifically: Bitter >= 2.0',
    rationale: 'Naringin + limonin give grapefruit its characteristic bitter note distinct from other citrus.',
    examples: { pass: ['grapefruit Bitter=3.0'], fail: [] },
  },
  {
    category: 'citrus',
    subCategory: 'zest_vs_juice',
    ruleType: 'relation',
    dimensionIdx: D_CITRUSY,
    operator: 'relation',
    appliesWhen: { sourceContains: 'zest' },
    severity: 'warning',
    description: 'Citrus zest: higher Citrusy (concentrated oils), lower Sour (no juice acid) than juice form',
    rationale: 'Essential oils in peel are 10-50x concentration of juice; zest has no citric acid solids.',
    examples: { pass: ['lemon zest Citrusy=6, Sour=0.5 vs lemon juice Citrusy=4, Sour=5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 8. FRESH HERBS (6 rules)
// ══════════════════════════════════════════════════════════════════════

const FRESH_HERB_RULES: RuleSeed[] = [
  {
    category: 'herb',
    subCategory: 'fresh_herb',
    ruleType: 'min',
    dimensionIdx: D_FRESH_HERB,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Fresh herbs must have Fresh Herb (dim 25) >= 3.0',
    rationale: 'The category is the dimension.',
    examples: { pass: ['basil', 'cilantro', 'parsley', 'dill', 'mint', 'tarragon'], fail: [] },
  },
  {
    category: 'herb',
    subCategory: 'fresh_herb',
    ruleType: 'min',
    dimensionIdx: D_FRESH,
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Fresh herbs must have Fresh (dim 108) >= 2.0',
    rationale: 'Volatile greens (hexenals, pinene) give bright, alive character.',
    examples: { pass: ['basil Fresh=4.0'], fail: [] },
  },
  {
    category: 'herb',
    subCategory: 'fresh_herb',
    ruleType: 'min',
    dimensionIdx: D_FRESH_HERB,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Fresh herbs: Fresh Herb (dim 25) >= 3.0 (defining dim)',
    rationale: 'The Fresh Herb dim explicitly captures leafy-herbaceous character.',
    examples: { pass: ['basil Fresh Herb=5.0'], fail: [] },
  },
  {
    category: 'herb',
    subCategory: 'fresh_herb',
    ruleType: 'range',
    dimensionIdx: D_GRASSY,
    operator: 'between',
    threshold: 0.5,
    thresholdHigh: 2.0,
    severity: 'warning',
    description: 'Fresh herbs: Grassy/Green (dim 27) between 0.5 and 2.0',
    rationale: 'Fresh herbs have varying grassy content — parsley high, basil moderate; too little is suspicious, too much overpowers.',
    examples: { pass: ['parsley Grassy=1.8', 'basil Grassy=0.8'], fail: [] },
  },
  {
    category: 'herb',
    subCategory: 'mint',
    ruleType: 'min',
    dimensionIdx: D_COOLING, // 9
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'mint' },
    severity: 'error',
    description: 'Mint specifically: Cooling (dim 9) >= 3.0',
    rationale: 'Menthol activates TRPM8 (cold receptors); defining character.',
    examples: { pass: ['peppermint Cooling=5.0', 'spearmint Cooling=3.5'], fail: [] },
  },
  {
    category: 'herb',
    subCategory: 'rosemary',
    ruleType: 'min',
    dimensionIdx: D_RESINOUS, // 29
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { sourceContains: 'rosemary' },
    severity: 'warning',
    description: 'Rosemary: Resinous (dim 29) >= 2.0 and Woody Herb (dim 26) >= 3.0',
    rationale: 'Pinene + camphor give rosemary its piney/resinous woodiness.',
    examples: { pass: ['rosemary Resinous=3.0, Woody Herb=4.0'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 9. DRIED HERBS / SPICES (5 rules)
// ══════════════════════════════════════════════════════════════════════

const DRIED_HERB_SPICE_RULES: RuleSeed[] = [
  {
    category: 'spice',
    subCategory: 'dried_herb_or_spice',
    ruleType: 'max',
    dimensionIdx: D_FRESH,
    operator: '<=',
    threshold: 1.5,
    severity: 'error',
    description: 'Dried herbs/spices: Fresh (dim 108) <= 1.5',
    rationale: 'Drying removes volatile top-notes — dried forms should NOT hit fresh character.',
    examples: { pass: ['dried oregano Fresh=0.5'], fail: ['AI gave dried basil Fresh=3.0 → ERROR'] },
  },
  {
    category: 'spice',
    subCategory: 'warm_sweet_spice',
    ruleType: 'min',
    dimensionIdx: D_WARM_SWEET_SPICE, // 32
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'cinnamon|nutmeg|clove|allspice|cardamom|star anise' },
    severity: 'error',
    description: 'Warm sweet spices: Warm Sweet Spice (dim 32) >= 4.0, Warming >= 1.0, Woody >= 1.0',
    rationale: 'Cinnamaldehyde/eugenol/myristicin all trigger the warm-sweet-spice + warming aromatic family.',
    examples: { pass: ['cinnamon WarmSweetSpice=5, Warming=2', 'nutmeg WarmSweetSpice=4'], fail: [] },
  },
  {
    category: 'spice',
    subCategory: 'cumin',
    ruleType: 'min',
    dimensionIdx: D_SAVORY_SPICE, // 33
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'cumin' },
    severity: 'warning',
    description: 'Cumin: Savory Spice (dim 33) >= 4.0 and Earthy >= 2.0',
    rationale: 'Cuminaldehyde gives earthy savory-spice character — defining.',
    examples: { pass: ['cumin Savory Spice=5, Earthy=3'], fail: [] },
  },
  {
    category: 'spice',
    subCategory: 'black_pepper',
    ruleType: 'min',
    dimensionIdx: D_PEPPER, // 34
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'black pepper' },
    severity: 'warning',
    description: 'Black pepper: Pepper (dim 34) >= 4.0, Pungent 1-2, Warming 1-2',
    rationale: 'Piperine drives pungent + warming; aroma dim captures pepper-specific terpenes.',
    examples: { pass: ['black pepper Pepper=5, Pungent=1.5, Warming=1.5'], fail: [] },
  },
  {
    category: 'spice',
    subCategory: 'smoked_paprika',
    ruleType: 'min',
    dimensionIdx: D_HARD_WOOD_SMOKE, // 48
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'smoked paprika|pimentón' },
    severity: 'warning',
    description: 'Smoked paprika: Hard-Wood-Smoke >= 3.0 and Spicy 0.5-2.0',
    rationale: 'Oak-smoked peppers dried over weeks — smoke is the defining character.',
    examples: { pass: ['smoked paprika Smoky=4, Spicy=1'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 10. BRASSICAS (4 rules)
// ══════════════════════════════════════════════════════════════════════

const BRASSICA_RULES: RuleSeed[] = [
  {
    category: 'brassica',
    subCategory: 'raw_brassica',
    ruleType: 'min',
    dimensionIdx: D_BRASSICA, // 53
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw brassicas: Brassica (dim 53) >= 2.0 and Sulfurous 1.0-3.0',
    rationale: 'Glucosinolate breakdown products (isothiocyanates) are the defining character.',
    examples: { pass: ['raw broccoli', 'raw cabbage', 'raw kale', 'raw cauliflower'], fail: [] },
  },
  {
    category: 'brassica',
    subCategory: 'raw_brassica',
    ruleType: 'range',
    dimensionIdx: D_BITTER,
    operator: 'between',
    threshold: 0.5,
    thresholdHigh: 2.0,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw brassicas: Bitter between 0.5 and 2.0',
    rationale: 'Glucosinolate bitterness varies — kale higher, bok choy lower.',
    examples: { pass: ['raw kale Bitter=1.8', 'raw bok choy Bitter=0.5'], fail: [] },
  },
  {
    category: 'brassica',
    subCategory: 'cooked_brassica',
    ruleType: 'relation',
    dimensionIdx: D_PROTEIN_SULFUR,
    operator: '<=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'cooked', duration: '>10min' },
    severity: 'warning',
    description: 'Cooked brassicas >10 min: Sulfurous reduced 40%+ and Sweet +0.5 vs raw',
    rationale: 'Prolonged heat drives off volatile sulfur; starch hydrolysis increases perceived sweetness.',
    examples: { pass: ['steamed broccoli Sulfurous=1.2, Sweet=1.5'], fail: [] },
  },
  {
    category: 'brassica',
    subCategory: 'raw_pungent_brassica',
    ruleType: 'min',
    dimensionIdx: D_PUNGENT,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'radish|mustard green|horseradish|wasabi' },
    severity: 'warning',
    description: 'Raw radish/mustard greens: Pungent >= 2.0',
    rationale: 'Allyl isothiocyanate drives the sharp/nose-prickling character of raw radish and mustard family.',
    examples: { pass: ['raw radish Pungent=3.0', 'raw mustard greens Pungent=2.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 11. RAW PROTEINS (5 rules)
// ══════════════════════════════════════════════════════════════════════

const RAW_PROTEIN_RULES: RuleSeed[] = [
  {
    category: 'protein',
    subCategory: 'raw_protein',
    ruleType: 'range',
    dimensionIdx: D_UMAMI,
    operator: 'between',
    threshold: 0.8,
    thresholdHigh: 2.5,
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw proteins: Umami between 0.8 and 2.5 (will increase with cooking)',
    rationale: 'Raw protein has baseline free glutamate/nucleotides; cooking drives protein hydrolysis upward.',
    examples: { pass: ['raw beef Umami=1.5', 'raw chicken Umami=1.2'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'raw_protein',
    ruleType: 'relation',
    dimensionIdx: D_RICH,
    operator: 'relation',
    appliesWhen: { cookingMethod: 'raw' },
    severity: 'error',
    description: 'Raw proteins: Rich proportional to fat content (fat%/100 × 4 ≈ Rich estimate)',
    rationale: 'Ribeye has 12-15g fat → Rich ~4; chicken breast has ~3g → Rich ~1.2.',
    examples: { pass: ['ribeye Rich=4.5, chicken breast Rich=1.0'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'raw_red_meat',
    ruleType: 'range',
    dimensionIdx: D_COOKED_MEAT, // 76 — Meaty proxy; raw red meat has some meaty character
    operator: 'between',
    threshold: 1.0,
    thresholdHigh: 2.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'beef|lamb|pork|venison' },
    severity: 'error',
    description: 'Raw red meat: Meaty 1-2, Iron/mineral 0.5-1.0',
    rationale: 'Myoglobin (heme iron) gives raw red meat its metallic mineral note; protein aromas build with cooking.',
    examples: { pass: ['raw beef Meaty=1.5, Mineral=0.8'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'raw_fish',
    ruleType: 'min',
    dimensionIdx: D_FISH, // 73
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'fish|salmon|tuna|sashimi' },
    severity: 'warning',
    description: 'Raw fish: Fish (dim 73) >= 3.0 and Marine/Seaweed (dim 72) >= 2.0',
    rationale: 'TMA-oxide and short-chain aldehydes give raw fish its characteristic marine aroma.',
    examples: { pass: ['sashimi Fish=4, Seaweed=2.5'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'raw_shellfish',
    ruleType: 'min',
    dimensionIdx: D_SHELLFISH, // 74
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'raw', sourceContains: 'oyster|clam|shrimp|scallop|lobster|crab' },
    severity: 'warning',
    description: 'Raw shellfish: Shellfish (74) >= 3.0, Briny 2-4, Sweet 1-2',
    rationale: 'Ocean minerality + glycine/alanine drive sweet-briny character.',
    examples: { pass: ['oyster Shellfish=4, Briny=4, Sweet=1.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 12. COOKED PROTEINS (6 rules)
// ══════════════════════════════════════════════════════════════════════

const COOKED_PROTEIN_RULES: RuleSeed[] = [
  {
    category: 'protein',
    subCategory: 'grilled_seared_protein',
    ruleType: 'min',
    dimensionIdx: D_MEAT_ROAST, // 41
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'grill|sear' },
    severity: 'error',
    description: 'Grilled/seared proteins: Meat-Roast (dim 41) >= 3.0',
    rationale: 'High direct heat drives Maillard pyrazines and 2-methyl-3-furanthiol — the defining "roasted meat" smell.',
    examples: { pass: ['grilled steak Meat-Roast=4.5'], fail: ['boiled chicken Meat-Roast=0 → should use different subcategory'] },
  },
  {
    category: 'protein',
    subCategory: 'grilled_seared_protein',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 2.5,
    appliesWhen: { cookingMethod: 'grill|sear' },
    severity: 'error',
    description: 'Grilled/seared proteins: Umami >= 2.5 (+1 from raw) and Smoky 0.5-1.5',
    rationale: 'Maillard liberates free glutamate; drippings char on grill bars creating smoky notes.',
    examples: { pass: ['grilled steak Umami=3.5, Smoky=1.0'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'braised_protein',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'braise' },
    severity: 'error',
    description: 'Braised proteins: Umami >= 3.0, Kokumi >= 2.0, Silky >= 1.0, Tender >= 3.0',
    rationale: 'Long wet cooking extracts collagen (gelatin = silky), breaks down protein (tender), builds sauce body (kokumi).',
    examples: { pass: ['braised short rib Umami=4, Kokumi=2.5, Silky=2, Tender=4.5'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'fried_protein',
    ruleType: 'min',
    dimensionIdx: D_CRISPY,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'fry|deep-fry' },
    severity: 'warning',
    description: 'Fried proteins: Crispy >= 3.0 and Oily 1.0-2.0',
    rationale: 'Hot oil dehydrates surface → crispy; some oil absorption is unavoidable.',
    examples: { pass: ['fried chicken Crispy=4, Oily=1.5'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'smoked_protein',
    ruleType: 'min',
    dimensionIdx: D_HARD_WOOD_SMOKE,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'smoke' },
    severity: 'warning',
    description: 'Smoked proteins: Smoky >= 3.0, Cured-Preserved 2-3, Umami >= 2.0',
    rationale: 'Phenolic deposits (guaiacol, syringol) give smoky; salt+time cures give cured character; protein hydrolysis gives umami.',
    examples: { pass: ['smoked brisket Smoky=4, Cured-Preserved=2.5'], fail: [] },
  },
  {
    category: 'protein',
    subCategory: 'confit_slowcooked_protein',
    ruleType: 'min',
    dimensionIdx: D_TENDER,
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { cookingMethod: 'confit|slow-cook' },
    severity: 'warning',
    description: 'Confit/slow-cooked proteins: Tender >= 4.0, Oily 1-2, Broth-Stock or Fatty 2-4',
    rationale: 'Submerged fat cooking breaks collagen to gelatin; oil infuses tissue; low temp prevents drying.',
    examples: { pass: ['duck confit Tender=5, Oily=1.8, Broth-Stock=3'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 13. FATS & OILS (5 rules)
// ══════════════════════════════════════════════════════════════════════

const FATS_OILS_RULES: RuleSeed[] = [
  {
    category: 'fat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_FATTY,
    operator: '>=',
    threshold: 4.0,
    severity: 'error',
    description: 'Fats & oils must have Fatty (dim 6, oleogustus) >= 4.0',
    rationale: 'Pure lipids activate CD36 and GPR120 receptors — defining sensory signal.',
    examples: { pass: ['olive oil', 'butter', 'ghee', 'lard', 'schmaltz', 'coconut oil'], fail: [] },
  },
  {
    category: 'fat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 4.0,
    severity: 'error',
    description: 'Fats & oils must have Rich (dim 106) >= 4.0',
    rationale: 'Pure fat = maximum richness per unit volume.',
    examples: { pass: ['olive oil Rich=5', 'butter Rich=5'], fail: [] },
  },
  {
    category: 'fat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_OILY, // 97
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Fats & oils must have Oily (dim 97) >= 3.0',
    rationale: 'Mouthfeel texture of pure lipid.',
    examples: { pass: ['olive oil Oily=5'], fail: [] },
  },
  {
    category: 'fat',
    subCategory: 'pure_oil',
    ruleType: 'max',
    dimensionIdx: D_SWEET,
    operator: '<=',
    threshold: 1.5,
    appliesWhen: { sourceContains: 'oil' },
    severity: 'error',
    description: 'Pure oils: Sweet/Salty/Sour/Bitter/Umami all <= 1.5',
    rationale: 'Oil = fat only, no carbs/proteins/minerals to drive taste dims.',
    examples: { pass: ['canola oil Sweet=0, Salty=0, Sour=0, Bitter=0, Umami=0'], fail: [] },
  },
  {
    category: 'fat',
    subCategory: 'butter',
    ruleType: 'min',
    dimensionIdx: D_BUTTER, // 60
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'butter' },
    severity: 'warning',
    description: 'Butter: Creamy >= 3.0, Butter (dim 60) >= 4.0, Dairy >= 3.0',
    rationale: 'Diacetyl (ripened cream) + butyric acid are signature; dairy origin drives Fresh Milk-Cream too.',
    examples: { pass: ['butter Butter=5, Creamy=4, Dairy=3.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 14. FERMENTED PRODUCTS (6 rules)
// ══════════════════════════════════════════════════════════════════════

const FERMENTED_RULES: RuleSeed[] = [
  {
    category: 'fermented',
    subCategory: null,
    ruleType: 'presence',
    dimensionIdx: null, // cross-family — any of 64, 65, 66, 67, 68 >= 2.0
    operator: 'exists',
    threshold: 2.0,
    severity: 'error',
    description: 'Fermented products must have any Fermented family dim (64-68) >= 2.0',
    rationale: 'The category is defined by the fermentation character — at least one fermented-family dim must register strongly.',
    examples: { pass: ['vinegar Acetic=5', 'miso Bean-Fermented=4', 'kimchi Lacto=4'], fail: [] },
  },
  {
    category: 'fermented',
    subCategory: 'vinegar',
    ruleType: 'min',
    dimensionIdx: D_ACETIC_VINEGAR, // 65
    operator: '>=',
    threshold: 5.0,
    appliesWhen: { sourceContains: 'vinegar' },
    severity: 'error',
    description: 'Vinegar: Acetic-Vinegar (dim 65) >= 5.0 and Sour >= 5.0',
    rationale: 'Acetic acid is nearly pure — both the aroma and taste dims must register at the top of the scale.',
    examples: { pass: ['white vinegar Acetic=6, Sour=6', 'apple cider vinegar Acetic=5, Sour=5.5'], fail: [] },
  },
  {
    category: 'fermented',
    subCategory: 'bean_fermented',
    ruleType: 'min',
    dimensionIdx: D_BEAN_FERMENTED, // 67
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'miso|soy sauce|tempeh|doenjang|gochujang' },
    severity: 'error',
    description: 'Miso/soy sauce/tempeh: Bean-Fermented (dim 67) >= 3.0 and Umami >= 3.0',
    rationale: 'Aspergillus oryzae ferments soy proteins to free glutamate — massive umami + characteristic bean-fermented aroma.',
    examples: { pass: ['soy sauce Bean-Fermented=5, Umami=5', 'miso Bean-Fermented=4, Umami=4'], fail: [] },
  },
  {
    category: 'fermented',
    subCategory: 'fish_sauce',
    ruleType: 'min',
    dimensionIdx: D_FISH_FERMENTED, // 66
    operator: '>=',
    threshold: 5.0,
    appliesWhen: { sourceContains: 'fish sauce|nuoc mam|colatura|garum' },
    severity: 'error',
    description: 'Fish sauce: Fish-Fermented (dim 66) >= 5.0, Umami >= 5.0, Salty >= 5.0, Pungent >= 2.0',
    rationale: 'Anchovy autolysis over months produces extreme free glutamate + volatile amines + salt saturation.',
    examples: { pass: ['fish sauce Fish-Fermented=6, Umami=6, Salty=6, Pungent=2.5'], fail: [] },
  },
  {
    category: 'fermented',
    subCategory: 'kimchi',
    ruleType: 'min',
    dimensionIdx: D_LACTO_PICKLED, // 64
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'kimchi' },
    severity: 'warning',
    description: 'Kimchi: Lacto-Pickled (dim 64) >= 4.0, Brassica 2-3, Spicy 2-3',
    rationale: 'Lactic acid bacteria ferment napa cabbage → lactic acid aromas; gochugaru drives spicy.',
    examples: { pass: ['kimchi Lacto-Pickled=5, Brassica=2.5, Spicy=2.5'], fail: [] },
  },
  {
    category: 'fermented',
    subCategory: 'yogurt_cultured',
    ruleType: 'min',
    dimensionIdx: D_CULTURED_DAIRY, // 61
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'yogurt|kefir' },
    severity: 'warning',
    description: 'Yogurt (cultured): Cultured Dairy (dim 61) >= 3.0 and Sour 1-3',
    rationale: 'Lactobacillus ferments lactose → lactic acid (sour) + acetaldehyde (yogurt aroma).',
    examples: { pass: ['yogurt Cultured Dairy=4, Sour=2'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 15. CURED MEATS (4 rules)
// ══════════════════════════════════════════════════════════════════════

const CURED_MEAT_RULES: RuleSeed[] = [
  {
    category: 'cured_meat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_CURED_PRESERVED, // 77
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Cured meats must have Cured-Preserved (dim 77) >= 3.0',
    rationale: 'Nitrite curing + salt draws water + proteolysis over weeks/months produces the signature cured aroma.',
    examples: { pass: ['bacon', 'prosciutto', 'pancetta', 'salami', 'chorizo', 'guanciale'], fail: [] },
  },
  {
    category: 'cured_meat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_SALTY,
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Cured meats: Salty >= 3.0',
    rationale: 'Dry cure salt concentrations 2-5% by weight — strongly salty.',
    examples: { pass: ['prosciutto Salty=4', 'bacon Salty=4'], fail: [] },
  },
  {
    category: 'cured_meat',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 2.5,
    severity: 'error',
    description: 'Cured meats: Umami >= 2.5',
    rationale: 'Extended proteolysis generates free glutamate and nucleotides.',
    examples: { pass: ['prosciutto Umami=3.5'], fail: [] },
  },
  {
    category: 'cured_meat',
    subCategory: 'aged_cured_meat',
    ruleType: 'min',
    dimensionIdx: D_AGED,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'prosciutto|soppressata|coppa|lomo|bresaola' },
    severity: 'warning',
    description: 'Aged cured meats (prosciutto, soppressata): Aged >= 3.0',
    rationale: 'Long dry aging (12-36 months) develops deep aged character.',
    examples: { pass: ['prosciutto di parma Aged=4'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 16. GRAINS (4 rules)
// ══════════════════════════════════════════════════════════════════════

const GRAINS_RULES: RuleSeed[] = [
  {
    category: 'grain',
    subCategory: 'cooked_grain',
    ruleType: 'min',
    dimensionIdx: D_STARCHY, // 100
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { cookingMethod: 'cooked' },
    severity: 'error',
    description: 'Cooked grains: Starchy (dim 100) >= 3.0',
    rationale: 'Gelatinized starch is the defining texture and mouthfeel.',
    examples: { pass: ['cooked rice Starchy=5', 'cooked pasta Starchy=5', 'polenta Starchy=5'], fail: [] },
  },
  {
    category: 'grain',
    subCategory: 'cooked_grain',
    ruleType: 'max',
    dimensionIdx: D_SWEET,
    operator: '<=',
    threshold: 1.5,
    severity: 'error',
    description: 'Cooked grains: taste dims minimal (Sweet <= 1.5, other tastes <= 0.5)',
    rationale: 'Grains are mostly starch + modest protein; minimal free sugars/salts/acids/glutamates.',
    examples: { pass: ['plain rice Sweet=0.5, Salty=0, Umami=0.3'], fail: [] },
  },
  {
    category: 'grain',
    subCategory: 'toasted_grain',
    ruleType: 'min',
    dimensionIdx: D_GRAIN_TOAST, // 42
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'toast' },
    severity: 'warning',
    description: 'Toasted grains: Grain-Toast (dim 42) >= 2.0, Nutty 1-2, Roasted >= 1.0',
    rationale: 'Maltol + pyrazines from pyrolysis of starch + cereal proteins.',
    examples: { pass: ['toasted oats Grain-Toast=3, Tree Nut=1.5'], fail: [] },
  },
  {
    category: 'grain',
    subCategory: 'bread',
    ruleType: 'min',
    dimensionIdx: D_BREAD_YEAST, // 69
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { sourceContains: 'bread|loaf|baguette|boule|sourdough|rye' },
    severity: 'warning',
    description: 'Bread: Bread-Yeast (dim 69) >= 2.0 and Bread-Crust 2-3 for crusted loaves',
    rationale: 'Yeast ethanol + esters during fermentation; Maillard crust develops during baking.',
    examples: { pass: ['sourdough bread Bread-Yeast=3, Bread-Crust=3'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 17. SWEETENERS (4 rules)
// ══════════════════════════════════════════════════════════════════════

const SWEETENER_RULES: RuleSeed[] = [
  {
    category: 'sweetener',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_SWEET,
    operator: '>=',
    threshold: 5.0,
    severity: 'error',
    description: 'Sweeteners must have Sweet >= 5.0',
    rationale: 'Definition of the category — max or near-max sweet activation.',
    examples: { pass: ['sugar Sweet=6', 'honey Sweet=5.5', 'maple syrup Sweet=5'], fail: [] },
  },
  {
    category: 'sweetener',
    subCategory: 'granulated_sugar',
    ruleType: 'max',
    dimensionIdx: null, // all dims except Sweet
    operator: '<=',
    threshold: 0.5,
    appliesWhen: { sourceContains: 'granulated sugar|white sugar|sucrose' },
    severity: 'error',
    description: 'Granulated sugar: no dim other than Sweet > 0.5',
    rationale: 'Pure sucrose is sensorially a single-note ingredient.',
    examples: { pass: ['granulated sugar Sweet=6, all others <= 0.3'], fail: [] },
  },
  {
    category: 'sweetener',
    subCategory: 'honey',
    ruleType: 'min',
    dimensionIdx: D_HONEY, // 80
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'honey' },
    severity: 'error',
    description: 'Honey: Honey (dim 80) >= 4.0 and Floral 1-2',
    rationale: 'Methylglyoxal + phenylacetaldehyde + floral terpenes from bee nectar-gathering.',
    examples: { pass: ['wildflower honey Honey=5, Floral=1.5'], fail: [] },
  },
  {
    category: 'sweetener',
    subCategory: 'molasses',
    ruleType: 'min',
    dimensionIdx: D_MOLASSES_CANE, // 82
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'molasses|blackstrap|treacle' },
    severity: 'warning',
    description: 'Molasses: Molasses-Cane (dim 82) >= 4.0, Bitter 1-2, Smoky 0.5-1',
    rationale: 'Concentrated cane byproduct — mineral-heavy, slightly bitter, caramel/smoky notes from processing.',
    examples: { pass: ['blackstrap molasses Molasses-Cane=5, Bitter=2, Smoky=1'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 18. DAIRY (NON-CHEESE) (5 rules)
// ══════════════════════════════════════════════════════════════════════

const DAIRY_RULES: RuleSeed[] = [
  {
    category: 'dairy',
    subCategory: null,
    ruleType: 'presence',
    dimensionIdx: null, // either D_FRESH_MILK_CREAM (59) OR D_CULTURED_DAIRY (61) >= 2.0
    operator: 'exists',
    threshold: 2.0,
    severity: 'error',
    description: 'Dairy (non-cheese): Fresh Milk-Cream (59) OR Cultured Dairy (61) >= 2.0',
    rationale: 'Either fresh or cultured dairy aroma must register — the category is defined by dairy origin.',
    examples: { pass: ['milk', 'heavy cream', 'yogurt', 'sour cream', 'buttermilk', 'kefir', 'crème fraîche'], fail: [] },
  },
  {
    category: 'dairy',
    subCategory: 'heavy_cream',
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'heavy cream|double cream|clotted cream' },
    severity: 'error',
    description: 'Heavy cream: Rich >= 4.0 and Creamy >= 4.0',
    rationale: '36-48% fat — near oil levels of richness; thick mouthfeel.',
    examples: { pass: ['heavy cream Rich=5, Creamy=5'], fail: [] },
  },
  {
    category: 'dairy',
    subCategory: 'whole_milk',
    ruleType: 'range',
    dimensionIdx: D_RICH,
    operator: 'between',
    threshold: 2.0,
    thresholdHigh: 3.0,
    appliesWhen: { sourceContains: 'whole milk' },
    severity: 'error',
    description: 'Whole milk: Rich 2-3, Sweet 0.5-1.0',
    rationale: '3.25% fat = moderate richness; ~5g lactose/100mL = mild sweetness.',
    examples: { pass: ['whole milk Rich=2.5, Sweet=0.8'], fail: [] },
  },
  {
    category: 'dairy',
    subCategory: 'cultured_dairy',
    ruleType: 'min',
    dimensionIdx: D_SOUR,
    operator: '>=',
    threshold: 1.0,
    appliesWhen: { sourceContains: 'yogurt|sour cream|buttermilk|kefir|crème fraîche|labneh' },
    severity: 'warning',
    description: 'Cultured dairy: Sour >= 1.0 and Fermented >= 1.5',
    rationale: 'Lactic fermentation produces lactic acid (sour) + acetaldehyde/diacetyl aromatics.',
    examples: { pass: ['sour cream Sour=2, Cultured Dairy=3'], fail: [] },
  },
  {
    category: 'dairy',
    subCategory: 'buttermilk',
    ruleType: 'min',
    dimensionIdx: D_CULTURED_DAIRY,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'buttermilk' },
    severity: 'warning',
    description: 'Buttermilk: Cultured Dairy >= 3.0 and Sour 2-3',
    rationale: 'Strongly cultured — often more sour than yogurt.',
    examples: { pass: ['buttermilk Cultured Dairy=4, Sour=2.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 19. FRUITS (4 rules)
// ══════════════════════════════════════════════════════════════════════

const FRUIT_RULES: RuleSeed[] = [
  {
    category: 'fruit',
    subCategory: null,
    ruleType: 'range',
    dimensionIdx: D_SWEET,
    operator: 'between',
    threshold: 2.0,
    thresholdHigh: 5.0,
    severity: 'error',
    description: 'Fruits: Sweet 2.0-5.0 proportional to sugar content (Brix)',
    rationale: 'Sour apple ~8 Brix → Sweet ~2; banana ~20 Brix → Sweet ~4.5. Should track Brix.',
    examples: { pass: ['banana Sweet=4.5', 'sour apple Sweet=2.3'], fail: [] },
  },
  {
    category: 'fruit',
    subCategory: null,
    ruleType: 'relation',
    dimensionIdx: null, // fruit must have appropriate secondary aroma dim
    operator: 'exists',
    threshold: 2.0,
    severity: 'error',
    description: 'Fruits: appropriate secondary aroma dim >= 2.0 (citrus→Citrusy, berry→Berry, tropical→Tropical, etc.)',
    rationale: 'Every fruit should hit its family aroma dim (14-20 range) at a meaningful level.',
    examples: { pass: ['strawberry Berry=4', 'mango Tropical=5', 'apple Orchard Pomme=3'], fail: [] },
  },
  {
    category: 'fruit',
    subCategory: 'fresh_fruit',
    ruleType: 'min',
    dimensionIdx: D_FRESH,
    operator: '>=',
    threshold: 1.5,
    severity: 'warning',
    description: 'Fresh fruit: Fresh (dim 108) >= 1.5',
    rationale: 'Volatile top-notes from intact cell structure.',
    examples: { pass: ['fresh strawberry Fresh=3'], fail: [] },
  },
  {
    category: 'fruit',
    subCategory: 'dried_fruit',
    ruleType: 'min',
    dimensionIdx: D_DRIED_FRUIT, // 20
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'dried|raisin|prune|apricot dried|date' },
    severity: 'warning',
    description: 'Dried fruit: Dried Fruit (dim 20) >= 3.0, Sweet >= 4.0, Fresh <= 1.0',
    rationale: 'Drying concentrates sugars, develops Maillard/caramelization products, strips volatile top-notes.',
    examples: { pass: ['raisin Dried Fruit=5, Sweet=5.5, Fresh=0.3'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 20. MUSHROOMS (3 rules)
// ══════════════════════════════════════════════════════════════════════

const MUSHROOM_RULES: RuleSeed[] = [
  {
    category: 'mushroom',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_MUSHROOM, // 55
    operator: '>=',
    threshold: 3.0,
    severity: 'error',
    description: 'Mushrooms: Mushroom (dim 55) >= 3.0',
    rationale: '1-octen-3-ol ("mushroom alcohol") is near-universal in fungi.',
    examples: { pass: ['button', 'cremini', 'shiitake', 'porcini', 'morel', 'oyster', 'chanterelle'], fail: [] },
  },
  {
    category: 'mushroom',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_MINERAL, // Earthy proxy — mineral 57 family captures earthy
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'Mushrooms: Earthy/Mineral >= 2.0',
    rationale: 'Geosmin + terpenes from soil substrate growth.',
    examples: { pass: ['porcini Earthy=3', 'shiitake Mineral=2.5'], fail: [] },
  },
  {
    category: 'mushroom',
    subCategory: 'dried_mushroom',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'dried porcini|dried shiitake|dried mushroom'},
    severity: 'warning',
    description: 'Dried mushroom: Umami >= 3.0, Mushroom >= 4.0 (concentrated)',
    rationale: 'Drying concentrates guanylate (nucleotide umami); loss of water intensifies mushroom aromatics.',
    examples: { pass: ['dried porcini Umami=4, Mushroom=5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 21. SEAFOOD (5 rules)
// ══════════════════════════════════════════════════════════════════════

const SEAFOOD_RULES: RuleSeed[] = [
  {
    category: 'seafood',
    subCategory: 'shellfish',
    ruleType: 'min',
    dimensionIdx: D_SHELLFISH,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'clam|oyster|mussel|scallop|shrimp|crab|lobster' },
    severity: 'error',
    description: 'Shellfish: Shellfish (dim 74) >= 3.0, Briny 2-4, Sweet 1-2',
    rationale: 'Glycine + alanine + taurine + marine bromophenols = sweet-briny shellfish signature.',
    examples: { pass: ['shrimp Shellfish=4, Briny=3, Sweet=1.5'], fail: [] },
  },
  {
    category: 'seafood',
    subCategory: 'fish',
    ruleType: 'min',
    dimensionIdx: D_FISH,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'fish|salmon|tuna|cod|halibut|trout|bass|sardine|anchovy' },
    severity: 'error',
    description: 'Fish: Fish (dim 73) >= 3.0 and Marine (dim 72) >= 2.0',
    rationale: 'TMA oxide + aldehydes (hexanal, decadienal) define fish aroma.',
    examples: { pass: ['salmon Fish=4, Seaweed=2.5'], fail: [] },
  },
  {
    category: 'seafood',
    subCategory: 'oyster',
    ruleType: 'min',
    dimensionIdx: D_BRINY, // 75
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'oyster' },
    severity: 'error',
    description: 'Oyster: Briny (dim 75) >= 4.0 and Mineral (dim 57) >= 2.0',
    rationale: 'Ocean-brine concentration + copper/zinc mineral notes — defining oyster character.',
    examples: { pass: ['oyster Briny=5, Mineral=3'], fail: [] },
  },
  {
    category: 'seafood',
    subCategory: 'seaweed',
    ruleType: 'min',
    dimensionIdx: D_SEAWEED, // 72
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'nori|kombu|wakame|dulse|hijiki|seaweed' },
    severity: 'warning',
    description: 'Seaweed: Seaweed (dim 72) >= 4.0 and Umami >= 2.0 (kombu especially high-glutamate)',
    rationale: 'Kombu has 1600mg/100g glutamate (highest natural source). Iodine/mineral notes amplify marine.',
    examples: { pass: ['kombu Seaweed=6, Umami=5', 'nori Seaweed=5'], fail: [] },
  },
  {
    category: 'seafood',
    subCategory: 'cured_seafood',
    ruleType: 'min',
    dimensionIdx: D_CURED_PRESERVED,
    operator: '>=',
    threshold: 2.5,
    appliesWhen: { sourceContains: 'bottarga|smoked salmon|lox|cured|gravlax' },
    severity: 'warning',
    description: 'Cured/dried seafood (bottarga, smoked salmon): Cured-Preserved >= 2.5 and respective marine dim',
    rationale: 'Salt cure + drying + optional smoke → preserved character plus intact marine signature.',
    examples: { pass: ['smoked salmon Cured-Preserved=3, Fish=3.5, Smoky=2'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// 22. CHOCOLATE (4 rules)
// ══════════════════════════════════════════════════════════════════════

const CHOCOLATE_RULES: RuleSeed[] = [
  {
    category: 'chocolate',
    subCategory: 'dark_chocolate',
    ruleType: 'min',
    dimensionIdx: D_DARK_COCOA, // 84
    operator: '>=',
    threshold: 4.0,
    appliesWhen: { sourceContains: 'dark chocolate|bittersweet|semisweet|cocoa nib|unsweetened cocoa' },
    severity: 'error',
    description: 'Dark chocolate: Dark Cocoa (dim 84) >= 4.0 and Bitter 2-4 (depends on %)',
    rationale: 'Theobromine + pyrazines from roasted cocoa define dark chocolate; bitter scales with % cacao.',
    examples: { pass: ['70% dark Dark Cocoa=5, Bitter=2.5', '85% dark Dark Cocoa=5, Bitter=3.5'], fail: [] },
  },
  {
    category: 'chocolate',
    subCategory: 'milk_chocolate',
    ruleType: 'min',
    dimensionIdx: D_MILK_CHOCOLATE, // 85
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { sourceContains: 'milk chocolate' },
    severity: 'error',
    description: 'Milk chocolate: Milk Chocolate (dim 85) >= 3.0, Sweet >= 3.0, Rich >= 3.0',
    rationale: 'Milk solids + sugar dominate; cocoa reduced vs dark.',
    examples: { pass: ['milk chocolate Milk Chocolate=4, Sweet=4, Rich=3.5'], fail: [] },
  },
  {
    category: 'chocolate',
    subCategory: null,
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 2.0,
    severity: 'error',
    description: 'All chocolate: Rich >= 2.0',
    rationale: 'Cocoa butter content (~30%+ typical) drives richness across all chocolate styles.',
    examples: { pass: ['dark Rich=4', 'milk Rich=3.5', 'white Rich=3'], fail: [] },
  },
  {
    category: 'chocolate',
    subCategory: 'high_cacao',
    ruleType: 'min',
    dimensionIdx: D_ASTRINGENT,
    operator: '>=',
    threshold: 1.0,
    appliesWhen: { sourceContains: '85%|90%|95%|100% cacao|100% chocolate' },
    severity: 'warning',
    description: '85%+ cacao chocolate: Astringent (dim 10) >= 1.0',
    rationale: 'High proanthocyanidin content from unroasted/lightly-processed cocoa causes dry, mouth-puckering sensation.',
    examples: { pass: ['90% dark Astringent=1.5'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// CROSS-CATEGORY INVARIANTS (~15 rules)
// ══════════════════════════════════════════════════════════════════════

const CROSS_CATEGORY_RULES: RuleSeed[] = [
  // ── Cooking-related ──────────────────────────────────────────
  {
    category: 'cross_category',
    subCategory: 'maillard_browned',
    ruleType: 'presence',
    dimensionIdx: null, // either Meat-Roast (41) OR Bread-Crust (40) >= 1.0
    operator: 'exists',
    threshold: 1.0,
    appliesWhen: { cookingMethod: 'brown|sear|roast|bake|grill|fry' },
    severity: 'warning',
    description: 'Maillard-browned foods: Meat-Roast (41) or Bread-Crust (40) >= 1.0',
    rationale: 'Browning reactions leave a detectable trace in at least one roasted-family dim.',
    examples: { pass: ['seared steak Meat-Roast=3', 'toasted bread Bread-Crust=3'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'caramelized',
    ruleType: 'presence',
    dimensionIdx: null, // Toffee-Caramel (44), Burnt-Sugar (45), or Molasses-Dark (47) >= 1.0
    operator: 'exists',
    threshold: 1.0,
    appliesWhen: { cookingMethod: 'caramelize' },
    severity: 'warning',
    description: 'Caramelized foods: any caramelized family dim (44-47) >= 1.0',
    rationale: 'Sugar pyrolysis products (furanones, hydroxymethylfurfural, maltol) register on these dims.',
    examples: { pass: ['caramelized onion Toffee-Caramel=3'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'smoked',
    ruleType: 'min',
    dimensionIdx: D_HARD_WOOD_SMOKE,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'smoke' },
    severity: 'warning',
    description: 'Smoked foods: Smoky (dim 48 family) >= 2.0',
    rationale: 'Phenolic deposits from smoke are persistent and measurable.',
    examples: { pass: ['smoked brisket Smoky=4', 'smoked salmon Smoky=2.5'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'fried',
    ruleType: 'min',
    dimensionIdx: D_CRISPY,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { cookingMethod: 'fry|deep-fry' },
    severity: 'warning',
    description: 'Fried foods: Crispy (87) or Crunchy (86) >= 2.0 and Oily >= 1.0',
    rationale: 'Surface dehydration + oil coating produces both a crispy texture and an oily mouthfeel.',
    examples: { pass: ['fried chicken Crispy=4, Oily=1.5'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'fermented_broad',
    ruleType: 'presence',
    dimensionIdx: null, // any Fermented family dim (64-68) >= 1.5
    operator: 'exists',
    threshold: 1.5,
    appliesWhen: { cookingMethod: 'ferment' },
    severity: 'warning',
    description: 'Any fermented food (broad): any Fermented-family dim (64-68) >= 1.5',
    rationale: 'Fermentation leaves chemistry traces — lactic acid, acetic acid, or enzymatic bean/fish byproducts.',
    examples: { pass: ['sauerkraut Lacto-Pickled=4', 'sourdough Sourdough-Starter=3'], fail: [] },
  },

  // ── Chemistry-related ───────────────────────────────────────
  {
    category: 'cross_category',
    subCategory: 'high_protein',
    ruleType: 'min',
    dimensionIdx: D_UMAMI,
    operator: '>=',
    threshold: 1.0,
    appliesWhen: { chemistry: 'protein_ge_10g_per_100g' },
    severity: 'warning',
    description: 'Protein ≥ 10g/100g: Umami >= 1.0 and Rich proportional to fat',
    rationale: 'Protein hydrolysis products (free glutamate, nucleotides) drive baseline umami.',
    examples: { pass: ['chicken breast Umami=1.5'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'high_fat',
    ruleType: 'min',
    dimensionIdx: D_RICH,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { chemistry: 'fat_ge_30g_per_100g' },
    severity: 'warning',
    description: 'Fat ≥ 30g/100g: Rich >= 3.0 and Fatty >= 3.0',
    rationale: 'High fat triggers CD36/GPR120 oleogustus receptors and perceived richness.',
    examples: { pass: ['avocado Rich=3, Fatty=3', 'heavy cream Rich=5, Fatty=5'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'high_sugar',
    ruleType: 'min',
    dimensionIdx: D_SWEET,
    operator: '>=',
    threshold: 3.0,
    appliesWhen: { chemistry: 'sugar_ge_15g_per_100g' },
    severity: 'warning',
    description: 'Sugar ≥ 15g/100g: Sweet >= 3.0',
    rationale: 'At this concentration sweet receptor activation should be strongly felt.',
    examples: { pass: ['banana Sweet=4', 'grape Sweet=4'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'high_fiber',
    ruleType: 'presence',
    dimensionIdx: null, // Grainy (98) or Fibrous (91) >= 1.0
    operator: 'exists',
    threshold: 1.0,
    appliesWhen: { chemistry: 'fiber_ge_6g_per_100g' },
    severity: 'warning',
    description: 'Fiber ≥ 6g/100g: Grainy OR Fibrous >= 1.0 (context-dependent)',
    rationale: 'High fiber produces detectable texture (grainy for seeds/bran, fibrous for tough-leaf/stalk).',
    examples: { pass: ['oat bran Grainy=2', 'celery stalk Fibrous=2'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'low_ph',
    ruleType: 'min',
    dimensionIdx: D_SOUR,
    operator: '>=',
    threshold: 2.0,
    appliesWhen: { chemistry: 'ph_lt_4' },
    severity: 'warning',
    description: 'pH < 4: Sour >= 2.0',
    rationale: 'Below pH 4 the sour receptor (PKD2L1) is strongly activated.',
    examples: { pass: ['lemon juice Sour=6 (pH 2.3)', 'yogurt Sour=2 (pH 4.1 borderline)'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'high_moisture',
    ruleType: 'presence',
    dimensionIdx: null, // Juicy (92) or Moist (93) >= 1.0
    operator: 'exists',
    threshold: 1.0,
    appliesWhen: { chemistry: 'moisture_gt_80pct' },
    severity: 'warning',
    description: 'Moisture > 80%: Juicy OR Moist >= 1.0',
    rationale: 'High water content produces a wet/juicy mouth sensation.',
    examples: { pass: ['watermelon Juicy=5', 'cucumber Moist=3'], fail: [] },
  },

  // ── Relationship invariants ─────────────────────────────────
  {
    category: 'cross_category',
    subCategory: 'raw_vs_cooked',
    ruleType: 'relation',
    dimensionIdx: null,
    operator: 'relation',
    severity: 'warning',
    description: 'Raw and cooked versions of same ingredient must have DIFFERENT profiles (never identical)',
    rationale: 'Cooking drives Maillard, caramelization, tenderization, moisture loss, aroma evolution — some dim MUST shift.',
    examples: { pass: ['raw broccoli Brassica=3 vs roasted broccoli Brassica=1.5, Meat-Roast=2'], fail: ['identical profiles → ERROR'] },
  },
  {
    category: 'cross_category',
    subCategory: 'category_clustering',
    ruleType: 'relation',
    dimensionIdx: null,
    operator: 'relation',
    severity: 'warning',
    description: 'Ingredients within the same category should cluster: similar relative dim shape, different magnitudes',
    rationale: 'All aged cheeses should share the same dominant dims (Aged Cheese, Umami, Rich), differing in strength — not fundamentally different patterns.',
    examples: { pass: ['parmesan and pecorino have same top-5 dims'], fail: [] },
  },
  {
    category: 'cross_category',
    subCategory: 'fresh_vs_preserved',
    ruleType: 'relation',
    dimensionIdx: null,
    operator: 'relation',
    severity: 'warning',
    description: 'Preserved ingredients have Fermented OR Cured-Preserved that fresh versions do not',
    rationale: 'Preservation is defined by one of these processes — must leave a measurable signal.',
    examples: { pass: ['fresh pork Cured-Preserved=0 vs prosciutto Cured-Preserved=4'], fail: [] },
  },
];

// ══════════════════════════════════════════════════════════════════════
// ALL RULES BY CATEGORY (grouped for --category flag + summary)
// ══════════════════════════════════════════════════════════════════════

const RULES_BY_CATEGORY: Record<string, RuleSeed[]> = {
  'aged_cheeses': AGED_CHEESE_RULES,
  'blue_cheeses': BLUE_CHEESE_RULES,
  'fresh_cheeses': FRESH_CHEESE_RULES,
  'raw_alliums': RAW_ALLIUM_RULES,
  'cooked_alliums': COOKED_ALLIUM_RULES,
  'nightshades': NIGHTSHADE_RULES,
  'citrus': CITRUS_RULES,
  'fresh_herbs': FRESH_HERB_RULES,
  'dried_herbs_spices': DRIED_HERB_SPICE_RULES,
  'brassicas': BRASSICA_RULES,
  'raw_proteins': RAW_PROTEIN_RULES,
  'cooked_proteins': COOKED_PROTEIN_RULES,
  'fats_oils': FATS_OILS_RULES,
  'fermented': FERMENTED_RULES,
  'cured_meats': CURED_MEAT_RULES,
  'grains': GRAINS_RULES,
  'sweeteners': SWEETENER_RULES,
  'dairy': DAIRY_RULES,
  'fruits': FRUIT_RULES,
  'mushrooms': MUSHROOM_RULES,
  'seafood': SEAFOOD_RULES,
  'chocolate': CHOCOLATE_RULES,
  'cross_category': CROSS_CATEGORY_RULES,
};

// ══════════════════════════════════════════════════════════════════════
// UPSERT LOGIC — find existing by (category, subCategory, dimensionIdx, operator)
// ══════════════════════════════════════════════════════════════════════

async function upsertRule(rule: RuleSeed, dryRun: boolean): Promise<'created' | 'updated' | 'skipped'> {
  if (dryRun) {
    // Skip any DB access in dry-run — just report what would happen
    return 'created';
  }

  // Find existing rule by identifying fields.
  // Multiple rules can share (category, subCategory, dimensionIdx, operator) — description is the tiebreaker.
  const existing = await prisma.calibrationRule.findFirst({
    where: {
      category: rule.category,
      subCategory: rule.subCategory ?? null,
      dimensionIdx: rule.dimensionIdx ?? null,
      operator: rule.operator,
      description: rule.description,
    },
  });

  const data: Prisma.CalibrationRuleCreateInput = {
    category: rule.category,
    subCategory: rule.subCategory ?? null,
    ruleType: rule.ruleType,
    dimensionIdx: rule.dimensionIdx ?? null,
    operator: rule.operator,
    threshold: rule.threshold ?? null,
    thresholdHigh: rule.thresholdHigh ?? null,
    relatedDim: rule.relatedDim ?? null,
    appliesWhen: rule.appliesWhen
      ? (rule.appliesWhen as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    severity: rule.severity,
    description: rule.description,
    rationale: rule.rationale ?? null,
    examples: rule.examples
      ? (rule.examples as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    citations: rule.citations ?? [],
    isActive: true,
    ruleVersion: 1,
  };

  if (existing) {
    await prisma.calibrationRule.update({
      where: { id: existing.id },
      data,
    });
    return 'updated';
  }

  await prisma.calibrationRule.create({ data });
  return 'created';
}

// ══════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const categoryArg = args.find((a) => a.startsWith('--category='));
  const onlyCategory = categoryArg ? categoryArg.slice('--category='.length) : null;

  console.log('');
  console.log('=== CalibrationRule Seed ===');
  if (dryRun) console.log('  Mode: DRY RUN (no DB writes)');
  if (onlyCategory) console.log(`  Filter: only category "${onlyCategory}"`);
  console.log('');

  const categoriesToSeed = onlyCategory
    ? (RULES_BY_CATEGORY[onlyCategory] ? { [onlyCategory]: RULES_BY_CATEGORY[onlyCategory] } : {})
    : RULES_BY_CATEGORY;

  if (onlyCategory && !RULES_BY_CATEGORY[onlyCategory]) {
    console.error(`ERROR: Unknown category "${onlyCategory}".`);
    console.error(`Valid categories: ${Object.keys(RULES_BY_CATEGORY).join(', ')}`);
    process.exit(1);
  }

  const totals = {
    created: 0,
    updated: 0,
    skipped: 0,
    byCategory: {} as Record<string, { error: number; warning: number; total: number }>,
  };

  const t0 = Date.now();

  for (const [catKey, rules] of Object.entries(categoriesToSeed)) {
    console.log(`\n── ${catKey.toUpperCase().replace(/_/g, ' ')} (${rules.length} rules) ──`);

    const catSummary = { error: 0, warning: 0, total: 0 };

    for (const rule of rules) {
      try {
        const action = await upsertRule(rule, dryRun);
        totals[action]++;
        catSummary.total++;
        if (rule.severity === 'error') catSummary.error++;
        else catSummary.warning++;

        const sev = rule.severity.padEnd(7);
        const dim = rule.dimensionIdx !== undefined && rule.dimensionIdx !== null
          ? `dim${String(rule.dimensionIdx).padStart(3, ' ')}`
          : 'cross ';
        const op = rule.operator.padEnd(8);
        const threshDisplay = rule.thresholdHigh != null
          ? `${rule.threshold}-${rule.thresholdHigh}`
          : (rule.threshold != null ? String(rule.threshold) : '—');
        const sub = rule.subCategory ? `[${rule.subCategory}] ` : '';
        console.log(`  ${action.padEnd(7)} ${sev} ${dim} ${op} ${threshDisplay.padEnd(10)} ${sub}${rule.description.slice(0, 80)}`);
      } catch (err) {
        console.error(`  ERROR on rule: ${rule.description}`);
        console.error(`  ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    totals.byCategory[catKey] = catSummary;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  Summary (${elapsed}s)${dryRun ? ' [DRY RUN]' : ''}`);
  console.log('═════════════════════════════════════════════════════════');
  console.log(`  Created:  ${totals.created}`);
  console.log(`  Updated:  ${totals.updated}`);
  console.log(`  Skipped:  ${totals.skipped}`);
  console.log('');
  console.log('  Per-category breakdown:');
  let grandTotal = 0, grandErr = 0, grandWarn = 0;
  for (const [cat, summary] of Object.entries(totals.byCategory)) {
    const line = `${cat.padEnd(22)} ${String(summary.total).padStart(3)} rules  (${summary.error} error / ${summary.warning} warning)`;
    console.log(`    ${line}`);
    grandTotal += summary.total;
    grandErr += summary.error;
    grandWarn += summary.warning;
  }
  console.log('');
  console.log(`  TOTAL: ${grandTotal} rules  (${grandErr} error / ${grandWarn} warning)`);
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
}

main()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
