# Sensory Compound System — Knowledge Base

> **Last Updated**: 2026-04-24 | **Status**: Master reference | **Version**: 1.1 (all 9 phases implemented)

The single comprehensive reference for ZeroScraps' sensory compound system. This document captures the full architecture, all 113 dimensions, the interaction model, the computation pipeline, and the workflows for enhancing the system iteratively.

**Related docs**:
- [Sensory Dimension Reference](sensory-dimension-reference.md) — 1-entry-per-dim quick lookup
- [Sensory Calibration Rules](sensory-calibration-rules.md) — per-category invariants
- [Sensory Interaction Examples](sensory-interaction-examples.md) — worked rule examples
- [Cooking Science Model](cooking-science-model.md) — cooking transforms
- [Sensory Compound Pipeline](sensory-compound-pipeline.md) — legacy pipeline doc (will be superseded by this KB)

**Schema**: primary data in `catalog` schema; recipe profiles in `recipe` schema; user preferences in `user_data` schema.

---

## Table of Contents

1. [Quick Start — Session Kickoff](#1-quick-start--session-kickoff)
2. [System Overview](#2-system-overview)
3. [The 113 Dimensions](#3-the-113-dimensions)
4. [Vocabulary Layer](#4-vocabulary-layer)
5. [Interaction Model — All 6 Tiers](#5-interaction-model--all-6-tiers)
6. [Dose-Response System](#6-dose-response-system)
7. [Computation Pipeline](#7-computation-pipeline)
8. [Harmony Score — 3 Passes](#8-harmony-score--3-passes)
9. [Data Model Reference](#9-data-model-reference)
10. [Calibration Protocols](#10-calibration-protocols)
11. [Data Sources](#11-data-sources)
12. [Enhancement Workflows](#12-enhancement-workflows)
13. [Quality Systems](#13-quality-systems)
14. [Additional Systems — The 22 Gap Items](#14-additional-systems--the-22-gap-items)
15. [Gaps & Future Work](#15-gaps--future-work)
16. [Glossary](#16-glossary)
17. [Changelog](#17-changelog)

---

## 1. Quick Start — Session Kickoff

### How to begin an enhancement session

When you want to extend or refine the sensory system, type one of these at the start of a new conversation:

| Command | What happens |
|---------|--------------|
| `sensory: audit` | Full data health check (counts, gaps, inconsistencies) |
| `sensory: session <category>` | Focused enhancement for one category (cheese, allium, nightshade, etc.) |
| `sensory: validate <recipeId>` | Sanity-check a specific recipe's profile vs archetypes |
| `sensory: research <ingredient>` | Look up authoritative data (USDA, Wikipedia) for an ingredient |
| `sensory: expand usda` | Map more ingredients to USDA FDC IDs |
| `sensory: drift-check` | Compare current profiles vs anchor expectations |
| `sensory: rules-audit` | Scan for rule conflicts, gaps, orphaned rules |
| `sensory: propose <topic>` | Draft new rules/ingredients for review before applying |
| `sensory: recompute <scope>` | Recompute recipe profiles after data changes |

### Session workflow

```
1. State your intent (one of the commands above)
2. Claude reads THIS document + the dim reference + calibration rules
3. Claude audits the relevant scope and reports current state
4. Claude proposes changes with reasoning and examples
5. You approve / modify / reject
6. Claude applies via scripts (dry-run first, then real)
7. Claude commits + documents what changed
8. Recompute affected recipes automatically
9. Claude logs new learnings to calibration rules (feeds future mini runs)
```

### Files Claude reads at session start

- `docs/sensory-compound-knowledge-base.md` (this file)
- `docs/sensory-dimension-reference.md`
- `docs/sensory-calibration-rules.md`
- `docs/sensory-interaction-examples.md`
- `server/prisma/schema.prisma` (for any relevant tables)
- Recent audit output from `audit-sensory-system.ts`

### Scripts available

```bash
# Health & analysis
npx ts-node src/scripts/audit-sensory-system.ts
npx ts-node src/scripts/analyze-ingredient-aliases.ts
npx ts-node src/scripts/check-cheese-profiles.ts    # per-category checks

# Data enhancement (run after approval)
npx ts-node src/scripts/merge-ingredient-aliases.ts
npx ts-node src/scripts/fix-sparse-profiles.ts
npx ts-node src/scripts/populate-chem-from-usda.ts
npx ts-node src/scripts/import-wageningen-svt.ts
npx ts-node src/scripts/seed-cooking-science.ts
npx ts-node src/scripts/seed-comprehensive-ingredients.ts
npx ts-node src/scripts/expand-reference-data-v2.ts

# Recompute
npx ts-node src/scripts/recompute-test-recipes.ts
```

### How to add new knowledge

Every session should generate 3 types of artifacts:
1. **Data changes** — new rows in DB (committed via script + git commit)
2. **Invariant rules** — new entries in `sensory-calibration-rules.md` (per-category rules)
3. **KB updates** — this document's Changelog section (section 17) logs what changed and why

---

## 2. System Overview

### The end goal

**A system that predicts a recipe's 113-dimensional sensory profile with accuracy comparable to a trained human panel, and uses that profile to match recipes to user preferences.**

Users describe what they want ("crunchy and rich", "not spicy, with umami", "funky and bright"), and the system ranks recipes by how well their computed sensory signatures match.

### Four-layer architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 4 — USER-FACING MATCHING (the product interface)          │
│  Natural-language queries → ranked recipe results                │
│  Preference vectors, substitution queries, explanations           │
└──────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 3 — RECIPE-LEVEL STORAGE (the queryable product)          │
│  Recipe.sensoryProfile, sensoryVector (pgvector), harmonyScore    │
│  Dominant archetype, emergences, clashes, aftertaste, body        │
│  Denormalized flags for fast filter (isCrunchy, isRich, etc.)    │
└──────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 2 — COMPUTATION ENGINE (the physics)                      │
│  Recipe ingredients + instructions → dose analysis →             │
│  cooking transforms → interaction rules → emergences →           │
│  clash detection → harmony → aftertaste → body → final profile   │
└──────────────────────────────────────────────────────────────────┘
                                ↑
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 — INGREDIENT LIBRARY (the raw data)                     │
│  Potencies, chemistry, cooking transforms, interaction rules,    │
│  clash rules, emergence patterns, dish archetypes, vocabulary    │
└──────────────────────────────────────────────────────────────────┘
```

### End-to-end data flow

```
Recipe (ingredients + instructions)
  ↓ Layer 1 lookup — ingredient potencies + chem properties
  ↓ Layer 2 compute — transforms + interactions + dose + emergence + clash
  ↓ Layer 3 store — 113-dim profile + vector + harmony + flags
  ↓ Layer 4 query — user preference → similarity → ranked results
```

### Three key innovations vs generic food apps

1. **Dose-dependent interactions** — a squeeze of lime in cream brightens; a cup of lime curdles. Rules have piecewise curves, not binary triggers.
2. **Emergence detection** — recognizes that `tomato + mozzarella + basil + olive oil` has emergent "caprese magic" beyond the sum of parts.
3. **Harmony score** — recipes with sensory clashes (mint + aged beef) score lower than their raw sensory match would suggest.

### User experience outcomes

- **Natural search**: "I want something funky and comforting" → kimchi-cheese toast, aged cheddar mac, fermented cabbage soup
- **Substitution**: "Replace ricotta in this lasagna" → similar texture + dairy profile (cottage cheese, labneh, silken tofu for vegan)
- **Complement**: "What goes with this salmon?" → synergy pairs + emergence-triggering partners
- **Explanation**: "Why this match?" → top contributing dimensions, ingredients, and archetype

---

## 3. The 113 Dimensions

### Category summary

| Category | Count | Purpose |
|----------|-------|---------|
| Taste (receptor-based) | 7 | Sweet, Salty, Sour, Bitter, Umami, Kokumi, Fatty |
| Chemesthetic (physical sensations) | 7 | Spicy, Pungent, Cooling, Astringent, Numbing, Carbonated, Warming |
| Aroma families | 72 | 19 primary families × 3-7 secondary dims each |
| Texture — mechanical | 6 | Crunchy, Crispy, Chewy, Tender, Firm, Fibrous |
| Texture — moisture | 3 | Juicy, Moist, Dry |
| Texture — mouthfeel | 10 | Creamy, Silky, Oily, Grainy, Gummy, Starchy, Gelatinous, Foamy, Powdery, Sticky |
| Temperature | 1 | Bipolar (-6 frozen → +6 very hot) |
| Character (emergent) | 7 | Rich, Complex, Fresh, Aged, Delicate, Bold, Body |
| **TOTAL** | **113** | |

### Hierarchical structure

Primary families have **secondary dimensions** (the actual scorable axes) and **tertiary descriptors** (natural-language terms that map to combinations of dims).

Example:
- **Fruity** (primary family, organizational label)
  - **Citrusy** (secondary, dim #14 — scorable)
    - Tertiary: "grapefruit", "lemon", "lime", "orange", "yuzu", "bergamot", "mandarin", "kumquat"
  - **Tropical** (secondary, dim #15 — scorable)
    - Tertiary: "mango", "pineapple", "passion fruit", "lychee", "dragon fruit"
  - **Berry** (secondary, dim #16 — scorable)
    - Tertiary: "strawberry", "blueberry", "raspberry", "blackberry", "cranberry"

### Full list by category

> **See [sensory-dimension-reference.md](sensory-dimension-reference.md) for 1-entry-per-dim details (mechanism, scale, anchors, tertiary descriptors).**

#### TASTE (indices 0-6)
| # | Name | Mechanism |
|---|------|-----------|
| 0 | Sweet | T1R2+T1R3 receptors |
| 1 | Salty | ENaC / Na+ channels |
| 2 | Sour | H+ / PKD2L1 |
| 3 | Bitter | T2R family |
| 4 | Umami | T1R1+T1R3 / mGluR |
| 5 | Kokumi | CaSR (mouthfulness, depth) |
| 6 | Fatty | CD36/GPR120 (oleogustus) |

#### CHEMESTHETIC (indices 7-13)
| # | Name | Mechanism |
|---|------|-----------|
| 7 | Spicy | TRPV1 heat (capsaicin) |
| 8 | Pungent | TRPA1 sharp (wasabi, mustard) |
| 9 | Cooling | TRPM8 (menthol) |
| 10 | Astringent | Protein crosslinking (tannins) |
| 11 | Numbing | Sanshool (Sichuan pepper) |
| 12 | Carbonated | CO2 mechanoreception |
| 13 | Warming | Alcohol/gingerol |

#### AROMA — FRUITY (indices 14-20)
14. Citrusy · 15. Tropical · 16. Berry · 17. Orchard Stone · 18. Orchard Pomme · 19. Melon · 20. Dried Fruit

#### AROMA — FLORAL (21-24)
21. Floral-Delicate · 22. Floral-Bold · 23. Blossom-Citrus · 24. Floral-Herbal

#### AROMA — HERBAL/GREEN (25-28)
25. Fresh Herb · 26. Woody Herb · 27. Grassy · 28. Vegetal

#### AROMA — WOODY (29-31)
29. Resinous · 30. Barrel-Aged · 31. Bark-Wood

#### AROMA — SPICY-AROMATIC (32-35)
32. Warm Sweet Spice · 33. Savory Spice · 34. Pepper · 35. Exotic-Curry

#### AROMA — NUTTY (36-38)
36. Tree Nut · 37. Ground Nut · 38. Seed

#### AROMA — ROASTED (39-43)
39. Coffee-Roast · 40. Bread-Crust · 41. Meat-Roast · 42. Grain-Toast · 43. Cocoa-Roast

#### AROMA — CARAMELIZED (44-47)
44. Toffee-Caramel · 45. Burnt-Sugar · 46. Maple-Syrup · 47. Molasses-Dark

#### AROMA — SMOKY (48-51)
48. Hard-Wood-Smoke · 49. Soft-Wood-Smoke · 50. Charred · 51. Cold-Smoke

#### AROMA — SULFUROUS (52-54)
52. Allium · 53. Brassica · 54. Protein-Sulfur

#### AROMA — EARTHY (55-58)
55. Mushroom · 56. Root-Tuber · 57. Mineral · 58. Musty

#### AROMA — DAIRY (59-63)
59. Fresh Milk-Cream · 60. Butter · 61. Cultured Dairy · 62. Aged Cheese · 63. Blue-Moldy Cheese

#### AROMA — FERMENTED (64-68)
64. Lacto-Pickled · 65. Acetic-Vinegar · 66. Fish-Fermented · 67. Bean-Fermented · 68. Sourdough-Starter

#### AROMA — YEASTY (69-71)
69. Bread-Yeast · 70. Beer-Brewery · 71. Umami-Yeast

#### AROMA — MARINE (72-75)
72. Seaweed · 73. Fish · 74. Shellfish · 75. Briny

#### AROMA — MEATY (76-79)
76. Cooked Meat · 77. Cured-Preserved · 78. Gamey · 79. Broth-Stock

#### AROMA — SWEET-AROMATIC (80-82)
80. Honey · 81. Tree-Syrup · 82. Molasses-Cane

#### AROMA — SPECIAL (83-85)
83. Vanilla · 84. Dark Cocoa · 85. Milk Chocolate

#### TEXTURE — MECHANICAL (86-91)
86. Crunchy · 87. Crispy · 88. Chewy · 89. Tender · 90. Firm · 91. Fibrous

#### TEXTURE — MOISTURE (92-94)
92. Juicy · 93. Moist · 94. Dry

#### TEXTURE — MOUTHFEEL (95-104)
95. Creamy · 96. Silky · 97. Oily · 98. Grainy · 99. Gummy · 100. Starchy · 101. Gelatinous · 102. Foamy · 103. Powdery · 104. Sticky

#### TEMPERATURE (105)
105. Temperature (bipolar: -6 frozen / -3 cold / -1 cool / 0 room / +2 warm / +4 hot / +6 very hot)

#### CHARACTER (106-112)
106. Rich · 107. Complex · 108. Fresh · 109. Aged · 110. Delicate · 111. Bold · 112. Body

---

## 4. Vocabulary Layer

### Purpose

Users don't think in dimension names. They say "stinky cheese" or "something warming" or "not too spicy". The **SensoryDescriptor** vocabulary table maps 1000+ natural-language terms to weighted combinations of the 113 dimensions.

### Descriptor types

| Type | Example | Maps to |
|------|---------|---------|
| Direct | "pungent" | `Pungent=1.0` |
| Synonym | "stinky", "smelly", "whiffy" | `Pungent=0.8, Sulfurous=0.5, Fermented=0.3` |
| Compound | "sweet-sour" | `Sweet=0.6, Sour=0.5` |
| Cuisine term | "umami-bomb" | `Umami=1.0, Kokumi=0.4, Salty=0.3` |
| Sensation | "refreshing" | `Fresh=0.7, Cooling=0.5, Citrusy=0.3` |
| Tertiary | "grapefruit" | `Citrusy=0.9, Bitter=0.4, Fresh=0.3` |
| Quality | "elegant" | `Floral-Delicate=0.4, Silky=0.5, Fresh=0.3` |
| Style | "rustic" | `Earthy=0.6, Woody=0.4, Grainy=0.3` |
| Avoidance | "not spicy" | `Spicy=-1.0` (special negative mapping) |
| Intensity | "very" / "slightly" | modifier applied to next term |

### Vocabulary categories & counts

| Category | Count | Examples |
|----------|-------|----------|
| Taste primaries & synonyms | ~80 | sweet, sugary, candied, saline, briny, tart, tangy |
| Chemesthetic terms | ~60 | spicy, hot, pungent, sharp, funky, cooling, tingly, numbing |
| Aroma families + tertiaries | ~500 | floral, roseate, citrus, grapefruit, herbaceous, basil-like, oaky |
| Texture terms | ~150 | crunchy, crispy, creamy, velvety, silky, starchy, gooey, gummy |
| Sensation/quality terms | ~100 | refreshing, comforting, indulgent, delicate, bold, bright, deep |
| Cuisine/cultural terms | ~80 | umami-bomb, mirepoix-like, Asian-forward, Mediterranean, rustic |
| Dish-type associations | ~60 | stew-like, salad-fresh, dessert-sweet, breakfast-hearty |
| Contrast/compound | ~50 | sweet-savory, bitter-sweet, hot-cool, rich-bright |
| Modifier patterns | ~20 | very, slightly, not, without, mostly, lightly, intensely, barely |
| **TOTAL** | **~1100** | |

### Modifier system

Applied to the next descriptor token:
- `very [X]` → multiply X's weights by 1.3
- `slightly [X]` → multiply X's weights by 0.5
- `not [X]` → negate (avoidance filter)
- `without [X]` → hard exclusion (filter-before-search)
- `mostly [X]` → X at full weight, dampens other dims
- `lightly [X]` → multiply by 0.6
- `intensely [X]` → multiply by 1.5
- `barely [X]` → multiply by 0.3
- `richly [X]` → X at 1.0 + Rich=+0.3

### Query parser behavior

Example: `"looking for something funky and crunchy, not too spicy"`

```
Tokens: ["funky", "crunchy", "not", "too", "spicy"]
Parsed:
  "funky"  → { Fermented: 0.7, Pungent: 0.6, Earthy: 0.3, Aged: 0.3 }
  "crunchy" → { Crunchy: 1.0 }
  "not too spicy" → { Spicy: -0.7 } (avoidance, with "too" as soft modifier)

Target vector:
  Fermented: 0.7, Pungent: 0.6, Earthy: 0.3, Aged: 0.3,
  Crunchy: 1.0,
  Spicy: -0.7  (exclusion weight)

Pre-filter: exclude recipes with Spicy > 0.4 (soft exclusion)
Vector search: rank by cosine similarity on positive dims
Return: kimchi tostada, aged cheese + crackers, sauerkraut reuben, etc.
```

### Growing the vocabulary

Vocabulary is seeded with ~1100 terms but grows over time:
- Every search query is logged with its resolution
- Unrecognized terms are queued for admin review
- Admins add new terms or synonyms via admin UI
- `searchCount` field tracks popularity — most-searched terms get priority for refinement

---

## 5. Interaction Model — All 6 Tiers

The model encodes how ingredients combine beyond simple averaging. Six tiers of rules, each addressing different phenomena.

### Summary of tiers

| Tier | Type | Approximate Rule Count | What It Models |
|------|------|------------------------|----------------|
| 1 | Perceptual dim math | ~80 | How dims enhance, mask, synergize each other |
| 2 | Physical chemistry | ~30 | Curdling, emulsions, gelation, denaturation |
| 3 | Temporal/order | ~20 | When ingredient is added matters |
| 4 | Carrier effects | ~15 | Fat carries spice, acid brightens aroma |
| 5 | Emergent patterns | ~40 | Classical bases (mirepoix, dashi, caprese) |
| 6 | Clashes | ~60 | Combinations that lower pleasantness |
| | **TOTAL** | **~245** | |

### Tier 1 — Perceptual Dimension Math

Rules describing how two dimensions interact at the perception level (no chemistry involved, just how the brain combines sensory input).

**Rule types within Tier 1:**
- `reinforce` — same dim stacks with Stevens' Power Law saturation
- `enhance` — one dim boosts another's perception (salt enhances sweet)
- `mask` — one dim suppresses another (sweet masks bitter)
- `synergy` — multiplicative combination (umami × umami)

**Examples:**

```
Salt enhances Sweet (trace levels)
  ruleType: enhance, dimA: Salty, dimB: Sweet
  doseCurve: [[0.001, 0.1], [0.005, 0.3], [0.015, 0.2], [0.025, -0.1]]
  (small salt amplifies sweet; too much masks it)

Sweet masks Bitter
  ruleType: mask, dimA: Sweet, dimB: Bitter  
  coefficient: -0.5
  threshold: Sweet > 2

Umami × Umami synergy (glutamate + nucleotide)
  ruleType: synergy, dimA: Umami, dimB: Umami (from different sources)
  multiplier: up to 7-8x when both > 2
  
Fat carries Spicy
  ruleType: enhance, dimA: Fatty, dimB: Spicy
  coefficient: +0.4

Sour brightens Aromatic (overall aroma perception)
  ruleType: enhance, dimA: Sour, dimB: [all aroma families]
  coefficient: +0.15 per aroma dim

Tannin reduces Sweet perception slightly
  ruleType: mask, dimA: Astringent, dimB: Sweet
  coefficient: -0.15
```

### Tier 2 — Physical / Chemical Interactions

Rules describing **actual chemistry** that happens when ingredients meet. Dose-dependent; requires real chem property data.

**Key interactions:**

#### 2.1 Acid-dairy interaction
```
Ingredients: any acid (Sour > 2) + any dairy (Fresh-Milk-Cream or Cultured > 2)
Dose curve (acid grams / dairy grams):
  0.005 → +0.1 Silky (brightening)
  0.02  → +0.3 Silky (tangy layer)
  0.05  → +0.5 Silky (thickening)
  0.10  → -0.8 Silky, +0.8 Grainy (curdling)
  0.15  → -1.5 Silky, +1.5 Grainy (broken, ricotta-like)
Stabilizers: high fat content (>30%), egg yolk, mustard, cold temperature
Effect on fat > 35%: reduce severity by 60%
```

#### 2.2 Enzyme-protein denaturation
```
Pineapple/papaya/kiwi (bromelain/papain) + protein
  Short contact: tenderizes (+Tender)
  Long contact: mush (excessive Tender, -Firm)
Duration threshold: 30 min = optimal; 2+ hours = over-tenderized
```

#### 2.3 Emulsification
```
Fat + water without emulsifier → breaks (Oily separation)
Fat + water + egg yolk lecithin → stable emulsion (Silky, Creamy)
Fat + water + mustard → stable (vinaigrette)
Fat + water + starch → moderately stable
```

#### 2.4 Gelation
```
Pectin + sugar > 55% + acid pH < 3.5 → gel (Gelatinous)
Gelatin + heat → dissolves
Gelatin + cold → sets (Gelatinous)
Starch + water + heat > 62°C → gelatinizes (Silky, Starchy)
Egg + heat > 63°C → coagulates (increases Firm, Creamy)
```

#### 2.5 Leavening
```
Baking soda + acid → CO2 → texture lightening (increases Foamy)
Yeast + sugar + time + warmth → CO2 + ethanol → (Bread-Yeast, Foamy, Alcoholic trace)
```

#### 2.6 Chelation
```
Tannins + iron-rich proteins → metallic perception
Calcium + oxalates (spinach + dairy) → chalky/bitter perception
```

### Tier 3 — Temporal / Order Effects

When ingredients enter cooking matters.

**Examples:**
```
Garlic added EARLY (sautéed > 5 min) → Sulfurous ÷ 2, Sweet +1.5, Roasted +0.5
Garlic added LATE (raw or < 1 min cook) → Sulfurous × 1.3, Pungent +1.0

Fresh herbs added EARLY → Fresh ÷ 2, Herbal stays (integrates into broth)
Fresh herbs added LATE → Fresh × 1.5, volatile top notes preserved

Salt on meat: BEFORE cook > 40 min → brining (Moist +0.5, Salty even distribution)
Salt on meat: < 10 min before cook → surface-only seasoning
Salt AFTER cook → finishing (high Salty on surface, affects Crispy if fried)

Citrus zest AT END → perfumed (Citrusy +1.0), volatile preservation
Citrus zest EARLY → faded (Citrusy -0.5)
```

### Tier 4 — Carrier Effects

Some dimensions amplify the perception of others.

```
Fat carries lipophilic compounds:
  - Fat × Spicy → Spicy perception +30% (butter + chili)
  - Fat × Warm Sweet Spice → +40% (cinnamon in cream)
  - Fat × Allium → +25% (oil + garlic, bagna cauda)
  - Fat × any Aroma → +15% baseline

Alcohol carries volatile aromatics (partial):
  - Alcoholic × any Aroma → +20% release
  - Burns off with heat (reduces over time)

Acid brightens:
  - Sour (0.5-2.0) × any Aroma → +15% perception
  - Sour > 3 → starts competing, effect diminishes

Salt enhances perception of:
  - Sweet (trace levels only)
  - Umami (synergistic)
  - many aromatics (general amplifier at low dose)

Heat releases aromatics from solids:
  - Temperature (warm+) × dried spices → +50% perceived intensity
  - Temperature (hot) × fresh herbs → -30% (volatiles burn off if no fat)
```

### Tier 5 — Emergent Patterns

Classical combinations that produce MORE than the sum of parts. Tagged and named.

**Foundational bases (flavor bombs):**
```
mirepoix (French): onion + carrot + celery
  Emerges: Complex +0.8, savory-base tag, French-cuisine
  Requires: sautéed > 10 min in fat

sofrito (Spanish/Italian): onion + garlic + tomato + (bell pepper optional)
  Emerges: Complex +0.7, Mediterranean-base tag
  Requires: sautéed > 15 min

holy trinity (Cajun): onion + celery + bell pepper
  Emerges: Complex +0.7, Southern-base tag

dashi stack: kombu + bonito (+ shiitake optional)
  Emerges: Umami × 2.5 (multiplicative), Kokumi +1.0, Japanese-base tag

masala/curry base: onion + ginger + garlic + warm spice mix
  Emerges: Complex +0.9, Warm Sweet Spice +0.5, Indian-cuisine tag
```

**Mother sauces:**
```
béchamel: butter + flour + milk + nutmeg
  Emerges: Creamy +1.5, Silky +1.0, French-technique tag

hollandaise: egg yolk + butter + lemon + heat
  Emerges: Creamy +1.5, Silky +1.2, Sour-bright +0.5

velouté: stock + roux
  Emerges: Silky +1.0, Umami +0.5, Complex +0.5

tomato sauce base: tomato + olive oil + garlic + herb
  Emerges: Complex +0.7, Italian-base
```

**Classical duos/trios:**
```
caprese: tomato + fresh mozzarella + basil (+ olive oil)
  Emerges: Complex +1.0, Fresh +0.5, Italian-classic tag

strawberry-balsamic: strawberry + balsamic
  Emerges: Complex +0.8, Sweet-Sour balanced tag

umami-bomb: 3+ glutamate-rich ingredients (tomato, parmesan, mushroom, soy)
  Emerges: Umami × 1.8 multiplier, Kokumi +1.0

brown butter: butter + heat > 120°C
  Emerges: Butter -0.5, Nutty +1.5, Caramelized +0.5

caramelized onion: onion + long sauté (> 30 min, low heat)
  Emerges: Allium ÷ 3, Sweet +2.0, Caramelized +1.0, Complex +0.5
```

### Tier 6 — Clashes

Combinations that lower pleasantness. Contribute to **harmony score penalty**, not the sensory profile itself.

**Category-level clashes:**
```
Cooling + Meaty-Aged (except lamb)
  severity: 0.7, cultural: western
  
Floral-Delicate + Sulfurous-Brassica
  severity: 0.5, cultural: universal (exceptions: specific fusion cuisines)

Floral-Delicate + Fermented-Fish
  severity: 0.8, cultural: universal

Dark-Cocoa + Marine-Fish
  severity: 0.8, exception: oyster (some chefs), cultural: western
  
Warm-Sweet-Spice + Fermented-Fish (cinnamon + fish sauce)
  severity: 0.7, cultural: western

Dairy + Citrus (high dose unstabilized)
  severity: 0.5, becomes physical curdle rule in Tier 2

Blue-Moldy + Delicate-White-Fish
  severity: 0.7, cultural: universal (some exceptions in specific cuisines)

Carbonated + Hot-Dense-Protein (mixing while still carbonated)
  severity: 0.3, low-priority aesthetic
```

**Ingredient-specific clashes:**
```
mint + bacon → severity 0.6
mint + salmon → severity 0.5
mint + beef (except lamb) → severity 0.6
basil + fish sauce → severity 0.5
rosemary + delicate seafood → severity 0.5
cinnamon + fresh fish → severity 0.7
chocolate + tuna → severity 0.9
lavender + garlic → severity 0.4 (subtle clash)
```

**Exceptions**: every clash rule can have `exceptions: String[]` — ingredients that resolve the clash. E.g., `mint + meat` clash has `exceptions: [lamb]` because mint+lamb is classic.

---

---

## 6. Dose-Response System

### Why doses matter

The system models **dose-dependent** interactions because many culinary phenomena are non-linear:
- Trace salt enhances sweetness; heavy salt kills it.
- Trace acid brightens cream; heavy acid curdles it.
- Trace vanilla warms chocolate; heavy vanilla dominates it.

**Rules encode dose-response curves as piecewise linear functions** rather than scalar coefficients.

### Dose-curve data structure

```json
"doseCurve": [
  { "dose": 0.005, "effect": 0.1 },   // 0.5% mass: trace effect
  { "dose": 0.02,  "effect": 0.3 },   // 2% mass: moderate positive
  { "dose": 0.05,  "effect": 0.5 },   // 5% mass: peak positive
  { "dose": 0.10,  "effect": -0.3 },  // 10% mass: turning negative
  { "dose": 0.15,  "effect": -1.5 }   // 15%+ mass: strongly negative
]
```

Dose can be expressed in several units (`doseUnit` field):
- `grams_ratio` — grams of ingredient A / grams of ingredient B (e.g., acid/dairy)
- `percent_mass` — percentage of total recipe mass (e.g., salt in desserts)
- `pH` — for acid-base reactions
- `presence` — binary, with 0/1 or 0/0.5/1 (used for rule-firing trigger)

### Standard curve library

Common dose curves reused across rules:

| Curve name | Shape | Typical use |
|-----------|-------|-------------|
| `acid_in_dairy` | bump-then-break | acid + cream (tangy → curdle) |
| `salt_in_sweet` | bump-then-decline | salt in dessert (0.1% enhance, 1%+ clash) |
| `fat_carries_spice` | linear saturating | butter + chili (grows until saturation) |
| `sugar_in_bitter` | masking-saturating | sugar + coffee (more = more mask, caps at mask=1) |
| `enzyme_tenderize` | peak-then-mush | pineapple + meat (optimal then over) |
| `reduction_concentrate` | concentration curve | liquid reduction over time |
| `alcohol_burnoff` | exponential decay | ethanol loss over simmer time |
| `baking_soda_acid` | stoichiometric | baking soda + acid ratio (matched is best) |
| `salt_brine_meat` | time-dependent | longer = deeper (up to diminishing returns) |

### Stabilizers

Rules can declare `stabilizers: String[]` — ingredients whose presence reduces the rule's effect:

```json
"stabilizers": ["egg yolk", "mustard", "starch", "high fat content"]
```

When a stabilizer is present in the recipe, the rule's effect magnitude is reduced by 50-80% (configurable per stabilizer).

**Example**: the acid-in-dairy curdling rule has `stabilizers: ["egg yolk", "mustard"]`. A Caesar dressing (acid + cream + egg yolk + mustard) can tolerate 5x more acid before curdling than plain cream would.

### Temperature-dependent dose scaling

Some reactions scale with temperature:
- Cold dairy tolerates 2x more acid before curdling
- Hot dairy curdles with 40% less acid
- Cold reduces aromatic release (dose feels lower)
- Hot amplifies aromatic release (dose feels higher)

These are encoded as `requiresTempRange` on rules plus a global temperature-sensitivity modifier.

### Exception handling

Every rule supports:
```json
"exceptions": ["specific_ingredient_name"]
```

Exceptions override the rule. Example: `mint + meat` clash has `exceptions: ["lamb"]` — mint+lamb doesn't trigger because it's a classical pairing.

---

## 7. Computation Pipeline

### The 17-step pipeline

Every recipe's sensory profile is computed through this pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. INGREDIENT POTENCY LOOKUP                                   │
│     - Normalize names (lowercase, strip punctuation)            │
│     - Resolve aliases (e.g., "extra-virgin olive oil" →         │
│       "extra virgin olive oil")                                 │
│     - Fetch potency arrays from IngredientSensoryProfile        │
│     - Fetch chem properties from IngredientChemProperties       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. MASS FRACTION COMPUTATION                                   │
│     - Convert quantity+unit to grams per ingredient             │
│     - Total grams = sum                                         │
│     - Mass fractions = grams / total                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. COOKING TRANSFORM APPLICATION                               │
│     - Parse instructions via instruction-parser.service         │
│     - For each ingredient, determine cooking context            │
│       (method, temp, duration)                                  │
│     - Apply CookingReactionRule + CompoundCookingEffect         │
│       transforms to potency                                     │
│     - Apply VolatileTimingCurve for time-dependent changes      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. RAW PROFILE AGGREGATION                                     │
│     - Sum transformed potencies × impact × mass fraction        │
│     - Apply impact multipliers by role                          │
│       (SEASONING=8x or 3x aromatic, PROTEIN=1x, etc.)           │
│     - Sum by dimension → raw 113-dim profile                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. DOSE ANALYSIS (new)                                         │
│     - Compute total acid grams (from Sour ingredients + acidic  │
│       chem)                                                     │
│     - Compute total fat grams                                   │
│     - Compute total protein grams                               │
│     - Compute total sugar grams                                 │
│     - Compute total salt grams                                  │
│     - Estimate pH                                               │
│     - Compute ratios (acid/dairy, salt/total, fat/liquid, etc.) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. INTERACTION RULE EVALUATION (Tier 1)                        │
│     - Apply perceptual dim math rules                           │
│     - Stevens' Power Law saturation per dim                     │
│     - Synergy multipliers (umami × umami)                       │
│     - Masking (sweet masks bitter)                              │
│     - Enhancement (salt enhances sweet)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. PHYSICAL INTERACTION EVALUATION (Tier 2)                    │
│     - Check each PhysicalInteractionRule                        │
│     - Look up dose on curve                                     │
│     - Check stabilizers                                         │
│     - Apply temperature modifiers                               │
│     - Apply effect to target dim                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. TEMPORAL / ORDER EFFECTS (Tier 3)                           │
│     - Parse instruction timing                                  │
│     - Apply early vs late addition rules                        │
│     - Adjust dims based on when ingredient entered              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  9. CARRIER EFFECTS (Tier 4)                                    │
│     - Fat carries spicy/aroma                                   │
│     - Alcohol carries volatile aromatics                        │
│     - Acid brightens                                            │
│     - Heat releases aromatics                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  10. EMERGENCE DETECTION (Tier 5)                               │
│     - For each CombinationEmergence pattern                     │
│     - Check if trigger set present (with min doses)             │
│     - If matched, apply emergent boosts                         │
│     - Tag recipe with matched emergences                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  11. CLASH DETECTION (Tier 6)                                   │
│     - For each FlavorClashRule                                  │
│     - Check if triggered (considering exceptions)               │
│     - Compute severity from dose curve                          │
│     - Accumulate harmony penalty                                │
│     - Record clash reason                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  12. TEMPERATURE MODIFIER APPLICATION                           │
│     - ServingTempModifier adjusts perception at serving temp    │
│     - Cold suppresses sweet + aroma                             │
│     - Hot amplifies aroma, suppresses sweet                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  13. AFTERTASTE COMPUTATION                                     │
│     - Simplified 8-dim finish profile                           │
│     - Persistent compounds (bitter, umami, warming)             │
│     - How long flavor lingers                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  14. BODY / WEIGHT COMPUTATION                                  │
│     - Derived from fat/protein/starch densities + viscosity     │
│     - Separate from Rich (intensity) — Body = perceived         │
│       heaviness                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  15. DERIVED METRICS                                            │
│     - Balance score: variance across dims (low variance = well  │
│       balanced)                                                 │
│     - Complexity score: count of non-trivial dims               │
│     - Intensity score: sum of top 5 dims                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  16. HARMONY SCORE (3 passes)                                   │
│     - Universal: start at 1.0, subtract clash penalties, add    │
│       emergence bonuses                                         │
│     - Cuisine-specific: recompute with cuisine-specific rules   │
│     - Personalized (on-demand): adjust for user preferences     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  17. FINALIZE & STORE                                           │
│     - Clamp dims to [0, 6]                                      │
│     - Denormalize flags (isCrunchy, isRich, etc.)               │
│     - Compute pgvector representation                           │
│     - Store Recipe fields + audit log                           │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline performance

- Current (5-step): ~5ms per recipe
- New (17-step): expected ~15-25ms per recipe
- Bottleneck: rule evaluation (many rule queries)
- Optimization: cache rules in memory (in-process LRU), batch DB lookups

### Computation modes

- **Full recompute**: applies all 17 steps, writes all fields
- **Partial recompute**: after rule changes, only re-runs steps 6-16
- **Hot reload**: after ingredient potency changes, only re-runs steps 3-16

---

## 8. Harmony Score — 3 Passes

### Pass 1: Universal Harmony

Computed once per recipe, cached on `Recipe.harmonyScoreUniversal`.

Algorithm:
```
score = 1.0

for each CLASH rule triggered:
  severity = dose_curve_lookup(clash_rule, recipe_dose)
  severity *= clash_rule.severity_multiplier
  if stabilizer present: severity *= 0.3
  if exception present: severity = 0
  score -= severity * 0.15

for each EMERGENCE pattern matched:
  bonus = emergence.harmonyBonus (typically 0.1-0.3)
  score += bonus

score = clamp(score, 0.0, 1.0)
```

### Pass 2: Cuisine-Specific Harmony

Stored as `Recipe.harmonyScoreCuisine Json?`:
```json
{
  "western": 0.85,
  "italian": 0.92,
  "japanese": 0.70,
  "indian": 0.65,
  "mexican": 0.80,
  "french": 0.88
}
```

Algorithm (computed per cuisine):
```
score = 1.0

for each CLASH rule triggered:
  if rule.cultures does NOT include cuisine: skip  // rule doesn't apply
  severity = dose_curve_lookup(...)
  score -= severity * 0.15

for each EMERGENCE pattern matched:
  if pattern.cuisineContext == cuisine: bonus *= 1.5  // cuisine match
  if pattern.cuisineContext != cuisine AND pattern.cuisineContext != null: bonus *= 0.5
  score += bonus

score = clamp(score, 0.0, 1.0)
```

Use cases:
- Search filters by cuisine preference
- Recipe recommendations for "Italian night"
- Warning for users: "this recipe has Asian influences, western harmony score differs"

### Pass 3: Personalized Harmony (on-demand)

Computed for specific user when they view a recipe or run a preference-based search.

Uses `UserSensoryPreference` + `UserCuisinePreference`:
```
user_pref = UserSensoryPreference.preferences (113-dim vector)
cuisine_pref = UserCuisinePreference.weights

for each dim:
  dim_match = dot_product(recipe.profile[dim], user_pref[dim])
  dim_weight = user_pref.weights[dim]
  similarity += dim_match * dim_weight

harmony = base_harmony * (1 + personal_boost)
  where personal_boost = f(similarity, cuisine_match, dim_match)

cached in RecipePreferenceMatch for TTL (24h)
```

### How the 3 passes combine for ranking

When ranking recipes for a user:

```
final_score =
  vector_similarity * 0.5 +                    # how well it matches the query
  harmony_score_universal * 0.15 +             # general "does it work?"
  harmony_score_cuisine[user_cuisine] * 0.15 + # cultural fit
  harmony_score_personal * 0.2                 # user-specific match
```

---

## 9. Data Model Reference

### Core tables

#### `Ingredient` (conceptually — may still be split across multiple tables initially)
Single source of truth for everything about an ingredient.

```prisma
model IngredientSensoryProfile {
  id               String   @id @default(cuid())
  name             String   @unique                  // canonical lowercase
  aliases          String[] @default([])             // variant names
  
  // Sensory (113 dims, 0-6 scale; Temperature bipolar -6 to 6)
  potency          Float[]  @default([])             // [113]
  adminOverride    Float[]  @default([])             // [113], -1 = no override
  
  // Provenance
  potencySource    String?                           // "wageningen_panel" | "ai_calibrated" | "admin" | "manual_expert" | "usda_fdc"
  confidenceScore  Float    @default(0)
  compoundEvidence Json?                             // external refs (USDA entry, Wageningen panel, etc.)
  isAnchor         Boolean  @default(false)          // calibration reference?
  
  // Classification
  role             String?                           // "PROTEIN" | "AROMATIC" | "DAIRY" | etc.
  category         String?                           // "cheese" | "allium" | "nightshade" | etc.
  
  // Metadata
  notes            String?  @db.Text
  embedding        Unsupported("vector(1536)")?      // for semantic search during calibration
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  chemProperties   IngredientChemProperties?
  @@schema("catalog")
}
```

#### `IngredientChemProperties`
Physical/chemical properties needed for Tier 2 (physical interactions).

```prisma
model IngredientChemProperties {
  id                 String   @id @default(cuid())
  ingredientName     String   @unique
  
  // Macros (per 100g)
  sugarContent       Float    @default(0)
  proteinContent     Float    @default(0)
  fatContent         Float    @default(0)
  starchContent      Float    @default(0)
  fiberContent       Float    @default(0)
  moistureContent    Float    @default(0)             // %
  
  // Chemistry
  acidPh             Float?                           // may be null if unknown
  collagenContent    Float?
  pectinContent      Float?
  glutenPotential    Float?
  volatileCompounds  Float?
  waterActivity      Float    @default(0.99)
  smokePoint         Float?
  meltingPoint       Float?
  
  // Enzymes + special
  enzymeActivity     String[] @default([])
  absorptionRate     Float    @default(0)
  
  // Provenance — CRITICAL: never fabricate
  source             String   @default("null")       // "usda_fdc" | "foodb" | "wikipedia" | "null"
  sourceCitation     String?                         // URL, USDA FDC ID, paper ref
  
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  @@schema("catalog")
}
```

#### `SensoryDimensionConfig`
Definition of the 113 dimensions.

```prisma
model SensoryDimensionConfig {
  index            Int      @id                       // 0-112
  name             String   @unique
  primaryCategory  String                              // taste | chemesthetic | aroma | texture_mechanical | texture_moisture | texture_mouthfeel | temperature | character
  parentFamily     String?                            // for aroma secondaries
  tier             String                              // "primary" | "secondary"
  scaleType        String   @default("unipolar")     // "unipolar" | "bipolar"
  scaleMin         Float    @default(0)
  scaleMax         Float    @default(6)
  stevensExponent  Float    @default(1.0)
  saturationPoint  Float?
  thresholdMgPer100g Float?
  keywords         String[] @default([])
  anchorExamples   String[] @default([])
  descriptorTerms  String[] @default([])
  isActive         Boolean  @default(true)
  notes            String?  @db.Text
  @@schema("catalog")
}
```

#### `SensoryInteractionRule` (enhanced)
All perceptual, carrier, and temporal rules.

```prisma
model SensoryInteractionRule {
  id            String   @id @default(cuid())
  tier          String                                 // "perceptual" | "temporal" | "carrier"
  ruleType      String                                 // "reinforce" | "enhance" | "mask" | "synergy" | "carry"
  
  // Triggers
  dimA          Int?
  dimB          Int?
  categoryA     String?
  categoryB     String?
  ingredientA   String?
  ingredientB   String?
  chemProperty  String?                                // for chem-based rules
  
  // Dose curve
  doseCurve     Json                                   // [{dose, effect}]
  doseUnit      String   @default("grams_ratio")
  
  // Effect
  effectDim     Int?
  effectType    String                                 // "multiply" | "add" | "cap"
  maxEffect     Float    @default(2)
  
  // Context
  requiresMethod    String[] @default([])
  requiresTempRange String?
  exceptions        String[] @default([])
  stabilizers       String[] @default([])
  
  description   String
  severity      Float    @default(1.0)
  ruleVersion   Int      @default(1)
  isActive      Boolean  @default(true)
  
  @@index([tier, ruleType])
  @@schema("catalog")
}
```

#### `PhysicalInteractionRule` (new — dedicated for chemistry)
Separate from perceptual for clarity.

```prisma
model PhysicalInteractionRule {
  id              String   @id @default(cuid())
  name            String   @unique                    // "acid_in_dairy", "enzyme_tenderize"
  category        String                              // "denaturation" | "emulsion" | "gelation" | "leavening"
  
  triggerA        Json                                // { chemProp: "acid", minValue: 0 }
  triggerB        Json
  doseCurve       Json
  doseUnit        String   @default("grams_ratio")
  
  effectDims      Json                                // { [dimIdx]: effectValue }
  
  stabilizers     String[] @default([])
  requiresTempRange String?
  description     String
  citations       String[] @default([])               // scientific refs
  
  isActive        Boolean  @default(true)
  @@schema("catalog")
}
```

#### `FlavorClashRule` (new)
Combinations that lower harmony.

```prisma
model FlavorClashRule {
  id              String   @id @default(cuid())
  scopeType       String                              // "ingredient_pair" | "category_pair" | "dim_combination"
  
  ingredientA     String?
  ingredientB     String?
  categoryA       String?
  categoryB       String?
  dimConstraints  Json?                               // { dimName: ">=value" }
  
  severityCurve   Json                                // dose-based severity
  
  cultures        String[] @default(["universal"])
  exceptions      String[] @default([])
  
  reason          String
  citations       String[] @default([])
  isActive        Boolean  @default(true)
  @@schema("catalog")
}
```

#### `CombinationEmergence` (new)
Named classical patterns.

```prisma
model CombinationEmergence {
  id                 String   @id @default(cuid())
  name               String   @unique
  cuisineContext     String?
  
  triggers           Json                             // [{ ingredient/category, minDose, role }]
  minTriggerCount    Int      @default(2)
  requiresMethod     String[] @default([])
  
  emergentBoosts     Json                             // { dim: +value }
  emergentTags       String[] @default([])
  harmonyBonus       Float    @default(0.1)
  
  description        String
  isActive           Boolean  @default(true)
  @@schema("catalog")
}
```

#### `DimensionDoseThreshold` (new)
Quick-reference dose ranges.

```prisma
model DimensionDoseThreshold {
  id           String @id @default(cuid())
  dimensionIdx Int
  context      String                                  // "dessert" | "savory" | "beverage" | "any"
  traceDose    Float
  noticeable   Float
  dominant     Float
  overwhelming Float
  notes        String?
  @@unique([dimensionIdx, context])
  @@schema("catalog")
}
```

#### `SensoryDescriptor` (new)
Vocabulary layer.

```prisma
model SensoryDescriptor {
  id           String   @id @default(cuid())
  term         String   @unique
  category     String?                                // "intensity" | "quality" | "sensation" | "tertiary" | etc.
  dimMappings  Json                                   // { Pungent: 0.8, Sulfurous: 0.5 }
  aliases      String[] @default([])
  searchCount  Int      @default(0)
  isActive     Boolean  @default(true)
  @@index([term])
  @@schema("catalog")
}
```

#### `IngredientChangeLog` (new)
Audit trail.

```prisma
model IngredientChangeLog {
  id              String   @id @default(cuid())
  ingredientName  String
  changeType      String
  beforeJson      Json?
  afterJson       Json?
  changedBy       String                              // "ai:claude" | "ai:gpt-4.1-mini" | userId
  reason          String?
  createdAt       DateTime @default(now())
  @@index([ingredientName, createdAt])
  @@schema("catalog")
}
```

#### `RuleVersion` (new)
Rule change history.

```prisma
model RuleVersion {
  id            String   @id @default(cuid())
  ruleType      String                                // "interaction" | "clash" | "emergence"
  ruleId        String
  version       Int
  beforeJson    Json
  afterJson     Json
  changedBy     String
  reason        String?
  createdAt     DateTime @default(now())
  @@index([ruleType, ruleId, version])
  @@schema("catalog")
}
```

#### `SensoryRegressionFixture` (new)
Known-good test recipes.

```prisma
model SensoryRegressionFixture {
  id                 String   @id @default(cuid())
  recipeId           String   @unique
  expectedProfile    Float[]                          // [113]
  tolerance          Float[]                          // [113] per-dim acceptable deviation
  expectedArchetype  String?
  expectedHarmony    Float?
  lockedAt           DateTime
  lockedBy           String                           // admin userId
  description        String?
  @@schema("catalog")
}
```

### Recipe-side extensions

```prisma
model Recipe {
  // ... existing fields ...
  
  // Sensory (Layer 3)
  sensoryProfile            Float[]                   // [113]
  sensoryVector             Unsupported("vector(113)")?
  aftertasteProfile         Float[]                   // [8] simplified finish
  bodyWeight                Float?                    // derived
  
  // Harmony (3 passes)
  harmonyScoreUniversal     Float?
  harmonyScoreCuisine       Json?
  // harmonyScorePersonal cached in RecipePreferenceMatch, not here
  
  // Detection results
  detectedClashes           Json?                     // [{ reason, severity }]
  detectedEmergences        Json?                     // [{ name, description }]
  dominantArchetype         String?
  archetypeConfidence       Float?
  
  // Context
  cuisineTags               String[] @default([])
  courseType                String?                   // "starter" | "main" | "side" | "dessert" | "snack"
  seasonalContext           String[] @default([])    // ["spring", "summer"]
  
  // Derived metrics
  balanceScore              Float?
  complexityScore           Float?
  intensityScore            Float?
  
  // Denormalized flags (for fast filtering)
  isCrunchy                 Boolean  @default(false)
  isCreamy                  Boolean  @default(false)
  isRich                    Boolean  @default(false)
  isSpicy                   Boolean  @default(false)
  isSweet                   Boolean  @default(false)
  isUmami                   Boolean  @default(false)
  isFresh                   Boolean  @default(false)
  isSmoky                   Boolean  @default(false)
  isBright                  Boolean  @default(false)
  isHearty                  Boolean  @default(false)
  
  // Regression tracking
  computedByRulesetVersion  Int?
  computedAt                DateTime?
  
  @@index([isCrunchy, isRich])
  @@index([isCreamy, isUmami])
  @@index([dominantArchetype])
  @@index([harmonyScoreUniversal])
}
```

### User-side tables

```prisma
model UserSensoryPreference {
  id                String   @id @default(cuid())
  userId            String   @unique
  preferences       Float[]  @default([])             // [113] preference vector
  weights           Float[]  @default([])             // [113] strength
  avoid             String[] @default([])             // hard avoids
  likedRecipeIds    String[] @default([])
  dislikedRecipeIds String[] @default([])
  derivedFromLikes  Boolean  @default(false)
  lastUpdated       DateTime @updatedAt
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@schema("user_data")
}

model UserCuisinePreference {
  id        String   @id @default(cuid())
  userId    String   @unique
  weights   Json                                      // { "italian": 0.9, "japanese": 0.8 }
  avoid     String[] @default([])
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@schema("user_data")
}

model RecipePreferenceMatch {
  id              String   @id @default(cuid())
  userId          String
  recipeId        String
  similarity      Float
  harmonyPersonal Float
  finalScore      Float
  explanation     Json
  computedAt      DateTime @default(now())
  ttlExpiresAt    DateTime
  @@unique([userId, recipeId])
  @@index([userId, finalScore])
  @@index([ttlExpiresAt])
  @@schema("user_data")
}
```

---

---

## 10. Calibration Protocols

Calibration protocols are **invariants** that every ingredient of a category MUST satisfy. They're stored as `CalibrationRule` records and checked before any write to `IngredientSensoryProfile`.

### Why calibration matters

Without invariants, AI-generated profiles drift:
- All aged cheeses had `Fermented=0` (wrong — aged cheese IS fermented)
- Bell peppers had `Rich=3.0` (wrong — peppers have minimal fat)
- Mayonnaise had `Rich=0.0` (wrong — mayo is 75% oil)

Each of these was caught by manual audit. Codifying them as rules prevents the error from recurring.

### Per-category rule examples

**See [sensory-calibration-rules.md](sensory-calibration-rules.md) for the full per-category rule list.**

#### Cheeses
- **Aged cheeses** (parmesan, cheddar, gruyère, manchego, gouda): `Fermented ≥ 2, Aged-Cheese ≥ 3, Umami ≥ 2, Rich ≥ 3`
- **Blue cheeses** (blue, gorgonzola, roquefort, stilton): `Blue-Moldy Cheese ≥ 4, Fermented ≥ 4, Pungent ≥ 3, Rich ≥ 3`
- **Fresh cheeses** (mozzarella, ricotta, cottage, mascarpone): `Fermented 0.5-1.5, Rich 1.5-4.0 (proportional to fat), Creamy ≥ 2`
- **Cheese with > 20g fat/100g**: `Rich ≥ 2`
- **Cheese with > 30g fat/100g**: `Rich ≥ 3, Oily ≥ 1`

#### Alliums (raw)
- **Raw garlic, onion, shallot, leek, chive, ramp**: `Sulfurous ≥ 2, Allium ≥ 3, Pungent ≥ 1`
- **Raw onion/shallot**: `Sulfurous ≥ 3, Pungent ≥ 2` (distinctly sharp)
- **Raw garlic**: `Sulfurous ≥ 4, Pungent ≥ 3`
- **Chives specifically**: `Herbal ≥ 2, Fresh Herb ≥ 2` (milder than others)

#### Cooked alliums
- **Sautéed alliums (>10min low heat)**: `Sulfurous ÷ 3, Sweet +1.5, Caramelized +0.5`
- **Caramelized onion (>30min)**: `Sulfurous ÷ 5, Sweet ≥ 4, Caramelized ≥ 2`

#### Nightshades
- **Raw tomato**: `Sour 1-2, Umami 0.8-1.5, Sweet 0.5-1.5, Fresh ≥ 1`
- **Cooked tomato**: `Umami ×2, Sour -0.5, Sweet +0.5` (Maillard + concentration)
- **Raw bell pepper**: `Vegetal ≥ 2, Fresh ≥ 1.5, Sweet (red > yellow > green > 1), Rich ≤ 1`

#### Citrus
- **Any citrus fruit/juice/zest**: `Citrusy ≥ 4, Sour ≥ 3, Fresh ≥ 2`
- **Lemon specifically**: `Sour ≥ 4, Citrusy ≥ 5`
- **Lime**: `Sour ≥ 4, Citrusy ≥ 4.5, Bitter 0.5-1.5`
- **Orange**: `Sour 2.5-3, Sweet 2-3, Citrusy ≥ 4`
- **Grapefruit**: `Bitter ≥ 2, Citrusy ≥ 4, Sour ≥ 3`

#### Fresh herbs
- **Any fresh herb**: `Herbal ≥ 3, Fresh ≥ 2, Green ≥ 1`
- **Basil**: `Fresh Herb ≥ 4, Floral-Herbal 1-2, Sweet 0.5-1`
- **Cilantro**: `Fresh Herb ≥ 4, Citrusy 1-2, Vegetal 1.5-2.5`
- **Mint**: `Cooling ≥ 3, Fresh Herb ≥ 3, Fresh ≥ 2`
- **Rosemary**: `Woody Herb ≥ 4, Resinous 2-3, Herbal ≥ 3`

#### Dried herbs/spices
- **Dried herbs**: reduced Fresh (≤ 1), concentrated dim values vs fresh equivalent
- **Warm sweet spices** (cinnamon, clove, allspice, nutmeg): `Warm Sweet Spice ≥ 4, Warming ≥ 1, Woody ≥ 1`
- **Black pepper**: `Pepper ≥ 4, Pungent 1-2, Spicy 1-2, Warming 1-2`

#### Brassicas (raw)
- **Raw brassica** (cabbage, broccoli, cauliflower, radish, mustard greens): `Brassica ≥ 2, Sulfurous 1-3, Bitter 0.5-2`
- **Cooked brassica**: `Sulfurous ÷ 2, Sweet +0.5, Umami +0.5` (methyl-sulfur loss)

#### Proteins (raw)
- **Raw meat**: `Umami 1-2, Rich proportional to fat, Meaty ≥ 1, Bloody/Iron trace`
- **Raw fish**: `Marine ≥ 2, Fish ≥ 3, Umami 1-2`
- **Raw shellfish**: `Shellfish ≥ 3, Briny 2-4, Sweet 1-2 (shellfish are sweet), Marine ≥ 3`

#### Cooked proteins
- **Grilled/seared meat**: `Maillard/Meat-Roast ≥ 3, Umami +1, Roasted ≥ 2, Smoky (slight grill) 0.5-1`
- **Braised meat**: `Umami +2, Kokumi ≥ 2, Silky ≥ 1, Tender ≥ 3, Broth-Stock ≥ 2`
- **Fried protein**: `Crispy ≥ 3, Oily 1-2, Maillard ≥ 2`
- **Smoked meat**: `Smoky ≥ 3, Cured-Preserved 2-3, Umami ≥ 2`

#### Grains
- **Raw grains**: `Starchy 1-2, Grainy 1-3, minimal taste`
- **Cooked grains**: `Starchy ≥ 3, Sweet 0.5-1, Moist ≥ 2`
- **Toasted grains**: `Nutty 1-2, Grain-Toast ≥ 2, Roasted ≥ 1`

#### Sweeteners
- **Any sweetener**: `Sweet ≥ 5`
- **Honey**: `Sweet 5-6, Honey ≥ 4, Floral 1-2`
- **Maple syrup**: `Sweet 5-6, Tree-Syrup ≥ 4, Woody 1-2`
- **Molasses**: `Sweet 4-5, Molasses-Cane ≥ 4, Bitter 1-2, Smoky 0.5-1`
- **Granulated sugar**: `Sweet 6, nothing else`

#### Fats & oils
- **Oils and pure fats**: `Fatty ≥ 4, Rich ≥ 4, Oily ≥ 3, minimal taste`
- **Olive oil**: `Fatty 4-5, Rich 4-5, Vegetal 1-2, Peppery trace (for extra virgin)`
- **Butter**: `Fatty 4-5, Rich 5-6, Creamy 3-4, Butter ≥ 4`
- **Brown butter**: `Rich 5-6, Nutty 3-4, Caramelized 1-2, Butter 2-3`

#### Fermented products
- **Any fermented**: `Fermented ≥ 2`
- **Vinegar**: `Acetic-Vinegar ≥ 5, Sour ≥ 5, Fermented ≥ 3`
- **Miso**: `Bean-Fermented ≥ 4, Umami ≥ 3, Salty ≥ 2, Fermented ≥ 3`
- **Soy sauce**: `Bean-Fermented ≥ 3, Umami ≥ 4, Salty ≥ 4, Fermented ≥ 2`
- **Fish sauce**: `Fish-Fermented ≥ 5, Umami ≥ 5, Salty ≥ 5, Pungent ≥ 2`
- **Kimchi**: `Lacto-Pickled ≥ 4, Sour 2-3, Fermented ≥ 3, Brassica 2-3, Spicy 2-3`

#### Cured meats
- **Any cured meat**: `Cured-Preserved ≥ 3, Salty ≥ 3, Umami ≥ 2, Aged ≥ 1`
- **Bacon**: `Smoky ≥ 2, Fatty ≥ 3, Cured-Preserved ≥ 3`
- **Prosciutto**: `Cured-Preserved ≥ 4, Umami ≥ 3, Salty 3-4, Aged ≥ 3`

### How calibration rules are enforced

```typescript
// Before any write to IngredientSensoryProfile
async function validateCalibration(name: string, potency: number[]): ValidationResult {
  const category = categorize(name);
  const rules = await getCalibrationRulesForCategory(category);
  
  for (const rule of rules) {
    const violation = checkRule(potency, rule);
    if (violation) {
      if (rule.severity === "error") return { valid: false, violations: [...] };
      if (rule.severity === "warning") warnings.push(violation);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}
```

When AI generates a profile and it violates a calibration rule:
- **Error-level violation**: reject, return to AI with correction reasoning
- **Warning-level violation**: accept but flag for admin review

### Growing the ruleset

New rules are added when:
1. Admin notices a systematic AI error (e.g., "all dessert spices got Woody=0 but cinnamon IS woody")
2. Audit detects a category-level inconsistency
3. Wageningen or literature data shows an expected value that AI missed
4. A failed regression test points to a missing rule

Every new rule entry should include:
- Scope (category)
- Condition (which ingredients the rule applies to)
- Assertion (`dim X ≥ value` or similar)
- Rationale (why this must hold)
- Severity (error or warning)
- Examples (ingredients that satisfy; ingredients that would fail)

---

## 11. Data Sources

### Reliability tiers

Sources ranked by reliability and how we use them.

| Tier | Source | Reliability | Use for |
|------|--------|-------------|---------|
| 1 | Wageningen SVT | Highest (trained panel) | Ground truth for 6 core tastes |
| 1 | USDA FoodData Central | Very high (lab-measured) | Chemistry (protein, fat, sugar, water) |
| 2 | FooDB | High | Compound concentrations (evidence, not formula) |
| 2 | ChemTastesDB | High | Taste classification per compound |
| 2 | FlavorDB | Medium-high | Aroma percept mapping |
| 3 | Wikipedia | Medium (if well-cited) | Fallback lookups, qualitative descriptions |
| 3 | FAO food composition | High | International fallback for non-USDA foods |
| 3 | University food science depts | High | Specialized topics (fermentation, dairy) |
| 4 | AI-generated from anchors | Medium | Initial seed for dims without data |
| 5 | Single-source blog/website | Low | Never use for numeric values |

### Source-specific protocols

#### Wageningen SVT
- Dataset: 627 foods, trained panel, 0-100 scale
- Filtered: 143 relevant items
- Imported: 56 ingredients with panel-validated taste data
- Used for: 6 core dims (Sweet, Salty, Sour, Bitter, Umami, Fat/Rich)
- **Never overwrite Wageningen values without explicit admin override**

#### USDA FoodData Central
- API: https://fdc.nal.usda.gov/api/
- Provides: calories, protein, carbs, fat, fiber, sugar, water, vitamins, minerals per 100g
- Used for: `IngredientChemProperties` — protein, fat, carbs, water, fiber, sugar
- Mapping via `IngredientFoodMapping` table
- Expansion script: `populate-chem-from-usda.ts`

#### Wikipedia lookups (new)
- REST API: https://en.wikipedia.org/api/rest_v1/
- Used for: ingredients without USDA mapping
- Protocol:
  1. Query article for ingredient
  2. Look for infobox nutrition data
  3. Parse citations (must link to USDA, FAO, peer-reviewed journal)
  4. Only accept if 2+ sources agree within 20%
  5. Store as `IngredientChemProperties` with `source: "wikipedia_<YYYY-MM>"` and citation URL

#### FooDB (archived but available)
- Dataset: 70K compounds, 384K content rows
- Current status: archived to `_archive` schema
- Could be reactivated for compound-evidence enhancement

### Citation tracking

Every chem property row stores:
- `source`: which authority (`usda_fdc`, `wikipedia`, `foodb`, `admin`, `ai_estimated`)
- `sourceCitation`: specific reference (USDA FDC ID, URL, paper DOI)
- `updatedAt`: when it was fetched

This is critical for:
- Audit compliance
- Re-verification when sources update
- Removing data if a source is discredited

### Data freshness policy

- USDA data: refresh every 12 months (macros don't change much)
- Wikipedia data: refresh every 6 months (articles may be updated)
- Wageningen: never refresh (fixed dataset)
- FooDB: no refresh needed (archived)
- AI-generated: always superseded by any real-data source

---

## 12. Enhancement Workflows

### Session types

**Category enhancement session**
Focus on one ingredient category (cheese, allium, nightshade, etc.) and perfect all ingredients within it. Output: improved profiles + category calibration rules.

**Interaction rule building session**
Focus on one interaction tier (e.g., physical chemistry) and expand the rule library with rigorous dose curves. Output: new rules + test cases.

**Emergence discovery session**
Find classical flavor combinations and codify as emergence patterns. Output: emergence rules + updated vocabulary.

**Data expansion session**
Run USDA mapping expansion, Wikipedia research, or bulk imports. Output: more chem property coverage.

**Validation session**
Audit drift, check regression tests, fix sparse profiles. Output: health report + fixes.

**Vocabulary expansion session**
Add new descriptor terms, especially those users searched for. Output: expanded vocabulary.

### Session: Adding a new ingredient

```
Step 1: Classify
  - Determine role (PROTEIN | AROMATIC | DAIRY | etc.)
  - Determine category (cheese, allium, etc.)
  - Determine parent cuisine context

Step 2: Gather evidence
  - USDA FDC lookup for macros
  - Wageningen panel data (if in dataset)
  - Wikipedia article review for flavor descriptions
  - FooDB compound lookup (if relevant)

Step 3: Apply category invariants
  - Look up calibration rules for the category
  - Use invariants as lower/upper bounds

Step 4: Fill in dimensions
  - 6 taste dims (prefer Wageningen > USDA-derived > AI-anchored)
  - Chemesthetic (based on compound presence)
  - Aroma primaries/secondaries (based on compound evidence + similar ingredients)
  - Texture (based on physical properties)
  - Character (derived at end)

Step 5: Validate
  - Check all calibration rules satisfied
  - Compare against most-similar 3 ingredients in the DB
  - Check for outliers vs peers

Step 6: Persist
  - Insert to IngredientSensoryProfile with full metadata
  - Insert chem props if real data available
  - Log to IngredientChangeLog

Step 7: Recompute affected recipes
  - Find recipes using this ingredient
  - Queue them for recompute

Step 8: Update KB
  - Add to dimension reference if any new tertiary descriptor learned
  - Add to calibration rules if new invariant observed
```

### Session: Enhancing an existing ingredient

```
Step 1: Audit current state
  - Fetch current potency + chem + source + confidence
  - Check against calibration rules
  - Compare against peers

Step 2: Identify gaps
  - Missing chem properties?
  - Dims at 0 that should be non-zero?
  - Values that violate invariants?
  - Low confidence source?

Step 3: Research
  - Consult trusted data sources
  - Check for new Wageningen matches
  - Look at similar ingredients for peer context

Step 4: Propose changes
  - Show before/after for admin review
  - Provide reasoning for each changed dim

Step 5: Apply (after approval)
  - Update potency array
  - Record admin_override if manual
  - Update source + confidence
  - Log change

Step 6: Recompute recipes
Step 7: Update KB
```

### Session: Adding an interaction rule

```
Step 1: Identify the phenomenon
  - Describe in plain English (e.g., "acid curdles cream above X% concentration")

Step 2: Classify
  - Which tier? (perceptual, physical, temporal, carrier, emergent, clash)
  - Dim-to-dim, ingredient pair, or category pair?

Step 3: Build the dose curve
  - Identify key data points: trace, moderate, peak, overwhelming
  - Experiment/literature check for thresholds
  - Piecewise linear approximation

Step 4: Declare stabilizers / exceptions
  - What neutralizes the rule?
  - What ingredients override it?

Step 5: Add to DB
  - Insert to SensoryInteractionRule (or FlavorClashRule, etc.)
  - Include full doseCurve JSON
  - Cite sources

Step 6: Test
  - Find recipes affected by this rule
  - Recompute + verify results make sense
  - Add to regression fixtures if high-impact

Step 7: Update KB
  - Add to interaction examples
  - Update calibration rules if relevant
```

### Automated session (mini handoff — Phase 9)

```
Every night:
1. Discover gaps (empty dims, missing chem, etc.)
2. Run gpt-4.1-mini batch generation with anchors
3. Run invariant checks on proposed changes
4. High-confidence + rule-compliant → auto-apply with log
5. Low-confidence or rule-violating → queue for admin review
6. Track drift from anchors + adjust generator prompt if systematic
7. Generate session report for admin dashboard
```

---

## 13. Quality Systems

### Regression test suite

Stored in `SensoryRegressionFixture` — a locked set of 20-30 "gold standard" recipes with expected profiles, tolerances, archetypes, and harmony scores.

**Pre-commit check**: any PR that touches sensory code must pass regression tests.

Sample fixtures:
```
Recipe: "Braised Short Ribs"
Expected:
  Umami: 0.95 ± 0.10
  Rich: 0.75 ± 0.10
  Silky: 0.70 ± 0.10
  Fermented: 0.25 ± 0.10 (from wine)
Expected archetype: "braised short ribs"
Expected harmony: 0.85+ (well-harmonized classic)

Recipe: "Grilled Cheese"
Expected:
  Creamy: 0.55 ± 0.10
  Silky: 0.55 ± 0.10
  Rich: 0.55 ± 0.10
  Crispy: 0.30 ± 0.10 (from grill + butter)
Expected archetype: "grilled cheese"
```

### Drift detection

**Nightly job** compares current profiles vs last 7 days:
- Any recipe where profile changed > 20% on any dim → flag
- Flagged changes grouped by potential cause (rule change, ingredient update, cooking transform change)
- Admin dashboard shows "Drift alerts" section

### Rule versioning

Every rule change snapshotted to `RuleVersion`:
- Who changed
- Before/after JSON
- Reason
- Timestamp

Allows:
- Point-in-time rollback
- "Which rule caused this recipe's drift?"
- Historical analysis

Recipes store `computedByRulesetVersion` — the version of the rule set used to compute their current profile. When rule set upgrades, recipes can be batch-recomputed against the new version.

### Confidence aggregation

Recipe-level confidence derived from:
```
recipe_confidence = weighted_avg(
  ingredient_confidences × mass_fractions,
  rule_confidences,
  data_source_reliability_tiers
)
```

Displayed in admin UI so we know which recipes to trust.

### Invariant enforcement

Every write to `IngredientSensoryProfile.potency` checks `CalibrationRule` records for the ingredient's category. Violations:
- **Error-severity**: block the write, return actionable message
- **Warning-severity**: allow with warning logged

### Audit logging

Every change logged to `IngredientChangeLog`:
- Who changed what (human admin / claude / gpt-4.1-mini)
- Before/after
- Reason
- Rule changes logged to `RuleVersion`

### Orphan detection

Weekly scan:
- Ingredients referenced by recipes but missing profiles → flag
- Rules referencing missing ingredients/categories → flag
- Recipes with no profile → queue for compute

---

## 14. Additional Systems — The 22 Gap Items

Each of the 22 items identified in the gap analysis, with implementation detail.

### Sensory Model Additions (1-5)

#### 1. Aftertaste / Finish profile

**What**: a simplified 8-dim profile representing the LINGERING character after swallowing, distinct from the main profile.

**Schema**: `Recipe.aftertasteProfile Float[8]`

**Dimensions** (aftertaste-specific):
- `finishSweet` - residual sweetness
- `finishBitter` - bitter finish (common with coffee, dark chocolate)
- `finishUmami` - savory persistence
- `finishAstringent` - drying finish (tannins)
- `finishWarming` - lingering heat/alcohol
- `finishCooling` - lingering mint/camphor
- `finishAromatic` - aroma persistence (wine "length")
- `finishComplexity` - layered finish (evolving)

**Computed in Step 13 of pipeline**:
- Derived from compounds known to persist (tannins, capsaicin, menthol, certain aromatics)
- Weighted by ingredient composition + cooking method
- Hot cooked foods have longer aromatic finish than cold preparations

**Used for**: matching users who care about "long finish" vs "clean finish"; describing dishes.

#### 2. Body / Weight (#112)

**What**: perceptual heaviness in the mouth and stomach, distinct from Rich.
- **Rich** = intensity + satiety + fat complexity
- **Body** = actual heaviness, viscosity, substance

Examples:
- Consommé: Rich=2, Body=1 (intense but light)
- Stew: Rich=4, Body=5 (heavy)
- Fondue: Rich=6, Body=5 (both)
- Sorbet: Rich=0, Body=0 (light)
- Ice cream: Rich=5, Body=3 (rich but still light)

**Computed in Step 14**:
```
body = f(fat%, protein%, starch%, viscosity, portion_density)
```

#### 3. Course / Phase tag

**What**: where the recipe fits in a meal.

**Schema**: `Recipe.courseType String?` — enum: "starter" | "main" | "side" | "dessert" | "snack" | "beverage" | "sauce" | "base"

**Detection**:
- Keyword-based from recipe title/tags
- Archetype matching (known dish types have known courses)
- Size/portion heuristic (small serving + sweet = dessert; large + protein = main)

**Used for**: meal planning search, time-of-day filters.

#### 4. Intensity / Balance / Complexity metrics (derived)

**What**: three scalar metrics derived from the profile.

- **Intensity**: sum of top 5 dim values (how LOUD is the dish)
- **Balance**: 1 - std_dev(dim_values) / max_value (how EVEN is the distribution)
- **Complexity**: count of dims with value > 1 (how MANY flavors)

Computed in Step 15. Stored on Recipe for fast search filters.

**Used for**:
- "Give me a simple dish" (low complexity)
- "Well-balanced" (high balance)
- "Something intense" (high intensity)

#### 5. Order / Stacking effects (documented formally)

Already in Tier 3 but needs formal documentation of:
- How timing rules stack
- Which rule wins if multiple fire
- Priority: explicit rule > category rule > generic rule

### Interaction Model Gaps (6-10)

#### 6. Order effects formalized

Rules in `SensoryInteractionRule` with `tier="temporal"` and `ruleType="temporal"`. Evaluated in pipeline Step 8. Uses instruction parsing from `instruction-parser.service.ts` to determine when each ingredient was added.

Example rule structure:
```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "garlic",
  "doseCurve": [
    { "dose": 1, "effect": -0.5, "condition": "cook_time_minutes > 10" },  // mellows
    { "dose": 1, "effect": +0.3, "condition": "cook_time_minutes < 2" }    // sharp
  ],
  "effectDim": 52,  // Allium
  "description": "Garlic mellows with prolonged cooking"
}
```

#### 7. Reduction / concentration dynamics

As liquid reduces, flavors concentrate non-linearly. Modeled as:
```typescript
// In cooking-transform or reduction-dynamics service
if (cookingContext.includes('reduce')) {
  const reductionRatio = initial_liquid / final_liquid;
  for (const ingredient of liquidBasedIngredients) {
    const nonlinearConcentration = Math.pow(reductionRatio, 0.7);
    ingredient.potency = ingredient.potency.map(v => v * nonlinearConcentration);
  }
  // Also concentrate Umami, Sweet more than others
}
```

#### 8. Marinade transfer model

Only a portion of marinade flavor transfers to the ingredient:
```
transfer_rate = f(marinade_time, marinade_salt_content, meat_surface_area, temperature)
- 30 min marinade: ~15% transfer
- 2 hours: ~35% transfer
- 4+ hours: ~50% transfer
- With salt ≥ 1%: adds brining effect (more moisture retention, deeper flavor)
```

New service: `marinade-transfer.service.ts` — called in pipeline when recipe includes marinating step.

#### 9. Freezing / chilling effects on texture

Applied as texture transforms when recipe is served cold:
- Frozen: ice crystal damage to previously-silky textures (Silky -1, Grainy +0.5)
- Cold: suppresses aroma by 30%
- Chilled cooking reductions: concentrate richness, set textures

#### 10. Alcohol burn-off model

During simmering/cooking, ethanol evaporates:
```
alcohol_remaining(t) = initial * exp(-k*t)
where k depends on surface area, temperature, and time
```

Typical retention:
- Flambé: 75%+ remains
- 15 min simmer: 60%
- 1 hour simmer: 25%
- 2+ hour simmer: <10%

Updates `Warming` and `Alcoholic` dims dynamically.

### Search/UX Gaps (11-14)

#### 11. Substitution queries

**Endpoint**: `GET /api/recipes/:id/substitute-ingredient?name=X`

**Algorithm**:
1. Find ingredient X in recipe, get its potency + role + chem properties
2. Query ingredients with similar potency (vector similarity on IngredientSensoryProfile.potency)
3. Filter by same role (PROTEIN → PROTEIN, AROMATIC → AROMATIC)
4. Filter by compatible cooking properties (can X's replacement withstand the recipe's cooking method?)
5. Rank by similarity + role match + cook compatibility
6. Return top 5 with explanation

**Use cases**:
- "I don't have parmesan" → grana padano, pecorino, aged cheddar
- "Vegan substitute for heavy cream" → cashew cream, coconut cream, oat cream
- "Dairy-free ricotta" → silken tofu, cashew cheese

#### 12. Negative / avoidance queries

Natural language: "rich but NOT cheesy"

**Parser**:
- Detects "not", "without", "avoid", "except"
- Next descriptor becomes avoidance filter
- Added to target vector as negative weight
- Pre-filter removes matches above avoidance threshold

**Schema support**: `UserSensoryPreference.avoid String[]` — user-level permanent avoidances.

#### 13. Intensity scaling

Modifiers: "very", "slightly", "not too", "mostly", "lightly".

**Parser**:
```
"very spicy" → Spicy target weight ×1.3
"slightly spicy" → Spicy target weight ×0.5
"not too spicy" → Spicy avoidance with soft threshold
```

Combined with descriptor resolution for full natural-language parsing.

#### 14. Complement queries

**Endpoint**: `GET /api/ingredients/:name/complements`

**Algorithm**:
1. Find all synergy pairs involving the ingredient
2. Find all emergence patterns where ingredient is a trigger
3. Rank by frequency in classical patterns
4. Return top pairings with "why they go together" explanation

**Use cases**:
- "What pairs with lamb?" → mint, rosemary, garlic, yogurt, pomegranate
- "What goes with chocolate?" → coffee, chili, orange, salt

### Data Management Gaps (15-18)

#### 15. Rule versioning

Already covered in Section 13 (Quality Systems). Every rule change snapshotted to `RuleVersion` table.

#### 16. Regression test fixtures

Already covered in Section 13. Locked `SensoryRegressionFixture` records with expected profiles + tolerances.

#### 17. Drift detection

Already covered in Section 13. Nightly job comparing current vs expected.

#### 18. Confidence aggregation

Already covered in Section 13. Weighted derivation from ingredient + rule + source confidences.

### Contextual / Cultural Gaps (19-21)

#### 19. Cuisine attribution

**On recipes**: `Recipe.cuisineTags String[]` — ["italian", "mediterranean"]

**On rules**: 
- `FlavorClashRule.cultures` — which cultures consider the clash valid
- `CombinationEmergence.cuisineContext` — which cuisine is the classical home of the pattern

**Detection** on new recipes:
- Keyword matching on title/description
- Ingredient profile matching (tomato+basil+olive oil → Italian)
- User-provided tags

**Used for**:
- Cuisine-specific harmony score
- "Italian night" meal planning
- Cultural filter in search

#### 20. Seasonal context

**On recipes**: `Recipe.seasonalContext String[]` — ["spring", "summer"]

**Detection**:
- Ingredient-based: recipes with asparagus → spring; watermelon → summer
- Cooking method: braising → fall/winter; grilling → summer
- Cuisine-specific seasonal traditions

**Used for**: seasonal recipe recommendations (show "summery" recipes in summer).

#### 21. Dietary overlay

Recipes have dietary tags (vegan, vegetarian, gluten-free, keto, paleo, halal, kosher, etc.) — already partially in schema.

**Interaction with sensory**:
- Vegan grilled cheese has different expected sensory profile than traditional
- Low-fat adaptations have different Rich/Body targets
- Sugar-free desserts need different Sweet calibration

**Handling**:
- Each dietary variant can have alternate archetype with adjusted expected profile
- Substitution queries prioritize dietary-compatible replacements
- Tagging lets users filter by diet + sensory preferences together

### Chemistry Expansion (22)

#### 22. Pairwise chemistry matrix

**What**: systematic table of ingredient pairs and their physical/chemical interactions, beyond just acid-dairy.

**Schema**: `PhysicalInteractionRule` table (Section 9) has generic structure for ALL chemistry interactions.

**Examples to seed**:
- Tannin × Protein: binding (wine + steak); mild Astringent reduction
- Enzyme × Protein: tenderization (pineapple + meat)
- Starch × Fat: emulsion stabilization (roux, beurre manié)
- Calcium × Oxalate: bitter/chalky (spinach + dairy)
- Polyphenol × Iron: metallic (black tea + iron-rich food)
- Acid × Baking soda: leavening (CO2 production)
- Egg × Heat: coagulation (custard setting)
- Gelatin × Cold: gelation (aspic, panna cotta)

Each has its own dose curve and context requirements.

---

## 15. Gaps & Future Work

### Deferred for post-v1

- **Multi-modal matching**: incorporating visual (color palette) and aural (crunch sound) into recipe matching
- **Temporal complexity profiles**: how flavor EVOLVES during a meal / across bites
- **Palate fatigue modeling**: strong one-note dishes become less noticed; complex stay interesting
- **Dietary-compatible archetype variants**: separate archetypes for vegan / gluten-free / keto adaptations
- **Ingredient substitution marketplace**: user-contributed substitutions with ratings
- **Seasonal recipe rotation**: automated meal plan rotation based on season
- **Voice-first search**: speech-to-text for hands-free recipe querying
- **Shopping list from sensory search**: "I want to cook something creamy tonight" → shopping list

### Research questions

- How well do our archetypes match REAL trained panel data? (need a validation study)
- What's the actual AI-to-Wageningen correlation on our 56 panel-validated items?
- How much does user preference vector drift over time? (study longitudinally)
- Do users actually benefit from harmony score, or just similarity?

### Known limitations

- The system is **Western-cuisine-biased** in its initial seed (more Italian/French emergences than Asian/African)
- Tier 2 physical rules require chem property data; only ~15% of ingredients have verified chem data currently
- User-specific harmony requires enough like/dislike data to be meaningful (cold start problem)
- Some dims are inherently subjective (what counts as "Elegant"?) — document as heuristic, not law

---

## 16. Glossary

- **Anchor**: a calibration reference ingredient whose dims are manually validated and locked. Every AI-generated profile is aligned to anchor values.

- **Archetype**: an expected sensory profile for a known dish type. Used to validate computed profiles (grilled cheese archetype has known Creamy + Silky + Rich values).

- **Calibration rule**: a category-level invariant that every ingredient in that category must satisfy (e.g., "aged cheese MUST have Fermented ≥ 2").

- **Chemesthetic**: physical sensations from the trigeminal nerve, not true taste (spicy, cooling, astringent, numbing).

- **Clash**: a combination of ingredients/dims that lowers perceived pleasantness without changing the sensory profile itself. Contributes to harmony score penalty.

- **Descriptor**: a natural-language term users might type ("funky", "zesty") that maps to a weighted combination of dimensions.

- **Dose curve**: piecewise linear function describing how an interaction's effect varies with ingredient dose.

- **Emergence**: a classical flavor combination that produces MORE than the sum of parts (caprese, dashi stack, mirepoix). Adds dim boosts + harmony bonus.

- **Harmony score**: 0-1 measure of how well the recipe's combinations work. Separate from raw sensory profile.

- **Invariant**: a rule that MUST hold. Enforced before DB writes.

- **Kokumi**: Japanese term for "mouthfulness" / "continuation taste" / "broth-like depth". Fifth-receptor-type taste (CaSR).

- **Oleogustus**: fatty taste, distinct receptor-based sense (CD36). Called "Fatty" in our dim set.

- **Potency**: 113-dim array representing an ingredient's sensory signature. Values 0-6 (except Temperature -6 to 6).

- **Stevens' Power Law**: psychophysical law — perception of intensity follows a power function of stimulus. Exponents ~0.6-1.5 depending on dimension.

- **Synergy**: multiplicative combination (umami × umami, salt × sweet). Distinct from enhancement (additive).

- **Tier** (of interaction): the 6 levels of interaction rules. 1=perceptual, 2=physical, 3=temporal, 4=carrier, 5=emergent, 6=clash.

- **Tertiary descriptor**: specific term in vocabulary (e.g., "grapefruit" — maps to Citrusy+Bitter+Fresh combination).

- **Volatile timing curve**: how an aromatic compound's intensity changes over cooking time (peaks + half-lifes).

- **Wageningen SVT**: Sensory Vocabulary Test dataset — 627 foods evaluated by trained human panels. Our ground truth for 6 core taste dims.

---

## 17. Changelog

### 2026-04-21 — v1.0 (initial comprehensive KB)
- Document created with 17 sections covering full system
- 113 dimensions documented (added Body as #112)
- 6-tier interaction model formalized
- Dose-response system specified
- 3-pass harmony score defined
- 22 gap items addressed
- Session workflow documented

### 2026-04-24 — v1.1 (implementation complete, all 9 phases)

**Implementation summary — every phase in the plan is now live:**

**Phase 0**: Knowledge base (2240 lines master KB + 1213-line dim reference +
520-line calibration rules + 3196-line interaction examples + CLAUDE.md workflow
triggers)

**Phase 1**: Schema applied to Azure production DB. 11 new tables in `catalog`
(PhysicalInteractionRule, FlavorClashRule, CombinationEmergence,
DimensionDoseThreshold, SensoryDescriptor, CalibrationRule, IngredientChangeLog,
RuleVersion, SensoryRegressionFixture) + 2 in `meal` (UserSensoryPreference,
RecipePreferenceMatch). Enhanced SensoryInteractionRule with tier + dose curves.
Enhanced SensoryDimensionConfig with primaryCategory, parentFamily, tier, scale
bounds, keywords, anchors, descriptors. Enhanced Recipe with 20+ fields:
sensoryVector(113), aftertasteProfile, bodyWeight, harmonyScoreUniversal,
harmonyScoreCuisine, detectedClashes, detectedEmergences, dominantArchetype,
cuisineTags, courseType, seasonalContext, balance/complexity/intensityScore,
10 search flags.

**Phase 2**: Core seed data in production:
- 113 sensory dimensions (with mechanism, anchors, descriptors, Stevens exponents)
- 120 calibration rules across 22 categories (68 error / 52 warning)
- 72 interaction rules: Tier 1 (23) + Tier 2 (5) + Tier 3 (4) + Tier 4 (4) +
  Tier 5 (10 emergences) + Tier 6 (11 clashes)
- 15 dose thresholds
- 246 natural-language vocabulary descriptors
- 10 emergence patterns (mirepoix, sofrito, dashi_stack, caprese,
  brown_butter, caramelized_onion, etc.)

**Phase 3**: Real chemistry data:
- 97 new USDA ingredient mappings (144 → 241 mapped)
- Chem properties (protein, fat, sugar, fiber, water) pulled from USDA for
  newly-mapped ingredients
- 6 match strategies (exact, alias, normalized, reorder, fuzzy, manual-queue)

**Phase 4**: 17-step computation engine (`sensory-compound-v2.service.ts`, 987
lines). Handles: potency lookup with alias fallback, dose analysis, Tier 1
perceptual rules, Tier 4 carriers, emergence detection, clash detection,
aftertaste computation, body computation, derived metrics, 3-pass harmony.
All 19 recipes in production have v2 profiles (computedByRulesetVersion=2).

**Phase 5**: User-facing search:
- Natural-language query parser with modifiers (very/slightly/not/without)
- Recipe matching with cosine similarity + harmony + personal boost
- /api/sensory/search POST endpoint
- /api/sensory/similar/:recipeId
- /api/sensory/substitutes/:ingredient (cosine sim on ingredient profiles)
- /api/sensory/complements/:ingredient (merges synergy pairs + emergences)

**Phase 6**: Quality systems:
- SensoryRegressionFixture with auto-generated tolerances (15% or 0.3 min)
- `sensory-regression-cli.ts` with --bootstrap/--run/--drift/--list commands
- 10 fixtures bootstrapped from top-harmony production recipes, all pass
- Drift detection against current profiles (threshold-based, 3 severity levels)

**Phase 7**: User preferences:
- 15-question onboarding survey covering spicy/sweet/rich/texture/cuisine prefs
- Implicit learning: likes/dislikes → weighted avg of profile deltas
- Hybrid blending (onboarding × behavior), 60/40 ratio after 5+ likes
- /api/sensory/preferences/* CRUD endpoints
- Personal boost applied automatically in findRecipesByQuery

**Phase 9**: AI autonomous gap-filler:
- gpt-4.1-mini for bulk generation under 5-layer safeguards
- Never overwrites admin/manual_expert/wageningen_panel (protected sources)
- 22-category regex classifier maps to calibration rules
- Confidence gating: ≥0.85 auto-apply, below queued for admin review
- All changes logged to IngredientChangeLog with AI reasoning + source anchors
- 344 gaps identified (mostly v1-era profiles needing expansion to 113 dims)
- CLI: `run-sensory-enhancement.ts` with --dry-run/--limit/--category

**File inventory** (all committed to production, Function-Dev branch):
```
docs/sensory-compound-knowledge-base.md        (this file)
docs/sensory-dimension-reference.md            (1213 lines)
docs/sensory-calibration-rules.md              (520 lines)
docs/sensory-interaction-examples.md           (3196 lines)
server/prisma/schema.prisma                    (enhanced)
server/prisma/migrations/20260421000000_sensory_system_v2_phase1/
server/prisma/migrations/20260421000001_dimension_config_v2/
server/src/services/sensory-compound-v2.service.ts      (pipeline)
server/src/services/sensory-query-parser.service.ts    (NLQ)
server/src/services/sensory-match.service.ts           (search)
server/src/services/sensory-regression.service.ts      (quality)
server/src/services/user-sensory-preference.service.ts (prefs)
server/src/services/sensory-ai-enhancer.service.ts     (AI gap-filler)
server/src/routes/sensory-search.routes.ts
server/src/routes/sensory-preference.routes.ts
server/src/scripts/seed-dimensions-v2.ts
server/src/scripts/seed-interaction-rules-v2.ts
server/src/scripts/seed-calibration-rules.ts
server/src/scripts/seed-vocabulary.ts
server/src/scripts/expand-usda-mappings.ts
server/src/scripts/test-sensory-v2.ts
server/src/scripts/test-sensory-query.ts
server/src/scripts/sensory-regression-cli.ts
server/src/scripts/run-sensory-enhancement.ts
```

### Ongoing
- Each session adds entries here: date, what changed, why

---

**End of Knowledge Base.**

For quick reference during a session, see:
- [sensory-dimension-reference.md](sensory-dimension-reference.md) — 1-entry-per-dim
- [sensory-calibration-rules.md](sensory-calibration-rules.md) — per-category invariants
- [sensory-interaction-examples.md](sensory-interaction-examples.md) — worked rule examples


