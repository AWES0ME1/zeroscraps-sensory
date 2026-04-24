/**
 * Seed all 113 SensoryDimensionConfig entries.
 *
 * Source of truth: docs/sensory-dimension-reference.md
 *
 * This is the "skeleton" that seeds dim indices, names, categories, scale types,
 * Stevens exponents, keywords, anchors, and descriptors. For the full descriptor
 * vocabulary (~1000 terms), run seed-vocabulary.ts separately.
 *
 * Run:
 *   cd server && npx ts-node src/scripts/seed-dimensions-v2.ts
 *   cd server && npx ts-node src/scripts/seed-dimensions-v2.ts --dry-run
 *
 * Idempotent via upsert on `index`.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');

// ══════════════════════════════════════════════════════════════════════
// Dimension definitions — 113 total
// Format: [index, name, category, parentFamily|null, tier, stevens, keywords[], anchors[], descriptors[]]
// ══════════════════════════════════════════════════════════════════════

type DimDef = {
  index: number;
  name: string;
  primaryCategory: string;
  parentFamily: string | null;
  tier: 'primary' | 'secondary';
  scaleType?: 'unipolar' | 'bipolar';
  scaleMin?: number;
  scaleMax?: number;
  stevensExponent: number;
  keywords: string[];
  anchorExamples: string[];
  descriptorTerms: string[];
};

const DIMENSIONS: DimDef[] = [
  // ─── TASTE (7) ─────────────────────────────────────────────────────
  { index: 0, name: 'Sweet', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['sweet', 'sugar', 'honey', 'dessert'],
    anchorExamples: ['sucrose', 'honey', 'ripe mango', 'maple syrup'],
    descriptorTerms: ['sugary', 'honeyed', 'candied', 'jammy', 'syrupy', 'saccharine', 'confectionary', 'dessert-like', 'glazed', 'cloying'] },
  { index: 1, name: 'Salty', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 1.3,
    keywords: ['salty', 'salt', 'brine', 'cured'],
    anchorExamples: ['salt', 'soy sauce', 'fish sauce', 'anchovy'],
    descriptorTerms: ['briny', 'saline', 'seasoned', 'cured', 'brackish', 'brined', 'salted'] },
  { index: 2, name: 'Sour', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 1.1,
    keywords: ['sour', 'acidic', 'tangy', 'tart'],
    anchorExamples: ['lemon juice', 'vinegar', 'sour cream', 'tamarind'],
    descriptorTerms: ['tart', 'tangy', 'acidic', 'zingy', 'puckering', 'vinegary', 'lactic', 'bright'] },
  { index: 3, name: 'Bitter', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 0.7,
    keywords: ['bitter', 'hoppy', 'cocoa'],
    anchorExamples: ['black coffee', 'dark chocolate', 'kale', 'hops'],
    descriptorTerms: ['hoppy', 'cocoa-bitter', 'rind', 'pith', 'earthy-bitter', 'astringent-bitter'] },
  { index: 4, name: 'Umami', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['umami', 'savory', 'meaty', 'brothy'],
    anchorExamples: ['soy sauce', 'parmesan', 'shiitake', 'miso'],
    descriptorTerms: ['savory', 'meaty-tasting', 'brothy-tasting', 'glutamate-rich', 'full-bodied'] },
  { index: 5, name: 'Kokumi', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['kokumi', 'mouth-filling', 'continuation'],
    anchorExamples: ['aged cheese', 'bone broth', 'garlic', 'yeast extract'],
    descriptorTerms: ['mouth-filling', 'long-lasting', 'complex', 'continuation-taste', 'resonant'] },
  { index: 6, name: 'Fatty', primaryCategory: 'taste', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['fatty', 'oleogustus', 'fat-taste'],
    anchorExamples: ['butter', 'bacon fat', 'avocado', 'olive oil'],
    descriptorTerms: ['oleogustus', 'fat-taste', 'lardy', 'buttery-taste', 'unctuous'] },

  // ─── CHEMESTHETIC (7) ──────────────────────────────────────────────
  { index: 7, name: 'Spicy', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.4,
    keywords: ['spicy', 'hot', 'chili', 'capsaicin'],
    anchorExamples: ['chili pepper', 'cayenne', 'sriracha', 'habanero'],
    descriptorTerms: ['chili-heat', 'peppery-hot', 'burning', 'fiery'] },
  { index: 8, name: 'Pungent', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.2,
    keywords: ['pungent', 'sharp', 'wasabi', 'horseradish'],
    anchorExamples: ['wasabi', 'horseradish', 'raw onion', 'mustard'],
    descriptorTerms: ['sharp', 'horseradishy', 'mustard-sharp', 'wasabi-sharp', 'raw-onion'] },
  { index: 9, name: 'Cooling', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['cooling', 'menthol', 'mint', 'cool'],
    anchorExamples: ['mint', 'menthol', 'eucalyptus', 'wintergreen'],
    descriptorTerms: ['menthol', 'icy-cool', 'minty-cool', 'camphor', 'refreshing'] },
  { index: 10, name: 'Astringent', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['astringent', 'tannic', 'puckering'],
    anchorExamples: ['strong black tea', 'unripe persimmon', 'red wine', 'pomegranate'],
    descriptorTerms: ['tannic', 'drying', 'puckering', 'chalky-dry', 'mouth-coating'] },
  { index: 11, name: 'Numbing', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.2,
    keywords: ['numbing', 'sanshool', 'ma-la', 'sichuan'],
    anchorExamples: ['sichuan pepper', 'szechuan pepper', 'mala'],
    descriptorTerms: ['ma-la', 'tingly-numb', 'buzzy', 'sichuan-tingle', 'vibrating'] },
  { index: 12, name: 'Carbonated', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['carbonated', 'fizzy', 'effervescent'],
    anchorExamples: ['seltzer', 'champagne', 'beer', 'kombucha'],
    descriptorTerms: ['fizzy', 'effervescent', 'sparkling', 'bubbly', 'prickly'] },
  { index: 13, name: 'Warming', primaryCategory: 'chemesthetic', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['warming', 'alcohol', 'ginger'],
    anchorExamples: ['whiskey', 'ginger', 'cinnamon', 'clove'],
    descriptorTerms: ['whiskey-warm', 'ginger-warm', 'cinnamon-warm', 'boozy-warm'] },

  // ─── AROMA — FRUITY (14-20) ────────────────────────────────────────
  { index: 14, name: 'Citrusy', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['citrus', 'lemon', 'lime', 'orange'],
    anchorExamples: ['lemon zest', 'lime', 'grapefruit', 'yuzu'],
    descriptorTerms: ['lemon', 'lime', 'orange', 'grapefruit', 'yuzu', 'bergamot', 'mandarin', 'kumquat', 'zesty', 'zingy'] },
  { index: 15, name: 'Tropical', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['tropical', 'mango', 'pineapple'],
    anchorExamples: ['mango', 'pineapple', 'passion fruit', 'guava'],
    descriptorTerms: ['mango', 'pineapple', 'passion-fruit', 'guava', 'papaya', 'lychee', 'dragon-fruit'] },
  { index: 16, name: 'Berry', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['berry', 'strawberry', 'blueberry'],
    anchorExamples: ['strawberry', 'blueberry', 'raspberry', 'blackberry'],
    descriptorTerms: ['strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'boysenberry', 'mulberry'] },
  { index: 17, name: 'Orchard Stone', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['peach', 'apricot', 'plum'],
    anchorExamples: ['peach', 'apricot', 'plum', 'cherry'],
    descriptorTerms: ['peach', 'apricot', 'plum', 'cherry', 'nectarine', 'damson'] },
  { index: 18, name: 'Orchard Pomme', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['apple', 'pear', 'quince'],
    anchorExamples: ['apple', 'pear', 'quince'],
    descriptorTerms: ['apple', 'pear', 'quince', 'crisp-fruit', 'orchard'] },
  { index: 19, name: 'Melon', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['melon', 'watermelon', 'cantaloupe'],
    anchorExamples: ['watermelon', 'cantaloupe', 'honeydew'],
    descriptorTerms: ['watermelon', 'cantaloupe', 'honeydew', 'galia', 'muskmelon'] },
  { index: 20, name: 'Dried Fruit', primaryCategory: 'aroma', parentFamily: 'Fruity', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['raisin', 'date', 'fig', 'dried'],
    anchorExamples: ['raisin', 'date', 'fig', 'prune'],
    descriptorTerms: ['raisin', 'date', 'fig', 'prune', 'dried-apricot', 'currant', 'sultana', 'concentrated-fruit'] },

  // ─── AROMA — FLORAL (21-24) ────────────────────────────────────────
  { index: 21, name: 'Floral-Delicate', primaryCategory: 'aroma', parentFamily: 'Floral', tier: 'secondary', stevensExponent: 0.8,
    keywords: ['rose', 'jasmine', 'elderflower', 'delicate floral'],
    anchorExamples: ['rose water', 'jasmine rice', 'elderflower', 'violet'],
    descriptorTerms: ['rose', 'jasmine', 'elderflower', 'violet', 'hibiscus', 'perfumed'] },
  { index: 22, name: 'Floral-Bold', primaryCategory: 'aroma', parentFamily: 'Floral', tier: 'secondary', stevensExponent: 0.8,
    keywords: ['gardenia', 'tuberose', 'heady floral'],
    anchorExamples: ['gardenia', 'tuberose', 'honeysuckle'],
    descriptorTerms: ['gardenia', 'tuberose', 'honeysuckle', 'magnolia', 'heady'] },
  { index: 23, name: 'Blossom-Citrus', primaryCategory: 'aroma', parentFamily: 'Floral', tier: 'secondary', stevensExponent: 0.8,
    keywords: ['orange blossom', 'neroli'],
    anchorExamples: ['orange blossom water', 'neroli', 'yuzu-blossom'],
    descriptorTerms: ['orange-blossom', 'neroli', 'yuzu-blossom', 'citrus-flower'] },
  { index: 24, name: 'Floral-Herbal', primaryCategory: 'aroma', parentFamily: 'Floral', tier: 'secondary', stevensExponent: 0.8,
    keywords: ['lavender', 'chamomile', 'saffron'],
    anchorExamples: ['lavender', 'chamomile', 'rose geranium', 'saffron'],
    descriptorTerms: ['lavender', 'chamomile', 'rose-geranium', 'saffron', 'dried-flowers'] },

  // ─── AROMA — HERBAL/GREEN (25-28) ──────────────────────────────────
  { index: 25, name: 'Fresh Herb', primaryCategory: 'aroma', parentFamily: 'Herbal', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['basil', 'cilantro', 'parsley', 'fresh herb'],
    anchorExamples: ['fresh basil', 'cilantro', 'dill', 'chive'],
    descriptorTerms: ['basil', 'cilantro', 'parsley', 'dill', 'chive', 'tarragon', 'mint-fresh', 'herbaceous'] },
  { index: 26, name: 'Woody Herb', primaryCategory: 'aroma', parentFamily: 'Herbal', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['rosemary', 'thyme', 'sage', 'oregano'],
    anchorExamples: ['rosemary', 'thyme', 'sage', 'oregano'],
    descriptorTerms: ['rosemary', 'thyme', 'sage', 'oregano', 'bay', 'marjoram', 'savory-herb'] },
  { index: 27, name: 'Grassy', primaryCategory: 'aroma', parentFamily: 'Herbal', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['grass', 'lemongrass', 'green tea', 'hay'],
    anchorExamples: ['fresh grass', 'lemongrass', 'matcha', 'green tea'],
    descriptorTerms: ['grassy', 'lemongrass', 'green-tea', 'matcha', 'hay-like', 'verdant'] },
  { index: 28, name: 'Vegetal', primaryCategory: 'aroma', parentFamily: 'Herbal', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['vegetal', 'green bean', 'asparagus', 'bell pepper'],
    anchorExamples: ['green bean', 'asparagus', 'artichoke', 'celery'],
    descriptorTerms: ['green-bean', 'asparagus', 'artichoke', 'celery', 'bell-pepper', 'pea-pod', 'raw-vegetable'] },

  // ─── AROMA — WOODY (29-31) ─────────────────────────────────────────
  { index: 29, name: 'Resinous', primaryCategory: 'aroma', parentFamily: 'Woody', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['pine', 'cedar', 'juniper', 'resin'],
    anchorExamples: ['pine', 'cedar', 'juniper', 'rosemary'],
    descriptorTerms: ['pine', 'cedar', 'juniper', 'fir', 'spruce', 'piney'] },
  { index: 30, name: 'Barrel-Aged', primaryCategory: 'aroma', parentFamily: 'Woody', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['oak', 'whiskey barrel', 'bourbon'],
    anchorExamples: ['oak-aged wine', 'whiskey', 'bourbon', 'aged-rum'],
    descriptorTerms: ['oaky', 'whiskey-barrel', 'bourbon', 'wine-barrel', 'charred-oak'] },
  { index: 31, name: 'Bark-Wood', primaryCategory: 'aroma', parentFamily: 'Woody', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['birch', 'sassafras', 'bark'],
    anchorExamples: ['birch syrup', 'sassafras', 'sarsaparilla'],
    descriptorTerms: ['birch', 'sassafras', 'sarsaparilla', 'bark', 'root-beer'] },

  // ─── AROMA — SPICY-AROMATIC (32-35) ────────────────────────────────
  { index: 32, name: 'Warm Sweet Spice', primaryCategory: 'aroma', parentFamily: 'Spicy-Aromatic', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['cinnamon', 'clove', 'nutmeg', 'allspice', 'cardamom'],
    anchorExamples: ['cinnamon', 'clove', 'nutmeg', 'cardamom'],
    descriptorTerms: ['cinnamon', 'clove', 'nutmeg', 'allspice', 'cardamom', 'mace', 'mulling-spice', 'baking-spice'] },
  { index: 33, name: 'Savory Spice', primaryCategory: 'aroma', parentFamily: 'Spicy-Aromatic', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['cumin', 'coriander', 'fennel', 'caraway', 'anise'],
    anchorExamples: ['cumin', 'coriander', 'fennel seed', 'caraway'],
    descriptorTerms: ['cumin', 'coriander', 'fennel', 'caraway', 'anise', 'star-anise', 'licorice-spice'] },
  { index: 34, name: 'Pepper', primaryCategory: 'aroma', parentFamily: 'Spicy-Aromatic', tier: 'secondary', stevensExponent: 1.1,
    keywords: ['peppercorn', 'black pepper', 'white pepper'],
    anchorExamples: ['black pepper', 'white pepper', 'pink peppercorn', 'green peppercorn'],
    descriptorTerms: ['black-pepper', 'white-pepper', 'pink-pepper', 'green-peppercorn', 'peppery'] },
  { index: 35, name: 'Exotic-Curry', primaryCategory: 'aroma', parentFamily: 'Spicy-Aromatic', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['turmeric', 'fenugreek', 'curry leaf', 'asafoetida', 'galangal'],
    anchorExamples: ['turmeric', 'fenugreek', 'curry leaf', 'galangal'],
    descriptorTerms: ['turmeric', 'fenugreek', 'curry-leaf', 'asafoetida', 'galangal', 'curry-powder'] },

  // ─── AROMA — NUTTY (36-38) ─────────────────────────────────────────
  { index: 36, name: 'Tree Nut', primaryCategory: 'aroma', parentFamily: 'Nutty', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['almond', 'walnut', 'pecan', 'hazelnut'],
    anchorExamples: ['roasted almond', 'walnut', 'hazelnut', 'pecan'],
    descriptorTerms: ['almond', 'walnut', 'pecan', 'hazelnut', 'cashew', 'pistachio', 'macadamia', 'buttery-nut'] },
  { index: 37, name: 'Ground Nut', primaryCategory: 'aroma', parentFamily: 'Nutty', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['peanut', 'groundnut'],
    anchorExamples: ['roasted peanut', 'peanut butter'],
    descriptorTerms: ['peanut', 'groundnut', 'peanut-butter', 'bambara'] },
  { index: 38, name: 'Seed', primaryCategory: 'aroma', parentFamily: 'Nutty', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['sesame', 'sunflower', 'pumpkin seed', 'pine nut'],
    anchorExamples: ['sesame seed', 'sunflower seed', 'pumpkin seed', 'pine nut'],
    descriptorTerms: ['sesame', 'sunflower', 'pumpkin-seed', 'pine-nut', 'chia', 'flax', 'tahini'] },

  // ─── AROMA — ROASTED (39-43) ───────────────────────────────────────
  { index: 39, name: 'Coffee-Roast', primaryCategory: 'aroma', parentFamily: 'Roasted', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['coffee', 'espresso', 'roasted coffee'],
    anchorExamples: ['espresso', 'dark roast coffee', 'coffee bean'],
    descriptorTerms: ['espresso', 'dark-roast', 'light-roast', 'coffee-bean', 'crema'] },
  { index: 40, name: 'Bread-Crust', primaryCategory: 'aroma', parentFamily: 'Roasted', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['toasted bread', 'crust', 'bread-crust'],
    anchorExamples: ['toasted bread', 'baked crust', 'sourdough crust', 'crouton'],
    descriptorTerms: ['toasted-bread', 'baked-crust', 'sourdough-crust', 'crouton', 'toasty'] },
  { index: 41, name: 'Meat-Roast', primaryCategory: 'aroma', parentFamily: 'Roasted', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['seared', 'grilled', 'browned meat', 'char'],
    anchorExamples: ['seared steak', 'grilled char', 'browned meat', 'roast-crust'],
    descriptorTerms: ['seared', 'grilled-char', 'browned-meat', 'roast-crust', 'maillard'] },
  { index: 42, name: 'Grain-Toast', primaryCategory: 'aroma', parentFamily: 'Roasted', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['toasted rice', 'popcorn', 'toasted grain'],
    anchorExamples: ['toasted rice', 'popcorn', 'toasted oat', 'puffed grain'],
    descriptorTerms: ['toasted-rice', 'popcorn', 'toasted-oat', 'puffed-grain'] },
  { index: 43, name: 'Cocoa-Roast', primaryCategory: 'aroma', parentFamily: 'Roasted', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['cocoa nib', 'roasted cacao'],
    anchorExamples: ['cocoa nib', 'roasted cacao', 'dark chocolate roast'],
    descriptorTerms: ['cocoa-nib', 'roasted-cacao', 'dark-chocolate-roast'] },

  // ─── AROMA — CARAMELIZED (44-47) ───────────────────────────────────
  { index: 44, name: 'Toffee-Caramel', primaryCategory: 'aroma', parentFamily: 'Caramelized', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['caramel', 'toffee', 'butterscotch'],
    anchorExamples: ['caramel', 'toffee', 'dulce de leche', 'butterscotch'],
    descriptorTerms: ['butterscotch', 'dulce-de-leche', 'caramel', 'toffee', 'caramelized-sugar'] },
  { index: 45, name: 'Burnt-Sugar', primaryCategory: 'aroma', parentFamily: 'Caramelized', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['burnt sugar', 'brûlée', 'scorched'],
    anchorExamples: ['crème brûlée top', 'brûléed sugar'],
    descriptorTerms: ['crème-brûlée-top', 'brûléed', 'scorched-sugar', 'burnt-edge-sweet'] },
  { index: 46, name: 'Maple-Syrup', primaryCategory: 'aroma', parentFamily: 'Caramelized', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['maple', 'birch syrup'],
    anchorExamples: ['maple syrup', 'birch syrup', 'sugar maple'],
    descriptorTerms: ['maple', 'birch-syrup', 'sugar-maple'] },
  { index: 47, name: 'Molasses-Dark', primaryCategory: 'aroma', parentFamily: 'Caramelized', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['molasses', 'treacle'],
    anchorExamples: ['molasses', 'treacle', 'muscovado'],
    descriptorTerms: ['molasses', 'treacle', 'muscovado', 'dark-cane'] },

  // ─── AROMA — SMOKY (48-51) ─────────────────────────────────────────
  { index: 48, name: 'Hard-Wood-Smoke', primaryCategory: 'aroma', parentFamily: 'Smoky', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['hickory', 'mesquite', 'oak smoke'],
    anchorExamples: ['hickory smoke', 'mesquite', 'oak-smoke', 'brisket-smoke'],
    descriptorTerms: ['hickory', 'mesquite', 'oak-smoke', 'barbecue-smoke'] },
  { index: 49, name: 'Soft-Wood-Smoke', primaryCategory: 'aroma', parentFamily: 'Smoky', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['applewood', 'alder', 'cherrywood'],
    anchorExamples: ['applewood smoke', 'alder', 'cherrywood'],
    descriptorTerms: ['applewood', 'alder', 'cherrywood', 'fruit-wood-smoke'] },
  { index: 50, name: 'Charred', primaryCategory: 'aroma', parentFamily: 'Smoky', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['charred', 'blackened', 'carbonized'],
    anchorExamples: ['blackened fish', 'carbonized crust', 'burnt edge'],
    descriptorTerms: ['blackened', 'carbonized', 'burnt-edge', 'char-crust'] },
  { index: 51, name: 'Cold-Smoke', primaryCategory: 'aroma', parentFamily: 'Smoky', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['smoked salmon', 'lapsang', 'liquid smoke'],
    anchorExamples: ['smoked salmon', 'lapsang souchong', 'liquid smoke'],
    descriptorTerms: ['smoked-salmon', 'lapsang', 'liquid-smoke', 'cold-cured-smoke'] },

  // ─── AROMA — SULFUROUS (52-54) ─────────────────────────────────────
  { index: 52, name: 'Allium', primaryCategory: 'aroma', parentFamily: 'Sulfurous', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['garlic', 'onion', 'allium', 'leek'],
    anchorExamples: ['raw garlic', 'raw onion', 'leek', 'shallot'],
    descriptorTerms: ['garlic', 'onion', 'leek', 'shallot', 'chive', 'scallion', 'ramp', 'garlicky', 'oniony'] },
  { index: 53, name: 'Brassica', primaryCategory: 'aroma', parentFamily: 'Sulfurous', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['cabbage', 'cauliflower', 'broccoli', 'brassica'],
    anchorExamples: ['cooked cabbage', 'raw broccoli', 'cauliflower', 'mustard greens'],
    descriptorTerms: ['cabbage', 'cauliflower', 'broccoli', 'kale', 'brussels-sprout', 'radish', 'mustardy'] },
  { index: 54, name: 'Protein-Sulfur', primaryCategory: 'aroma', parentFamily: 'Sulfurous', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['boiled egg', 'cooked protein', 'egg sulfur'],
    anchorExamples: ['boiled egg', 'hard-boiled yolk'],
    descriptorTerms: ['boiled-egg', 'hard-boiled-yolk', 'egg-sulfur', 'cooked-protein'] },

  // ─── AROMA — EARTHY (55-58) ────────────────────────────────────────
  { index: 55, name: 'Mushroom', primaryCategory: 'aroma', parentFamily: 'Earthy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['mushroom', 'shiitake', 'truffle', 'porcini'],
    anchorExamples: ['shiitake', 'porcini', 'truffle', 'button mushroom'],
    descriptorTerms: ['button', 'shiitake', 'porcini', 'morel', 'chanterelle', 'truffle', 'mushroomy'] },
  { index: 56, name: 'Root-Tuber', primaryCategory: 'aroma', parentFamily: 'Earthy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['beet', 'turnip', 'rutabaga'],
    anchorExamples: ['beet', 'turnip', 'celeriac', 'parsnip'],
    descriptorTerms: ['beet', 'turnip', 'rutabaga', 'parsnip', 'celeriac', 'earthy-root'] },
  { index: 57, name: 'Mineral', primaryCategory: 'aroma', parentFamily: 'Earthy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['flint', 'chalk', 'iron', 'mineral'],
    anchorExamples: ['oyster mineral', 'flint stone', 'iron-rich meat'],
    descriptorTerms: ['flint', 'chalk', 'iron', 'stony', 'petrichor', 'metallic'] },
  { index: 58, name: 'Musty', primaryCategory: 'aroma', parentFamily: 'Earthy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['cellar', 'damp', 'cork', 'musty'],
    anchorExamples: ['aged cellar', 'damp wood', 'cork'],
    descriptorTerms: ['cellar', 'damp', 'cork', 'aged-dust', 'earthen'] },

  // ─── AROMA — DAIRY (59-63) ─────────────────────────────────────────
  { index: 59, name: 'Fresh Milk-Cream', primaryCategory: 'aroma', parentFamily: 'Dairy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['milk', 'cream', 'fresh milk'],
    anchorExamples: ['whole milk', 'heavy cream', 'half-and-half'],
    descriptorTerms: ['milk', 'heavy-cream', 'half-and-half', 'whole-milk', 'milky'] },
  { index: 60, name: 'Butter', primaryCategory: 'aroma', parentFamily: 'Dairy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['butter', 'ghee', 'brown butter'],
    anchorExamples: ['fresh butter', 'brown butter', 'ghee', 'cultured butter'],
    descriptorTerms: ['butter', 'brown-butter', 'beurre-noisette', 'ghee', 'buttery'] },
  { index: 61, name: 'Cultured Dairy', primaryCategory: 'aroma', parentFamily: 'Dairy', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['yogurt', 'kefir', 'sour cream', 'buttermilk'],
    anchorExamples: ['yogurt', 'kefir', 'sour cream', 'crème fraîche'],
    descriptorTerms: ['yogurt', 'kefir', 'sour-cream', 'buttermilk', 'crème-fraîche', 'tangy-dairy'] },
  { index: 62, name: 'Aged Cheese', primaryCategory: 'aroma', parentFamily: 'Dairy', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['parmesan', 'cheddar', 'aged cheese', 'gruyere'],
    anchorExamples: ['parmesan', 'aged cheddar', 'gruyère', 'manchego'],
    descriptorTerms: ['parmesan', 'cheddar', 'gruyère', 'manchego', 'pecorino', 'gouda', 'cheesy'] },
  { index: 63, name: 'Blue-Moldy Cheese', primaryCategory: 'aroma', parentFamily: 'Dairy', tier: 'secondary', stevensExponent: 1.1,
    keywords: ['blue cheese', 'gorgonzola', 'roquefort'],
    anchorExamples: ['blue cheese', 'gorgonzola', 'roquefort', 'stilton'],
    descriptorTerms: ['blue', 'gorgonzola', 'roquefort', 'stilton', 'cabrales', 'funky-cheese'] },

  // ─── AROMA — FERMENTED (64-68) ─────────────────────────────────────
  { index: 64, name: 'Lacto-Pickled', primaryCategory: 'aroma', parentFamily: 'Fermented', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['kimchi', 'sauerkraut', 'pickled'],
    anchorExamples: ['kimchi', 'sauerkraut', 'fermented hot sauce'],
    descriptorTerms: ['kimchi', 'sauerkraut', 'pickled-veg', 'fermented-hot-sauce', 'lacto-funky'] },
  { index: 65, name: 'Acetic-Vinegar', primaryCategory: 'aroma', parentFamily: 'Fermented', tier: 'secondary', stevensExponent: 1.1,
    keywords: ['vinegar', 'kombucha', 'shrub'],
    anchorExamples: ['vinegar', 'kombucha', 'apple cider vinegar'],
    descriptorTerms: ['vinegar', 'kombucha', 'shrub', 'acetic'] },
  { index: 66, name: 'Fish-Fermented', primaryCategory: 'aroma', parentFamily: 'Fermented', tier: 'secondary', stevensExponent: 1.2,
    keywords: ['fish sauce', 'anchovy', 'bottarga'],
    anchorExamples: ['fish sauce', 'anchovy paste', 'bottarga', 'shrimp paste'],
    descriptorTerms: ['fish-sauce', 'anchovy', 'bottarga', 'shrimp-paste', 'funky-fish'] },
  { index: 67, name: 'Bean-Fermented', primaryCategory: 'aroma', parentFamily: 'Fermented', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['miso', 'soy sauce', 'tempeh', 'natto'],
    anchorExamples: ['miso', 'soy sauce', 'tempeh', 'doubanjiang'],
    descriptorTerms: ['miso', 'soy-sauce', 'tempeh', 'natto', 'doubanjiang', 'gochujang'] },
  { index: 68, name: 'Sourdough-Starter', primaryCategory: 'aroma', parentFamily: 'Fermented', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['sourdough', 'naturally leavened'],
    anchorExamples: ['sourdough', 'naturally-leavened bread', 'cultured grain'],
    descriptorTerms: ['sourdough', 'naturally-leavened', 'cultured-grain', 'levain'] },

  // ─── AROMA — YEASTY (69-71) ────────────────────────────────────────
  { index: 69, name: 'Bread-Yeast', primaryCategory: 'aroma', parentFamily: 'Yeasty', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['bread dough', 'fresh dough', 'pizza dough'],
    anchorExamples: ['fresh dough', 'baked bread', 'pizza dough'],
    descriptorTerms: ['fresh-dough', 'baked-bread', 'pizza-dough', 'bready'] },
  { index: 70, name: 'Beer-Brewery', primaryCategory: 'aroma', parentFamily: 'Yeasty', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['ale', 'lager', 'stout', 'hoppy'],
    anchorExamples: ['ale', 'lager', 'stout', 'hoppy beer'],
    descriptorTerms: ['ale', 'lager', 'stout', 'hoppy', 'brewery'] },
  { index: 71, name: 'Umami-Yeast', primaryCategory: 'aroma', parentFamily: 'Yeasty', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['marmite', 'nutritional yeast', 'brewer yeast'],
    anchorExamples: ['marmite', 'nutritional yeast', 'brewer yeast'],
    descriptorTerms: ['marmite', 'vegemite', 'nutritional-yeast', 'brewer-yeast'] },

  // ─── AROMA — MARINE (72-75) ────────────────────────────────────────
  { index: 72, name: 'Seaweed', primaryCategory: 'aroma', parentFamily: 'Marine', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['seaweed', 'nori', 'kombu', 'wakame'],
    anchorExamples: ['nori', 'kombu', 'wakame', 'kelp'],
    descriptorTerms: ['nori', 'kombu', 'wakame', 'kelp', 'dulse', 'sea-vegetable'] },
  { index: 73, name: 'Fish', primaryCategory: 'aroma', parentFamily: 'Marine', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['fish', 'fresh fish', 'smoked fish'],
    anchorExamples: ['fresh fish', 'smoked fish', 'dried fish', 'sashimi'],
    descriptorTerms: ['fresh-fish', 'smoked-fish', 'dried-fish', 'sashimi', 'fishy'] },
  { index: 74, name: 'Shellfish', primaryCategory: 'aroma', parentFamily: 'Marine', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['shellfish', 'oyster', 'shrimp', 'lobster'],
    anchorExamples: ['oyster', 'shrimp', 'lobster', 'crab', 'scallop'],
    descriptorTerms: ['oyster', 'clam', 'shrimp', 'lobster', 'crab', 'scallop', 'shellfishy'] },
  { index: 75, name: 'Briny', primaryCategory: 'aroma', parentFamily: 'Marine', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['brine', 'sea salt', 'pickled'],
    anchorExamples: ['sea salt', 'oyster brine', 'caviar', 'anchovy liquid'],
    descriptorTerms: ['sea-salt', 'pickled-brine', 'caviar', 'anchovy-liquid', 'oceanic'] },

  // ─── AROMA — MEATY (76-79) ─────────────────────────────────────────
  { index: 76, name: 'Cooked Meat', primaryCategory: 'aroma', parentFamily: 'Meaty', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['roasted', 'grilled', 'braised', 'cooked meat'],
    anchorExamples: ['roast beef', 'grilled chicken', 'braised pork'],
    descriptorTerms: ['roasted', 'grilled', 'braised', 'sous-vide', 'confit', 'meaty'] },
  { index: 77, name: 'Cured-Preserved', primaryCategory: 'aroma', parentFamily: 'Meaty', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['bacon', 'prosciutto', 'jerky', 'pastrami'],
    anchorExamples: ['bacon', 'prosciutto', 'jerky', 'pastrami', 'salumi'],
    descriptorTerms: ['bacon', 'prosciutto', 'jerky', 'pastrami', 'salumi', 'charcuterie'] },
  { index: 78, name: 'Gamey', primaryCategory: 'aroma', parentFamily: 'Meaty', tier: 'secondary', stevensExponent: 1.1,
    keywords: ['venison', 'duck', 'lamb', 'game'],
    anchorExamples: ['venison', 'duck', 'lamb', 'wild boar'],
    descriptorTerms: ['venison', 'duck', 'lamb', 'rabbit', 'wild-boar', 'gamey'] },
  { index: 79, name: 'Broth-Stock', primaryCategory: 'aroma', parentFamily: 'Meaty', tier: 'secondary', stevensExponent: 1.0,
    keywords: ['broth', 'stock', 'demi-glace'],
    anchorExamples: ['bone broth', 'demi-glace', 'reduction', 'jus'],
    descriptorTerms: ['bone-broth', 'demi-glace', 'stock', 'reduction', 'jus', 'brothy'] },

  // ─── AROMA — SWEET-AROMATIC (80-82) ────────────────────────────────
  { index: 80, name: 'Honey', primaryCategory: 'aroma', parentFamily: 'Sweet-Aromatic', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['honey'],
    anchorExamples: ['wildflower honey', 'orange-blossom honey', 'manuka honey'],
    descriptorTerms: ['wildflower-honey', 'orange-blossom-honey', 'manuka', 'buckwheat-honey', 'clover'] },
  { index: 81, name: 'Tree-Syrup', primaryCategory: 'aroma', parentFamily: 'Sweet-Aromatic', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['maple syrup', 'birch syrup'],
    anchorExamples: ['maple syrup', 'birch syrup'],
    descriptorTerms: ['maple', 'birch'] },
  { index: 82, name: 'Molasses-Cane', primaryCategory: 'aroma', parentFamily: 'Sweet-Aromatic', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['molasses', 'cane syrup', 'treacle'],
    anchorExamples: ['molasses', 'treacle', 'sugarcane syrup'],
    descriptorTerms: ['molasses', 'treacle', 'sugarcane', 'muscovado'] },

  // ─── AROMA — SPECIAL (83-85) ───────────────────────────────────────
  { index: 83, name: 'Vanilla', primaryCategory: 'aroma', parentFamily: 'Sweet-Special', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['vanilla', 'vanillin'],
    anchorExamples: ['vanilla bean', 'bourbon vanilla', 'tonka'],
    descriptorTerms: ['bourbon-vanilla', 'tahitian-vanilla', 'mexican-vanilla', 'tonka', 'vanillin'] },
  { index: 84, name: 'Dark Cocoa', primaryCategory: 'aroma', parentFamily: 'Chocolate-Cocoa', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['dark chocolate', 'cocoa powder', 'cacao'],
    anchorExamples: ['dark chocolate 70%+', 'cocoa powder', 'cacao nib'],
    descriptorTerms: ['cocoa-powder', 'dark-chocolate', 'cacao-nib', '70%-dark'] },
  { index: 85, name: 'Milk Chocolate', primaryCategory: 'aroma', parentFamily: 'Chocolate-Cocoa', tier: 'secondary', stevensExponent: 0.9,
    keywords: ['milk chocolate', 'white chocolate'],
    anchorExamples: ['milk chocolate', 'white chocolate', 'chocolate liquor'],
    descriptorTerms: ['milk-chocolate', 'white-chocolate', 'chocolate-liquor', 'creamy-chocolate'] },

  // ─── TEXTURE — MECHANICAL (86-91) ──────────────────────────────────
  { index: 86, name: 'Crunchy', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['crunchy', 'crisp', 'brittle'],
    anchorExamples: ['raw celery', 'apple', 'chip', 'cracker', 'granola'],
    descriptorTerms: ['cracker-crunch', 'raw-celery', 'chip-crunch', 'granola', 'snap'] },
  { index: 87, name: 'Crispy', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['crispy', 'fried', 'golden-brown'],
    anchorExamples: ['fried chicken skin', 'tempura', 'panko coating', 'potato chip'],
    descriptorTerms: ['tempura', 'fried-skin', 'panko-crisp', 'cracker-crisp', 'golden-crust'] },
  { index: 88, name: 'Chewy', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['chewy', 'al dente', 'bread', 'dough'],
    anchorExamples: ['bagel', 'taffy', 'mochi', 'al-dente pasta'],
    descriptorTerms: ['taffy', 'mochi', 'bagel', 'al-dente-pasta', 'gummy-bread'] },
  { index: 89, name: 'Tender', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['tender', 'melt-in-mouth', 'fall-apart'],
    anchorExamples: ['braised meat', 'poached egg', 'silken tofu'],
    descriptorTerms: ['fall-apart', 'melt-in-mouth', 'silky-poached', 'butter-tender'] },
  { index: 90, name: 'Firm', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['firm', 'structured', 'holds shape'],
    anchorExamples: ['cooked egg white', 'firm tofu', 'carrot'],
    descriptorTerms: ['resistant-bite', 'structured', 'holds-shape', 'sturdy'] },
  { index: 91, name: 'Fibrous', primaryCategory: 'texture_mechanical', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['fibrous', 'stringy', 'braided'],
    anchorExamples: ['asparagus fiber', 'pulled pork', 'string cheese'],
    descriptorTerms: ['stringy', 'braided', 'ropy', 'asparagus-fiber', 'sinewy'] },

  // ─── TEXTURE — MOISTURE (92-94) ────────────────────────────────────
  { index: 92, name: 'Juicy', primaryCategory: 'texture_moisture', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['juicy', 'succulent', 'bursting'],
    anchorExamples: ['ripe peach', 'watermelon', 'perfectly cooked chicken'],
    descriptorTerms: ['bursting', 'succulent', 'dripping', 'gushing', 'plump'] },
  { index: 93, name: 'Moist', primaryCategory: 'texture_moisture', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['moist', 'damp', 'hydrated'],
    anchorExamples: ['good cake', 'pilaf', 'moistened bread'],
    descriptorTerms: ['damp', 'supple', 'hydrated', 'plump', 'not-dry'] },
  { index: 94, name: 'Dry', primaryCategory: 'texture_moisture', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['dry', 'arid', 'crumbly'],
    anchorExamples: ['jerky', 'cracker', 'overcooked chicken breast'],
    descriptorTerms: ['arid', 'desiccated', 'crumbly-dry', 'mealy', 'parched'] },

  // ─── TEXTURE — MOUTHFEEL (95-104) ──────────────────────────────────
  { index: 95, name: 'Creamy', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['creamy', 'smooth', 'velvety'],
    anchorExamples: ['heavy cream', 'avocado', 'custard', 'mousse'],
    descriptorTerms: ['velvety', 'whipped', 'luxurious', 'pillowy', 'lush'] },
  { index: 96, name: 'Silky', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['silky', 'smooth', 'pureed'],
    anchorExamples: ['silken tofu', 'panna cotta', 'pureed soup', 'hollandaise'],
    descriptorTerms: ['smooth-liquid', 'pureed', 'satiny', 'glossy', 'consommé-like'] },
  { index: 97, name: 'Oily', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['oily', 'fat-coating', 'greasy'],
    anchorExamples: ['olive oil', 'deep-fried food', 'fatty fish'],
    descriptorTerms: ['slick', 'greasy', 'coating-fat', 'glistening'] },
  { index: 98, name: 'Grainy', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['grainy', 'sandy', 'cornmeal'],
    anchorExamples: ['polenta', 'cornmeal', 'grits'],
    descriptorTerms: ['sandy', 'cornmeal-grit', 'polenta', 'coarse', 'small-particles'] },
  { index: 99, name: 'Gummy', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['gummy', 'sticky-chew', 'elastic'],
    anchorExamples: ['gummy candy', 'marshmallow', 'overcooked rice'],
    descriptorTerms: ['sticky-chew', 'elastic', 'rubbery', 'chewy-sticky'] },
  { index: 100, name: 'Starchy', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['starchy', 'mealy', 'potato-thick'],
    anchorExamples: ['mashed potato', 'pasta water', 'cooked rice'],
    descriptorTerms: ['mealy', 'pasty', 'potato-thick', 'carbohydrate-rich'] },
  { index: 101, name: 'Gelatinous', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['gelatinous', 'jiggly', 'aspic'],
    anchorExamples: ['panna cotta', 'aspic', 'jell-o', 'boba pearl'],
    descriptorTerms: ['aspic', 'quivering', 'jell-o', 'panna-cotta', 'jiggly'] },
  { index: 102, name: 'Foamy', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['foamy', 'airy', 'mousse'],
    anchorExamples: ['whipped cream', 'mousse', 'meringue', 'cappuccino foam'],
    descriptorTerms: ['airy', 'mousse', 'foam', 'whipped-topping', 'bubbly'] },
  { index: 103, name: 'Powdery', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['powdery', 'dusty', 'flour'],
    anchorExamples: ['powdered sugar', 'flour', 'dusting', 'cocoa powder'],
    descriptorTerms: ['dust', 'flour', 'talc', 'fine-powder'] },
  { index: 104, name: 'Sticky', primaryCategory: 'texture_mouthfeel', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['sticky', 'gooey', 'tacky'],
    anchorExamples: ['sticky rice', 'honey', 'caramel', 'glaze'],
    descriptorTerms: ['gooey', 'tacky', 'glutinous', 'adhesive'] },

  // ─── TEMPERATURE (105) ─────────────────────────────────────────────
  { index: 105, name: 'Temperature', primaryCategory: 'temperature', parentFamily: null, tier: 'primary',
    scaleType: 'bipolar', scaleMin: -6, scaleMax: 6, stevensExponent: 1.0,
    keywords: ['temperature', 'hot', 'cold', 'warm', 'cool', 'frozen'],
    anchorExamples: ['frozen=-6', 'cold=-3', 'cool=-1', 'room=0', 'warm=+2', 'hot=+4', 'very hot=+6'],
    descriptorTerms: ['frozen', 'cold', 'cool', 'room-temperature', 'warm', 'hot', 'piping-hot', 'steaming'] },

  // ─── CHARACTER (106-112) ───────────────────────────────────────────
  { index: 106, name: 'Rich', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['rich', 'indulgent', 'decadent', 'satiating'],
    anchorExamples: ['heavy cream sauce', 'foie gras', 'chocolate cake', 'braised short ribs'],
    descriptorTerms: ['indulgent', 'decadent', 'satiating', 'full-bodied', 'unctuous', 'luxurious'] },
  { index: 107, name: 'Complex', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['complex', 'layered', 'nuanced', 'multi-dimensional'],
    anchorExamples: ['aged wine', 'mole', 'long-simmered curry', 'bone broth reduction'],
    descriptorTerms: ['layered', 'nuanced', 'multi-dimensional', 'evolving', 'intricate'] },
  { index: 108, name: 'Fresh', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['fresh', 'bright', 'vibrant', 'just-made'],
    anchorExamples: ['fresh herb', 'citrus zest', 'garden salad', 'just-cut fruit'],
    descriptorTerms: ['bright', 'vibrant', 'just-made', 'clean', 'lively', 'zingy'] },
  { index: 109, name: 'Aged', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['aged', 'matured', 'developed'],
    anchorExamples: ['aged cheese', 'aged wine', 'prosciutto di parma', 'soy sauce'],
    descriptorTerms: ['matured', 'developed', 'weathered', 'ripened', 'time-worked'] },
  { index: 110, name: 'Delicate', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['delicate', 'subtle', 'refined', 'light'],
    anchorExamples: ['poached white fish', 'chamomile tea', 'silken tofu'],
    descriptorTerms: ['subtle', 'refined', 'light-handed', 'gentle', 'nuanced'] },
  { index: 111, name: 'Bold', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 1.0,
    keywords: ['bold', 'assertive', 'strong', 'full-force'],
    anchorExamples: ['blue cheese', 'chipotle-in-adobo', 'fish sauce', 'stinky tofu'],
    descriptorTerms: ['assertive', 'strong', 'full-force', 'aggressive', 'forward'] },
  { index: 112, name: 'Body', primaryCategory: 'character', parentFamily: null, tier: 'primary', stevensExponent: 0.9,
    keywords: ['body', 'weight', 'heaviness', 'substance'],
    anchorExamples: ['stew', 'dense cake', 'heavy-cream soup'],
    descriptorTerms: ['weighty', 'substantial', 'heavy', 'dense', 'massive', 'present'] },
];

async function main() {
  console.log('\n=== Seed Sensory Dimensions v2 ===\n');
  if (DRY_RUN) console.log('  [DRY RUN — no writes]\n');

  console.log(`Seeding ${DIMENSIONS.length} dimensions...\n`);

  let created = 0;
  let updated = 0;

  // Group by category for nice progress
  const byCat: Record<string, number> = {};

  for (const dim of DIMENSIONS) {
    byCat[dim.primaryCategory] = (byCat[dim.primaryCategory] || 0) + 1;

    if (!DRY_RUN) {
      const existing = await prisma.sensoryDimensionConfig.findUnique({ where: { dimension: dim.index } });
      const data = {
        name: dim.name,
        category: dim.primaryCategory,   // legacy field
        primaryCategory: dim.primaryCategory,
        parentFamily: dim.parentFamily,
        tier: dim.tier,
        scaleType: dim.scaleType ?? 'unipolar',
        scaleMin: dim.scaleMin ?? 0,
        scaleMax: dim.scaleMax ?? 6,
        stevensExponent: dim.stevensExponent,
        keywords: dim.keywords,
        anchorExamples: dim.anchorExamples,
        descriptorTerms: dim.descriptorTerms,
        isActive: true,
      };
      if (existing) {
        await prisma.sensoryDimensionConfig.update({ where: { dimension: dim.index }, data });
        updated++;
      } else {
        await prisma.sensoryDimensionConfig.create({ data: { dimension: dim.index, ...data } });
        created++;
      }
    }
  }

  console.log('By category:');
  Object.entries(byCat).forEach(([cat, n]) => console.log(`  ${cat.padEnd(25)} ${n}`));

  console.log(`\n=== Summary ===`);
  console.log(`  Total dims seeded: ${DIMENSIONS.length}`);
  console.log(`  Created:           ${created}`);
  console.log(`  Updated:           ${updated}`);
  if (DRY_RUN) console.log(`  [DRY RUN — no changes written]`);
  console.log();

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
