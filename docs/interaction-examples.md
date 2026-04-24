# Sensory Interaction Examples — Worked Rule Catalog

> **Last Updated**: 2026-04-22 | **Status**: Developer reference | **Version**: 1.0
>
> Companion to [sensory-compound-knowledge-base.md](sensory-compound-knowledge-base.md).
> This document provides concrete, fully-specified JSON examples of every rule type across the 6 tiers of the sensory interaction model. Use it as a reference when authoring new rules, when training AI agents to propose rules, or when debugging unexpected profile outputs.

**Related docs**:
- [Sensory Compound Knowledge Base](sensory-compound-knowledge-base.md) — master reference; schema and architecture
- [Sensory Dimension Reference](sensory-dimension-reference.md) — 1-entry-per-dim quick lookup
- [Sensory Calibration Rules](sensory-calibration-rules.md) — per-category invariants
- [Cooking Science Model](cooking-science-model.md) — transforms referenced by `requiresMethod`

**Conventions used in this document**:
- All examples are shown as complete JSON objects ready to seed via `seed-sensory-rules.ts`.
- `doseCurve` arrays follow `[{ "dose": number, "effect": number }, ...]` with doses in ascending order. The engine linearly interpolates between anchor points and clamps below the first / above the last.
- Dimension names are written as strings (`"Sweet"`, `"Allium"`) for readability. The seed script resolves them to indices (0-112) from `constants/sensory-dimensions.ts`.
- `why this matters` prose follows every rule and explains mechanism + when it fires + the shape of the curve in plain English.

---

## Table of Contents

1. [Tier 1 — Perceptual Dimension Math](#tier-1--perceptual-dimension-math)
   - [1.1 reinforce](#11-reinforce-same-dim-stacking)
   - [1.2 enhance](#12-enhance-additive-amplification)
   - [1.3 mask](#13-mask-suppression)
   - [1.4 synergy](#14-synergy-multiplicative)
2. [Tier 2 — Physical / Chemical Interactions](#tier-2--physical--chemical-interactions)
3. [Tier 3 — Temporal / Order Effects](#tier-3--temporal--order-effects)
4. [Tier 4 — Carrier Effects](#tier-4--carrier-effects)
5. [Tier 5 — Emergent Patterns](#tier-5--emergent-patterns)
6. [Tier 6 — Clashes](#tier-6--clashes)
7. [How to use these examples](#how-to-use-these-examples)
   - [Copy / modify workflow](#copy--modify-workflow)
   - [Seed script pattern](#seed-script-pattern)
   - [Testing a new rule](#testing-a-new-rule)
   - [Decision tree: which tier?](#decision-tree-which-tier)

---

# Tier 1 — Perceptual Dimension Math

Tier 1 rules describe how two sensory dimensions combine **at the perception level**. No chemistry is modeled — these rules encode how the human brain/tongue integrates concurrent sensory input. Evaluated in pipeline Step 6 after ingredient doses have been resolved and cooking transforms applied.

**Schema target**: `SensoryInteractionRule` with `tier: "perceptual"`.

**Rule types**:
- `reinforce` — two doses of the same dim stack sub-linearly (Stevens' Power Law; `ψ = k·I^n`, n ≈ 0.6-1.4 depending on modality).
- `enhance` — one dim additively boosts another's perceived intensity (salt enhances sweet).
- `mask` — one dim suppresses another's perceived intensity (sweet masks bitter).
- `synergy` — multiplicative gain (umami × umami, up to ~8x measured in panel studies).

Evaluation order inside Tier 1: `reinforce` first (self-saturation), then `enhance` (additive), then `mask` (subtractive), then `synergy` (multiplicative). This order matters because masking and enhancement modify inputs the synergy rule then multiplies.

---

## 1.1 reinforce (same-dim stacking)

When two ingredients both contribute to the same dimension, the perceived total is less than the linear sum. Stevens' Power Law governs the compression. Reinforce rules declare an exponent `n` (<1 = compressive, >1 = expansive) that replaces naive additive summation for that dim.

### Example 1.1.1 — Sweet self-reinforcement (compressive)

```json
{
  "tier": "perceptual",
  "ruleType": "reinforce",
  "dimA": "Sweet",
  "dimB": "Sweet",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.50 },
    { "dose": 1.0, "effect": 0.95 },
    { "dose": 2.0, "effect": 1.68 },
    { "dose": 3.0, "effect": 2.28 },
    { "dose": 4.0, "effect": 2.78 },
    { "dose": 5.0, "effect": 3.20 },
    { "dose": 7.0, "effect": 3.86 },
    { "dose": 10.0, "effect": 4.46 }
  ],
  "doseUnit": "sum_of_dim_contributions",
  "effectType": "cap",
  "effectDim": "Sweet",
  "maxEffect": 5.0,
  "description": "Sweet self-reinforcement using Stevens' Power Law exponent n=0.8. A recipe with sugar(3.0) + honey(2.0) perceives Sweet ≈ 3.86, not 5.0.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: naive summation over-predicts compound sweetness. Panel studies (Moskowitz 1970; ASTM E253) show sweet perception saturates around `ψ = k·I^0.8`. A cheesecake listing 40g sugar + 15g honey + 5g vanilla extract (sweet contributions ≈ 4, 2, 0.3) should taste around Sweet=5.1, not Sweet=6.3. Without a reinforce rule, dessert recipes over-score on Sweet and clash detection fires false positives. `[citation: Stevens, S.S. (1957) "On the psychophysical law", Psych Review 64(3)]`

---

### Example 1.1.2 — Spicy self-reinforcement (expansive; cumulative burn)

```json
{
  "tier": "perceptual",
  "ruleType": "reinforce",
  "dimA": "Spicy",
  "dimB": "Spicy",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.55 },
    { "dose": 1.0, "effect": 1.15 },
    { "dose": 2.0, "effect": 2.45 },
    { "dose": 3.0, "effect": 3.85 },
    { "dose": 4.0, "effect": 5.35 },
    { "dose": 5.0, "effect": 6.90 }
  ],
  "doseUnit": "sum_of_dim_contributions",
  "effectType": "cap",
  "effectDim": "Spicy",
  "maxEffect": 6.5,
  "description": "Spicy uses exponent n=1.1 (mildly expansive) to model TRPV1 temporal summation: repeated capsaicin exposure accumulates rather than saturating.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: capsaicin does not desensitize within a single eating session — the opposite, successive bites build heat. A recipe with chili flakes + fresh jalapeño + chili oil should perceive stronger than the sum. Using `n=1.1` lets a dish with three moderate heat sources (each 1.5) score ~5.3 instead of 4.5. The cap at 6.5 prevents runaway in ghost-pepper recipes where realistic human tolerance tops out. `[citation: Green, B.G. (1989) "Capsaicin sensitization and desensitization", Pain]`

---

### Example 1.1.3 — Umami self-reinforcement (near-linear until synergy kicks in)

```json
{
  "tier": "perceptual",
  "ruleType": "reinforce",
  "dimA": "Umami",
  "dimB": "Umami",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.50 },
    { "dose": 1.0, "effect": 1.00 },
    { "dose": 2.0, "effect": 1.95 },
    { "dose": 3.0, "effect": 2.85 },
    { "dose": 4.0, "effect": 3.70 },
    { "dose": 5.0, "effect": 4.50 }
  ],
  "doseUnit": "sum_of_dim_contributions",
  "effectType": "cap",
  "effectDim": "Umami",
  "maxEffect": 5.0,
  "description": "Umami uses exponent n=0.95 (near-linear) so that the multiplicative synergy rule (1.4.1) does the lifting when glutamate and inosinate co-occur.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: umami reinforcement is deliberately kept near-linear because the real non-linearity is between glutamate and 5'-ribonucleotides (IMP, GMP) — that belongs in a synergy rule, not a reinforce rule. If reinforce compressed umami too aggressively, the synergy multiplier would fight it and two dashi recipes with different L/N ratios would score nearly identically.

---

### Example 1.1.4 — Bitter self-reinforcement (strongly compressive)

```json
{
  "tier": "perceptual",
  "ruleType": "reinforce",
  "dimA": "Bitter",
  "dimB": "Bitter",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.55 },
    { "dose": 1.0, "effect": 0.95 },
    { "dose": 2.0, "effect": 1.55 },
    { "dose": 3.0, "effect": 2.00 },
    { "dose": 5.0, "effect": 2.65 },
    { "dose": 8.0, "effect": 3.30 }
  ],
  "doseUnit": "sum_of_dim_contributions",
  "effectType": "cap",
  "effectDim": "Bitter",
  "maxEffect": 4.0,
  "description": "Bitter uses exponent n=0.65 (strongly compressive). Human bitter receptors (T2R family) desensitize quickly; total perceived bitterness from kale + coffee + radicchio plateaus sharply.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: if bitter summed linearly, a puntarelle salad with radicchio + dandelion greens + olive tapenade would score Bitter=6+ and the harmony engine would flag it as intolerable. In reality diners perceive it as "pleasantly bitter", around 3. The compressive curve respects T2R desensitization kinetics. `[citation: Meyerhof et al. (2010) "The molecular receptive ranges of human TAS2R bitter taste receptors", Chem Senses 35:157]`

---

### Example 1.1.5 — Citrusy self-reinforcement (aroma dims)

```json
{
  "tier": "perceptual",
  "ruleType": "reinforce",
  "dimA": "Citrusy",
  "dimB": "Citrusy",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.50 },
    { "dose": 1.0, "effect": 0.90 },
    { "dose": 2.0, "effect": 1.55 },
    { "dose": 3.0, "effect": 2.05 },
    { "dose": 5.0, "effect": 2.80 },
    { "dose": 8.0, "effect": 3.45 }
  ],
  "doseUnit": "sum_of_dim_contributions",
  "effectType": "cap",
  "effectDim": "Citrusy",
  "maxEffect": 4.0,
  "description": "Citrusy (limonene, citral, linalool congeners) uses exponent n=0.7. Multiple citrus sources overlap in aromatic receptor activation so perception compresses.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: a recipe with lemon juice + lime zest + orange peel has three overlapping citrus aroma contributions but perceptually reads as "citrus-forward" rather than "3x citrus". The compressive curve prevents over-scoring and keeps cocktail recipes, ceviches, and citrus-marinated proteins realistic.

---

## 1.2 enhance (additive amplification)

One dim additively lifts another. Unlike synergy (multiplicative), enhance adds a fixed amount to the target dim regardless of the target's current level. The dose curve controls magnitude as a function of the *enhancer's* dose. Common pattern: trace levels give the strongest boost, higher doses plateau or reverse.

### Example 1.2.1 — Salt enhances Sweet (bump-then-decline)

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Salty",
  "dimB": "Sweet",
  "doseCurve": [
    { "dose": 0.0005, "effect": 0.05 },
    { "dose": 0.001,  "effect": 0.12 },
    { "dose": 0.003,  "effect": 0.28 },
    { "dose": 0.005,  "effect": 0.35 },
    { "dose": 0.010,  "effect": 0.30 },
    { "dose": 0.015,  "effect": 0.15 },
    { "dose": 0.020,  "effect": 0.00 },
    { "dose": 0.030,  "effect": -0.25 }
  ],
  "doseUnit": "percent_mass",
  "effectType": "add",
  "effectDim": "Sweet",
  "maxEffect": 0.5,
  "description": "Trace salt (0.3-0.5% of mass) amplifies Sweet perception; above 1.5% salt starts masking sweet.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true,
  "stabilizers": [],
  "requiresMethod": []
}
```

**Why this matters**: every baker's "pinch of salt" trick. At 0.3-0.5% of dough mass, sodium ions suppress bitter receptors and open sweet perception; higher than 1.5% mass, salinity competes with sweet and the effect inverts. Without this rule, salted caramel recipes score Sweet too low and flag as "unbalanced sweet" in harmony detection. `[citation: Breslin & Beauchamp (1995) "Suppression of bitterness by sodium", Chem Senses 20]`

---

### Example 1.2.2 — Sour enhances general Aroma perception

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Sour",
  "dimB": "*aroma*",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.05 },
    { "dose": 1.0, "effect": 0.10 },
    { "dose": 2.0, "effect": 0.18 },
    { "dose": 3.0, "effect": 0.20 },
    { "dose": 4.0, "effect": 0.15 },
    { "dose": 5.0, "effect": 0.05 },
    { "dose": 6.0, "effect": -0.10 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "*aroma*",
  "maxEffect": 0.25,
  "description": "Moderate acid (Sour 1-3) lifts perceived aromatic intensity across all aroma families. High acid (>5) competes and depresses perception.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: the "squeeze of lemon" that wakes up a stew, the splash of vinegar on roasted veg, the acid in a ceviche that makes the herbs sing — all observed effects of H+ altering olfactory epithelium perfusion and retronasal airflow. The `*aroma*` wildcard iterates over dims 14-85. Without this rule the system would undervalue acid-finished dishes. `[citation: Djordjevic et al. (2004) "Odor-induced changes in taste perception", Exp Brain Res 159]`

---

### Example 1.2.3 — Fat enhances Warm Sweet Spice

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Fatty",
  "dimB": "Warm Sweet Spice",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.15 },
    { "dose": 1.0, "effect": 0.30 },
    { "dose": 2.0, "effect": 0.50 },
    { "dose": 3.0, "effect": 0.65 },
    { "dose": 4.0, "effect": 0.70 },
    { "dose": 5.0, "effect": 0.70 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Warm Sweet Spice",
  "maxEffect": 0.8,
  "description": "Fat dissolves cinnamaldehyde, eugenol, vanillin and holds them on the palate. Butter + cinnamon perceives ~40% more spice than water + cinnamon.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: the full flavor of cinnamon rolls, chai lattes, eggnog, rice pudding, pumpkin pie — all depend on fat holding warm-spice volatiles in suspension. Without this rule, a low-fat cinnamon-apple compote would score the same as a croissant with cinnamon-sugar, which is clearly wrong to any home cook. `[citation: Roberts & Taylor (2000) "Flavor Release", ACS Symposium 763]`

---

### Example 1.2.4 — Acid enhances Citrusy (zest + juice pairing)

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Sour",
  "dimB": "Citrusy",
  "doseCurve": [
    { "dose": 0.3, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.25 },
    { "dose": 2.0, "effect": 0.40 },
    { "dose": 3.0, "effect": 0.45 },
    { "dose": 5.0, "effect": 0.30 },
    { "dose": 7.0, "effect": 0.10 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Citrusy",
  "maxEffect": 0.5,
  "description": "Citric/malic acid reinforces limonene aroma perception — the retronasal 'citrus punch'. This is why lemon juice + lemon zest scores higher than either alone.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: a vinaigrette made with lemon juice + lemon zest + olive oil tastes "more lemon" than the linear sum because the acid amplifies the terpene perception. Extends general Sour×Aroma rule (1.2.2) with a stronger coefficient for the specific citrusy dim since they share chemical origin.

---

### Example 1.2.5 — Umami enhances Savory Spice

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Umami",
  "dimB": "Savory Spice",
  "doseCurve": [
    { "dose": 1.0, "effect": 0.10 },
    { "dose": 2.0, "effect": 0.25 },
    { "dose": 3.0, "effect": 0.35 },
    { "dose": 4.0, "effect": 0.40 },
    { "dose": 5.0, "effect": 0.40 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Savory Spice",
  "maxEffect": 0.5,
  "description": "Umami amplifies savory-spice (cumin, coriander, smoked paprika, fenugreek) perception. Explains why meat rubs work so well on mushrooms and why vegetable curries benefit from doubled spice.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: without this rule, a vegan chili with soy sauce + mushroom + cumin would score under-spiced compared to a beef chili with the same spice dose, when in reality the umami load bridges the perception gap.

---

### Example 1.2.6 — Heat (temperature) enhances Warm Sweet Spice

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Temperature",
  "dimB": "Warm Sweet Spice",
  "doseCurve": [
    { "dose": 0,  "effect": 0.00 },
    { "dose": 2,  "effect": 0.10 },
    { "dose": 3,  "effect": 0.25 },
    { "dose": 4,  "effect": 0.40 },
    { "dose": 5,  "effect": 0.50 },
    { "dose": 6,  "effect": 0.55 }
  ],
  "doseUnit": "temperature_index",
  "effectType": "add",
  "effectDim": "Warm Sweet Spice",
  "maxEffect": 0.6,
  "description": "Served warm/hot, cinnamon/cloves/cardamom volatiles enter the retronasal stream more readily. Temperature is bipolar (-6..+6); only positive branch fires.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true,
  "requiresTempRange": "warm_or_hotter"
}
```

**Why this matters**: a hot chai scores stronger Warm Sweet Spice than an iced chai of identical composition. The system stores Temperature as a bipolar dim 105; this rule demonstrates how to trigger off it.

---

### Example 1.2.7 — Kokumi enhances Rich (character)

```json
{
  "tier": "perceptual",
  "ruleType": "enhance",
  "dimA": "Kokumi",
  "dimB": "Rich",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.15 },
    { "dose": 1.0, "effect": 0.30 },
    { "dose": 2.0, "effect": 0.55 },
    { "dose": 3.0, "effect": 0.80 },
    { "dose": 4.0, "effect": 0.95 },
    { "dose": 5.0, "effect": 1.00 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Rich",
  "maxEffect": 1.2,
  "description": "Kokumi (γ-glutamyl peptides, CaSR activation) directly projects onto the Rich character dim. Aged cheese, long-braised meats, and soy-based marinades score Rich.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: character dims (Rich, Complex, Body) don't have direct ingredient potencies — they emerge from combinations of sensory input. Kokumi is the primary driver of Rich perception. `[citation: Ohsu et al. (2010) "Involvement of the CaSR in human taste perception", JBC 285]`

---

## 1.3 mask (suppression)

One dim actively reduces perception of another. Mask rules use negative-going effect values. The curve describes how much the *masker's* dose suppresses the target. Masking is bounded — it cannot drive the target below zero; the pipeline clamps.

### Example 1.3.1 — Sweet masks Bitter

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Sweet",
  "dimB": "Bitter",
  "doseCurve": [
    { "dose": 0.5, "effect": -0.05 },
    { "dose": 1.0, "effect": -0.15 },
    { "dose": 2.0, "effect": -0.35 },
    { "dose": 3.0, "effect": -0.55 },
    { "dose": 4.0, "effect": -0.75 },
    { "dose": 5.0, "effect": -0.90 },
    { "dose": 7.0, "effect": -1.10 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Bitter",
  "maxEffect": -1.2,
  "description": "Sucrose/fructose bind at T1R2-T1R3, lateral inhibition suppresses T2R bitter signaling. Sugar in coffee, mole with chocolate, bittersweet dessert glazes.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: foundational to dessert engineering. Dark-chocolate mousse (Bitter 3.5 + Sweet 4) perceives only Bitter ~2.6 because sugar masks ~0.9 of it. Without this rule, bittersweet desserts would score as unpalatable. `[citation: Kroeze & Bartoshuk (1985) "Bitterness suppression as revealed by split-tongue taste stimulation", Physiol Behav 35]`

---

### Example 1.3.2 — Fat masks Spicy (dairy cooling)

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Fatty",
  "dimB": "Spicy",
  "doseCurve": [
    { "dose": 1.0, "effect": -0.10 },
    { "dose": 2.0, "effect": -0.25 },
    { "dose": 3.0, "effect": -0.45 },
    { "dose": 4.0, "effect": -0.65 },
    { "dose": 5.0, "effect": -0.85 },
    { "dose": 6.0, "effect": -1.00 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Spicy",
  "maxEffect": -1.2,
  "description": "Casein and dairy fat sequester capsaicin (hydrophobic), reducing TRPV1 activation. Why yogurt/milk/cream/butter cool spicy dishes.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true,
  "exceptions": ["chili oil"]
}
```

**Why this matters**: encodes the familiar "drink milk with spicy food" effect. A madras curry finished with yogurt scores lower Spicy than the same curry without. Note: this rule deliberately conflicts with the carrier rule (4.1) where fat *delivers* capsaicin to receptors. The pipeline applies carrier first (volatile delivery), then mask (duration of perception). Net: fat increases initial burn but shortens its duration, modeled as carrier+mask composition.

---

### Example 1.3.3 — Sour masks Sweet (at high sour dose)

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Sour",
  "dimB": "Sweet",
  "doseCurve": [
    { "dose": 1.0, "effect": 0.00 },
    { "dose": 2.0, "effect": -0.05 },
    { "dose": 3.0, "effect": -0.20 },
    { "dose": 4.0, "effect": -0.40 },
    { "dose": 5.0, "effect": -0.65 },
    { "dose": 6.0, "effect": -0.90 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Sweet",
  "maxEffect": -1.0,
  "description": "Strong acid suppresses Sweet perception through receptor competition. Sour candies with Sour >5 perceive less sweet than their sugar content suggests.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: a sour-cherry bourbon cocktail with equal sugar and citric acid scores Sweet lower than a Manhattan with the same sugar. Without this rule, Agua Fresca recipes over-predict Sweet.

---

### Example 1.3.4 — Astringent masks Sweet (tannin binding)

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Astringent",
  "dimB": "Sweet",
  "doseCurve": [
    { "dose": 0.5, "effect": -0.05 },
    { "dose": 1.0, "effect": -0.12 },
    { "dose": 2.0, "effect": -0.22 },
    { "dose": 3.0, "effect": -0.30 },
    { "dose": 4.0, "effect": -0.35 },
    { "dose": 5.0, "effect": -0.38 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Sweet",
  "maxEffect": -0.4,
  "description": "Tannins (proanthocyanidins, tea catechins) crosslink salivary proteins, reducing palate lubrication and muting Sweet perception. Why unsweetened tea tastes more bitter than sweetened tea tastes less sweet.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: chocolate + red wine pairing relies on this. Port-wine-plus-dark-chocolate dessert: the tannins partly mask the sugar, producing a less cloying finish. Effect is small (-0.4 max) because tannins are weak maskers compared to salt or acid.

---

### Example 1.3.5 — Fat masks Astringent

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Fatty",
  "dimB": "Astringent",
  "doseCurve": [
    { "dose": 0.5, "effect": -0.10 },
    { "dose": 1.0, "effect": -0.25 },
    { "dose": 2.0, "effect": -0.45 },
    { "dose": 3.0, "effect": -0.70 },
    { "dose": 4.0, "effect": -0.90 },
    { "dose": 5.0, "effect": -1.05 }
  ],
  "doseUnit": "dim_value",
  "effectType": "add",
  "effectDim": "Astringent",
  "maxEffect": -1.2,
  "description": "Fat coats the tongue and salivary proteins, blocking tannin crosslinking. Why cheese + red wine works; why creamy pasta softens a tannic Cabernet.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: fundamental for wine pairing logic. A lamb chop in butter sauce paired with a tannic Cabernet reads smoother than the same wine alone. The system uses this rule (in the pairing algorithm) to suggest fatty dishes for high-tannin wines.

---

### Example 1.3.6 — Salty masks Sour (at trace levels)

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Salty",
  "dimB": "Sour",
  "doseCurve": [
    { "dose": 0.001, "effect": 0.00 },
    { "dose": 0.003, "effect": -0.05 },
    { "dose": 0.005, "effect": -0.10 },
    { "dose": 0.010, "effect": -0.15 },
    { "dose": 0.015, "effect": -0.18 },
    { "dose": 0.025, "effect": -0.15 },
    { "dose": 0.040, "effect": 0.00 }
  ],
  "doseUnit": "percent_mass",
  "effectType": "add",
  "effectDim": "Sour",
  "maxEffect": -0.25,
  "description": "Moderate salt (0.5-2%) mildly suppresses Sour perception via ENaC/H+ receptor cross-talk. High salt loses the effect.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: why a well-seasoned vinaigrette tastes less sharp than the acid alone. Subtle effect but matters for sauce balance. Panel studies show the suppression is modest and narrow.

---

### Example 1.3.7 — Warm temperature masks Sweet (iced coffee paradox)

```json
{
  "tier": "perceptual",
  "ruleType": "mask",
  "dimA": "Temperature",
  "dimB": "Sweet",
  "doseCurve": [
    { "dose": -6, "effect": -0.35 },
    { "dose": -3, "effect": -0.20 },
    { "dose": -1, "effect": -0.10 },
    { "dose":  0, "effect":  0.00 },
    { "dose":  2, "effect":  0.05 },
    { "dose":  4, "effect":  0.10 },
    { "dose":  6, "effect":  0.15 }
  ],
  "doseUnit": "temperature_index",
  "effectType": "add",
  "effectDim": "Sweet",
  "maxEffect": 0.3,
  "description": "Cold temperatures reduce T1R2-T1R3 activation — ice cream tastes less sweet than the same base warmed. Inverse effect at warm.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: explains why commercial ice cream recipes use higher sugar than warm desserts with equivalent perceived sweetness. A recipe scored at room temperature (the default) would over-predict ice cream sweetness without this rule.

---

## 1.4 synergy (multiplicative)

Two dims combine multiplicatively — the effect is the *product* of their doses (within a ceiling), not their sum. Synergy rules produce the largest effects in the Tier 1 system and correspond to the most celebrated pairings in cooking.

### Example 1.4.1 — Umami × Umami synergy (glutamate × nucleotide)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Umami",
  "dimB": "Umami",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.30 },
    { "dose": 1.0, "effect": 1.00 },
    { "dose": 1.5, "effect": 1.80 },
    { "dose": 2.0, "effect": 2.80 },
    { "dose": 2.5, "effect": 3.80 },
    { "dose": 3.0, "effect": 4.60 },
    { "dose": 4.0, "effect": 5.60 },
    { "dose": 5.0, "effect": 6.00 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Umami",
  "maxEffect": 6.0,
  "description": "Glutamate (MSG, tomato, parm, soy) × Inosinate/Guanylate (bonito, mushroom, anchovy) — up to 7-8x perceived vs either alone. Only fires when BOTH sources present (different ingredient origins required).",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true,
  "requiresTriggers": ["glutamate_source", "nucleotide_source"]
}
```

**Why this matters**: the single most important perceptual rule in the entire catalog. Underpins dashi, tomato+parm, shiitake+soy, ragù bolognese, bacon+mushroom, Caesar dressing (anchovy+parm). Without this rule, tomato sauce and dashi would score similarly to their ingredient averages. The `geometric_mean` dose unit means the effect fires strongly only when *both* sources are present above threshold — one alone contributes normally. `[citation: Yamaguchi (1991) "Basic properties of umami and its effects on food flavor", Food Reviews International]`

---

### Example 1.4.2 — Salt × Umami synergy

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Salty",
  "dimB": "Umami",
  "doseCurve": [
    { "dose": 0.3, "effect": 0.15 },
    { "dose": 0.6, "effect": 0.40 },
    { "dose": 1.0, "effect": 0.75 },
    { "dose": 1.5, "effect": 1.10 },
    { "dose": 2.0, "effect": 1.35 },
    { "dose": 3.0, "effect": 1.50 },
    { "dose": 4.0, "effect": 1.45 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Umami",
  "maxEffect": 1.6,
  "description": "NaCl amplifies glutamate perception at the receptor — why salt 'finds' the umami in a soup. Soy sauce (salty+umami) is the iconic example.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: under-salted stew tastes flat even with plenty of meat and mushrooms. This rule formalizes the professional kitchen adage "salt unlocks umami." Peaks at salt ≈ 1-2% of mass — the industry sweet spot.

---

### Example 1.4.3 — Sweet × Sour synergy (sweet-tart bump)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Sweet",
  "dimB": "Sour",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.30 },
    { "dose": 2.0, "effect": 0.60 },
    { "dose": 3.0, "effect": 0.90 },
    { "dose": 4.0, "effect": 1.10 },
    { "dose": 5.0, "effect": 1.20 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Fresh",
  "maxEffect": 1.4,
  "description": "Sweet + sour balance produces the 'Fresh' character boost found in fruit pies, Thai dressings, agrodolce. Feeds character dim, not taste dims.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: the hallmark of a perfectly balanced lemonade, a proper lemon meringue, Thai sweet chili — the balance itself produces an emergent Fresh character, not stronger sweet or stronger sour.

---

### Example 1.4.4 — Fat × Salt synergy (mouthfeel)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Fatty",
  "dimB": "Salty",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.25 },
    { "dose": 2.0, "effect": 0.55 },
    { "dose": 3.0, "effect": 0.80 },
    { "dose": 4.0, "effect": 0.95 },
    { "dose": 5.0, "effect": 1.00 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Rich",
  "maxEffect": 1.2,
  "description": "Salted butter, aged parm, cured charcuterie, salted caramel — fat + salt produces 'Rich' character gain.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: a core synergy in Western cooking. Explains why unsalted butter on bread is flat but salted butter is craveable. Feeds the Rich character dim, not Salty or Fatty.

---

### Example 1.4.5 — Kokumi × Umami synergy (depth multiplier)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Kokumi",
  "dimB": "Umami",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.20 },
    { "dose": 1.0, "effect": 0.55 },
    { "dose": 1.5, "effect": 0.95 },
    { "dose": 2.0, "effect": 1.35 },
    { "dose": 3.0, "effect": 1.80 },
    { "dose": 4.0, "effect": 2.00 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Umami",
  "maxEffect": 2.2,
  "description": "CaSR (kokumi) and T1R1-T1R3 (umami) synergize for depth perception. Aged cheese + long-braised stock + garlic confit produces layered umami greater than the sum.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: separates "umami-strong" (MSG sprinkled on popcorn) from "umami-deep" (a 6-hour beef bourguignon). Kokumi-rich ingredients carry γ-glutamyl peptides that amplify umami through a distinct receptor pathway. `[citation: Ohsu et al. (2010) JBC 285:1016]`

---

### Example 1.4.6 — Sour × Briny synergy (ceviche bump)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Sour",
  "dimB": "Briny",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.30 },
    { "dose": 2.0, "effect": 0.65 },
    { "dose": 3.0, "effect": 0.95 },
    { "dose": 4.0, "effect": 1.10 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Fresh",
  "maxEffect": 1.3,
  "description": "Acid + brine (oysters with mignonette, ceviche, seafood with capers+lemon) produces 'Fresh' character above either alone.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: why ceviche is *more* refreshing than either raw fish or a citrus spritz. Feeds Fresh character dim to help recommender distinguish "light & bright" dishes.

---

### Example 1.4.7 — Complex × Body synergy (stew character)

```json
{
  "tier": "perceptual",
  "ruleType": "synergy",
  "dimA": "Complex",
  "dimB": "Body",
  "doseCurve": [
    { "dose": 1.0, "effect": 0.30 },
    { "dose": 2.0, "effect": 0.70 },
    { "dose": 3.0, "effect": 1.00 },
    { "dose": 4.0, "effect": 1.20 },
    { "dose": 5.0, "effect": 1.30 }
  ],
  "doseUnit": "geometric_mean",
  "effectType": "add",
  "effectDim": "Rich",
  "maxEffect": 1.4,
  "description": "When a recipe has both high Complex (many flavor layers) AND high Body (mouthfilling viscosity), Rich character is boosted further.",
  "severity": 1.0,
  "ruleVersion": 1,
  "isActive": true
}
```

**Why this matters**: a braise with 12 ingredients cooked 4 hours scores Rich ~4.5; the same ingredients in a quick stir-fry (same Complex, low Body) scores Rich ~2.5. This synergy rule captures that distinction.

---

# Tier 2 — Physical / Chemical Interactions

Tier 2 models **actual chemistry**. Rules fire when chem-property thresholds are crossed, not when perceptual doses combine. Requires the ingredient to have verified chem data (pH, fat content, enzyme activity, etc.).

**Schema target**: `PhysicalInteractionRule`.

**Evaluation**: pipeline Step 7, after perceptual adjustments. Effects modify texture and mouthfeel dims directly, bypassing perceptual math (because the chemistry really changed the food).

---

### Example 2.1 — Acid in dairy (curdling curve)

```json
{
  "name": "acid_in_dairy_curdling",
  "category": "denaturation",
  "triggerA": { "chemProp": "pH", "maxValue": 4.6, "minDose": 0.5 },
  "triggerB": { "chemProp": "caseinMassFraction", "minValue": 0.02 },
  "doseCurve": [
    { "dose": 0.005, "effect": { "Silky": 0.10, "Sour": 0.20 } },
    { "dose": 0.010, "effect": { "Silky": 0.20, "Sour": 0.40 } },
    { "dose": 0.020, "effect": { "Silky": 0.30, "Sour": 0.70 } },
    { "dose": 0.035, "effect": { "Silky": 0.50, "Sour": 1.00 } },
    { "dose": 0.050, "effect": { "Silky": 0.20, "Grainy": 0.30, "Sour": 1.20 } },
    { "dose": 0.075, "effect": { "Silky": -0.40, "Grainy": 0.80, "Sour": 1.40 } },
    { "dose": 0.100, "effect": { "Silky": -0.80, "Grainy": 1.20, "Sour": 1.60 } },
    { "dose": 0.150, "effect": { "Silky": -1.50, "Grainy": 1.60, "Sour": 1.80 } }
  ],
  "doseUnit": "grams_ratio",
  "doseDefinition": "grams_of_acid_per_grams_of_dairy",
  "stabilizers": ["egg_yolk", "mustard", "starch", "xanthan_gum", "high_fat_content"],
  "stabilizerReduction": 0.6,
  "requiresTempRange": "any",
  "temperatureModifiers": {
    "cold": { "doseMultiplier": 2.0, "description": "cold dairy tolerates 2x more acid before breaking" },
    "hot":  { "doseMultiplier": 0.6, "description": "hot dairy breaks with 40% less acid" }
  },
  "description": "Casein micelles destabilize below pH 4.6. Curve goes from brightening (trace) → tangy (moderate) → thickening (higher) → curdling/breaking. Stabilizers (egg yolk lecithin, mustard gums, starch) protect the emulsion.",
  "citations": [
    "McGee (2004) On Food and Cooking, p. 20-24 (casein micelles)",
    "Fox & McSweeney (1998) Dairy Chemistry Vol 1, ch 2"
  ],
  "isActive": true
}
```

**Why this matters**: the canonical Tier 2 example. Covers pan sauce splits, buttermilk biscuits, lemon curd, creamy vinaigrettes, Indian curries with yogurt, Caesar dressing, beurre blanc. A recipe where acid/dairy > 0.05 without stabilizers should lose 0.8 Silky and gain 0.8 Grainy — reflecting the texture of broken dairy. Stabilizers reduce this effect 60%, which is why Caesar (mustard + yolk) tolerates far more acid than a cream sauce. Temperature matters: a hot beurre blanc broken at 0.03 acid ratio recovers when cooled; a cold cream soup holds 0.06 before breaking.

---

### Example 2.2 — Bromelain/papain enzyme on protein

```json
{
  "name": "enzyme_tenderize_protein",
  "category": "denaturation",
  "triggerA": { "chemProp": "proteaseActivity", "minValue": 0.5, "enzymes": ["bromelain", "papain", "actinidin", "ficin"] },
  "triggerB": { "chemProp": "proteinMassFraction", "minValue": 0.08 },
  "doseCurve": [
    { "dose": 10,   "effect": { "Tender": 0.10, "Firm": -0.05 } },
    { "dose": 30,   "effect": { "Tender": 0.35, "Firm": -0.20 } },
    { "dose": 60,   "effect": { "Tender": 0.60, "Firm": -0.40 } },
    { "dose": 120,  "effect": { "Tender": 0.80, "Firm": -0.60 } },
    { "dose": 240,  "effect": { "Tender": 1.10, "Firm": -0.90, "Gummy": 0.20 } },
    { "dose": 480,  "effect": { "Tender": 0.80, "Firm": -1.20, "Gummy": 0.60, "Grainy": 0.40 } },
    { "dose": 1440, "effect": { "Tender": 0.20, "Firm": -2.00, "Gummy": 1.20, "Grainy": 0.80 } }
  ],
  "doseUnit": "contact_minutes",
  "stabilizers": ["heat_deactivation", "acid_deactivation_pH_below_3"],
  "temperatureModifiers": {
    "hot_above_70C": { "doseMultiplier": 0.0, "description": "enzyme denatures above 70°C, no tenderizing effect" }
  },
  "description": "Bromelain (pineapple), papain (papaya), actinidin (kiwi), ficin (fig) cleave peptide bonds. 30-60 min contact = optimal. 4+ hours → protein dissolves into mush. Heat above 70°C instantly denatures the enzyme (why canned pineapple works in Jell-O but fresh doesn't).",
  "citations": [
    "McGee (2004) On Food and Cooking, p. 152-153",
    "Grzonka et al. (2007) 'Insights into the mechanism of protein cleavage by papain', BBRC 357"
  ],
  "isActive": true
}
```

**Why this matters**: Hawaiian ham marinade (pineapple + pork, 1 hour) gains Tender +0.6 correctly. An overnight pineapple-chicken marinade (1440 min) correctly produces mush. Stabilizer: cooking the fruit first deactivates the enzyme, so canned-pineapple recipes don't fire this rule.

---

### Example 2.3 — Emulsion formation (lecithin-stabilized)

```json
{
  "name": "lecithin_emulsion_mayo",
  "category": "emulsion",
  "triggerA": { "chemProp": "oilMassFraction", "minValue": 0.5 },
  "triggerB": { "chemProp": "lecithinPhosphatidylcholine", "minValue": 0.003 },
  "doseCurve": [
    { "dose": 0.2, "effect": { "Silky": 0.30, "Creamy": 0.20, "Oily": -0.30 } },
    { "dose": 0.5, "effect": { "Silky": 0.80, "Creamy": 0.60, "Oily": -0.60, "Body": 0.40 } },
    { "dose": 0.8, "effect": { "Silky": 1.10, "Creamy": 0.90, "Oily": -0.80, "Body": 0.70 } },
    { "dose": 1.0, "effect": { "Silky": 1.30, "Creamy": 1.00, "Oily": -1.00, "Body": 0.90 } }
  ],
  "doseUnit": "yolk_to_oil_ratio",
  "requiresMethod": ["whisk", "blend", "emulsify"],
  "stabilizers": ["mustard", "vinegar_acid", "slow_oil_stream"],
  "description": "Egg yolk phospholipids (phosphatidylcholine) form amphipathic interface between oil and water. Produces mayonnaise, aioli, hollandaise texture. Mustard seed mucilage stabilizes further (Dijon mustard is ~5% mucilage).",
  "citations": [
    "McClements (2005) Food Emulsions: Principles, Practices, and Techniques",
    "Depree & Savage (2001) 'Physical and flavor stability of mayonnaise', Trends in Food Sci 12"
  ],
  "isActive": true
}
```

**Why this matters**: the emulsification itself transforms the texture profile. A bowl of oil + vinegar + yolk reads Oily=4, Silky=0. Once emulsified, it reads Oily=0.5, Silky=3, Creamy=2, Body=1.5 — utterly different. The `requiresMethod` field ensures this only fires when the instruction parser sees mixing verbs (whisk, blend, emulsify).

---

### Example 2.4 — Pectin-sugar-acid gelation

```json
{
  "name": "pectin_sugar_acid_gel",
  "category": "gelation",
  "triggerA": { "chemProp": "pectinMassFraction", "minValue": 0.005 },
  "triggerB": { "chemProp": "sugarMassFraction", "minValue": 0.55 },
  "triggerC": { "chemProp": "pH", "maxValue": 3.5 },
  "doseCurve": [
    { "dose": 0.4, "effect": { "Gelatinous": 0.10, "Silky": 0.05 } },
    { "dose": 0.6, "effect": { "Gelatinous": 0.40, "Silky": 0.20, "Body": 0.30 } },
    { "dose": 1.0, "effect": { "Gelatinous": 0.80, "Silky": 0.30, "Body": 0.60, "Firm": 0.20 } },
    { "dose": 1.4, "effect": { "Gelatinous": 1.20, "Silky": 0.30, "Body": 0.80, "Firm": 0.50 } },
    { "dose": 2.0, "effect": { "Gelatinous": 1.60, "Silky": 0.20, "Body": 1.00, "Firm": 0.90, "Chewy": 0.30 } }
  ],
  "doseUnit": "gel_strength_index",
  "doseDefinition": "product of (pectin % × sugar %) / pH deviation below 3.5",
  "requiresTempRange": "hot_then_cooled",
  "requiresMethod": ["boil", "reduce"],
  "description": "High-methoxyl pectin gels when sugar >55% of water phase dehydrates the polymer and pH <3.5 neutralizes carboxyls, letting chains H-bond. Jam, jelly, fruit pâtes. Low-methoxyl pectin (commercial) gels with calcium instead — separate rule.",
  "citations": [
    "BeMiller (2019) Carbohydrate Chemistry for Food Scientists, ch 6",
    "Voragen et al. (2009) 'Pectin, a versatile polysaccharide', Structural Chemistry 20"
  ],
  "isActive": true
}
```

**Why this matters**: strawberry jam (pectin+sugar+lemon acid) reads Gelatinous=1.2, Body=0.8 — correct jam profile. Without the sugar threshold, a fruit purée would incorrectly score as a gel. The three-trigger structure (A AND B AND C) demonstrates how Tier 2 rules model stoichiometric requirements.

---

### Example 2.5 — Baking soda + acid leavening

```json
{
  "name": "baking_soda_acid_leavening",
  "category": "leavening",
  "triggerA": { "chemProp": "sodiumBicarbonateMassFraction", "minValue": 0.001 },
  "triggerB": { "chemProp": "acidMassFraction_freeAcid", "minValue": 0.002 },
  "doseCurve": [
    { "dose": 0.5, "effect": { "Foamy": 0.15, "Tender": 0.10, "Body": -0.10 } },
    { "dose": 1.0, "effect": { "Foamy": 0.40, "Tender": 0.30, "Body": -0.25 } },
    { "dose": 1.5, "effect": { "Foamy": 0.70, "Tender": 0.50, "Body": -0.40, "Crumbly": 0.20 } },
    { "dose": 2.0, "effect": { "Foamy": 0.85, "Tender": 0.55, "Body": -0.50, "Crumbly": 0.40 } },
    { "dose": 3.0, "effect": { "Foamy": 0.80, "Tender": 0.50, "Body": -0.50, "Crumbly": 0.60, "Bitter": 0.30 } }
  ],
  "doseUnit": "stoichiometric_ratio",
  "doseDefinition": "actual_acid_to_base_ratio / ideal_ratio_(1:1_eq)",
  "requiresMethod": ["bake", "oven"],
  "requiresTempRange": "hot",
  "description": "NaHCO3 + H+ → CO2 + H2O + Na+. Buttermilk biscuits, Irish soda bread, chocolate cake w/ buttermilk. Off-ratio: excess soda → soapy/bitter; excess acid → flat rise.",
  "citations": [
    "Figoni (2010) How Baking Works, ch 14",
    "Corriher (1997) CookWise, p. 176"
  ],
  "isActive": true
}
```

**Why this matters**: Irish soda bread (buttermilk lactic acid + baking soda) produces the characteristic Foamy=0.7, Tender=0.5. The stoichiometric dose unit penalizes unbalanced ratios — a recipe with 2x soda to acid correctly produces the bitter/soapy off-flavor (Bitter +0.3).

---

### Example 2.6 — Egg protein coagulation (custard)

```json
{
  "name": "egg_coagulation",
  "category": "coagulation",
  "triggerA": { "chemProp": "eggProteinMassFraction", "minValue": 0.015 },
  "triggerB": { "chemProp": "temperatureReached_C", "minValue": 63 },
  "doseCurve": [
    { "dose": 63, "effect": { "Firm": 0.10, "Creamy": 0.30, "Silky": 0.20 } },
    { "dose": 68, "effect": { "Firm": 0.25, "Creamy": 0.60, "Silky": 0.40 } },
    { "dose": 75, "effect": { "Firm": 0.45, "Creamy": 0.80, "Silky": 0.50, "Body": 0.40 } },
    { "dose": 82, "effect": { "Firm": 0.70, "Creamy": 0.70, "Silky": 0.40, "Body": 0.60 } },
    { "dose": 85, "effect": { "Firm": 0.90, "Creamy": 0.50, "Silky": 0.20, "Grainy": 0.30, "Body": 0.70 } },
    { "dose": 90, "effect": { "Firm": 1.20, "Creamy": 0.20, "Silky": -0.20, "Grainy": 0.60, "Body": 0.80 } }
  ],
  "doseUnit": "cook_temperature_C",
  "stabilizers": ["starch_addition", "sugar_addition", "slow_heat_bain_marie"],
  "description": "Egg whites (ovalbumin) coagulate at 62°C, yolks at 68°C, tempered custards at 80-83°C. Above 85°C → grainy curdle. Sugar & starch raise coagulation temp (custard base with 15% sugar holds smooth to 87°C).",
  "citations": [
    "This, H. (2008) Molecular Gastronomy: Exploring the Science of Flavor",
    "McGee (2004), p. 72-80 (egg proteins)"
  ],
  "isActive": true
}
```

**Why this matters**: crème anglaise (custard cooked to 82°C) correctly scores Silky=0.5, Creamy=0.8 — velvet sauce. Overcooked to 90°C it correctly scores Grainy=0.6 — broken custard. Sugar stabilizer raises the effective trigger curve so pastry cream (15% sugar) cooks safely to 85°C.

---

### Example 2.7 — Tannin-iron chelation (tea + milk)

```json
{
  "name": "tannin_iron_chelation",
  "category": "chelation",
  "triggerA": { "chemProp": "tanninMassFraction", "minValue": 0.001 },
  "triggerB": { "chemProp": "ironMassFraction", "minValue": 0.00005 },
  "doseCurve": [
    { "dose": 0.5, "effect": { "Astringent": -0.20, "Mineral": 0.10 } },
    { "dose": 1.0, "effect": { "Astringent": -0.40, "Mineral": 0.25, "Bitter": -0.15 } },
    { "dose": 2.0, "effect": { "Astringent": -0.70, "Mineral": 0.40, "Bitter": -0.25 } },
    { "dose": 3.0, "effect": { "Astringent": -0.90, "Mineral": 0.50, "Bitter": -0.30 } }
  ],
  "doseUnit": "tannin_iron_ratio",
  "description": "Polyphenols bind non-heme iron (chelation complex). Tea with milk: milk casein pre-binds tannins, reducing astringency — different but related rule. Metallic perception appears in high-tannin + high-iron (e.g., spinach + black tea).",
  "citations": [
    "Hurrell & Egli (2010) 'Iron bioavailability and dietary reference values', Am J Clin Nutr 91",
    "Disler et al. (1975) 'The effect of tea on iron absorption', Gut 16"
  ],
  "isActive": true
}
```

**Why this matters**: explains why milk in tea reduces astringency (positive diners effect) but also inhibits iron absorption (nutritional effect — see nutrition pipeline). The sensory rule only models the Astringent reduction.

---

### Example 2.8 — Calcium-oxalate binding (spinach + dairy)

```json
{
  "name": "calcium_oxalate_chalky",
  "category": "chelation",
  "triggerA": { "chemProp": "oxalateMassFraction", "minValue": 0.005 },
  "triggerB": { "chemProp": "calciumMassFraction", "minValue": 0.001 },
  "doseCurve": [
    { "dose": 0.3, "effect": { "Powdery": 0.10, "Astringent": 0.05 } },
    { "dose": 0.6, "effect": { "Powdery": 0.25, "Astringent": 0.15, "Creamy": -0.10 } },
    { "dose": 1.0, "effect": { "Powdery": 0.45, "Astringent": 0.30, "Creamy": -0.25 } },
    { "dose": 1.5, "effect": { "Powdery": 0.70, "Astringent": 0.45, "Creamy": -0.40, "Bitter": 0.15 } }
  ],
  "doseUnit": "calcium_oxalate_stoichiometric",
  "description": "Oxalic acid (spinach, chard, rhubarb, chocolate) precipitates with calcium → calcium oxalate crystals. Perceived as chalky/gritty on tongue. Why creamed spinach can feel slightly powdery vs creamed kale (low oxalate).",
  "citations": [
    "Noonan & Savage (1999) 'Oxalate content of foods and its effect on humans', Asia Pacific J Clin Nutr 8"
  ],
  "isActive": true
}
```

**Why this matters**: subtle but real — creamed spinach reads slightly Powdery (+0.25), creamed kale doesn't. Helps distinguish similar recipes and gives the substitution engine nuanced data.

---

### Example 2.9 — Starch gelatinization

```json
{
  "name": "starch_gelatinization",
  "category": "gelation",
  "triggerA": { "chemProp": "starchMassFraction", "minValue": 0.02 },
  "triggerB": { "chemProp": "temperatureReached_C", "minValue": 62 },
  "triggerC": { "chemProp": "waterActivity", "minValue": 0.6 },
  "doseCurve": [
    { "dose": 62, "effect": { "Silky": 0.20, "Starchy": 0.30, "Body": 0.30 } },
    { "dose": 70, "effect": { "Silky": 0.40, "Starchy": 0.50, "Body": 0.60 } },
    { "dose": 80, "effect": { "Silky": 0.60, "Starchy": 0.70, "Body": 0.80, "Creamy": 0.30 } },
    { "dose": 95, "effect": { "Silky": 0.70, "Starchy": 0.80, "Body": 1.00, "Creamy": 0.40, "Gelatinous": 0.20 } }
  ],
  "doseUnit": "cook_temperature_C",
  "description": "Starch granules swell and absorb water above gelatinization temp (cornstarch ~62°C, wheat ~60°C, rice ~68°C, potato ~58°C). Produces sauce thickening, roux body, pudding.",
  "citations": [
    "BeMiller & Whistler (2009) Starch: Chemistry and Technology, 3rd ed",
    "McGee (2004), ch 11"
  ],
  "isActive": true
}
```

**Why this matters**: béchamel (roux cooked to 80°C) reads Silky=0.6, Starchy=0.7, Body=0.8 correctly. Undercooked roux (60°C) under-scores Body — and tastes raw.

---

### Example 2.10 — Maillard browning (surface)

```json
{
  "name": "maillard_browning",
  "category": "reaction",
  "triggerA": { "chemProp": "aminoAcidFreeForm", "minValue": 0.005 },
  "triggerB": { "chemProp": "reducingSugar", "minValue": 0.002 },
  "triggerC": { "chemProp": "surfaceTemperature_C", "minValue": 140 },
  "doseCurve": [
    { "dose": 60,   "effect": { "Meat-Roast": 0.30, "Bread-Crust": 0.20, "Savory Spice": 0.20, "Umami": 0.20, "Crispy": 0.30 } },
    { "dose": 180,  "effect": { "Meat-Roast": 0.70, "Bread-Crust": 0.50, "Savory Spice": 0.40, "Umami": 0.40, "Crispy": 0.60 } },
    { "dose": 360,  "effect": { "Meat-Roast": 1.10, "Bread-Crust": 0.80, "Savory Spice": 0.60, "Umami": 0.60, "Crispy": 0.80, "Bitter": 0.10 } },
    { "dose": 600,  "effect": { "Meat-Roast": 1.40, "Bread-Crust": 1.00, "Savory Spice": 0.80, "Umami": 0.75, "Crispy": 1.00, "Charred": 0.30, "Bitter": 0.30 } },
    { "dose": 900,  "effect": { "Meat-Roast": 1.40, "Bread-Crust": 0.80, "Savory Spice": 0.80, "Charred": 0.90, "Bitter": 0.70, "Burnt-Sugar": 0.60 } }
  ],
  "doseUnit": "cook_seconds_at_temp",
  "stabilizers": ["moisture_barrier", "low_pH"],
  "description": "Amadori rearrangement → Strecker degradation → melanoidins. Produces hundreds of volatile flavor compounds (pyrazines, furans, thiophenes). Dose is time at >140°C surface temp. Overshooting → charring (shift into Burnt-Sugar + Bitter).",
  "citations": [
    "Nursten (2005) The Maillard Reaction: Chemistry, Biochemistry and Implications",
    "Hodge (1953) 'Dehydrated foods: Chemistry of browning reactions in model systems', J Ag Food Chem 1"
  ],
  "isActive": true
}
```

**Why this matters**: a seared steak (60 seconds per side at 200°C = 120s dose) reads Meat-Roast=0.8, Bread-Crust=0.5, Crispy=0.6. A well-browned roast (360s) reads Meat-Roast=1.1. A burned steak (900s) correctly reads Bitter=0.7, Charred=0.9. Without this rule, seared and boiled meat would score identically.

---

### Example 2.11 — Caramelization of sugar (dry heat)

```json
{
  "name": "sugar_caramelization",
  "category": "reaction",
  "triggerA": { "chemProp": "sugarMassFraction", "minValue": 0.1 },
  "triggerB": { "chemProp": "waterActivity", "maxValue": 0.5 },
  "triggerC": { "chemProp": "temperatureReached_C", "minValue": 160 },
  "doseCurve": [
    { "dose": 160, "effect": { "Toffee-Caramel": 0.40, "Sweet": -0.20, "Body": 0.20 } },
    { "dose": 170, "effect": { "Toffee-Caramel": 0.80, "Sweet": -0.40, "Body": 0.30 } },
    { "dose": 180, "effect": { "Toffee-Caramel": 1.20, "Sweet": -0.60, "Bitter": 0.20, "Body": 0.40 } },
    { "dose": 190, "effect": { "Toffee-Caramel": 1.40, "Burnt-Sugar": 0.30, "Sweet": -0.90, "Bitter": 0.40, "Body": 0.50 } },
    { "dose": 200, "effect": { "Toffee-Caramel": 1.00, "Burnt-Sugar": 1.00, "Sweet": -1.30, "Bitter": 0.80, "Charred": 0.30 } }
  ],
  "doseUnit": "cook_temperature_C",
  "description": "Sucrose pyrolysis produces diacetyl (butterscotch), furaneol (burnt sugar), HMF (caramel). Light caramel (160°C) still reads mostly sweet with toffee; dark caramel (190°C) shifts to bitter-complex.",
  "citations": [
    "Kroh (1994) 'Caramelisation in food and beverages', Food Chem 51"
  ],
  "isActive": true
}
```

**Why this matters**: a flan with caramel at 180°C scores Toffee-Caramel=1.2 (amber) and correctly loses 0.6 Sweet. Crème brûlée (200°C torched) shifts to bitter-complex. Differentiates caramel sauces by cook temp — a difference chefs routinely specify and diners perceive.

---

### Example 2.12 — Oil + flour roux (starch + protein coupling)

```json
{
  "name": "roux_formation",
  "category": "reaction",
  "triggerA": { "chemProp": "starchMassFraction", "minValue": 0.35 },
  "triggerB": { "chemProp": "oilMassFraction", "minValue": 0.35 },
  "triggerC": { "chemProp": "temperatureReached_C", "minValue": 90 },
  "doseCurve": [
    { "dose": 300,  "effect": { "Silky": 0.50, "Body": 0.60, "Bread-Crust": 0.20 } },
    { "dose": 900,  "effect": { "Silky": 0.60, "Body": 0.70, "Bread-Crust": 0.50, "Grain-Toast": 0.30, "Color_Blonde": 1.0 } },
    { "dose": 1800, "effect": { "Silky": 0.60, "Body": 0.70, "Bread-Crust": 0.80, "Grain-Toast": 0.60, "Nutty": 0.40, "Color_Brown": 1.0 } },
    { "dose": 3600, "effect": { "Silky": 0.50, "Body": 0.60, "Bread-Crust": 1.00, "Grain-Toast": 0.80, "Nutty": 0.80, "Cocoa-Roast": 0.40, "Color_DarkBrown": 1.0 } }
  ],
  "doseUnit": "cook_seconds",
  "description": "Cajun dark roux (Louisiana gumbo) cooks to ~1 hour. Fat coats starch, preventing lumps; starch granules progressively brown via Maillard. Nutty/toasty aromatics grow with time.",
  "citations": [
    "Prudhomme (1984) Chef Paul Prudhomme's Louisiana Kitchen",
    "McGee (2004), p. 596-598"
  ],
  "isActive": true
}
```

**Why this matters**: gumbo's "chocolate roux" is a stark Tier 2 transformation — Silky=0.5, Nutty=0.8, Cocoa-Roast=0.4 after an hour. A blonde béchamel roux (5 min) stays neutral. This rule distinguishes them correctly.

---

### Example 2.13 — Deglazing (Maillard dissolution)

```json
{
  "name": "deglazing_fond",
  "category": "reaction",
  "triggerA": { "event": "fond_present_from_prior_browning", "minValue": 1 },
  "triggerB": { "chemProp": "liquidMassAdded", "minValue": 0.1 },
  "triggerC": { "chemProp": "acidOrAlcohol", "minValue": 0.01 },
  "doseCurve": [
    { "dose": 0.3, "effect": { "Meat-Roast": 0.30, "Umami": 0.30, "Complex": 0.30 } },
    { "dose": 0.6, "effect": { "Meat-Roast": 0.50, "Umami": 0.50, "Complex": 0.50, "Body": 0.30 } },
    { "dose": 1.0, "effect": { "Meat-Roast": 0.70, "Umami": 0.70, "Complex": 0.70, "Body": 0.50, "Broth-Stock": 0.40 } }
  ],
  "doseUnit": "dissolution_completeness",
  "description": "Pan fond (Maillard melanoidins stuck to pan after browning) dissolves in liquid, especially acidified or alcoholic. Transfers the browning flavor into the sauce. Why wine deglaze > water deglaze.",
  "citations": [
    "McGee (2004), p. 777-778 (pan sauces)"
  ],
  "isActive": true
}
```

**Why this matters**: a pan sauce from seared pork deglazed with wine scores markedly higher Complex and Meat-Roast than one simply deglazed with water. Tier 2 rule because the chemistry is real (solubilization of melanoidins), not perceptual.

---

### Example 2.14 — Yeast fermentation

```json
{
  "name": "yeast_fermentation",
  "category": "fermentation",
  "triggerA": { "chemProp": "yeastViableCells", "minValue": 1000000 },
  "triggerB": { "chemProp": "sugarMassFraction", "minValue": 0.005 },
  "triggerC": { "chemProp": "temperatureReached_C", "minValue": 18, "maxValue": 35 },
  "doseCurve": [
    { "dose": 60,    "effect": { "Foamy": 0.10, "Bread-Yeast": 0.10 } },
    { "dose": 300,   "effect": { "Foamy": 0.50, "Bread-Yeast": 0.40, "Body": -0.20 } },
    { "dose": 900,   "effect": { "Foamy": 0.90, "Bread-Yeast": 0.80, "Body": -0.40, "Alcoholic": 0.10, "Sour": 0.10 } },
    { "dose": 3600,  "effect": { "Foamy": 1.10, "Bread-Yeast": 1.00, "Body": -0.50, "Alcoholic": 0.30, "Sour": 0.30, "Complex": 0.40 } },
    { "dose": 14400, "effect": { "Foamy": 1.20, "Bread-Yeast": 1.20, "Body": -0.50, "Alcoholic": 0.60, "Sour": 0.60, "Complex": 0.80, "Sourdough-Starter": 0.60 } }
  ],
  "doseUnit": "ferment_minutes",
  "description": "Saccharomyces cerevisiae: sugar → CO2 + ethanol + side metabolites. Long ferments (>12h) develop lactic acid, acetic acid, and complex esters characteristic of sourdough.",
  "citations": [
    "Hutkins (2018) Microbiology and Technology of Fermented Foods, 2nd ed",
    "Gobbetti & Gänzle (2013) Handbook on Sourdough Biotechnology"
  ],
  "isActive": true
}
```

**Why this matters**: a 12-hour sourdough bulk-fermented bread reads Complex=0.8, Sourdough-Starter=0.6, Sour=0.6 — correctly distinguishing it from a 1-hour commercial-yeast loaf.

---

### Example 2.15 — Vinegar + baking soda (stoichiometric leavening)

```json
{
  "name": "vinegar_soda_quick_bread",
  "category": "leavening",
  "triggerA": { "chemProp": "sodiumBicarbonateMassFraction", "minValue": 0.003 },
  "triggerB": { "chemProp": "aceticAcidMassFraction", "minValue": 0.004 },
  "doseCurve": [
    { "dose": 0.8, "effect": { "Foamy": 0.35, "Tender": 0.30, "Vinegar": 0.10 } },
    { "dose": 1.0, "effect": { "Foamy": 0.55, "Tender": 0.40, "Vinegar": 0.05 } },
    { "dose": 1.2, "effect": { "Foamy": 0.45, "Tender": 0.35, "Vinegar": 0.25, "Bitter": 0.10 } },
    { "dose": 1.5, "effect": { "Foamy": 0.30, "Tender": 0.25, "Vinegar": 0.50, "Bitter": 0.25 } }
  ],
  "doseUnit": "stoichiometric_ratio",
  "description": "CH3COOH + NaHCO3 → CO2 + H2O + CH3COONa. Peak Foamy at 1:1 molar ratio. Excess acid leaves vinegar flavor; excess base leaves soapy bitter.",
  "citations": [
    "Figoni (2010) How Baking Works, ch 5"
  ],
  "isActive": true
}
```

**Why this matters**: simple quick-bread recipes live or die by this stoichiometry. Feeds Foamy dim for chapatis, vegan pancakes, and the classic "chocolate mayonnaise cake" (vinegar + soda + cocoa).

---

# Tier 3 — Temporal / Order Effects

**When** an ingredient enters cooking changes its sensory signature. Garlic added early caramelizes; garlic added late stays pungent. Tier 3 rules depend on the instruction-parser identifying *when* each ingredient is added.

**Schema target**: `SensoryInteractionRule` with `tier: "temporal"`.

**Evaluation**: pipeline Step 8. Operates on the ingredient's potency vector before dose aggregation.

---

### Example 3.1 — Garlic early (caramelized) vs late (pungent)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "garlic",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,   "effect": { "Allium": 1.00, "Pungent": 1.00, "Sulfurous": 1.00, "Sweet": 0.00, "Meat-Roast": 0.00, "Nutty": 0.00 } },
    { "dose": 1,   "effect": { "Allium": 0.95, "Pungent": 1.00, "Sulfurous": 1.00 } },
    { "dose": 5,   "effect": { "Allium": 0.70, "Pungent": 0.50, "Sulfurous": 0.70, "Sweet": 0.30, "Meat-Roast": 0.20, "Nutty": 0.20 } },
    { "dose": 15,  "effect": { "Allium": 0.40, "Pungent": 0.20, "Sulfurous": 0.40, "Sweet": 0.80, "Meat-Roast": 0.40, "Nutty": 0.50 } },
    { "dose": 45,  "effect": { "Allium": 0.20, "Pungent": 0.05, "Sulfurous": 0.20, "Sweet": 1.50, "Meat-Roast": 0.60, "Nutty": 0.80, "Toffee-Caramel": 0.30 } },
    { "dose": 120, "effect": { "Allium": 0.10, "Pungent": 0.00, "Sulfurous": 0.10, "Sweet": 2.00, "Meat-Roast": 0.80, "Nutty": 1.00, "Toffee-Caramel": 0.60 } }
  ],
  "doseUnit": "cook_minutes_in_fat_under_90C",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Allyl thiosulfinates (garlic pungency) decompose at 60°C+; prolonged low-heat cooking in fat shifts flavor toward sweet-nutty (diallyl sulfide → thioethers → meat-roast via Maillard with ingredient aminos).",
  "citations": [
    "Block (2010) Garlic and Other Alliums: The Lore and the Science",
    "McGee (2004), p. 313-314"
  ],
  "isActive": true
}
```

**Why this matters**: a 45-minute garlic confit dresses pasta with Sweet=1.5, Nutty=1.0 — not pungent at all. Raw garlic in pesto stays at the full 1.0 Allium/Pungent. Without this rule, all garlic-containing recipes would score identically pungent.

---

### Example 3.2 — Fresh herbs early (integrated) vs late (bright)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "categoryA": "fresh_herb_soft",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,  "effect": { "Fresh Herb": 1.00, "Grassy": 0.80, "Fresh": 1.00 } },
    { "dose": 2,  "effect": { "Fresh Herb": 0.85, "Grassy": 0.65, "Fresh": 0.85 } },
    { "dose": 10, "effect": { "Fresh Herb": 0.55, "Grassy": 0.30, "Fresh": 0.50, "Woody Herb": 0.20 } },
    { "dose": 30, "effect": { "Fresh Herb": 0.30, "Grassy": 0.10, "Fresh": 0.20, "Woody Herb": 0.40 } },
    { "dose": 60, "effect": { "Fresh Herb": 0.15, "Grassy": 0.00, "Fresh": 0.10, "Woody Herb": 0.60 } }
  ],
  "doseUnit": "cook_minutes",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Soft herbs (basil, parsley, cilantro, dill, chervil, tarragon, chives, mint) have volatile terpenes (linalool, estragole, limonene congeners) that evaporate rapidly above 50°C. Added late = Fresh character preserved; added early = integrates into Woody Herb base.",
  "exceptions": ["bay_leaf", "rosemary", "thyme", "oregano", "sage"],
  "citations": [
    "Parry (1922) Chemistry of Essential Oils (classic)",
    "Jirovetz et al. (2003) 'Solid-phase microextraction–GC analysis of herbal volatiles'"
  ],
  "isActive": true
}
```

**Why this matters**: basil stirred into sauce at the end reads Fresh Herb=1.0; basil simmered 30 min reads Fresh Herb=0.3. The `exceptions` list covers hard herbs (rosemary, thyme, bay) whose volatiles are in woody stems and survive long cooking — a different rule applies to them.

---

### Example 3.3 — Hard herbs (rosemary, thyme, bay) — slow-release curve

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "categoryA": "fresh_herb_hard",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,   "effect": { "Woody Herb": 1.00, "Resinous": 0.80 } },
    { "dose": 5,   "effect": { "Woody Herb": 1.05, "Resinous": 0.85 } },
    { "dose": 15,  "effect": { "Woody Herb": 1.15, "Resinous": 0.95, "Pepper": 0.20 } },
    { "dose": 30,  "effect": { "Woody Herb": 1.20, "Resinous": 1.00, "Pepper": 0.30 } },
    { "dose": 60,  "effect": { "Woody Herb": 1.15, "Resinous": 0.95, "Pepper": 0.35, "Bitter": 0.20 } },
    { "dose": 180, "effect": { "Woody Herb": 0.80, "Resinous": 0.65, "Pepper": 0.40, "Bitter": 0.50 } }
  ],
  "doseUnit": "cook_minutes",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Hard-herb volatiles (1,8-cineole, α-pinene, thymol, camphor) are locked in lignified structure and release slowly — peak at ~30 min. Very long cooks (>2h) extract bitter tannins.",
  "citations": [
    "Guenther (1950) The Essential Oils Vol V (rosemary, thyme)"
  ],
  "isActive": true
}
```

**Why this matters**: rosemary in a 20-minute roast chicken reads Woody Herb=1.2 (slightly elevated); in an overnight braise reads bitter-heavy. Explains why bay leaf is usually removed before serving long stews.

---

### Example 3.4 — Dried herbs early vs late (inverse of fresh)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "categoryA": "dried_herb",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,  "effect": { "Woody Herb": 0.30, "Fresh Herb": 0.00 } },
    { "dose": 2,  "effect": { "Woody Herb": 0.45, "Fresh Herb": 0.05 } },
    { "dose": 5,  "effect": { "Woody Herb": 0.70, "Fresh Herb": 0.10 } },
    { "dose": 10, "effect": { "Woody Herb": 0.95, "Fresh Herb": 0.15, "Resinous": 0.40 } },
    { "dose": 20, "effect": { "Woody Herb": 1.05, "Fresh Herb": 0.15, "Resinous": 0.55 } }
  ],
  "doseUnit": "cook_minutes_hydrated",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Dried herbs must rehydrate and release bound volatiles — cooking time is essential. Unlike fresh, dried herbs *gain* potency as they cook (up to ~20 min). Finishing a sauce with dried oregano tastes flat.",
  "citations": [
    "Yeh et al. (2014) 'Volatile release from dried herbs during rehydration', J Ag Food Chem 62"
  ],
  "isActive": true
}
```

**Why this matters**: inverse of fresh herb rule. A tomato sauce with dried oregano added at the start reads Woody Herb=1.0; the same recipe with oregano added at the end reads 0.3. Surfaces cooking best-practices that recipes often get wrong.

---

### Example 3.5 — Salt on protein (brining vs seasoning)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "salt",
  "ingredientB": "*protein*",
  "doseCurve": [
    { "dose": 0,    "effect": { "Salty": 1.0, "Moist": 0.00, "Tender": 0.00, "Umami": 0.00 } },
    { "dose": 5,    "effect": { "Salty": 1.0, "Moist": 0.00, "Tender": 0.00, "Umami": 0.00 } },
    { "dose": 15,   "effect": { "Salty": 1.0, "Moist": 0.05, "Tender": 0.05, "Umami": 0.05 } },
    { "dose": 60,   "effect": { "Salty": 0.9, "Moist": 0.30, "Tender": 0.20, "Umami": 0.15 } },
    { "dose": 240,  "effect": { "Salty": 0.8, "Moist": 0.50, "Tender": 0.40, "Umami": 0.30, "Body": 0.20 } },
    { "dose": 720,  "effect": { "Salty": 0.7, "Moist": 0.60, "Tender": 0.50, "Umami": 0.40, "Body": 0.30 } },
    { "dose": 1440, "effect": { "Salty": 0.6, "Moist": 0.60, "Tender": 0.50, "Umami": 0.45, "Body": 0.35 } }
  ],
  "doseUnit": "brine_minutes",
  "effectType": "add",
  "description": "Salt on protein: surface only below 10 min; diffuses into muscle 1-12h (dry-brine); full equilibration at 24h+. Longer brining redistributes salt inward (lower surface Salty, higher Moist/Tender/Umami from protein dissolution).",
  "citations": [
    "McGee (2004), p. 156-161 (curing)",
    "López-Alt (2015) The Food Lab, ch 4 (dry-brining)"
  ],
  "isActive": true
}
```

**Why this matters**: a turkey dry-brined 24h reads Tender=0.5, Moist=0.6, Umami=0.45 — objectively a better bird than a turkey salted 5 min before roasting. The system's recipe-quality algorithm weights these gains.

---

### Example 3.6 — Citrus zest timing (volatile preservation)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "citrus_zest",
  "dimA": null,
  "doseCurve": [
    { "dose": -1, "effect": { "Citrusy": 1.20, "Floral-Delicate": 0.30, "Fresh": 1.10 } },
    { "dose": 0,  "effect": { "Citrusy": 1.00, "Floral-Delicate": 0.20, "Fresh": 1.00 } },
    { "dose": 2,  "effect": { "Citrusy": 0.85, "Floral-Delicate": 0.15, "Fresh": 0.80 } },
    { "dose": 10, "effect": { "Citrusy": 0.50, "Floral-Delicate": 0.05, "Fresh": 0.40, "Bitter": 0.10 } },
    { "dose": 30, "effect": { "Citrusy": 0.25, "Floral-Delicate": 0.00, "Fresh": 0.15, "Bitter": 0.25 } }
  ],
  "doseUnit": "cook_minutes",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Dose -1 = added as finish after cooking (peak perfume). Limonene, linalool, citral rapidly evaporate above 50°C. Zest simmered > 20 min loses citrus notes and extracts bitter limonin from pith.",
  "citations": [
    "Bellanca & Chonka (2015) 'Volatile flavor compounds of citrus peel oils', Citrus Research"
  ],
  "isActive": true
}
```

**Why this matters**: lemon-ricotta pasta finished with zest scores Citrusy=1.2 — a clean perfume. Lemon-zest stew simmered for 30 min scores Citrusy=0.25 and accidentally gains Bitter. The negative dose value (-1) represents "added after cooking" and is how the pipeline handles finishing ingredients.

---

### Example 3.7 — Acid timing in sauce (reduction vs finish)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "categoryA": "acid",
  "dimA": null,
  "doseCurve": [
    { "dose": -1, "effect": { "Sour": 1.00, "Fresh": 0.60, "Citrusy": 0.30 } },
    { "dose": 0,  "effect": { "Sour": 0.95, "Fresh": 0.50, "Citrusy": 0.25 } },
    { "dose": 5,  "effect": { "Sour": 0.85, "Fresh": 0.35, "Citrusy": 0.15 } },
    { "dose": 15, "effect": { "Sour": 0.65, "Fresh": 0.15, "Citrusy": 0.05, "Complex": 0.20 } },
    { "dose": 30, "effect": { "Sour": 0.45, "Fresh": 0.05, "Citrusy": 0.00, "Complex": 0.30 } },
    { "dose": 60, "effect": { "Sour": 0.30, "Fresh": 0.00, "Citrusy": 0.00, "Complex": 0.30 } }
  ],
  "doseUnit": "cook_minutes",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Volatile acids (acetic, citric) concentrate but lose aromatic top notes as sauce reduces. Non-volatile acids (malic, tartaric, lactic) remain Sour but lose 'brightness'. Finishing acid preserves Fresh.",
  "citations": [
    "Peterson (2007) Sauces: Classical and Contemporary Sauce Making, 3rd ed"
  ],
  "isActive": true
}
```

**Why this matters**: a pan sauce reduced 20 min then finished with a splash of vinegar scores Sour=1.0 and Fresh=0.6. The same recipe with all vinegar at the start scores Fresh=0.05. Feeds the "add acid at the end" rule chefs use instinctively.

---

### Example 3.8 — Wine timing (alcohol burn-off vs aroma preservation)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "categoryA": "wine_or_spirit",
  "dimA": null,
  "doseCurve": [
    { "dose": -1, "effect": { "Alcoholic": 0.90, "Barrel-Aged": 0.60, "Fruity": 0.50, "Warming": 0.50 } },
    { "dose": 0,  "effect": { "Alcoholic": 0.80, "Barrel-Aged": 0.55, "Fruity": 0.45, "Warming": 0.45 } },
    { "dose": 5,  "effect": { "Alcoholic": 0.55, "Barrel-Aged": 0.50, "Fruity": 0.35, "Warming": 0.30 } },
    { "dose": 15, "effect": { "Alcoholic": 0.25, "Barrel-Aged": 0.45, "Fruity": 0.25, "Warming": 0.10 } },
    { "dose": 30, "effect": { "Alcoholic": 0.10, "Barrel-Aged": 0.40, "Fruity": 0.15, "Warming": 0.00, "Complex": 0.30 } },
    { "dose": 60, "effect": { "Alcoholic": 0.05, "Barrel-Aged": 0.30, "Fruity": 0.05, "Warming": 0.00, "Complex": 0.40 } }
  ],
  "doseUnit": "cook_minutes_simmer",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Ethanol evaporates exponentially (~85% gone at 2h simmer; USDA 1998 study). But it carries aromatics out with it — a long-simmered wine sauce keeps Complex but loses Fruity/Warming.",
  "citations": [
    "USDA Nutrient Data Lab (1998) 'Alcohol retention in cooked foods'",
    "Augusto Silva et al. (2016) 'Ethanol evaporation in cooking'"
  ],
  "isActive": true
}
```

**Why this matters**: coq au vin simmered 90 minutes scores Alcoholic=0.08 (safe for children), Complex=0.4 (deep). A flambé finish preserves Warming=0.5. The curve gives the UI precise data for flagging dishes as alcohol-free after sufficient cook time.

---

### Example 3.9 — Onion sweating vs caramelizing (time × temperature)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "onion",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,  "effect": { "Allium": 1.00, "Pungent": 0.80, "Sulfurous": 0.90, "Sweet": 0.00, "Caramelized": 0.00 } },
    { "dose": 3,  "effect": { "Allium": 0.90, "Pungent": 0.60, "Sulfurous": 0.75 } },
    { "dose": 8,  "effect": { "Allium": 0.70, "Pungent": 0.30, "Sulfurous": 0.55, "Sweet": 0.30 } },
    { "dose": 15, "effect": { "Allium": 0.55, "Pungent": 0.10, "Sulfurous": 0.40, "Sweet": 0.70 } },
    { "dose": 30, "effect": { "Allium": 0.40, "Pungent": 0.05, "Sulfurous": 0.25, "Sweet": 1.20, "Caramelized": 0.20, "Toffee-Caramel": 0.20 } },
    { "dose": 60, "effect": { "Allium": 0.25, "Pungent": 0.00, "Sulfurous": 0.15, "Sweet": 1.80, "Caramelized": 0.80, "Toffee-Caramel": 0.60, "Body": 0.40 } },
    { "dose": 90, "effect": { "Allium": 0.15, "Pungent": 0.00, "Sulfurous": 0.10, "Sweet": 2.30, "Caramelized": 1.20, "Toffee-Caramel": 0.80, "Body": 0.60, "Complex": 0.40 } }
  ],
  "doseUnit": "cook_minutes_low_heat_in_fat",
  "effectType": "multiply_on_ingredient_vector",
  "requiresMethod": ["saute_low_heat", "sweat", "caramelize"],
  "description": "Onion pyrvic acid (lachrymatory) decomposes; sugars (fructose, glucose) release from cell walls and caramelize; sulfur compounds reduce. French onion soup (90 min) vs sautéed onion base (15 min) are fundamentally different sensory profiles.",
  "citations": [
    "Block (2010) Garlic and Other Alliums, ch on onions",
    "McGee (2004), p. 311-312"
  ],
  "isActive": true
}
```

**Why this matters**: French onion soup reads Sweet=2.3, Caramelized=1.2, Complex=0.4 — indistinguishable from other onion recipes without this rule. Recipe-matching for "sweet, deep, caramelized" queries depends on this curve.

---

### Example 3.10 — Ginger timing (fresh bite vs mellow warmth)

```json
{
  "tier": "temporal",
  "ruleType": "temporal",
  "ingredientA": "ginger_fresh",
  "dimA": null,
  "doseCurve": [
    { "dose": 0,  "effect": { "Pungent": 1.00, "Warming": 0.80, "Floral-Bold": 0.40, "Citrusy": 0.30 } },
    { "dose": 3,  "effect": { "Pungent": 0.90, "Warming": 0.85, "Floral-Bold": 0.35 } },
    { "dose": 10, "effect": { "Pungent": 0.65, "Warming": 0.95, "Floral-Bold": 0.25 } },
    { "dose": 30, "effect": { "Pungent": 0.40, "Warming": 1.05, "Floral-Bold": 0.15, "Exotic-Curry": 0.20 } },
    { "dose": 60, "effect": { "Pungent": 0.25, "Warming": 1.15, "Floral-Bold": 0.10, "Exotic-Curry": 0.35 } }
  ],
  "doseUnit": "cook_minutes",
  "effectType": "multiply_on_ingredient_vector",
  "description": "Gingerol → shogaol on heating (reduces pungency, increases warming). Long braise converts to zingerone (sweeter, mellower). Fresh ginger added to stir-fry at end vs ginger braised in stew — same ingredient, very different dim signatures.",
  "citations": [
    "Bhattarai et al. (2001) 'The stability of gingerol and shogaol in aqueous solutions', J Pharm Sci 90"
  ],
  "isActive": true
}
```

**Why this matters**: gingerbread vs fresh-ginger salad dressing vs Asian stir-fry — three very different sensory profiles all from "ginger + something". This rule captures the transformation chemistry.

---

# Tier 4 — Carrier Effects

Some dimensions amplify the *perception* of others not by receptor interaction (Tier 1) but by **physical delivery** — fat dissolving lipophilic volatiles, alcohol volatilizing aromatics, heat evaporating compounds into the retronasal airstream.

**Schema target**: `SensoryInteractionRule` with `tier: "carrier"`, `ruleType: "carry"`.

**Evaluation**: pipeline Step 9, after temporal adjustments.

Carrier rules differ from enhance rules because they scale the target's *existing* value rather than adding to it. If Spicy=0, carrier fires but produces 0 additional Spicy. If Spicy=3, carrier produces +30% ⇒ final Spicy=3.9.

---

### Example 4.1 — Fat carries Spicy (butter + chili)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Fatty",
  "dimB": "Spicy",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.05 },
    { "dose": 1.0, "effect": 0.12 },
    { "dose": 2.0, "effect": 0.25 },
    { "dose": 3.0, "effect": 0.35 },
    { "dose": 4.0, "effect": 0.40 },
    { "dose": 5.0, "effect": 0.42 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "Spicy",
  "maxEffect": 0.45,
  "description": "Capsaicin is hydrophobic — dissolves in fat and distributes evenly over palate. Butter + chili flakes, chili oil, coconut-milk curry all amplify Spicy perception by 25-40% vs water-borne capsaicin.",
  "citations": [
    "Iwai et al. (2003) 'Pungency of capsaicin', Biosci Biotech Biochem 67"
  ],
  "isActive": true
}
```

**Why this matters**: a coconut-milk curry with the same chili dose as a water-based broth reads Spicy=3.5 vs 2.5 — a meaningful difference. Recipe difficulty / kid-friendliness flags rely on accurate Spicy scoring.

---

### Example 4.2 — Fat carries Warm Sweet Spice (cinnamon in cream)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Fatty",
  "dimB": "Warm Sweet Spice",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.20 },
    { "dose": 2.0, "effect": 0.30 },
    { "dose": 3.0, "effect": 0.38 },
    { "dose": 4.0, "effect": 0.40 },
    { "dose": 5.0, "effect": 0.40 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "Warm Sweet Spice",
  "maxEffect": 0.45,
  "description": "Cinnamaldehyde, eugenol, vanillin are lipid-soluble. Infused cream, butter sauces, custards present warm spices far more vividly than water-based infusions.",
  "citations": [
    "Roberts & Taylor (2000) Flavor Release, ACS 763"
  ],
  "isActive": true
}
```

**Why this matters**: rice pudding (dairy + cinnamon) scores Warm Sweet Spice 30-40% higher than rice water with cinnamon. Explains why horchata with whole milk beats horchata with water for spice perception.

---

### Example 4.3 — Fat carries Allium/Sulfurous

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Fatty",
  "dimB": "Allium",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.10 },
    { "dose": 1.0, "effect": 0.18 },
    { "dose": 2.0, "effect": 0.25 },
    { "dose": 3.0, "effect": 0.28 },
    { "dose": 4.0, "effect": 0.30 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "Allium",
  "maxEffect": 0.32,
  "description": "Diallyl sulfides (garlic, onion) are lipid-soluble. Garlic-infused olive oil, bagna cauda, aglio e olio pasta — oil delivers Allium more effectively than water.",
  "citations": [
    "Block (2010) Garlic and Other Alliums"
  ],
  "isActive": true
}
```

**Why this matters**: aglio e olio scores Allium noticeably higher than garlic bread (fat-heavy) vs garlic broth (water-heavy) — explaining why the former is iconic and the latter is usually forgettable.

---

### Example 4.4 — Fat carries general Aroma (baseline)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Fatty",
  "dimB": "*aroma*",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.05 },
    { "dose": 1.0, "effect": 0.10 },
    { "dose": 2.0, "effect": 0.15 },
    { "dose": 3.0, "effect": 0.18 },
    { "dose": 4.0, "effect": 0.20 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "*aroma*",
  "maxEffect": 0.22,
  "description": "Baseline 'fat carries aroma' effect applied to every aroma dim not covered by a more specific rule (4.1, 4.2, 4.3). +15-20% at moderate fat. Specific rules override.",
  "citations": [],
  "isActive": true
}
```

**Why this matters**: generalizes the fat-carrier principle. A fat-heavy dish scores ~15-20% more aromatic across the board. Specific rules supersede (the higher coefficient for Spicy/Warm Sweet Spice/Allium takes precedence over this baseline).

---

### Example 4.5 — Alcohol carries volatile aromatics

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Alcoholic",
  "dimB": "*aroma*",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.05 },
    { "dose": 1.0, "effect": 0.12 },
    { "dose": 2.0, "effect": 0.22 },
    { "dose": 3.0, "effect": 0.28 },
    { "dose": 4.0, "effect": 0.30 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "*aroma*",
  "maxEffect": 0.32,
  "description": "Ethanol lowers the partial pressure required for aromatic volatilization — i.e., it helps aroma compounds leave the liquid and reach the nose. Wine-based sauces, vanilla extract (60% ethanol), bitters, liqueurs — alcohol is a carrier.",
  "citations": [
    "Conner et al. (1998) 'Effect of ethanol on headspace concentration of volatiles', Flavor Res 13"
  ],
  "isActive": true
}
```

**Why this matters**: vanilla extract (ethanol-based) presents Vanilla far more vividly than vanilla bean paste. A rum-raisin ice cream scores Dried Fruit higher than a water-soaked-raisin version. Interacts with temporal rule 3.8 — as alcohol burns off during simmer, this carrier effect decays.

---

### Example 4.6 — Sour brightens aroma (bright-bump)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Sour",
  "dimB": "*aroma*",
  "doseCurve": [
    { "dose": 0.5, "effect": 0.05 },
    { "dose": 1.0, "effect": 0.10 },
    { "dose": 2.0, "effect": 0.15 },
    { "dose": 3.0, "effect": 0.15 },
    { "dose": 4.0, "effect": 0.10 },
    { "dose": 5.0, "effect": 0.00 },
    { "dose": 6.0, "effect": -0.10 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "*aroma*",
  "maxEffect": 0.18,
  "description": "Moderate acid alters saliva and epithelial perfusion, improving retronasal aroma delivery. At very high acid, competition suppresses perception. Overlaps with Tier 1 enhance rule 1.2.2 — carrier captures the mechanism, enhance captures the perceptual boost.",
  "citations": [
    "Djordjevic et al. (2004) Exp Brain Res 159"
  ],
  "isActive": true
}
```

**Why this matters**: the "splash of vinegar" trick to finish a dish — it actually changes aromatic delivery, not just flavor balance. Differentiates technically from enhance 1.2.2 because it's multiplicative on the target dim rather than additive.

---

### Example 4.7 — Heat releases dried-spice aromatics

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Temperature",
  "dimB": "Warm Sweet Spice",
  "doseCurve": [
    { "dose": -6, "effect": -0.40 },
    { "dose": -3, "effect": -0.25 },
    { "dose": -1, "effect": -0.10 },
    { "dose":  0, "effect":  0.00 },
    { "dose":  2, "effect":  0.20 },
    { "dose":  4, "effect":  0.40 },
    { "dose":  6, "effect":  0.55 }
  ],
  "doseUnit": "temperature_index",
  "effectType": "multiply",
  "effectDim": "Warm Sweet Spice",
  "maxEffect": 0.6,
  "description": "Hot dishes release spice volatiles far more readily than cold ones. Cold cinnamon toast tastes muted; hot oatmeal with cinnamon tastes intense. Applies to most dried-spice dims.",
  "citations": [
    "McGee (2004), p. 391-398 (spices)"
  ],
  "isActive": true
}
```

**Why this matters**: paired with mask rule 1.3.7 (temperature masks Sweet), this explains why commercial cold dessert bases need more sugar AND more spice than warm equivalents.

---

### Example 4.8 — Heat burns off fresh herb volatiles (inverse carrier)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Temperature",
  "dimB": "Fresh Herb",
  "doseCurve": [
    { "dose": -3, "effect": 0.10 },
    { "dose":  0, "effect": 0.00 },
    { "dose":  2, "effect": -0.15 },
    { "dose":  4, "effect": -0.35 },
    { "dose":  6, "effect": -0.50 }
  ],
  "doseUnit": "temperature_index",
  "effectType": "multiply",
  "effectDim": "Fresh Herb",
  "maxEffect": -0.55,
  "description": "Fresh herb terpenes evaporate above ~50°C. Room-temp salsa verde: Fresh Herb=1.0. Simmering sauce with fresh parsley: Fresh Herb=0.6. Intersects with Tier 3.2 (fresh herb temporal) — Tier 3 captures the cooking history; Tier 4 captures current serve temperature.",
  "citations": [
    "Jirovetz et al. (2003)"
  ],
  "isActive": true
}
```

**Why this matters**: captures serve-time effect (not cook-time). A pesto served warm scores lower Fresh Herb than pesto served at room temperature. Useful for hot-vs-cold preparations of the same recipe.

---

### Example 4.9 — Salt carries (amplifier at trace)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Salty",
  "dimB": "*taste*",
  "doseCurve": [
    { "dose": 0.0003, "effect": 0.05 },
    { "dose": 0.001,  "effect": 0.12 },
    { "dose": 0.003,  "effect": 0.18 },
    { "dose": 0.005,  "effect": 0.15 },
    { "dose": 0.010,  "effect": 0.10 },
    { "dose": 0.020,  "effect": 0.00 },
    { "dose": 0.030,  "effect": -0.10 }
  ],
  "doseUnit": "percent_mass",
  "effectType": "multiply",
  "effectDim": "*taste*",
  "maxEffect": 0.2,
  "description": "At trace dose, NaCl amplifies all basic taste perception via membrane potential modulation on taste cells. Effect peaks at 0.3% of mass, inverts above 2%.",
  "citations": [
    "Lugaz et al. (2005) 'Time-intensity of taste mixtures', Chemical Senses"
  ],
  "isActive": true
}
```

**Why this matters**: generalization of 1.2.1 (salt + sweet). A trace of salt lifts *every* basic taste perception; at high dose, the effect reverses. Distinct from enhance 1.2.1 because this is multiplicative (scales existing perception), while 1.2.1 is additive.

---

### Example 4.10 — Acid vehicle for aromatic sours (brines + pickles)

```json
{
  "tier": "carrier",
  "ruleType": "carry",
  "dimA": "Sour",
  "dimB": "Lacto-Pickled",
  "doseCurve": [
    { "dose": 1.0, "effect": 0.10 },
    { "dose": 2.0, "effect": 0.20 },
    { "dose": 3.0, "effect": 0.30 },
    { "dose": 4.0, "effect": 0.35 },
    { "dose": 5.0, "effect": 0.40 }
  ],
  "doseUnit": "dim_value",
  "effectType": "multiply",
  "effectDim": "Lacto-Pickled",
  "maxEffect": 0.45,
  "description": "Free lactic/acetic acid in brine amplifies fermented aroma perception. Sauerkraut juice, kimchi brine, pickle liquid — the Sour is inseparable from the fermented character.",
  "citations": [
    "Gänzle (2015) 'Lactic metabolism revisited', Curr Opin Food Sci 2"
  ],
  "isActive": true
}
```

**Why this matters**: why a kimchi-stew made with the full brine tastes more fermented than one made with drained kimchi — the acid vehicle carries the Lacto-Pickled aromatics.

---

# Tier 5 — Emergent Patterns

Named classical combinations whose whole exceeds the sum of parts. Emergence rules recognize patterns and apply a **boost vector** to the recipe profile plus tag it with cuisine/technique markers.

**Schema target**: `CombinationEmergence`.

**Evaluation**: pipeline Step 10. Applied after all Tier 1-4 effects resolved.

Each rule has:
- `triggers`: ingredients or categories that must be present, with minimum doses (`minDose`) and optional roles (`role`)
- `minTriggerCount`: how many of the trigger list must match (allows "3 of these 5" patterns)
- `requiresMethod`: cooking methods required (sauté, braise, etc.)
- `emergentBoosts`: `{ dim: +value }` added to the recipe profile
- `emergentTags`: cuisine/technique labels appended to the recipe
- `harmonyBonus`: added to the harmony score (classical = familiar = pleasant)

---

### Example 5.1 — Mirepoix (French base)

```json
{
  "name": "mirepoix_french",
  "cuisineContext": "French",
  "triggers": [
    { "ingredient": "onion", "minDose": 50, "role": "base" },
    { "ingredient": "carrot", "minDose": 30, "role": "sweetener" },
    { "ingredient": "celery", "minDose": 30, "role": "aromatic" }
  ],
  "minTriggerCount": 3,
  "requiresMethod": ["saute_in_fat", "cook_minutes_min:10"],
  "emergentBoosts": {
    "Complex": 0.80,
    "Umami": 0.30,
    "Broth-Stock": 0.40,
    "Woody Herb": 0.20,
    "Body": 0.40
  },
  "emergentTags": ["french_base", "stock_base", "sauté_aromatic"],
  "harmonyBonus": 0.12,
  "description": "Classical French aromatic base. Ratio 2:1:1 (onion:carrot:celery). Forms the foundation of stocks, braises, stews, soups. Must be cooked in fat ≥10 min for Maillard + vegetable sugar release.",
  "citations": [
    "Escoffier (1903) Le Guide Culinaire",
    "Ruhlman (2007) The Elements of Cooking, p. 44"
  ],
  "isActive": true
}
```

**Why this matters**: a French onion soup, coq au vin, boeuf bourguignon all trigger mirepoix emergence. The +0.8 Complex boost is what makes these dishes taste *together* rather than like separate vegetable sums. The `harmonyBonus` of +0.12 reflects classical-familiar-pleasant bias.

---

### Example 5.2 — Soffritto (Italian)

```json
{
  "name": "soffritto_italian",
  "cuisineContext": "Italian",
  "triggers": [
    { "ingredient": "onion", "minDose": 40, "role": "base" },
    { "ingredient": "carrot", "minDose": 20, "role": "sweetener" },
    { "ingredient": "celery", "minDose": 20, "role": "aromatic" },
    { "ingredient": "garlic", "minDose": 5, "role": "accent", "optional": true },
    { "ingredient": "olive_oil", "minDose": 20, "role": "fat" }
  ],
  "minTriggerCount": 4,
  "requiresMethod": ["saute_olive_oil", "cook_minutes_min:15"],
  "emergentBoosts": {
    "Complex": 0.75,
    "Umami": 0.30,
    "Fresh Herb": 0.20,
    "Broth-Stock": 0.30,
    "Body": 0.40
  },
  "emergentTags": ["italian_base", "ragù_base", "mediterranean"],
  "harmonyBonus": 0.11,
  "description": "Italian variant of mirepoix, cooked longer in olive oil until jammy. Foundation of ragù, minestrone, osso buco. Slightly sweeter than French mirepoix due to longer sauté.",
  "citations": [
    "Hazan (1992) Essentials of Classic Italian Cooking"
  ],
  "isActive": true
}
```

**Why this matters**: soffritto-based ragù scores differently from a mirepoix-based French braise despite sharing vegetables — the olive oil + longer cook time shift the Complex/Fresh Herb profile. Tag enables "Italian-base recipes" filter in the recommender.

---

### Example 5.3 — Sofrito (Spanish/Caribbean)

```json
{
  "name": "sofrito_spanish",
  "cuisineContext": "Spanish_Caribbean",
  "triggers": [
    { "ingredient": "onion", "minDose": 40, "role": "base" },
    { "ingredient": "bell_pepper", "minDose": 30, "role": "sweetener" },
    { "ingredient": "garlic", "minDose": 8, "role": "aromatic" },
    { "ingredient": "tomato", "minDose": 40, "role": "acid_umami" },
    { "ingredient": "olive_oil", "minDose": 15, "role": "fat" },
    { "ingredient": "cilantro", "minDose": 3, "role": "herb", "optional": true }
  ],
  "minTriggerCount": 4,
  "requiresMethod": ["saute", "cook_minutes_min:12"],
  "emergentBoosts": {
    "Complex": 0.70,
    "Umami": 0.45,
    "Fruity": 0.20,
    "Allium": 0.30,
    "Body": 0.30,
    "Fresh Herb": 0.20
  },
  "emergentTags": ["spanish_base", "caribbean_base", "latin", "tomato_base"],
  "harmonyBonus": 0.10,
  "description": "Spanish/Latin American base with tomato and bell pepper. Puerto Rican version adds recao/cilantro + ají. Foundation of arroz con pollo, paella, ropa vieja, Cuban black beans.",
  "citations": [
    "Ortiz (1994) A Taste of Puerto Rico",
    "Sevilla Soler (2007) La cocina española"
  ],
  "isActive": true
}
```

**Why this matters**: sofrito-based dishes score Umami +0.45 (from the tomato glutamate amplified by garlic/onion prep), enabling the system to rank Latin dishes as "savory/satisfying" appropriately.

---

### Example 5.4 — Holy Trinity (Cajun)

```json
{
  "name": "holy_trinity_cajun",
  "cuisineContext": "Cajun_Creole",
  "triggers": [
    { "ingredient": "onion", "minDose": 40, "role": "base" },
    { "ingredient": "celery", "minDose": 25, "role": "aromatic" },
    { "ingredient": "bell_pepper", "minDose": 30, "role": "sweetener" }
  ],
  "minTriggerCount": 3,
  "requiresMethod": ["saute", "cook_minutes_min:10"],
  "emergentBoosts": {
    "Complex": 0.70,
    "Fresh Herb": 0.20,
    "Umami": 0.25,
    "Broth-Stock": 0.30,
    "Body": 0.35
  },
  "emergentTags": ["cajun_base", "creole_base", "southern_us"],
  "harmonyBonus": 0.10,
  "description": "Louisiana analogue of mirepoix — celery instead of carrot, bell pepper for sweet. Foundation of gumbo, étouffée, jambalaya. Often paired with dark roux (rule 2.12) for gumbo body.",
  "citations": [
    "Prudhomme (1984) Chef Paul Prudhomme's Louisiana Kitchen"
  ],
  "isActive": true
}
```

**Why this matters**: tags recipe as Cajun/Creole regardless of declared cuisine. Cross-cultural recipe matching uses these tags to find "Louisiana-style" dishes regardless of labeling.

---

### Example 5.5 — Masala base (Indian)

```json
{
  "name": "masala_base_indian",
  "cuisineContext": "Indian",
  "triggers": [
    { "ingredient": "onion", "minDose": 60, "role": "base" },
    { "ingredient": "ginger", "minDose": 5, "role": "aromatic" },
    { "ingredient": "garlic", "minDose": 8, "role": "aromatic" },
    { "ingredient": "tomato", "minDose": 50, "role": "acid_umami" },
    { "category": "warm_spice_mix", "minDose": 3, "role": "spice", "includes": ["cumin", "coriander", "turmeric", "cardamom", "clove", "cinnamon"] },
    { "ingredient": "green_chili", "minDose": 2, "role": "heat", "optional": true }
  ],
  "minTriggerCount": 4,
  "requiresMethod": ["saute", "bhuna", "cook_minutes_min:20"],
  "emergentBoosts": {
    "Complex": 0.90,
    "Warm Sweet Spice": 0.50,
    "Savory Spice": 0.60,
    "Exotic-Curry": 0.70,
    "Umami": 0.30,
    "Body": 0.40
  },
  "emergentTags": ["indian_base", "curry_base", "south_asian"],
  "harmonyBonus": 0.13,
  "description": "Onion-tomato-spice base (bhuna) is foundational to North/West Indian gravies. The spice bloom in hot oil activates volatile extraction. Longer cook = deeper Exotic-Curry.",
  "citations": [
    "Jaffrey (1982) An Invitation to Indian Cooking",
    "Singh (2019) India: The Cookbook"
  ],
  "isActive": true
}
```

**Why this matters**: tikka masala, butter chicken, palak paneer, rogan josh all trigger this base. The +0.7 Exotic-Curry is the dim that lets users search for "Indian curry" intuitively.

---

### Example 5.6 — Dashi stack (Japanese umami)

```json
{
  "name": "dashi_stack_japanese",
  "cuisineContext": "Japanese",
  "triggers": [
    { "ingredient": "kombu", "minDose": 5, "role": "glutamate" },
    { "ingredient": "bonito_flakes", "minDose": 10, "role": "inosinate", "alternatives": ["niboshi", "anchovy_dried"] },
    { "ingredient": "shiitake_dried", "minDose": 3, "role": "guanylate", "optional": true },
    { "ingredient": "water", "minDose": 500, "role": "solvent" }
  ],
  "minTriggerCount": 3,
  "requiresMethod": ["cold_infuse_kombu", "steep_bonito"],
  "emergentBoosts": {
    "Umami": 2.50,
    "Kokumi": 1.00,
    "Broth-Stock": 1.50,
    "Seaweed": 0.60,
    "Fish-Fermented": 0.30,
    "Body": 0.50,
    "Complex": 0.50
  },
  "emergentTags": ["japanese_base", "umami_bomb", "dashi"],
  "harmonyBonus": 0.15,
  "description": "Kombu provides glutamate (L-form), bonito provides inosinate (IMP); together they synergize multiplicatively (Tier 1.4.1). Adding shiitake (guanylate, GMP) further amplifies. The Umami +2.5 here is *on top of* the Tier 1 synergy — it's the pattern-level gestalt beyond even that.",
  "citations": [
    "Yamaguchi (1991) Food Reviews International",
    "Tsuji (1980) Japanese Cooking: A Simple Art"
  ],
  "isActive": true
}
```

**Why this matters**: dashi is the single most "umami-dense" technique in all of cooking. The emergence rule layers on top of the Tier 1 umami synergy to capture the overall gestalt including aroma (Seaweed, Fish-Fermented) that the perceptual rule can't model.

---

### Example 5.7 — Béchamel (mother sauce)

```json
{
  "name": "bechamel_french",
  "cuisineContext": "French",
  "triggers": [
    { "ingredient": "butter", "minDose": 30, "role": "fat" },
    { "ingredient": "flour", "minDose": 30, "role": "starch" },
    { "ingredient": "milk_whole", "minDose": 500, "role": "liquid" },
    { "ingredient": "nutmeg", "minDose": 0.2, "role": "spice", "optional": true },
    { "ingredient": "bay_leaf", "minDose": 1, "role": "aromatic", "optional": true }
  ],
  "minTriggerCount": 3,
  "requiresMethod": ["make_roux", "whisk_add_milk", "simmer"],
  "emergentBoosts": {
    "Creamy": 1.50,
    "Silky": 1.00,
    "Body": 0.80,
    "Butter": 0.50,
    "Warm Sweet Spice": 0.15
  },
  "emergentTags": ["mother_sauce", "french_technique", "creamy_base"],
  "harmonyBonus": 0.12,
  "description": "Blonde roux + milk = béchamel. Foundation of mornay, soubise, lasagna white sauce. Roux must be cooked out (>2 min) to lose raw-flour taste.",
  "citations": [
    "Escoffier (1903) Le Guide Culinaire",
    "Peterson (2007) Sauces, 3rd ed"
  ],
  "isActive": true
}
```

**Why this matters**: lasagna bolognese + béchamel triggers both béchamel emergence and soffritto emergence. The +1.5 Creamy is the definitional hallmark of béchamel and differentiates it from a cream reduction.

---

### Example 5.8 — Hollandaise (emulsion sauce)

```json
{
  "name": "hollandaise_french",
  "cuisineContext": "French",
  "triggers": [
    { "ingredient": "egg_yolk", "minDose": 30, "role": "emulsifier" },
    { "ingredient": "butter_clarified", "minDose": 150, "role": "fat", "alternatives": ["butter"] },
    { "ingredient": "lemon_juice", "minDose": 10, "role": "acid" },
    { "ingredient": "water_or_wine", "minDose": 15, "role": "liquid" }
  ],
  "minTriggerCount": 3,
  "requiresMethod": ["double_boiler_or_sabayon", "whisk_emulsify", "temp_below_70C"],
  "emergentBoosts": {
    "Creamy": 1.50,
    "Silky": 1.20,
    "Butter": 0.80,
    "Sour": 0.50,
    "Body": 0.60,
    "Fresh": 0.30
  },
  "emergentTags": ["mother_sauce", "french_technique", "emulsion_sauce"],
  "harmonyBonus": 0.12,
  "description": "Warm emulsion of egg yolk + butter + acid. Must hold below 70°C (egg coagulates). Lemon brightens. Variants: béarnaise (add tarragon), maltaise (add orange).",
  "citations": [
    "Escoffier (1903)",
    "Peterson (2007)"
  ],
  "isActive": true
}
```

**Why this matters**: eggs benedict triggers hollandaise emergence; the 0.5 Sour from lemon plus 1.5 Creamy is the signature "bright-rich" character. Without the rule, it would score like a generic butter sauce.

---

### Example 5.9 — Caprese (Italian classic)

```json
{
  "name": "caprese_italian",
  "cuisineContext": "Italian",
  "triggers": [
    { "ingredient": "tomato_fresh", "minDose": 100, "role": "fruit_acid" },
    { "ingredient": "mozzarella_fresh", "minDose": 80, "role": "dairy" },
    { "ingredient": "basil_fresh", "minDose": 5, "role": "herb" },
    { "ingredient": "olive_oil", "minDose": 10, "role": "fat" },
    { "ingredient": "salt", "minDose": 0.5, "role": "seasoning" }
  ],
  "minTriggerCount": 4,
  "requiresMethod": ["raw_assembly", "serve_room_temp"],
  "emergentBoosts": {
    "Complex": 1.00,
    "Fresh": 0.60,
    "Umami": 0.30,
    "Fruity": 0.30,
    "Fresh Herb": 0.30,
    "Creamy": 0.30,
    "Body": 0.20
  },
  "emergentTags": ["italian_classic", "summer_dish", "raw_assembly"],
  "harmonyBonus": 0.14,
  "description": "Tomato glutamate + mozzarella dairy + basil terpenes + olive oil fat carrier — minimal preparation, maximum perceived complexity. The olive oil serves as both flavor carrier AND binder for the assembled layers.",
  "citations": [
    "Hazan (1992)",
    "Bastianich (2013) Lidia's Commonsense Italian Cooking"
  ],
  "isActive": true
}
```

**Why this matters**: a simple 4-ingredient salad that punches above its weight because of the pattern. Without the emergence rule, caprese would score similarly to a basic tomato salad with cheese.

---

### Example 5.10 — Umami bomb (3+ glutamate-rich ingredients)

```json
{
  "name": "umami_bomb_threshold",
  "cuisineContext": "universal",
  "triggers": [
    { "category": "glutamate_source", "minDose": 10, "role": "umami", "includes": ["tomato", "parmesan", "shiitake", "soy_sauce", "fish_sauce", "anchovy", "miso", "nutritional_yeast", "aged_cheese", "cured_meat"] }
  ],
  "minTriggerCount": 3,
  "requiresMethod": [],
  "emergentBoosts": {
    "Umami": 1.00,
    "Kokumi": 0.50,
    "Rich": 0.50,
    "Body": 0.30,
    "Complex": 0.40
  },
  "emergentTags": ["umami_bomb", "savory_dense"],
  "harmonyBonus": 0.10,
  "description": "3+ glutamate-rich ingredients trigger an additional Umami bomb on top of Tier 1 synergy. Pasta with tomato + parmesan + anchovy + mushroom hits 4 sources — 'more-than-sum' effect.",
  "citations": [
    "Kurihara (2015) 'Umami the Fifth Basic Taste', Biomed Res Int"
  ],
  "isActive": true
}
```

**Why this matters**: triggers for a huge range of Italian, Japanese, Thai dishes. Captures the gestalt of "savory-dense" that single pair-wise synergies miss.

---

### Example 5.11 — Brown butter (beurre noisette)

```json
{
  "name": "beurre_noisette",
  "cuisineContext": "French",
  "triggers": [
    { "ingredient": "butter", "minDose": 30, "role": "fat" }
  ],
  "minTriggerCount": 1,
  "requiresMethod": ["cook_butter_temp:120", "cook_until_brown_solids"],
  "emergentBoosts": {
    "Butter": -0.50,
    "Nutty": 1.50,
    "Toffee-Caramel": 0.50,
    "Meat-Roast": 0.30,
    "Complex": 0.40
  },
  "emergentTags": ["brown_butter_technique", "nutty_fat"],
  "harmonyBonus": 0.08,
  "description": "Milk-solid proteins in butter brown via Maillard when heated above 120°C. Fresh-butter character decreases; Nutty/Toffee character dominates. Used for finishing fish, gnocchi, pasta, desserts.",
  "citations": [
    "McGee (2004), p. 33-34",
    "Bittman (2008) How to Cook Everything"
  ],
  "isActive": true
}
```

**Why this matters**: a single-ingredient emergence. Brown butter is a transformation, not a combination. The Butter dim *decreases* (the fresh-dairy character is gone) while Nutty, Toffee-Caramel, and Complex gain.

---

### Example 5.12 — Caramelized onion (time-based emergence)

```json
{
  "name": "caramelized_onion_deep",
  "cuisineContext": "universal",
  "triggers": [
    { "ingredient": "onion", "minDose": 100, "role": "sugar_source" },
    { "ingredient": "fat", "minDose": 15, "role": "heat_medium" }
  ],
  "minTriggerCount": 2,
  "requiresMethod": ["saute_low_heat", "cook_minutes_min:45"],
  "emergentBoosts": {
    "Allium": -0.70,
    "Pungent": -0.80,
    "Sulfurous": -0.50,
    "Sweet": 2.00,
    "Caramelized": 1.00,
    "Toffee-Caramel": 0.70,
    "Body": 0.40,
    "Complex": 0.50,
    "Umami": 0.30
  },
  "emergentTags": ["caramelized_onion", "sweet_savory_base"],
  "harmonyBonus": 0.11,
  "description": "45+ minute low-heat onion sauté transforms pungent Allium into sweet-caramel base. Foundation of French onion soup, onion jam, biryani onion base.",
  "citations": [
    "McGee (2004), p. 311-312"
  ],
  "isActive": true
}
```

**Why this matters**: overlaps with temporal rule 3.9 (onion timing) but adds cross-dim gestalt (Complex, Body, Umami). French onion soup triggers both 3.9 (per-ingredient) AND 5.12 (pattern) — layered effects.

---

### Example 5.13 — Chile + Chocolate (mole base)

```json
{
  "name": "mole_chile_chocolate",
  "cuisineContext": "Mexican",
  "triggers": [
    { "category": "dried_chile", "minDose": 10, "role": "heat_depth", "includes": ["ancho", "guajillo", "pasilla", "mulato", "chipotle"] },
    { "ingredient": "dark_chocolate", "minDose": 15, "role": "bitter_round" },
    { "category": "warm_spice", "minDose": 2, "role": "spice", "includes": ["cinnamon", "clove", "allspice", "anise"], "optional": true },
    { "ingredient": "nut_or_seed", "minDose": 20, "role": "body", "optional": true }
  ],
  "minTriggerCount": 2,
  "requiresMethod": ["toast_chiles", "blend", "simmer"],
  "emergentBoosts": {
    "Complex": 1.20,
    "Dark Cocoa": 0.50,
    "Spicy": 0.40,
    "Warm Sweet Spice": 0.40,
    "Body": 0.60,
    "Umami": 0.30
  },
  "emergentTags": ["mole_base", "mexican_classic"],
  "harmonyBonus": 0.12,
  "description": "Toasted chiles + dark chocolate + warm spice = mole poblano base. The chocolate rounds bitter edges of chiles; the chiles add dimension to the chocolate. One of the most structurally complex flavor emergences in traditional cuisine.",
  "citations": [
    "Kennedy (1972) The Cuisines of Mexico",
    "Kennedy (2000) My Mexico"
  ],
  "isActive": true
}
```

**Why this matters**: mole is often miscategorized because individual ingredients look unusual together. The emergence rule recognizes the classical pattern and lifts Complex +1.2.

---

### Example 5.14 — Strawberry + balsamic (acid-fruit bump)

```json
{
  "name": "strawberry_balsamic",
  "cuisineContext": "Italian_modern",
  "triggers": [
    { "ingredient": "strawberry", "minDose": 50, "role": "fruit" },
    { "ingredient": "balsamic_vinegar", "minDose": 3, "role": "acid_aged" }
  ],
  "minTriggerCount": 2,
  "requiresMethod": [],
  "emergentBoosts": {
    "Complex": 0.80,
    "Sweet": 0.20,
    "Berry": 0.30,
    "Barrel-Aged": 0.30,
    "Fresh": 0.25
  },
  "emergentTags": ["modern_italian", "sweet_sour_fruit"],
  "harmonyBonus": 0.09,
  "description": "Aged balsamic glaze on fresh berries — classic acid-fruit pairing. Balsamic's wood-aged character and residual sweetness complement strawberry methyl cinnamate volatiles.",
  "citations": [
    "Artusi (1891) La scienza in cucina e l'arte di mangiar bene"
  ],
  "isActive": true
}
```

**Why this matters**: a 2-ingredient emergence. Without it, strawberries with balsamic would score like strawberries with any vinegar — missing the Barrel-Aged character lift that makes the dish iconic.

---

### Example 5.15 — Tomato + basil + olive oil (Mediterranean triad)

```json
{
  "name": "tomato_basil_olive_oil",
  "cuisineContext": "Mediterranean",
  "triggers": [
    { "ingredient": "tomato", "minDose": 80, "role": "fruit_acid_umami" },
    { "ingredient": "basil_fresh", "minDose": 3, "role": "herb" },
    { "ingredient": "olive_oil_extra_virgin", "minDose": 10, "role": "fat_flavor" }
  ],
  "minTriggerCount": 3,
  "requiresMethod": [],
  "emergentBoosts": {
    "Complex": 0.60,
    "Fresh Herb": 0.30,
    "Fresh": 0.40,
    "Fruity": 0.20,
    "Umami": 0.20
  },
  "emergentTags": ["mediterranean_triad", "italian_summer"],
  "harmonyBonus": 0.09,
  "description": "The base of almost every Italian summer dish. Tomato glutamate + basil eugenol/linalool + olive oil (fruity polyphenols) form a chord greater than their sum.",
  "citations": [
    "Hazan (1992)",
    "Andrews (2014) The Country Cooking of Italy"
  ],
  "isActive": true
}
```

**Why this matters**: bruschetta, caprese, pasta al pomodoro, pizza Margherita all layer on this base. Creates a clean Italian-summer signal in the recommender.

---

# Tier 6 — Clashes

Combinations that **lower pleasantness** without changing the sensory profile. Clash rules contribute to a harmony-score *penalty*, not a dim adjustment.

**Schema target**: `FlavorClashRule`.

**Evaluation**: pipeline Step 11. Detected clashes are stored in `Recipe.detectedClashes` with reason + severity and applied against `harmonyScoreUniversal`.

Severity is dose-based, not binary. A trace of mint in a beef stew barely clashes; a cup of mint is intolerable.

Each rule has:
- `scopeType`: `"ingredient_pair"`, `"category_pair"`, `"dim_combination"`
- `severityCurve`: `[{ dose, severity }]` where severity ∈ [0, 1]
- `cultures`: list of cultures where the clash applies (`"universal"` or specific)
- `exceptions`: ingredients or combinations that resolve the clash
- `reason`: human-readable explanation shown in "why lower harmony" tooltips

---

### Example 6.1 — Mint + aged beef (with lamb exception)

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "mint_fresh",
  "ingredientB": "beef_aged",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.20 },
    { "dose": 1.5, "severity": 0.45 },
    { "dose": 3.0, "severity": 0.60 },
    { "dose": 5.0, "severity": 0.70 }
  ],
  "doseUnit": "grams_mint_per_100g_beef",
  "cultures": ["western", "mediterranean"],
  "exceptions": [
    { "ingredient": "lamb", "reason": "classical mint-lamb pairing" },
    { "cuisine": "vietnamese", "reason": "pho-style mint-beef is culturally established" },
    { "cuisine": "levantine", "reason": "kibbeh with mint works" }
  ],
  "reason": "Cooling menthol clashes with aged-meat glutamate/aromatic compounds in Western cuisine. Mint's volatile cooling overwhelms meat's umami depth.",
  "citations": [
    "Flavor pairing analysis (Ahn et al. 2011, Nature Sci Reports)"
  ],
  "isActive": true
}
```

**Why this matters**: the canonical example. The exception for lamb is critical — mint sauce with roast lamb is a British culinary staple. Without the exception, lamb recipes would score unfairly low.

---

### Example 6.2 — Mint + delicate fish

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "mint_fresh",
  "ingredientB": "fish_delicate_white",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.30 },
    { "dose": 1.5, "severity": 0.50 },
    { "dose": 3.0, "severity": 0.65 }
  ],
  "doseUnit": "grams_mint_per_100g_fish",
  "cultures": ["western"],
  "exceptions": [
    { "cuisine": "vietnamese", "reason": "mint in nuoc cham / fish salads" },
    { "cuisine": "thai", "reason": "mint in larb or som tam with fish" }
  ],
  "reason": "Delicate fish proteins are masked by menthol cooling. Fish flavor molecules are too subtle to compete.",
  "isActive": true
}
```

**Why this matters**: prevents Western sauces from pairing mint with cod/sole/flounder. Southeast Asian cuisines have established techniques that use this combination intentionally — culturally scoped.

---

### Example 6.3 — Chocolate + fish (universal, strong)

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "chocolate",
  "ingredientB": "fish_any",
  "severityCurve": [
    { "dose": 0.2, "severity": 0.50 },
    { "dose": 1.0, "severity": 0.85 },
    { "dose": 3.0, "severity": 0.95 }
  ],
  "doseUnit": "grams_chocolate_per_100g_fish",
  "cultures": ["universal"],
  "exceptions": [
    { "ingredient": "oyster_with_cocoa_nib_tasting_menu", "reason": "specific high-end tasting menu pairings documented (Heston Blumenthal)" }
  ],
  "reason": "Dark-cocoa bitter-roast volatiles and fish trimethylamine notes are structurally incompatible. One of the most universal flavor clashes documented.",
  "citations": [
    "Ahn et al. (2011) 'Flavor network and the principles of food pairing', Nature Sci Reports 1:196"
  ],
  "isActive": true
}
```

**Why this matters**: a strong universal clash with minimal exceptions. The curve starts high severity (0.5 at 0.2g) because even trace chocolate in a fish dish is jarring.

---

### Example 6.4 — Cooling dim + Meaty-Aged dim (dim_combination scope)

```json
{
  "scopeType": "dim_combination",
  "dimConstraints": {
    "Cooling": ">=1.5",
    "Meat-Roast": ">=2.0",
    "Cured-Preserved": ">=1.0"
  },
  "severityCurve": [
    { "dose": 1.0, "severity": 0.30 },
    { "dose": 2.0, "severity": 0.55 },
    { "dose": 3.5, "severity": 0.70 },
    { "dose": 5.0, "severity": 0.85 }
  ],
  "doseUnit": "geometric_mean_of_cooling_and_aged",
  "cultures": ["western"],
  "exceptions": [
    { "ingredient": "lamb", "reason": "mint-lamb pairing" },
    { "cuisine": "vietnamese" },
    { "cuisine": "thai" }
  ],
  "reason": "Menthol cooling + aged-meat savor is an umbrella clash covering many specific ingredient pairs (mint+bacon, mint+aged-cheese, cooling+prosciutto).",
  "isActive": true
}
```

**Why this matters**: dim_combination scope catches patterns that individual ingredient_pair rules miss. A Viet-inspired recipe with pho-mint + short ribs triggers this but is rescued by the Vietnamese culture exception.

---

### Example 6.5 — Floral-Delicate + Brassica (category_pair scope)

```json
{
  "scopeType": "category_pair",
  "categoryA": "floral_delicate_herb",
  "categoryB": "brassica_sulfur",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.25 },
    { "dose": 1.5, "severity": 0.45 },
    { "dose": 3.0, "severity": 0.55 }
  ],
  "doseUnit": "geometric_mean_doses",
  "cultures": ["universal"],
  "exceptions": [
    { "combination": ["cauliflower", "saffron"], "reason": "Mediterranean classic" },
    { "combination": ["broccoli", "chamomile_tea_poach"], "reason": "specific fusion technique" }
  ],
  "reason": "Delicate floral volatiles (lavender, violet, elderflower) are overwhelmed by brassica sulfurous compounds (allyl isothiocyanate in broccoli, cabbage, mustard greens).",
  "isActive": true
}
```

**Why this matters**: covers lavender + broccoli, elderflower + cabbage, jasmine + brussels sprouts. Universal because it's a basic volatile mismatch, not a cultural preference.

---

### Example 6.6 — Blue cheese + delicate white fish

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "blue_cheese",
  "ingredientB": "fish_delicate_white",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.35 },
    { "dose": 1.5, "severity": 0.60 },
    { "dose": 3.0, "severity": 0.75 }
  ],
  "doseUnit": "grams_cheese_per_100g_fish",
  "cultures": ["universal"],
  "exceptions": [
    { "ingredient": "swordfish", "reason": "meatier fish tolerates blue" },
    { "ingredient": "monkfish", "reason": "meatier profile" }
  ],
  "reason": "Blue-moldy pungency (methyl ketones, 2-heptanone) overwhelms delicate fish flavors. Fatty/oily fish (salmon) holds up better; delicate white (sole, flounder, tilapia) disappears.",
  "isActive": true
}
```

**Why this matters**: a classic "chef's rule" encoded. A sole recipe with blue cheese sauce correctly flags as low-harmony.

---

### Example 6.7 — Warm sweet spice + fermented fish

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "cinnamon_or_clove_or_nutmeg",
  "ingredientB": "fish_sauce_or_anchovy_or_shrimp_paste",
  "severityCurve": [
    { "dose": 0.2, "severity": 0.40 },
    { "dose": 1.0, "severity": 0.65 },
    { "dose": 3.0, "severity": 0.80 }
  ],
  "doseUnit": "geometric_mean_grams",
  "cultures": ["western", "mediterranean"],
  "exceptions": [
    { "cuisine": "vietnamese", "reason": "pho broth contains both cinnamon and fish sauce" },
    { "cuisine": "thai", "reason": "some curries use cinnamon + fish sauce together" },
    { "cuisine": "sri_lankan", "reason": "black curry uses cinnamon + maldive fish" }
  ],
  "reason": "Sweet-warm spice aromatics (cinnamaldehyde, eugenol) clash with fermented-fish trimethylamine/DMS in Western cuisine. SE Asian cuisines have cultural techniques that resolve this.",
  "isActive": true
}
```

**Why this matters**: a Italian pork ragù with a pinch of cinnamon + anchovies works (both at trace) but a sweet-spiced ragù loaded with fish sauce would clash. Culture scoping ensures pho and Thai curries aren't penalized.

---

### Example 6.8 — Dairy + citrus high-dose (perceptual + physical)

```json
{
  "scopeType": "category_pair",
  "categoryA": "fresh_dairy",
  "categoryB": "citrus_juice",
  "severityCurve": [
    { "dose": 0.03, "severity": 0.20 },
    { "dose": 0.05, "severity": 0.35 },
    { "dose": 0.08, "severity": 0.55 },
    { "dose": 0.12, "severity": 0.75 }
  ],
  "doseUnit": "acid_to_dairy_mass_ratio",
  "cultures": ["universal"],
  "exceptions": [
    { "stabilizer": "egg_yolk", "reason": "emulsifies — Caesar dressing, hollandaise" },
    { "stabilizer": "mustard", "reason": "stabilizes emulsion" },
    { "stabilizer": "starch", "reason": "binds water, prevents curdle" },
    { "combination": ["buttermilk", "lemon"], "reason": "buttermilk is already acidified — separate rule" }
  ],
  "reason": "Beyond 5% acid:dairy, visible curdling appears (physical Tier 2 rule) and perceived harmony drops. Stabilizers resolve both the physical breakdown and the perceptual clash.",
  "isActive": true,
  "relatedPhysicalRule": "acid_in_dairy_curdling"
}
```

**Why this matters**: perceptual-level clash that shadows the Tier 2 physical rule (2.1). Even if stabilizers prevent visible curdle, at very high acid the taste is unbalanced. This rule captures the perceptual unbalance; Tier 2 captures the physical breakdown.

---

### Example 6.9 — Cinnamon + fresh fish

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "cinnamon",
  "ingredientB": "fish_fresh_white",
  "severityCurve": [
    { "dose": 0.1, "severity": 0.45 },
    { "dose": 0.5, "severity": 0.70 },
    { "dose": 1.5, "severity": 0.85 }
  ],
  "doseUnit": "grams_per_100g_fish",
  "cultures": ["western"],
  "exceptions": [
    { "cuisine": "moroccan", "reason": "some tagines use cinnamon with fish" },
    { "cuisine": "sri_lankan" }
  ],
  "reason": "Cinnamaldehyde dominates delicate fish volatiles, leaving a cloying sweet-fishy mismatch. Western cooks virtually never combine them.",
  "isActive": true
}
```

**Why this matters**: flags Western seafood recipes that accidentally include cinnamon (common in AI-generated recipes). Moroccan tagine exception preserves legit ethnic uses.

---

### Example 6.10 — Tannic red wine + delicate seafood

```json
{
  "scopeType": "category_pair",
  "categoryA": "tannic_wine_high",
  "categoryB": "seafood_delicate",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.40 },
    { "dose": 1.5, "severity": 0.60 },
    { "dose": 3.0, "severity": 0.75 }
  ],
  "doseUnit": "tannin_index_x_fish_mass",
  "cultures": ["universal"],
  "exceptions": [
    { "seafood": "tuna_seared", "reason": "meaty fish holds tannin" },
    { "seafood": "grilled_squid", "reason": "grilling adds tannin-compatible char" }
  ],
  "reason": "High tannins (proanthocyanidins) bind to fish protein and produce metallic/bitter perception. Classical sommelier rule: fish with white wine, not red.",
  "citations": [
    "Tamura et al. (2009) 'Role of cysteine in off-flavors of wine-fish pairings', J Food Sci 74"
  ],
  "isActive": true
}
```

**Why this matters**: used in the wine-pairing algorithm to warn when recipes suggest red wine with delicate seafood. Exceptions preserve legit meaty-fish pairings.

---

### Example 6.11 — Anise + dairy (subtle clash)

```json
{
  "scopeType": "ingredient_pair",
  "ingredientA": "anise_or_fennel_seed",
  "ingredientB": "cream_or_milk",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.20 },
    { "dose": 2.0, "severity": 0.35 },
    { "dose": 5.0, "severity": 0.50 }
  ],
  "doseUnit": "grams_spice_per_100g_dairy",
  "cultures": ["western"],
  "exceptions": [
    { "combination": ["fennel_cream_sauce", "seared_fish"], "reason": "French technique" },
    { "ingredient": "pastis_liqueur", "reason": "alcoholic variant" }
  ],
  "reason": "Anethole (anise volatile) interacts oddly with milk fat — produces a soapy perception (the 'ouzo effect' at high dose). Moderate doses are fine; heavy doses clash.",
  "citations": [
    "Sitzmann (2010) 'The ouzo effect' Chem Senses 35"
  ],
  "isActive": true
}
```

**Why this matters**: a rarely-discussed but real clash. Explains why anise + heavy cream rarely appears in classical recipes except in French technique (where it's balanced carefully).

---

### Example 6.12 — Carbonated + hot dense protein

```json
{
  "scopeType": "dim_combination",
  "dimConstraints": {
    "Carbonated": ">=1.5",
    "Temperature": ">=3",
    "Body": ">=2.5"
  },
  "severityCurve": [
    { "dose": 1.0, "severity": 0.20 },
    { "dose": 2.5, "severity": 0.30 },
    { "dose": 4.0, "severity": 0.40 }
  ],
  "doseUnit": "product_of_carbonated_and_temp",
  "cultures": ["western"],
  "exceptions": [
    { "dish": "beer_battered_fish", "reason": "carbonation is mechanical, not served" },
    { "dish": "risotto_finished_with_prosecco", "reason": "finish only" }
  ],
  "reason": "Carbonation + hot dense proteins creates foam-protein film that most diners find off-putting. Low-priority aesthetic clash.",
  "isActive": true
}
```

**Why this matters**: a soft clash (max severity 0.40) — aesthetic rather than fundamental. Useful for flagging unusual pairings without rejecting them.

---

### Example 6.13 — Coffee-roast + delicate fruit

```json
{
  "scopeType": "category_pair",
  "categoryA": "coffee_strong",
  "categoryB": "fruit_delicate_floral",
  "severityCurve": [
    { "dose": 1.0, "severity": 0.35 },
    { "dose": 2.5, "severity": 0.55 },
    { "dose": 5.0, "severity": 0.70 }
  ],
  "doseUnit": "geometric_mean_dim_values",
  "cultures": ["universal"],
  "exceptions": [
    { "combination": ["coffee", "banana"], "reason": "established dessert pair" },
    { "combination": ["coffee", "cardamom"], "reason": "MENA tradition" }
  ],
  "reason": "Coffee-roast bitter-roast volatiles (pyrazines, furfurals) overwhelm delicate fruit (peach, pear, lychee, elderflower).",
  "isActive": true
}
```

**Why this matters**: warns against coffee-glazed peach, espresso-lychee pairings. Most exceptions are robust fruits (banana, fig, cherry).

---

### Example 6.14 — Bitter greens + sweet dessert

```json
{
  "scopeType": "category_pair",
  "categoryA": "bitter_leaf",
  "categoryB": "sweet_dessert_primary",
  "severityCurve": [
    { "dose": 1.0, "severity": 0.30 },
    { "dose": 3.0, "severity": 0.50 },
    { "dose": 5.0, "severity": 0.65 }
  ],
  "doseUnit": "geometric_mean_grams",
  "cultures": ["western"],
  "exceptions": [
    { "combination": ["dandelion_greens", "honey_glaze"], "reason": "Italian tradition" },
    { "combination": ["radicchio", "balsamic_reduction"], "reason": "classic Italian pairing" }
  ],
  "reason": "Heavily bitter greens compete with dessert-level sweet, producing disjointed course arcs. Moderate doses (bittersweet salad with fruit) work; heavy bitter in a sugar-forward context does not.",
  "isActive": true
}
```

**Why this matters**: flags AI-generated recipes that pair kale with buttercream frosting. The Italian exceptions preserve legit bittersweet traditions.

---

### Example 6.15 — Seafood + aged cheese

```json
{
  "scopeType": "category_pair",
  "categoryA": "seafood_shellfish",
  "categoryB": "aged_cheese_hard",
  "severityCurve": [
    { "dose": 0.5, "severity": 0.35 },
    { "dose": 2.0, "severity": 0.55 },
    { "dose": 5.0, "severity": 0.70 }
  ],
  "doseUnit": "grams_cheese_per_100g_seafood",
  "cultures": ["italian", "mediterranean"],
  "exceptions": [
    { "combination": ["seafood_pasta_with_trace_parm", "< 5g per plate"], "reason": "a sprinkle is debated; this catches heavy use" },
    { "cuisine": "northern_european", "reason": "fish-pie-with-cheddar is traditional" }
  ],
  "reason": "Italian 'no cheese on seafood pasta' rule. Aged-cheese glutamate + shellfish trimethylamine creates an overloaded umami-briny that feels heavy. Northern European traditions disagree.",
  "isActive": true
}
```

**Why this matters**: a culturally-scoped rule. Flags in Italian-styled dishes but permits cheesy fish pies in Northern European categorizations.

---

# How to use these examples

## Copy / modify workflow

1. Locate the tier your new rule belongs in (see [decision tree](#decision-tree-which-tier)).
2. Copy the closest-matching example block as your starting point.
3. Replace ingredients, dims, and dose values with your target data.
4. If you need a new dose unit, check `doseUnit` conventions in section [6. Dose-Response System](sensory-compound-knowledge-base.md#6-dose-response-system) of the master KB.
5. Write the `description` field — one sentence on what the rule does, mechanism if relevant.
6. Add `citations` if you have them; not required but preferred.
7. Run the seed validator (below) before committing.

**When in doubt**, propose the rule via `sensory: propose <topic>` and let the KB session workflow apply it.

---

## Seed script pattern

The seed scripts that bulk-load rules live in `server/src/scripts/seed-*.ts`. Pattern:

```typescript
// server/src/scripts/seed-sensory-rules.ts (abbreviated)
import { PrismaClient } from '@prisma/client';
import { DIM_INDEX } from '../constants/sensory-dimensions';

const prisma = new PrismaClient();

const perceptualRules = [
  {
    tier: 'perceptual',
    ruleType: 'enhance',
    dimA: DIM_INDEX.Salty,
    dimB: DIM_INDEX.Sweet,
    doseCurve: [
      { dose: 0.0005, effect: 0.05 },
      { dose: 0.001,  effect: 0.12 },
      { dose: 0.003,  effect: 0.28 },
      { dose: 0.005,  effect: 0.35 },
      { dose: 0.010,  effect: 0.30 },
      { dose: 0.015,  effect: 0.15 },
      { dose: 0.020,  effect: 0.00 },
      { dose: 0.030,  effect: -0.25 }
    ],
    doseUnit: 'percent_mass',
    effectType: 'add',
    effectDim: DIM_INDEX.Sweet,
    maxEffect: 0.5,
    description: 'Trace salt amplifies Sweet; high salt masks it.',
    severity: 1.0,
    ruleVersion: 1,
    isActive: true
  },
  // ... 29 more perceptual rules
];

async function seed() {
  for (const rule of perceptualRules) {
    await prisma.sensoryInteractionRule.upsert({
      where: {
        tier_ruleType_dimA_dimB: {
          tier: rule.tier,
          ruleType: rule.ruleType,
          dimA: rule.dimA,
          dimB: rule.dimB
        }
      },
      update: rule,
      create: rule
    });
  }
  console.log(`Seeded ${perceptualRules.length} perceptual rules`);
}

seed().catch(console.error).finally(() => prisma.$disconnect());
```

Run with:
```bash
cd server
npx ts-node src/scripts/seed-sensory-rules.ts --dry-run   # print what would change
npx ts-node src/scripts/seed-sensory-rules.ts             # apply
```

Each rule insert/update writes a `RuleVersion` row automatically (via Prisma middleware in `lib/prisma.ts`), so changes are audit-logged.

---

## Testing a new rule

After seeding, validate the rule against known-good recipes:

```bash
# Recompute sensory profiles for the regression-fixture recipes
cd server
npx ts-node src/scripts/recompute-test-recipes.ts

# Diff against locked expected profiles
npx ts-node src/scripts/compare-fixture-profiles.ts --ruleset-version 2
```

Interpretation:
- **Expected change**: fixture recipe affected by the new rule shifts by the predicted amount.
- **Unexpected change**: a fixture recipe unrelated to the rule shifted — investigate overlap with existing rules.
- **No change**: rule is not firing — check trigger conditions.

For a targeted single-rule test:
```bash
# Apply just one rule to a sample recipe and print the diff
npx ts-node src/scripts/test-rule-on-recipe.ts \
  --rule-id "<ruleId>" \
  --recipe-id "<recipeId>"
```

Output shows the per-dim delta introduced by the rule so you can verify the direction and magnitude are correct.

**Regression locking**: once a rule is verified, re-generate the fixture expected profiles:
```bash
npx ts-node src/scripts/lock-regression-fixtures.ts --ruleset-version 2
```

This updates `SensoryRegressionFixture.expectedProfile` for all fixtures, and future changes will diff against the new baseline.

---

## Decision tree: which tier?

Use this to pick the right tier for a new rule.

```
Does the rule change the RECIPE'S FINAL SENSORY PROFILE?
├── NO — the combination just feels off but doesn't change the profile
│   └── Tier 6 (clash) — affects harmony score only
│
└── YES — the sensory profile itself changes
    │
    ├── Does the change depend on WHEN an ingredient is added (cooking time / order)?
    │   └── YES → Tier 3 (temporal)
    │
    ├── Does the change require actual CHEMISTRY (denaturation, emulsion, reaction)?
    │   └── YES → Tier 2 (physical/chemical)
    │       ├── Needs chem-property data on ingredients
    │       └── Must match requiresTempRange and requiresMethod
    │
    ├── Is it a NAMED CLASSICAL PATTERN (mirepoix, dashi, caprese, roux)?
    │   └── YES → Tier 5 (emergent)
    │       ├── More than 2 triggers usually
    │       └── Carries cuisine/technique tags
    │
    ├── Does one dim amplify another's PERCEIVED INTENSITY multiplicatively?
    │   └── YES → Tier 4 (carrier)
    │       └── If target dim = 0, rule produces 0 effect
    │
    └── Is it a per-receptor PERCEPTUAL interaction of two dims?
        └── YES → Tier 1 (perceptual)
            ├── reinforce — same-dim self-stacking (Stevens)
            ├── enhance — additive amplification
            ├── mask — subtractive suppression
            └── synergy — multiplicative gain
```

**Tie-breakers**:
- Tier 1 vs Tier 4: if the effect depends on **existing** value of the target, it's Tier 4. If it adds a fixed amount regardless, it's Tier 1.
- Tier 2 vs Tier 3: if time matters but no chemistry is modeled (e.g., herb volatilization), it's Tier 3. If a real chemical transformation occurs (roux, emulsion, curdle), it's Tier 2.
- Tier 5 vs summing rules: if the whole is more than the sum of already-fired rules, add a Tier 5 rule for the gestalt. Otherwise rely on Tier 1-4 composition.
- Tier 6 vs negative effects: if a combination lowers individual dims (mask), it's Tier 1. If it lowers *overall pleasantness* without changing dims, it's Tier 6.

---

## Anti-patterns to avoid

- **Binary triggers**: avoid rules of the form "if X present AND Y present, add +1". Use a dose curve even if it's coarse — your future self will thank you.
- **Double-counting**: don't re-implement a Tier 1 synergy as a Tier 5 emergence. Emergences should add *on top of* Tier 1-4 composition, representing genuine gestalt beyond summed effects.
- **Missing exceptions**: almost every clash rule has a culturally-scoped or stabilizer-scoped exception. Search existing recipes for "false negatives" (dishes your rule flags that are actually good) and codify those as exceptions.
- **Hardcoded dim indices**: reference dims by name in source files (`DIM_INDEX.Umami`) and resolve to indices at seed time. Prevents breakage when the dim list grows.
- **Untested stabilizer reductions**: if your rule has `stabilizers`, write a fixture recipe that exercises the stabilizer path (e.g., hollandaise for the acid-in-dairy rule) and lock its expected profile.
- **No citation**: when a rule encodes food science, cite it. Even a textbook page number gives future maintainers a way to sanity-check the curve shape.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Initial worked-examples catalog. 30 Tier-1 examples, 15 Tier-2, 10 Tier-3, 10 Tier-4, 15 Tier-5, 15 Tier-6. |
