# Sensory Calibration Rules — Per-Category Invariants

> **Last Updated**: 2026-04-21 | **Purpose**: Category-level invariants that ingredient profiles MUST satisfy

This document codifies the calibration rules that validate every ingredient's sensory profile. When an AI or human generates/updates an ingredient's potency, the values are checked against these rules. Violations block writes (error severity) or queue for review (warning severity).

**Schema**: rules stored in `CalibrationRule` table (to be created in Phase 1). This doc is the source of truth that seeds it.

## How to read a rule

Each rule has:
- **Category**: which ingredients the rule applies to (by category or explicit list)
- **Assertion**: numeric constraint on potency array (`dim X ≥ value`, `dim X between a-b`, etc.)
- **Severity**: `error` (blocks write) or `warning` (logs + allows)
- **Rationale**: why this must hold (food science basis)
- **Examples**: ingredients that satisfy; ingredients that would fail

## Rule count summary

| Category | Rules | Severity mix |
|----------|-------|--------------|
| Aged cheeses | 5 | 3 error / 2 warning |
| Blue cheeses | 4 | 3 error / 1 warning |
| Fresh cheeses | 4 | 2 error / 2 warning |
| Alliums (raw) | 6 | 4 error / 2 warning |
| Alliums (cooked) | 4 | 2 error / 2 warning |
| Nightshades | 5 | 3 error / 2 warning |
| Citrus | 5 | 4 error / 1 warning |
| Fresh herbs | 6 | 4 error / 2 warning |
| Dried herbs/spices | 5 | 2 error / 3 warning |
| Brassicas | 4 | 2 error / 2 warning |
| Raw proteins | 5 | 3 error / 2 warning |
| Cooked proteins | 6 | 3 error / 3 warning |
| Fats & oils | 5 | 4 error / 1 warning |
| Fermented products | 6 | 4 error / 2 warning |
| Cured meats | 4 | 3 error / 1 warning |
| Grains | 4 | 2 error / 2 warning |
| Sweeteners | 4 | 3 error / 1 warning |
| Dairy (non-cheese) | 5 | 3 error / 2 warning |
| Fruits | 4 | 2 error / 2 warning |
| Mushrooms | 3 | 2 error / 1 warning |
| Seafood | 5 | 3 error / 2 warning |
| Chocolate | 4 | 3 error / 1 warning |
| **TOTAL** | **~100 rules** | |

---

## Aged cheeses

**Scope**: parmesan, cheddar, gruyère, manchego, pecorino, gouda (aged), aged/mature varieties. Detection: category = "cheese" AND name contains aged/sharp/mature OR known aged variety.

| # | Rule | Severity | Rationale |
|---|------|----------|-----------|
| 1.1 | `Fermented ≥ 2.0` | error | Aged cheeses are fermented products — enzymatic protein breakdown over months |
| 1.2 | `Aged Cheese ≥ 3.0` (dim 62) | error | Dimension explicitly defines the category |
| 1.3 | `Umami ≥ 2.0` | error | Protein breakdown produces glutamate |
| 1.4 | `Rich ≥ 3.0` | error | Fat content (28-35g/100g typical) with concentration from aging |
| 1.5 | `Aged ≥ 2.0` | warning | Should register on the "aged" character dim |

**Examples**:
- ✅ parmesan: Fermented=3.0, Aged Cheese=5.0, Umami=4.14 (Wageningen panel), Rich=5.0, Aged=3.0
- ✅ cheddar: Fermented=2.5, Aged Cheese=4.0, Umami=4.0, Rich=5.0, Aged=2.5
- ❌ If generated with Fermented=0.0 → ERROR, block

---

## Blue cheeses

**Scope**: blue, gorgonzola, roquefort, stilton, cabrales, danish blue, bleu d'auvergne.

| # | Rule | Severity |
|---|------|----------|
| 2.1 | `Blue-Moldy Cheese ≥ 4.0` (dim 63) | error |
| 2.2 | `Fermented ≥ 4.0` | error |
| 2.3 | `Pungent ≥ 3.0` | error |
| 2.4 | `Rich ≥ 3.0` | warning |

**Rationale**: Blue cheeses get their character from Penicillium roqueforti/glaucum mold fermentation, producing intense pungent/funky notes. Must register on all four.

---

## Fresh cheeses

**Scope**: mozzarella, ricotta, cottage, mascarpone, fromage blanc, queso fresco, burrata, paneer, fresh feta (young).

| # | Rule | Severity |
|---|------|----------|
| 3.1 | `Fermented between 0.5-1.5` | error |
| 3.2 | `Creamy ≥ 2.0` | error |
| 3.3 | `Aged ≤ 1.0` | warning |
| 3.4 | `Rich between 1.5-4.5 proportional to fat%` | warning |

**Rationale**: Fresh cheeses have minimal aging — only primary lactic fermentation. Should NOT hit aged-cheese or blue-cheese aromatic territory.

---

## Alliums (raw)

**Scope**: raw garlic, onion, shallot, leek, chive, scallion, ramp, green garlic.

| # | Rule | Severity |
|---|------|----------|
| 4.1 | `Allium ≥ 3.0` (dim 52) | error |
| 4.2 | `Sulfurous ≥ 2.0` (family aggregate) | error |
| 4.3 | `Pungent ≥ 1.0` | error |
| 4.4 | Raw garlic specifically: `Sulfurous ≥ 4.0, Pungent ≥ 3.0` | error |
| 4.5 | Raw onion/shallot: `Pungent ≥ 2.0` | warning |
| 4.6 | Chives: `Herbal ≥ 2.0, Fresh Herb ≥ 2.0` (milder than others) | warning |

**Rationale**: Raw alliums contain diallyl sulfides and allicin (TRPA1 agonists). Cooking mellows but raw MUST register high.

---

## Alliums (cooked)

**Scope**: sautéed/caramelized/roasted alliums, fried onions, cooked garlic.

| # | Rule | Severity |
|---|------|----------|
| 5.1 | Long-sautéed (>10 min, low heat): `Sulfurous reduced ≥ 50% from raw` | error |
| 5.2 | Long-sautéed: `Sweet ≥ 2.0` | error |
| 5.3 | Caramelized (>30 min): `Caramelized ≥ 2.0, Sweet ≥ 4.0` | warning |
| 5.4 | Fried crisp: `Crispy ≥ 2.0, Maillard/Roasted ≥ 1.5` | warning |

**Rationale**: Heat breaks down sulfur compounds (Maillard rearrangement) and converts starches/sugars to Maillard products. Long cooking shifts Allium → Sweet + Caramelized.

---

## Nightshades

**Scope**: tomato, bell pepper, chili pepper, eggplant, tomatillo, ground cherry.

| # | Rule | Severity |
|---|------|----------|
| 6.1 | Raw tomato: `Sour 1.0-2.0, Umami 0.8-1.5` | error |
| 6.2 | Cooked tomato: `Umami ≥ 1.5 (increased from raw), Sour reduced` | error |
| 6.3 | Raw bell pepper: `Vegetal ≥ 2.0, Rich ≤ 1.0, Fresh ≥ 1.5` | error |
| 6.4 | Raw bell pepper color ordering: `red Sweet > yellow > green > orange` | warning |
| 6.5 | Chili peppers: `Spicy proportional to capsaicin content` | warning |

**Rationale**: Key catch: bell peppers should have LOW Rich (they have ~0.3g fat/100g — not a rich food). This was a major AI error corrected by Wageningen.

---

## Citrus

**Scope**: lemon, lime, orange, grapefruit, yuzu, bergamot, mandarin, kumquat, pomelo, juice or zest.

| # | Rule | Severity |
|---|------|----------|
| 7.1 | `Citrusy ≥ 4.0` | error |
| 7.2 | `Sour ≥ 3.0` (for juice/pulp) | error |
| 7.3 | `Fresh ≥ 2.0` | error |
| 7.4 | Grapefruit specifically: `Bitter ≥ 2.0` | error |
| 7.5 | Zest vs juice: zest has higher Citrusy, lower Sour | warning |

---

## Fresh herbs

**Scope**: basil, cilantro, parsley, dill, chive, tarragon, mint, oregano (fresh), cilantro, sage (fresh), thyme (fresh), rosemary (fresh).

| # | Rule | Severity |
|---|------|----------|
| 8.1 | `Herbal ≥ 3.0` | error |
| 8.2 | `Fresh ≥ 2.0` | error |
| 8.3 | `Fresh Herb ≥ 3.0` (dim 25) | error |
| 8.4 | `Grassy/Green 0.5-2.0` | warning |
| 8.5 | Mint specifically: `Cooling ≥ 3.0` | error |
| 8.6 | Rosemary: `Resinous ≥ 2.0, Woody Herb ≥ 3.0` | warning |

---

## Dried herbs / spices

**Scope**: dried basil, oregano, thyme, etc.; ground cumin, coriander, turmeric, warm spices.

| # | Rule | Severity |
|---|------|----------|
| 9.1 | Fresh ≤ 1.5 (concentrated from drying) | error |
| 9.2 | Warm sweet spices: `Warm Sweet Spice ≥ 4.0, Warming ≥ 1.0, Woody ≥ 1.0` | error |
| 9.3 | Cumin: `Earthy ≥ 2.0, Savory Spice ≥ 4.0` | warning |
| 9.4 | Black pepper: `Pepper ≥ 4.0, Pungent 1-2, Warming 1-2` | warning |
| 9.5 | Paprika (smoked): `Smoky ≥ 3.0, Spicy 0.5-2.0` | warning |

---

## Brassicas

**Scope**: cabbage, broccoli, cauliflower, kale, brussels sprouts, radish (raw/cooked), mustard greens, bok choy, collards.

| # | Rule | Severity |
|---|------|----------|
| 10.1 | Raw: `Brassica ≥ 2.0, Sulfurous 1.0-3.0` | error |
| 10.2 | Raw: `Bitter 0.5-2.0` | error |
| 10.3 | Cooked > 10 min: `Sulfurous reduced 40%+, Sweet +0.5` | warning |
| 10.4 | Raw radish/mustard greens: `Pungent ≥ 2.0` | warning |

---

## Raw proteins

**Scope**: raw meat, raw poultry, raw fish, raw seafood, raw eggs, tofu (uncooked).

| # | Rule | Severity |
|---|------|----------|
| 11.1 | `Umami 0.8-2.5` (raw — will increase with cooking) | error |
| 11.2 | `Rich proportional to fat content` (fat%/100×4 as Rich estimate) | error |
| 11.3 | Raw red meat: `Meaty 1-2, Iron/mineral 0.5-1.0` | error |
| 11.4 | Raw fish: `Marine ≥ 2.0, Fish ≥ 3.0` | warning |
| 11.5 | Raw shellfish: `Shellfish ≥ 3.0, Briny 2-4, Sweet 1-2` | warning |

---

## Cooked proteins

**Scope**: roasted, grilled, seared, braised, fried meats/poultry/fish.

| # | Rule | Severity |
|---|------|----------|
| 12.1 | Grilled/seared: `Meat-Roast/Roasted ≥ 3.0` | error |
| 12.2 | Grilled/seared: `Umami ≥ 2.5 (+1 from raw), Smoky 0.5-1.5` | error |
| 12.3 | Braised: `Umami ≥ 3.0, Kokumi ≥ 2.0, Silky ≥ 1.0, Tender ≥ 3.0` | error |
| 12.4 | Fried: `Crispy ≥ 3.0, Oily 1.0-2.0` | warning |
| 12.5 | Smoked: `Smoky ≥ 3.0, Cured-Preserved 2-3, Umami ≥ 2.0` | warning |
| 12.6 | Confit/slow-cooked: `Tender ≥ 4.0, Oily 1-2, Broth-Stock or Fatty 2-4` | warning |

---

## Fats & oils

**Scope**: olive oil, butter, ghee, coconut oil, vegetable oil, lard, tallow, schmaltz, sesame oil.

| # | Rule | Severity |
|---|------|----------|
| 13.1 | `Fatty ≥ 4.0` | error |
| 13.2 | `Rich ≥ 4.0` | error |
| 13.3 | `Oily ≥ 3.0` | error |
| 13.4 | Pure oils: taste dims (Sweet/Salty/Sour/Bitter/Umami) should be ≤ 1.5 | error |
| 13.5 | Butter: `Creamy ≥ 3.0, Butter ≥ 4.0, Dairy ≥ 3.0` | warning |

**Special case**: brown butter has additional `Nutty ≥ 3.0, Caramelized 1-2`.

---

## Fermented products

**Scope**: vinegar, miso, soy sauce, fish sauce, kimchi, sauerkraut, yogurt (cultured), kombucha, tempeh, natto, sourdough starter.

| # | Rule | Severity |
|---|------|----------|
| 14.1 | `Fermented ≥ 2.0` | error |
| 14.2 | Vinegar: `Acetic-Vinegar ≥ 5.0, Sour ≥ 5.0` | error |
| 14.3 | Miso/soy sauce/tempeh: `Bean-Fermented ≥ 3.0, Umami ≥ 3.0` | error |
| 14.4 | Fish sauce: `Fish-Fermented ≥ 5.0, Umami ≥ 5.0, Salty ≥ 5.0, Pungent ≥ 2.0` | error |
| 14.5 | Kimchi: `Lacto-Pickled ≥ 4.0, Brassica 2-3, Spicy 2-3` | warning |
| 14.6 | Yogurt (cultured): `Cultured Dairy ≥ 3.0, Sour 1-3` | warning |

---

## Cured meats

**Scope**: bacon, prosciutto, pancetta, salami, jerky, pepperoni, chorizo, guanciale.

| # | Rule | Severity |
|---|------|----------|
| 15.1 | `Cured-Preserved ≥ 3.0` | error |
| 15.2 | `Salty ≥ 3.0` | error |
| 15.3 | `Umami ≥ 2.5` | error |
| 15.4 | Aged (prosciutto, soppressata): `Aged ≥ 3.0` | warning |

**Special**: bacon has `Smoky ≥ 2.0`; chorizo has `Spicy ≥ 2.0, Smoky ≥ 2.0`.

---

## Grains

**Scope**: rice, pasta, bread, quinoa, oats, polenta, couscous, bulgur, farro, barley.

| # | Rule | Severity |
|---|------|----------|
| 16.1 | Cooked grains: `Starchy ≥ 3.0` | error |
| 16.2 | Dry taste dims should be minimal (Sweet ≤ 1.5, other tastes ≤ 0.5) | error |
| 16.3 | Toasted: `Grain-Toast ≥ 2.0, Nutty 1-2, Roasted ≥ 1.0` | warning |
| 16.4 | Bread specifically: `Bread-Yeast ≥ 2.0, Bread-Crust 2-3 (for crusted)` | warning |

---

## Sweeteners

**Scope**: sugar, honey, maple syrup, agave, molasses, date syrup, rice syrup, stevia, brown sugar.

| # | Rule | Severity |
|---|------|----------|
| 17.1 | `Sweet ≥ 5.0` | error |
| 17.2 | Granulated sugar: no other dim > 0.5 | error |
| 17.3 | Honey: `Honey ≥ 4.0, Floral 1-2` | error |
| 17.4 | Molasses: `Molasses-Cane ≥ 4.0, Bitter 1-2, Smoky 0.5-1` | warning |

---

## Dairy (non-cheese)

**Scope**: milk, heavy cream, half-and-half, yogurt, sour cream, buttermilk, kefir, crème fraîche.

| # | Rule | Severity |
|---|------|----------|
| 18.1 | `Fresh Milk-Cream OR Cultured Dairy ≥ 2.0` | error |
| 18.2 | Heavy cream: `Rich ≥ 4.0, Creamy ≥ 4.0` | error |
| 18.3 | Milk (whole): `Rich 2-3, Sweet 0.5-1.0` | error |
| 18.4 | Cultured: `Sour ≥ 1.0, Fermented ≥ 1.5` | warning |
| 18.5 | Buttermilk: `Cultured Dairy ≥ 3.0, Sour 2-3` | warning |

---

## Fruits

**Scope**: apple, pear, banana, berry, stone fruit, tropical, melon, grape, etc. (fresh).

| # | Rule | Severity |
|---|------|----------|
| 19.1 | `Sweet 2.0-5.0 proportional to sugar content` | error |
| 19.2 | Appropriate secondary aroma dim: citrus → Citrusy, berry → Berry, etc. | error |
| 19.3 | `Fresh ≥ 1.5` for fresh fruit | warning |
| 19.4 | Dried fruit: `Dried Fruit ≥ 3.0, Sweet ≥ 4.0, Fresh ≤ 1.0` | warning |

---

## Mushrooms

**Scope**: button, cremini, shiitake, porcini, morel, oyster, enoki, maitake, chanterelle, truffle.

| # | Rule | Severity |
|---|------|----------|
| 20.1 | `Mushroom ≥ 3.0` (dim 55) | error |
| 20.2 | `Earthy ≥ 2.0` | error |
| 20.3 | Dried (e.g., dried porcini): `Umami ≥ 3.0, Mushroom ≥ 4.0, Concentrated` | warning |

---

## Seafood (beyond fin fish)

**Scope**: shellfish (clam, oyster, mussel, scallop, shrimp, crab, lobster); seaweed (nori, kombu, wakame).

| # | Rule | Severity |
|---|------|----------|
| 21.1 | Shellfish: `Shellfish ≥ 3.0, Briny 2-4, Sweet 1-2` | error |
| 21.2 | Fish: `Fish ≥ 3.0, Marine ≥ 2.0` | error |
| 21.3 | Oyster: `Briny ≥ 4.0, Mineral ≥ 2.0` | error |
| 21.4 | Seaweed: `Seaweed ≥ 4.0, Umami ≥ 2.0 (esp kombu high-glutamate)` | warning |
| 21.5 | Dried/cured fish (bottarga, smoked salmon): `Cured-Preserved + respective marine dims` | warning |

---

## Chocolate

**Scope**: dark chocolate, milk chocolate, white chocolate, cocoa powder, cocoa nibs, cacao.

| # | Rule | Severity |
|---|------|----------|
| 22.1 | Dark: `Dark Cocoa ≥ 4.0, Bitter 2-4 (depending on %)` | error |
| 22.2 | Milk: `Milk Chocolate ≥ 3.0, Sweet ≥ 3.0, Rich ≥ 3.0` | error |
| 22.3 | All chocolate: `Rich ≥ 2.0` | error |
| 22.4 | 85%+ cacao: `Astringent ≥ 1.0` | warning |

---

## Cross-category invariants

Rules that apply across multiple categories:

### Cooking-related

- **Any Maillard-browned food**: `Meat-Roast or Bread-Crust ≥ 1.0`
- **Any caramelized food**: `Caramelized ≥ 1.0`
- **Any smoked food**: `Smoky ≥ 2.0`
- **Any fried food**: `Crispy or Crunchy ≥ 2.0, Oily ≥ 1.0`
- **Any fermented food (broad)**: `Fermented ≥ 1.5`

### Chemistry-related (when chem props available)

- **Protein ≥ 10g/100g**: `Umami ≥ 1.0, Rich appropriate to fat`
- **Fat ≥ 30g/100g**: `Rich ≥ 3.0, Fatty ≥ 3.0`
- **Sugar ≥ 15g/100g**: `Sweet ≥ 3.0`
- **Fiber ≥ 6g/100g**: `Grainy OR Fibrous ≥ 1.0` (depending on context)
- **pH < 4**: `Sour ≥ 2.0`
- **High moisture (>80%)**: `Juicy OR Moist ≥ 1.0`

### Relationship invariants

- **Raw vs cooked versions of same ingredient**: cooked should have different profile (Maillard/caramelization/tenderization), NEVER identical
- **Similar ingredients within category**: profiles should cluster (all aged cheeses have similar relative dim profile, differ in magnitudes)
- **Preserved vs fresh**: preserved has Fermented or Cured-Preserved that fresh version doesn't

---

## How to add a new rule

```
1. Identify the invariant (e.g., "all stone fruits have Orchard Stone > 3")
2. Check it against 3-5 ingredient profiles (all pass, none fail)
3. Edit this document to add the rule
4. Commit the change
5. Phase 1+: update CalibrationRule DB table seed script
6. Validate: run audit to confirm no existing ingredient violates the new rule
7. If violations found, either fix ingredients or loosen rule
```

---

## Rule violations log

When a rule fires, the violation is logged with:
- Ingredient name
- Rule ID
- Expected vs actual
- Severity
- Admin review outcome (approved/modified/rejected)

This log feeds back into:
- Identifying which rules are too strict (many warnings = loosen)
- Which rules are catching real errors (error violations with rejected overrides = good rule)
- Systematic AI error patterns (specific rule keeps firing = add to generator prompt)

---

## Future additions

Rules to add as we expand:
- International cuisines (Indian, Thai, Korean, Mexican, West African, etc.)
- More specialized categories (offal, game meats, specific nut types)
- Dietary variants (vegan cheese analogues, plant-based meats)
- Beverages (coffee, tea, wine varieties, spirits)
- Sweets & pastries (specific dessert types)
- Sauces & condiments (by type)

Each new category should follow the same pattern: 3-7 rules, mix of error/warning, grounded in food science.
