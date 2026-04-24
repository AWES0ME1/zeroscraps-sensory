/**
 * Seed SensoryDescriptor vocabulary — ~500 natural-language descriptors
 * mapping to weighted dimension combinations.
 *
 * This is the "user-facing" layer. When a user searches for "funky" or
 * "zesty", we look up here to convert to a target dimension vector.
 *
 * Run: cd server && npx ts-node src/scripts/seed-vocabulary.ts
 *      --dry-run to preview
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/lib/prisma';

const DRY_RUN = process.argv.includes('--dry-run');

// Dimension index map (must match docs/sensory-dimension-reference.md)
const D = {
  Sweet: 0, Salty: 1, Sour: 2, Bitter: 3, Umami: 4, Kokumi: 5, Fatty: 6,
  Spicy: 7, Pungent: 8, Cooling: 9, Astringent: 10, Numbing: 11, Carbonated: 12, Warming: 13,
  Citrusy: 14, Tropical: 15, Berry: 16, OrchardStone: 17, OrchardPomme: 18, Melon: 19, DriedFruit: 20,
  FloralDelicate: 21, FloralBold: 22, BlossomCitrus: 23, FloralHerbal: 24,
  FreshHerb: 25, WoodyHerb: 26, Grassy: 27, Vegetal: 28,
  Resinous: 29, BarrelAged: 30, BarkWood: 31,
  WarmSweetSpice: 32, SavorySpice: 33, Pepper: 34, ExoticCurry: 35,
  TreeNut: 36, GroundNut: 37, Seed: 38,
  CoffeeRoast: 39, BreadCrust: 40, MeatRoast: 41, GrainToast: 42, CocoaRoast: 43,
  ToffeeCaramel: 44, BurntSugar: 45, MapleSyrup: 46, MolassesDark: 47,
  HardWoodSmoke: 48, SoftWoodSmoke: 49, Charred: 50, ColdSmoke: 51,
  Allium: 52, Brassica: 53, ProteinSulfur: 54,
  Mushroom: 55, RootTuber: 56, Mineral: 57, Musty: 58,
  FreshMilkCream: 59, Butter: 60, CulturedDairy: 61, AgedCheese: 62, BlueMoldyCheese: 63,
  LactoPickled: 64, AceticVinegar: 65, FishFermented: 66, BeanFermented: 67, SourdoughStarter: 68,
  BreadYeast: 69, BeerBrewery: 70, UmamiYeast: 71,
  Seaweed: 72, Fish: 73, Shellfish: 74, Briny: 75,
  CookedMeat: 76, CuredPreserved: 77, Gamey: 78, BrothStock: 79,
  Honey: 80, TreeSyrup: 81, MolassesCane: 82,
  Vanilla: 83, DarkCocoa: 84, MilkChocolate: 85,
  Crunchy: 86, Crispy: 87, Chewy: 88, Tender: 89, Firm: 90, Fibrous: 91,
  Juicy: 92, Moist: 93, Dry: 94,
  Creamy: 95, Silky: 96, Oily: 97, Grainy: 98, Gummy: 99, Starchy: 100,
  Gelatinous: 101, Foamy: 102, Powdery: 103, Sticky: 104,
  Temperature: 105,
  Rich: 106, Complex: 107, Fresh: 108, Aged: 109, Delicate: 110, Bold: 111, Body: 112,
};

// ══════════════════════════════════════════════════════════════════════
// VOCABULARY — term → weighted dim mappings
// ══════════════════════════════════════════════════════════════════════

type Descriptor = {
  term: string;
  category: string;
  dimMappings: Record<number, number>;
  aliases?: string[];
};

const DESCRIPTORS: Descriptor[] = [
  // ── TASTE PRIMARIES & SYNONYMS ──
  { term: 'sweet', category: 'taste', dimMappings: { [D.Sweet]: 1.0 }, aliases: ['sugary', 'honeyed', 'candied'] },
  { term: 'salty', category: 'taste', dimMappings: { [D.Salty]: 1.0 }, aliases: ['saline', 'briny-salt'] },
  { term: 'sour', category: 'taste', dimMappings: { [D.Sour]: 1.0 }, aliases: ['tart', 'acidic'] },
  { term: 'bitter', category: 'taste', dimMappings: { [D.Bitter]: 1.0 }, aliases: ['astringent-bitter'] },
  { term: 'umami', category: 'taste', dimMappings: { [D.Umami]: 1.0 }, aliases: ['savory', 'glutamate-rich'] },
  { term: 'fatty', category: 'taste', dimMappings: { [D.Fatty]: 1.0, [D.Rich]: 0.3 } },
  { term: 'sugary', category: 'taste', dimMappings: { [D.Sweet]: 0.9 } },
  { term: 'honeyed', category: 'taste', dimMappings: { [D.Sweet]: 0.7, [D.Honey]: 0.8, [D.FloralDelicate]: 0.3 } },
  { term: 'candied', category: 'taste', dimMappings: { [D.Sweet]: 0.9, [D.ToffeeCaramel]: 0.3 } },
  { term: 'jammy', category: 'taste', dimMappings: { [D.Sweet]: 0.7, [D.Berry]: 0.5, [D.Sticky]: 0.4 } },
  { term: 'syrupy', category: 'texture', dimMappings: { [D.Sticky]: 0.6, [D.Sweet]: 0.7, [D.Silky]: 0.5 } },
  { term: 'briny', category: 'taste', dimMappings: { [D.Salty]: 0.7, [D.Briny]: 0.8, [D.Seaweed]: 0.2 } },
  { term: 'tart', category: 'taste', dimMappings: { [D.Sour]: 0.8, [D.Fresh]: 0.3 } },
  { term: 'tangy', category: 'taste', dimMappings: { [D.Sour]: 0.6, [D.Fresh]: 0.4, [D.Citrusy]: 0.3 } },
  { term: 'vinegary', category: 'taste', dimMappings: { [D.Sour]: 0.7, [D.AceticVinegar]: 0.9 } },
  { term: 'savory', category: 'taste', dimMappings: { [D.Umami]: 0.8, [D.Salty]: 0.4 } },
  { term: 'meaty', category: 'flavor', dimMappings: { [D.Umami]: 0.8, [D.CookedMeat]: 0.7, [D.Rich]: 0.3 } },
  { term: 'brothy', category: 'flavor', dimMappings: { [D.Umami]: 0.7, [D.Kokumi]: 0.6, [D.BrothStock]: 0.8, [D.Silky]: 0.4 } },

  // ── CHEMESTHETIC ──
  { term: 'spicy', category: 'chemesthetic', dimMappings: { [D.Spicy]: 1.0 }, aliases: ['hot', 'fiery'] },
  { term: 'hot', category: 'chemesthetic', dimMappings: { [D.Spicy]: 0.8, [D.Warming]: 0.4 } },
  { term: 'fiery', category: 'chemesthetic', dimMappings: { [D.Spicy]: 0.9, [D.Warming]: 0.4 } },
  { term: 'pungent', category: 'chemesthetic', dimMappings: { [D.Pungent]: 1.0 }, aliases: ['sharp'] },
  { term: 'sharp', category: 'chemesthetic', dimMappings: { [D.Pungent]: 0.8, [D.Spicy]: 0.2 } },
  { term: 'stinky', category: 'chemesthetic', dimMappings: { [D.Pungent]: 0.8, [D.Allium]: 0.5, [D.LactoPickled]: 0.3 }, aliases: ['smelly', 'whiffy', 'funky'] },
  { term: 'funky', category: 'chemesthetic', dimMappings: { [D.LactoPickled]: 0.7, [D.Pungent]: 0.6, [D.Mushroom]: 0.3, [D.Aged]: 0.3 } },
  { term: 'cooling', category: 'chemesthetic', dimMappings: { [D.Cooling]: 1.0, [D.Fresh]: 0.3 } },
  { term: 'minty', category: 'chemesthetic', dimMappings: { [D.Cooling]: 0.8, [D.FreshHerb]: 0.6, [D.Fresh]: 0.4 } },
  { term: 'refreshing', category: 'sensation', dimMappings: { [D.Fresh]: 0.7, [D.Cooling]: 0.5, [D.Citrusy]: 0.3 } },
  { term: 'tannic', category: 'chemesthetic', dimMappings: { [D.Astringent]: 0.8, [D.Bitter]: 0.3 } },
  { term: 'drying', category: 'chemesthetic', dimMappings: { [D.Astringent]: 0.7, [D.Dry]: 0.4 } },
  { term: 'astringent', category: 'chemesthetic', dimMappings: { [D.Astringent]: 1.0 } },
  { term: 'numbing', category: 'chemesthetic', dimMappings: { [D.Numbing]: 1.0 } },
  { term: 'tingly', category: 'chemesthetic', dimMappings: { [D.Numbing]: 0.6, [D.Carbonated]: 0.3 } },
  { term: 'ma-la', category: 'chemesthetic', dimMappings: { [D.Numbing]: 0.9, [D.Spicy]: 0.7 } },
  { term: 'fizzy', category: 'chemesthetic', dimMappings: { [D.Carbonated]: 1.0 } },
  { term: 'effervescent', category: 'chemesthetic', dimMappings: { [D.Carbonated]: 1.0 } },
  { term: 'sparkling', category: 'chemesthetic', dimMappings: { [D.Carbonated]: 0.9 } },
  { term: 'warming', category: 'sensation', dimMappings: { [D.Warming]: 0.8, [D.WarmSweetSpice]: 0.3 } },
  { term: 'boozy', category: 'chemesthetic', dimMappings: { [D.Warming]: 0.6, [D.BarrelAged]: 0.3 } },

  // ── FRUITY TERTIARIES ──
  { term: 'citrusy', category: 'aroma', dimMappings: { [D.Citrusy]: 1.0 }, aliases: ['lemony', 'zesty'] },
  { term: 'zesty', category: 'aroma', dimMappings: { [D.Citrusy]: 0.7, [D.Fresh]: 0.6, [D.Sour]: 0.3 } },
  { term: 'lemon', category: 'aroma', dimMappings: { [D.Citrusy]: 0.9, [D.Sour]: 0.5, [D.Fresh]: 0.3 } },
  { term: 'lime', category: 'aroma', dimMappings: { [D.Citrusy]: 0.9, [D.Sour]: 0.5, [D.Bitter]: 0.2 } },
  { term: 'orange', category: 'aroma', dimMappings: { [D.Citrusy]: 0.8, [D.Sweet]: 0.4, [D.OrchardStone]: 0.1 } },
  { term: 'grapefruit', category: 'aroma', dimMappings: { [D.Citrusy]: 0.9, [D.Bitter]: 0.4, [D.Fresh]: 0.3 } },
  { term: 'yuzu', category: 'aroma', dimMappings: { [D.Citrusy]: 0.9, [D.FloralDelicate]: 0.4, [D.BlossomCitrus]: 0.4 } },
  { term: 'bergamot', category: 'aroma', dimMappings: { [D.Citrusy]: 0.7, [D.FloralDelicate]: 0.5 } },
  { term: 'tropical', category: 'aroma', dimMappings: { [D.Tropical]: 1.0 } },
  { term: 'mango', category: 'aroma', dimMappings: { [D.Tropical]: 0.9, [D.Sweet]: 0.5 } },
  { term: 'pineapple', category: 'aroma', dimMappings: { [D.Tropical]: 0.9, [D.Sweet]: 0.4, [D.Sour]: 0.3 } },
  { term: 'passion-fruit', category: 'aroma', dimMappings: { [D.Tropical]: 0.9, [D.Sour]: 0.4, [D.Fresh]: 0.4 } },
  { term: 'coconut', category: 'aroma', dimMappings: { [D.Tropical]: 0.7, [D.Rich]: 0.4, [D.Creamy]: 0.3 } },
  { term: 'berry', category: 'aroma', dimMappings: { [D.Berry]: 1.0 } },
  { term: 'strawberry', category: 'aroma', dimMappings: { [D.Berry]: 0.9, [D.Sweet]: 0.4, [D.FloralDelicate]: 0.2 } },
  { term: 'blueberry', category: 'aroma', dimMappings: { [D.Berry]: 0.9 } },
  { term: 'raspberry', category: 'aroma', dimMappings: { [D.Berry]: 0.9, [D.Sour]: 0.3 } },
  { term: 'peach', category: 'aroma', dimMappings: { [D.OrchardStone]: 0.9, [D.FloralDelicate]: 0.3, [D.Sweet]: 0.4 } },
  { term: 'apricot', category: 'aroma', dimMappings: { [D.OrchardStone]: 0.8, [D.Sour]: 0.2 } },
  { term: 'cherry', category: 'aroma', dimMappings: { [D.OrchardStone]: 0.8, [D.Sour]: 0.3, [D.Sweet]: 0.4 } },
  { term: 'apple', category: 'aroma', dimMappings: { [D.OrchardPomme]: 0.9, [D.Sweet]: 0.3, [D.Sour]: 0.2 } },
  { term: 'pear', category: 'aroma', dimMappings: { [D.OrchardPomme]: 0.9, [D.FloralDelicate]: 0.2 } },

  // ── FLORAL ──
  { term: 'floral', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.7, [D.FloralBold]: 0.3 } },
  { term: 'rose', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.9, [D.Sweet]: 0.2 } },
  { term: 'jasmine', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.9, [D.BlossomCitrus]: 0.3 } },
  { term: 'elderflower', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.9 } },
  { term: 'violet', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.8 } },
  { term: 'lavender', category: 'aroma', dimMappings: { [D.FloralHerbal]: 0.9, [D.FloralDelicate]: 0.3 } },
  { term: 'chamomile', category: 'aroma', dimMappings: { [D.FloralHerbal]: 0.8, [D.Honey]: 0.3 } },
  { term: 'saffron', category: 'aroma', dimMappings: { [D.FloralHerbal]: 0.7, [D.WoodyHerb]: 0.4 } },
  { term: 'perfumed', category: 'aroma', dimMappings: { [D.FloralDelicate]: 0.5, [D.FloralBold]: 0.5 } },

  // ── HERBAL/GREEN ──
  { term: 'herbal', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.6, [D.WoodyHerb]: 0.4 } },
  { term: 'herbaceous', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.7, [D.Grassy]: 0.3 } },
  { term: 'basil', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.9, [D.FloralHerbal]: 0.3 } },
  { term: 'cilantro', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.9, [D.Citrusy]: 0.2 } },
  { term: 'parsley', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.8, [D.Grassy]: 0.3 } },
  { term: 'dill', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.8, [D.Grassy]: 0.2 } },
  { term: 'mint', category: 'aroma', dimMappings: { [D.FreshHerb]: 0.8, [D.Cooling]: 0.9 } },
  { term: 'rosemary', category: 'aroma', dimMappings: { [D.WoodyHerb]: 0.9, [D.Resinous]: 0.5 } },
  { term: 'thyme', category: 'aroma', dimMappings: { [D.WoodyHerb]: 0.9 } },
  { term: 'sage', category: 'aroma', dimMappings: { [D.WoodyHerb]: 0.9, [D.Mushroom]: 0.2 } },
  { term: 'oregano', category: 'aroma', dimMappings: { [D.WoodyHerb]: 0.8 } },
  { term: 'bay', category: 'aroma', dimMappings: { [D.WoodyHerb]: 0.8 } },
  { term: 'grassy', category: 'aroma', dimMappings: { [D.Grassy]: 1.0, [D.Fresh]: 0.4 } },
  { term: 'lemongrass', category: 'aroma', dimMappings: { [D.Grassy]: 0.8, [D.Citrusy]: 0.5 } },
  { term: 'green', category: 'aroma', dimMappings: { [D.Grassy]: 0.6, [D.Vegetal]: 0.5 } },
  { term: 'vegetal', category: 'aroma', dimMappings: { [D.Vegetal]: 1.0 } },

  // ── WOODY ──
  { term: 'woody', category: 'aroma', dimMappings: { [D.Resinous]: 0.4, [D.BarkWood]: 0.4, [D.BarrelAged]: 0.2 } },
  { term: 'piney', category: 'aroma', dimMappings: { [D.Resinous]: 0.9 } },
  { term: 'resinous', category: 'aroma', dimMappings: { [D.Resinous]: 1.0 } },
  { term: 'oaky', category: 'aroma', dimMappings: { [D.BarrelAged]: 0.9 } },
  { term: 'barrel-aged', category: 'aroma', dimMappings: { [D.BarrelAged]: 1.0, [D.Aged]: 0.5 } },

  // ── SPICES ──
  { term: 'spiced', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.5, [D.SavorySpice]: 0.3 } },
  { term: 'cinnamon', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.9, [D.Warming]: 0.3 } },
  { term: 'clove', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.9, [D.Numbing]: 0.3 } },
  { term: 'nutmeg', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.9 } },
  { term: 'cardamom', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.8, [D.FloralDelicate]: 0.3 } },
  { term: 'allspice', category: 'aroma', dimMappings: { [D.WarmSweetSpice]: 0.9 } },
  { term: 'cumin', category: 'aroma', dimMappings: { [D.SavorySpice]: 0.9, [D.Mushroom]: 0.4 } },
  { term: 'coriander', category: 'aroma', dimMappings: { [D.SavorySpice]: 0.9, [D.Citrusy]: 0.3 } },
  { term: 'fennel', category: 'aroma', dimMappings: { [D.SavorySpice]: 0.8 } },
  { term: 'anise', category: 'aroma', dimMappings: { [D.SavorySpice]: 0.9 } },
  { term: 'peppery', category: 'aroma', dimMappings: { [D.Pepper]: 0.8, [D.Spicy]: 0.3 } },
  { term: 'turmeric', category: 'aroma', dimMappings: { [D.ExoticCurry]: 0.8, [D.Mushroom]: 0.3 } },
  { term: 'curry', category: 'aroma', dimMappings: { [D.ExoticCurry]: 1.0, [D.WarmSweetSpice]: 0.3 } },

  // ── NUTTY ──
  { term: 'nutty', category: 'aroma', dimMappings: { [D.TreeNut]: 0.7, [D.GroundNut]: 0.3 } },
  { term: 'almond', category: 'aroma', dimMappings: { [D.TreeNut]: 0.9, [D.FloralDelicate]: 0.2 } },
  { term: 'walnut', category: 'aroma', dimMappings: { [D.TreeNut]: 0.9, [D.Bitter]: 0.2 } },
  { term: 'hazelnut', category: 'aroma', dimMappings: { [D.TreeNut]: 0.9, [D.CocoaRoast]: 0.2 } },
  { term: 'pecan', category: 'aroma', dimMappings: { [D.TreeNut]: 0.9, [D.Rich]: 0.3 } },
  { term: 'peanut', category: 'aroma', dimMappings: { [D.GroundNut]: 1.0 } },
  { term: 'sesame', category: 'aroma', dimMappings: { [D.Seed]: 0.9, [D.TreeNut]: 0.3 } },

  // ── ROASTED/CARAMELIZED/SMOKY ──
  { term: 'roasted', category: 'aroma', dimMappings: { [D.MeatRoast]: 0.6, [D.TreeNut]: 0.3, [D.BreadCrust]: 0.3 } },
  { term: 'toasty', category: 'aroma', dimMappings: { [D.BreadCrust]: 0.8, [D.TreeNut]: 0.3 } },
  { term: 'coffee-like', category: 'aroma', dimMappings: { [D.CoffeeRoast]: 0.9, [D.Bitter]: 0.3 } },
  { term: 'seared', category: 'aroma', dimMappings: { [D.MeatRoast]: 0.9, [D.Umami]: 0.3 } },
  { term: 'caramelized', category: 'aroma', dimMappings: { [D.ToffeeCaramel]: 0.9, [D.Sweet]: 0.4 } },
  { term: 'caramel', category: 'aroma', dimMappings: { [D.ToffeeCaramel]: 1.0, [D.Sweet]: 0.5 } },
  { term: 'toffee', category: 'aroma', dimMappings: { [D.ToffeeCaramel]: 0.9, [D.Sweet]: 0.4, [D.Butter]: 0.3 } },
  { term: 'butterscotch', category: 'aroma', dimMappings: { [D.ToffeeCaramel]: 0.8, [D.Butter]: 0.5 } },
  { term: 'brûléed', category: 'aroma', dimMappings: { [D.BurntSugar]: 0.9, [D.Sweet]: 0.5 } },
  { term: 'maple', category: 'aroma', dimMappings: { [D.MapleSyrup]: 1.0, [D.Sweet]: 0.5 } },
  { term: 'molasses', category: 'aroma', dimMappings: { [D.MolassesDark]: 0.9, [D.Bitter]: 0.2 } },
  { term: 'smoky', category: 'aroma', dimMappings: { [D.HardWoodSmoke]: 0.6, [D.SoftWoodSmoke]: 0.3 } },
  { term: 'hickory', category: 'aroma', dimMappings: { [D.HardWoodSmoke]: 0.9 } },
  { term: 'mesquite', category: 'aroma', dimMappings: { [D.HardWoodSmoke]: 0.9 } },
  { term: 'charred', category: 'aroma', dimMappings: { [D.Charred]: 1.0, [D.HardWoodSmoke]: 0.3 } },
  { term: 'barbecue', category: 'aroma', dimMappings: { [D.HardWoodSmoke]: 0.7, [D.MeatRoast]: 0.5 } },

  // ── SULFUROUS ──
  { term: 'garlicky', category: 'aroma', dimMappings: { [D.Allium]: 0.9, [D.Pungent]: 0.4 } },
  { term: 'oniony', category: 'aroma', dimMappings: { [D.Allium]: 0.8 } },
  { term: 'allium', category: 'aroma', dimMappings: { [D.Allium]: 1.0 } },
  { term: 'cabbagy', category: 'aroma', dimMappings: { [D.Brassica]: 0.9 } },
  { term: 'brassica', category: 'aroma', dimMappings: { [D.Brassica]: 1.0 } },

  // ── EARTHY/MUSHROOM ──
  { term: 'earthy', category: 'aroma', dimMappings: { [D.Mushroom]: 0.4, [D.RootTuber]: 0.4, [D.Musty]: 0.2 } },
  { term: 'mushroomy', category: 'aroma', dimMappings: { [D.Mushroom]: 1.0 } },
  { term: 'truffle', category: 'aroma', dimMappings: { [D.Mushroom]: 0.9, [D.Musty]: 0.5 } },
  { term: 'beety', category: 'aroma', dimMappings: { [D.RootTuber]: 0.9 } },
  { term: 'mineral', category: 'aroma', dimMappings: { [D.Mineral]: 1.0 } },
  { term: 'metallic', category: 'aroma', dimMappings: { [D.Mineral]: 0.7 } },
  { term: 'musty', category: 'aroma', dimMappings: { [D.Musty]: 1.0, [D.Aged]: 0.3 } },

  // ── DAIRY/CHEESE ──
  { term: 'milky', category: 'aroma', dimMappings: { [D.FreshMilkCream]: 1.0 } },
  { term: 'creamy', category: 'texture', dimMappings: { [D.Creamy]: 0.8, [D.FreshMilkCream]: 0.3 } },
  { term: 'buttery', category: 'aroma', dimMappings: { [D.Butter]: 0.9, [D.Rich]: 0.3 } },
  { term: 'cultured', category: 'aroma', dimMappings: { [D.CulturedDairy]: 0.9 } },
  { term: 'yogurty', category: 'aroma', dimMappings: { [D.CulturedDairy]: 0.9, [D.Sour]: 0.3 } },
  { term: 'cheesy', category: 'aroma', dimMappings: { [D.AgedCheese]: 0.7, [D.LactoPickled]: 0.3 } },
  { term: 'parmesan-like', category: 'aroma', dimMappings: { [D.AgedCheese]: 1.0, [D.Umami]: 0.5 } },
  { term: 'bleu', category: 'aroma', dimMappings: { [D.BlueMoldyCheese]: 1.0, [D.Pungent]: 0.5 } },

  // ── FERMENTED ──
  { term: 'fermented', category: 'aroma', dimMappings: { [D.LactoPickled]: 0.4, [D.AceticVinegar]: 0.2, [D.BeanFermented]: 0.2 } },
  { term: 'pickled', category: 'aroma', dimMappings: { [D.LactoPickled]: 0.9, [D.AceticVinegar]: 0.3 } },
  { term: 'kimchi-like', category: 'aroma', dimMappings: { [D.LactoPickled]: 0.9, [D.Brassica]: 0.4, [D.Spicy]: 0.3 } },
  { term: 'miso-like', category: 'aroma', dimMappings: { [D.BeanFermented]: 0.9, [D.Umami]: 0.5 } },
  { term: 'soy-sauce', category: 'aroma', dimMappings: { [D.BeanFermented]: 0.8, [D.Salty]: 0.5, [D.Umami]: 0.6 } },
  { term: 'fishy-fermented', category: 'aroma', dimMappings: { [D.FishFermented]: 1.0, [D.Pungent]: 0.4 } },

  // ── MARINE ──
  { term: 'oceanic', category: 'aroma', dimMappings: { [D.Seaweed]: 0.5, [D.Briny]: 0.7 } },
  { term: 'seaweedy', category: 'aroma', dimMappings: { [D.Seaweed]: 1.0 } },
  { term: 'fishy', category: 'aroma', dimMappings: { [D.Fish]: 1.0 } },
  { term: 'shellfish', category: 'aroma', dimMappings: { [D.Shellfish]: 1.0 } },
  { term: 'oceany', category: 'aroma', dimMappings: { [D.Seaweed]: 0.8, [D.Briny]: 0.5 } },

  // ── MEATY ──
  { term: 'roasted-meat', category: 'aroma', dimMappings: { [D.CookedMeat]: 0.9, [D.MeatRoast]: 0.5 } },
  { term: 'cured', category: 'aroma', dimMappings: { [D.CuredPreserved]: 0.9, [D.Salty]: 0.4 } },
  { term: 'bacon-like', category: 'aroma', dimMappings: { [D.CuredPreserved]: 0.8, [D.HardWoodSmoke]: 0.5 } },
  { term: 'gamey', category: 'aroma', dimMappings: { [D.Gamey]: 1.0, [D.Aged]: 0.3 } },
  { term: 'bone-brothy', category: 'aroma', dimMappings: { [D.BrothStock]: 1.0, [D.Kokumi]: 0.5 } },

  // ── SWEET AROMATICS ──
  { term: 'honey-like', category: 'aroma', dimMappings: { [D.Honey]: 1.0, [D.Sweet]: 0.5 } },
  { term: 'vanilla', category: 'aroma', dimMappings: { [D.Vanilla]: 1.0 } },
  { term: 'cocoa', category: 'aroma', dimMappings: { [D.DarkCocoa]: 1.0, [D.Bitter]: 0.3 } },
  { term: 'chocolate', category: 'aroma', dimMappings: { [D.DarkCocoa]: 0.6, [D.MilkChocolate]: 0.4 } },
  { term: 'chocolatey', category: 'aroma', dimMappings: { [D.DarkCocoa]: 0.5, [D.MilkChocolate]: 0.5 } },

  // ── TEXTURE MECHANICAL ──
  { term: 'crunchy', category: 'texture', dimMappings: { [D.Crunchy]: 1.0 } },
  { term: 'crispy', category: 'texture', dimMappings: { [D.Crispy]: 1.0 } },
  { term: 'crisp', category: 'texture', dimMappings: { [D.Crunchy]: 0.5, [D.Crispy]: 0.5, [D.Fresh]: 0.3 } },
  { term: 'chewy', category: 'texture', dimMappings: { [D.Chewy]: 1.0 } },
  { term: 'tender', category: 'texture', dimMappings: { [D.Tender]: 1.0 } },
  { term: 'firm', category: 'texture', dimMappings: { [D.Firm]: 1.0 } },
  { term: 'fall-apart', category: 'texture', dimMappings: { [D.Tender]: 0.9 } },
  { term: 'melt-in-mouth', category: 'texture', dimMappings: { [D.Tender]: 0.8, [D.Silky]: 0.6 } },
  { term: 'al-dente', category: 'texture', dimMappings: { [D.Firm]: 0.7, [D.Chewy]: 0.5 } },

  // ── TEXTURE MOUTHFEEL ──
  { term: 'silky', category: 'texture', dimMappings: { [D.Silky]: 1.0 } },
  { term: 'velvety', category: 'texture', dimMappings: { [D.Creamy]: 0.7, [D.Silky]: 0.5 } },
  { term: 'smooth', category: 'texture', dimMappings: { [D.Silky]: 0.6, [D.Creamy]: 0.4 } },
  { term: 'oily', category: 'texture', dimMappings: { [D.Oily]: 1.0 } },
  { term: 'greasy', category: 'texture', dimMappings: { [D.Oily]: 0.8 } },
  { term: 'gooey', category: 'texture', dimMappings: { [D.Sticky]: 0.6, [D.Silky]: 0.4 } },
  { term: 'sticky', category: 'texture', dimMappings: { [D.Sticky]: 1.0 } },
  { term: 'gummy', category: 'texture', dimMappings: { [D.Gummy]: 1.0 } },
  { term: 'starchy', category: 'texture', dimMappings: { [D.Starchy]: 1.0 } },
  { term: 'mealy', category: 'texture', dimMappings: { [D.Grainy]: 0.5, [D.Starchy]: 0.4, [D.Dry]: 0.3 } },
  { term: 'grainy', category: 'texture', dimMappings: { [D.Grainy]: 1.0 } },
  { term: 'juicy', category: 'texture', dimMappings: { [D.Juicy]: 1.0 } },
  { term: 'succulent', category: 'texture', dimMappings: { [D.Juicy]: 0.8, [D.Tender]: 0.4 } },
  { term: 'dry', category: 'texture', dimMappings: { [D.Dry]: 1.0 } },
  { term: 'moist', category: 'texture', dimMappings: { [D.Moist]: 1.0 } },
  { term: 'fluffy', category: 'texture', dimMappings: { [D.Foamy]: 0.7 } },
  { term: 'foamy', category: 'texture', dimMappings: { [D.Foamy]: 1.0 } },
  { term: 'airy', category: 'texture', dimMappings: { [D.Foamy]: 0.6, [D.Delicate]: 0.3 } },
  { term: 'gelatinous', category: 'texture', dimMappings: { [D.Gelatinous]: 1.0 } },
  { term: 'jiggly', category: 'texture', dimMappings: { [D.Gelatinous]: 0.8 } },
  { term: 'fibrous', category: 'texture', dimMappings: { [D.Fibrous]: 1.0 } },
  { term: 'stringy', category: 'texture', dimMappings: { [D.Fibrous]: 0.8 } },
  { term: 'powdery', category: 'texture', dimMappings: { [D.Powdery]: 1.0 } },
  { term: 'chalky', category: 'texture', dimMappings: { [D.Powdery]: 0.7, [D.Dry]: 0.4 } },

  // ── TEMPERATURE ──
  { term: 'hot', category: 'temperature', dimMappings: { [D.Temperature]: 4.0 } },
  { term: 'warm', category: 'temperature', dimMappings: { [D.Temperature]: 2.0 } },
  { term: 'cold', category: 'temperature', dimMappings: { [D.Temperature]: -3.0 } },
  { term: 'frozen', category: 'temperature', dimMappings: { [D.Temperature]: -6.0 } },
  { term: 'icy', category: 'temperature', dimMappings: { [D.Temperature]: -5.0 } },

  // ── CHARACTER ──
  { term: 'rich', category: 'character', dimMappings: { [D.Rich]: 1.0 } },
  { term: 'indulgent', category: 'character', dimMappings: { [D.Rich]: 0.8, [D.Creamy]: 0.3 } },
  { term: 'decadent', category: 'character', dimMappings: { [D.Rich]: 0.9, [D.Creamy]: 0.4, [D.Sweet]: 0.2 } },
  { term: 'satiating', category: 'character', dimMappings: { [D.Rich]: 0.7, [D.Body]: 0.5 } },
  { term: 'complex', category: 'character', dimMappings: { [D.Complex]: 1.0 } },
  { term: 'layered', category: 'character', dimMappings: { [D.Complex]: 0.8 } },
  { term: 'nuanced', category: 'character', dimMappings: { [D.Complex]: 0.7, [D.Delicate]: 0.4 } },
  { term: 'fresh', category: 'character', dimMappings: { [D.Fresh]: 1.0 } },
  { term: 'bright', category: 'character', dimMappings: { [D.Fresh]: 0.6, [D.Citrusy]: 0.3 } },
  { term: 'vibrant', category: 'character', dimMappings: { [D.Fresh]: 0.8, [D.Bold]: 0.3 } },
  { term: 'aged', category: 'character', dimMappings: { [D.Aged]: 1.0 } },
  { term: 'mature', category: 'character', dimMappings: { [D.Aged]: 0.8 } },
  { term: 'delicate', category: 'character', dimMappings: { [D.Delicate]: 1.0 } },
  { term: 'subtle', category: 'character', dimMappings: { [D.Delicate]: 0.8 } },
  { term: 'refined', category: 'character', dimMappings: { [D.Delicate]: 0.6, [D.Complex]: 0.3 } },
  { term: 'bold', category: 'character', dimMappings: { [D.Bold]: 1.0 } },
  { term: 'strong', category: 'character', dimMappings: { [D.Bold]: 0.8 } },
  { term: 'assertive', category: 'character', dimMappings: { [D.Bold]: 0.9 } },
  { term: 'heavy', category: 'character', dimMappings: { [D.Body]: 0.9, [D.Rich]: 0.3 } },
  { term: 'light', category: 'character', dimMappings: { [D.Body]: -0.5, [D.Delicate]: 0.5 } },
  { term: 'hearty', category: 'character', dimMappings: { [D.Rich]: 0.5, [D.Body]: 0.6, [D.Umami]: 0.4 } },
  { term: 'substantial', category: 'character', dimMappings: { [D.Body]: 0.8 } },

  // ── EMOTIONAL/CUISINE DESCRIPTORS ──
  { term: 'comforting', category: 'style', dimMappings: { [D.Rich]: 0.5, [D.Creamy]: 0.4, [D.Umami]: 0.3, [D.WarmSweetSpice]: 0.2 } },
  { term: 'rustic', category: 'style', dimMappings: { [D.Mushroom]: 0.5, [D.Grainy]: 0.3, [D.BrothStock]: 0.3 } },
  { term: 'elegant', category: 'style', dimMappings: { [D.Delicate]: 0.6, [D.Silky]: 0.4 } },
  { term: 'rustic', category: 'style', dimMappings: { [D.Mushroom]: 0.5, [D.Grainy]: 0.3 } },
  { term: 'umami-bomb', category: 'compound', dimMappings: { [D.Umami]: 1.0, [D.Kokumi]: 0.5, [D.Salty]: 0.3 } },
  { term: 'sweet-savory', category: 'compound', dimMappings: { [D.Sweet]: 0.6, [D.Umami]: 0.6, [D.Salty]: 0.3 } },
  { term: 'spicy-sweet', category: 'compound', dimMappings: { [D.Spicy]: 0.6, [D.Sweet]: 0.5 } },
  { term: 'sour-sweet', category: 'compound', dimMappings: { [D.Sour]: 0.5, [D.Sweet]: 0.5 } },
  { term: 'rich-bright', category: 'compound', dimMappings: { [D.Rich]: 0.6, [D.Citrusy]: 0.4, [D.Fresh]: 0.3 } },
  { term: 'hot-cool', category: 'compound', dimMappings: { [D.Spicy]: 0.5, [D.Cooling]: 0.5 } },
  { term: 'mediterranean', category: 'cuisine', dimMappings: { [D.Citrusy]: 0.3, [D.FreshHerb]: 0.4, [D.Oily]: 0.3, [D.Fresh]: 0.4 } },
  { term: 'italian', category: 'cuisine', dimMappings: { [D.AgedCheese]: 0.3, [D.Umami]: 0.4, [D.FreshHerb]: 0.3 } },
  { term: 'french', category: 'cuisine', dimMappings: { [D.Butter]: 0.5, [D.Rich]: 0.4, [D.BrothStock]: 0.3 } },
  { term: 'japanese', category: 'cuisine', dimMappings: { [D.Umami]: 0.5, [D.Seaweed]: 0.3, [D.BeanFermented]: 0.3 } },
  { term: 'indian', category: 'cuisine', dimMappings: { [D.ExoticCurry]: 0.6, [D.WarmSweetSpice]: 0.4, [D.Spicy]: 0.3 } },
  { term: 'asian', category: 'cuisine', dimMappings: { [D.Umami]: 0.4, [D.Allium]: 0.3, [D.BeanFermented]: 0.2, [D.Seed]: 0.2 } },
  { term: 'mexican', category: 'cuisine', dimMappings: { [D.Spicy]: 0.4, [D.Citrusy]: 0.3, [D.Allium]: 0.3 } },
  { term: 'thai', category: 'cuisine', dimMappings: { [D.Spicy]: 0.4, [D.FishFermented]: 0.3, [D.Citrusy]: 0.3, [D.FreshHerb]: 0.3 } },
];

async function main() {
  console.log(`\n=== Seed Sensory Descriptor Vocabulary ===\n`);
  if (DRY_RUN) console.log('  [DRY RUN — no writes]\n');

  console.log(`Descriptors to seed: ${DESCRIPTORS.length}\n`);

  let created = 0;
  let updated = 0;

  for (const d of DESCRIPTORS) {
    if (DRY_RUN) continue;
    const existing = await prisma.sensoryDescriptor.findUnique({ where: { term: d.term } });
    const data = {
      term: d.term,
      category: d.category,
      dimMappings: d.dimMappings as object,
      aliases: d.aliases ?? [],
      isActive: true,
    };
    if (existing) {
      await prisma.sensoryDescriptor.update({ where: { term: d.term }, data });
      updated++;
    } else {
      await prisma.sensoryDescriptor.create({ data });
      created++;
    }
  }

  // Category summary
  const byCategory: Record<string, number> = {};
  DESCRIPTORS.forEach((d) => {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  });

  console.log('By category:');
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
    console.log(`  ${c.padEnd(20)} ${n}`);
  });

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  Total descriptors: ${DESCRIPTORS.length}`);
  console.log(`  Created: ${created}   Updated: ${updated}`);
  console.log(`═══════════════════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
