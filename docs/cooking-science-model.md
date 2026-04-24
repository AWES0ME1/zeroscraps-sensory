# Cooking Science Model — Complete Design

## Overview

A physics-and-chemistry-based model that predicts how ingredients transform
through cooking, how ingredients interact with each other during cooking,
and how the final sensory profile of a dish emerges from the combination
of ingredient properties, cooking methods, sequences, and compound effects.

---

## Part 1: Ingredient Chemical Properties

Every ingredient stores its chemical composition — the properties that
determine HOW it reacts when cooked. These are factual, measurable,
and seedable from USDA/FooDB data + AI for gaps.

### Schema: `IngredientChemProperties`

```
ingredient_name       "all-purpose flour"
sugar_content         LOW (0.3g/100g)
sugar_types           ["maltose", "glucose"]     // determines caramelization behavior
protein_content       MODERATE (10g/100g)
protein_types         ["gluten (gliadin+glutenin)"]  // determines gluten development
fat_content           LOW (1g/100g)
fat_types             ["unsaturated"]
starch_content        HIGH (76g/100g)
starch_types          ["amylose", "amylopectin"]    // determines gelatinization temp
fiber_content         LOW (2.7g/100g)
moisture_content      MODERATE (12%)
acid_ph               6.0 (neutral)
collagen_content      NONE
pectin_content        NONE
gluten_potential       HIGH                         // unique to wheat flour
volatile_compounds     LOW                          // aromatic potential
mineral_content        LOW
enzyme_activity        ["amylase"]                  // breaks starch during fermentation
melting_point          N/A
smoke_point            N/A
```

### Property Scale

| Level | Numeric Range (g/100g) | Examples |
|-------|----------------------|----------|
| NONE | 0 | Water has 0 fat |
| TRACE | 0.1-0.5 | Lettuce has trace protein |
| LOW | 0.5-5 | Carrot has low protein (0.9g) |
| MODERATE | 5-20 | Egg has moderate fat (11g) |
| HIGH | 20-50 | Cheese has high fat (33g) |
| VERY_HIGH | 50+ | Butter has very high fat (81g), Sugar is very high sugar (100g) |

### Key Property Types (determine reaction specificity)

**Sugar Types** (each caramelizes at different temperatures):
- Fructose: 110°C (lowest — fruits caramelize easily)
- Glucose: 150°C
- Sucrose: 160°C (table sugar)
- Lactose: 170°C (milk sugars — brown slower)
- Maltose: 180°C (bread crust browning)

**Protein Types** (determine texture when heated):
- Gluten (gliadin + glutenin): develops elasticity when hydrated + worked
- Casein (milk): coagulates, stretches when heated (cheese pull)
- Albumin (egg white): sets firm at 62-65°C, solid at 80°C
- Ovalbumin (egg yolk): thickens at 65°C, sets at 70°C
- Myosin (meat): denatures at 50°C, contracts at 65-75°C
- Collagen: converts to gelatin at 70°C+ over time
- Actin (meat): denatures at 65-70°C → toughness

**Fat Types** (determine rendering and mouthfeel):
- Saturated (butter, lard): solid at room temp, melts 30-40°C
- Monounsaturated (olive oil): liquid, smoke point ~190°C
- Polyunsaturated (vegetable oil): liquid, smoke point varies
- Butterfat: complex emulsion, breaks at 100°C+ (clarified butter)

**Starch Types** (determine thickening behavior):
- Amylose (straight chain): gels firmly when cooled (potatoes)
- Amylopectin (branched): stays viscous, doesn't gel (waxy corn)
- Gelatinization temp: 60-80°C depending on source

---

## Part 2: Cooking Reactions (The Chemistry Engine)

These are the fundamental chemical and physical transformations.
Each has precise activation conditions and sensory effects.

### Reaction 1: MAILLARD REACTION
```
Conditions:
  - Requires: amino acids + reducing sugars (both must be present)
  - Temperature: >140°C (280°F)
  - Moisture: LOW at surface (dry heat or dried surface)
  - pH: accelerated by alkaline (baking soda), slowed by acid
  
Sensory Effects:
  Sweet: -0.5 (sugars consumed)
  Umami: +1.5
  Nutty: +1.5
  Smoky: +1.0
  Earthy: +0.5
  Rich: +1.5
  Bitter: +0.5 (if extensive)
  Crunchy/Crispy: +2 (surface only)
  Fresh: -2

Rate: Faster at higher temp, lower moisture, higher pH
Products: melanoidins (brown color), furanones (caramel aroma), 
          pyrazines (nutty/roasted), thiophenes (meaty, if sulfur present)

Examples:
  - Seared steak surface: HIGH protein + sugars + 230°C dry = intense Maillard
  - Toast: moderate protein + starch-derived sugars + 180°C dry = moderate Maillard
  - Boiled meat: same protein but WET = NO Maillard (temp capped at 100°C, surface wet)
```

### Reaction 2: CARAMELIZATION
```
Conditions:
  - Requires: sugars (no protein needed, unlike Maillard)
  - Temperature: >160°C for sucrose, >110°C for fructose
  - Moisture: LOW (sugar must be concentrated, not dissolved)
  
Sensory Effects:
  Sweet: +2 initially, then -2 (deep caramel becomes bitter)
  Bitter: +1 (deep caramelization)
  Smoky: +1
  Rich: +1.5
  Nutty: +0.5
  
Critical distinction:
  - Sugar IN cake batter: dissolved in water, batter never exceeds 100°C 
    internally → NO caramelization inside, only on exposed surface
  - Sugar ON crème brûlée: direct flame at 400°C+ → full caramelization
  - Caramelized onions: cell walls break down releasing sugar, low heat over
    45+ min concentrates sugar, eventually reaches caramelization temp
  
Stages:
  Stage 1 (160-170°C): light golden, sweet, butterscotch
  Stage 2 (170-180°C): amber, nutty, toffee
  Stage 3 (180-190°C): dark, bitter notes emerge, smoky
  Stage 4 (>195°C): burnt, acrid, carbon
```

### Reaction 3: COLLAGEN → GELATIN CONVERSION
```
Conditions:
  - Requires: collagen (connective tissue in tough meat cuts)
  - Temperature: >70°C (160°F)
  - Moisture: HIGH (wet cooking environment)
  - Time: LONG (minimum 1-2 hours, optimal 3-4 hours)
  
Sensory Effects:
  Chewy: -4 (tough collagen → soft gelatin)
  Silky: +4 (gelatin = silky mouthfeel)
  Rich: +2 (gelatin body)
  Umami: +1 (amino acid release)
  Creamy: +1 (gelatin viscosity)
  
Critical: Does NOT occur in dry heat (roasting a tough cut → still tough)
         ONLY in wet heat with time (braising, stewing, slow cooking)
         
Short ribs: VERY HIGH collagen → after 2hr braise → fork-tender, silky sauce
Chicken breast: NO collagen → braising makes it dry and stringy (wrong method)
```

### Reaction 4: STARCH GELATINIZATION
```
Conditions:
  - Requires: starch + water
  - Temperature: 60-80°C depending on starch source
  - Moisture: HIGH (must be hydrated)
  
Sensory Effects:
  Grainy: -3 (raw starch → smooth gel)
  Silky: +3
  Creamy: +2
  
Applications:
  - Roux: flour starch + butter fat + heat → fat coats starch granules
    → adding liquid → starch absorbs liquid → thickens → silky sauce
  - Boiled potato: starch granules swell with water → fluffy/creamy
  - Pasta in boiling water: starch gelatinizes → tender, slight silky
  - Raw flour in soup: clumps because starch hydrates unevenly without fat
  
Important: Starch retrogrades on cooling (goes partially grainy again)
           → day-old bread, cold rice = more resistant starch
```

### Reaction 5: PROTEIN DENATURATION / COAGULATION
```
Conditions:
  - Requires: protein
  - Temperature: varies by protein type (see below)
  - Acid can also denature (ceviche)
  
Temperature Thresholds:
  Myosin (meat): 50°C → starts to denature, meat firms
  Albumin (egg white): 62°C → starts to set
  Collagen: 70°C → starts converting (see Reaction 3)
  Actin (meat): 65-75°C → contracts, squeezes out moisture → dry if overcooked
  Egg yolk: 65-70°C → thickens (custard), 70°C+ → fully set
  Casein (milk): 80°C+ → curdles (especially with acid)
  Gluten: doesn't denature by heat alone, sets structure during baking
  
Sensory Effects (vary by doneness):
  RARE meat (50-55°C): Silky+2, Chewy+1, Rich+3, Umami+2
  MEDIUM meat (60-65°C): Chewy+2, Rich+2, Umami+1.5
  WELL DONE meat (75°C+): Chewy+4, Rich-1, Silky-2 (dry, tough)
  
  Soft-boiled egg: Silky+4, Creamy+3
  Hard-boiled egg: Chewy+2, Grainy+1 (yolk), Silky-2
  
  Custard (gentle, 80°C): Silky+5, Creamy+4, Rich+2
  Scrambled (fast, high heat): Chewy+1, Creamy+2, Grainy+1
```

### Reaction 6: FAT RENDERING / MELTING
```
Conditions:
  - Requires: fat-containing ingredient
  - Temperature: varies by fat type
  
Behaviors:
  Butter melting (<40°C): Creamy→Silky, Rich maintained
  Butter browning (120-150°C): Maillard on milk solids → Nutty+3, Smoky+1
  Cheese melting (60-70°C): Casein matrix loosens → Creamy+, Silky+
  Cheese at high surface heat: fat renders out, proteins brown → Crispy+4
  Lard/tallow rendering (130°C+): solid fat → liquid → Rich+, Silky+
  Bacon fat rendering: fat melts out + Maillard on protein → Smoky+, Crispy+, Rich+
  
  INSIDE dish (submerged): fat melts, coats ingredients → Rich+, Silky+
  SURFACE of dish (exposed): fat renders, surface dries → Crispy+, may Brown
```

### Reaction 7: EMULSIFICATION
```
Conditions:
  - Requires: fat + water-based liquid + emulsifier (lecithin, casein, mustard)
  - Agitation: mechanical action (whisking, blending)
  - Temperature: varies (hot emulsion vs cold emulsion)
  
Sensory Effects:
  Creamy: +4
  Silky: +3
  Rich: +2
  
Applications:
  - Vinaigrette: oil + vinegar + mustard (emulsifier) + whisking
  - Mayonnaise: oil + egg yolk (lecithin) + acid + whisking → Creamy+5, Rich+3
  - Beurre blanc: butter + wine reduction + whisking → Silky+4, Rich+4
  - Hollandaise: butter + egg yolk + acid + heat + whisking → Creamy+4, Rich+5
  - Pan sauce: fond + liquid + butter mounted → Silky+3, Rich+3, Umami+2
  
  BREAKS if: too hot (butter sauce), too cold (mayo), too fast (insufficient agitation)
  BROKEN emulsion: Grainy+2, oily, separated
```

### Reaction 8: GLUTEN DEVELOPMENT
```
Conditions:
  - Requires: wheat flour (gluten proteins) + water + mechanical work
  - Enhanced by: kneading, folding, time (autolyse)
  - Inhibited by: fat (shortbread = no gluten = crumbly), sugar, acid
  
Sensory Effects:
  Chewy: +3 (bread)
  Crispy: +2 (crust, if baked)
  Crunchy: +1 (if baked crisp)
  
Spectrum:
  No gluten development (cake, shortbread): Crumbly, tender, Grainy+1
  Moderate development (pizza dough): Chewy+2, Crispy+2 (crust)
  High development (bagel): Chewy+4, Dense, Crispy+1 (crust)
  
  ROUX: flour + fat = fat coats gluten proteins → prevents development
        → NO chewy texture, just thickening via starch
```

### Reaction 9: PECTIN BREAKDOWN
```
Conditions:
  - Requires: pectin (fruits, vegetables)
  - Temperature: >85°C
  - Acid: accelerates breakdown
  - Sugar: inhibits breakdown (preserves jam texture)
  
Sensory Effects:
  Crunchy: -3 (cell walls soften)
  Creamy: +1 (if fully broken down)
  Silky: +1
  
Applications:
  - Apple sauce: high pectin apple + heat → cell walls break → smooth
  - Jam: pectin + sugar + acid + heat → gels (sugar preserves some structure)
  - Braised vegetables: pectin breaks down → soft, tender
  - Tomato sauce: long cooking breaks down pectin → smooth, silky
```

### Reaction 10: REDUCTION (Evaporation Concentration)
```
Conditions:
  - Requires: liquid + heat + time + exposed surface
  - Temperature: at or above simmering (>85°C)
  
Sensory Effects:
  CONCENTRATES all existing flavors proportionally:
  - A sauce with Sour=0.5 reduced by half → Sour=1.0
  - Wine reduction: alcohol evaporates first, then water
    → initial: Sweet=0.5, Sour=1.5, Bitter=1.5
    → reduced 75%: Sweet=1.5, Sour=4.0, Bitter=3.0 (but acid softens)
    → actually: Sweet+2 (concentration + Maillard), Sour+1 (acid partially volatilizes),
      Rich+3, Fermented+1, Umami+1 (Maillard products)
  
  Silky: +2 (viscosity increases as water leaves)
  Rich: +2 (concentration of dissolved solids)
  
Important: Volatile aromatics (Floral, Herbal, Citrusy, Fresh) DECREASE
           during extended reduction because they evaporate with the steam.
           Fresh=0 after long reduction. Herbal notes dissipate.
```

### Reaction 11: ACID TRANSFORMATIONS
```
Conditions:
  - Requires: acid (citrus, vinegar, wine, tomato) + protein or fiber
  
Effects on PROTEIN:
  - Ceviche: acid denatures fish protein (no heat needed)
    → Chewy+1, Silky+1 (surface), Fresh+2
  - Marinating: acid + meat → partial surface denaturation
    → tenderizes outer layer, flavor penetration
  - Curdling: acid + hot milk → casein coagulates → cheese/paneer

Effects on VEGETABLES:
  - Acid + green vegetables = color loss (chlorophyll degradation)
  - Acid + red cabbage = brighter red (anthocyanin stabilization)
  - Acid slows pectin breakdown → vegetables stay firmer in acidic braise

Effects on FLAVOR:
  - Acid brightens and lifts other flavors
  - Fresh+2 from acid addition
  - Balances richness: Rich-0.5 perceived (see interaction rules)
  - Sour+varies (depends on acid concentration)
```

### Reaction 12: ENZYMATIC BROWNING
```
Conditions:
  - Requires: polyphenol oxidase enzyme + oxygen (cut fruit/veg surface)
  - Temperature: active at room temp, deactivated >70°C
  - Inhibited by: acid (lemon juice), blanching, vacuum
  
Sensory Effects:
  Bitter: +0.5
  Earthy: +0.5
  Fresh: -1 (oxidized = less fresh)
  
Applications:
  - Cut apple: browns in minutes → slight bitter, less fresh
  - Avocado: browns → bitter notes
  - Prevented by: tossing in lemon juice (acid inhibits enzyme)
```

---

## Part 3: Compound Effects (Ingredient Interactions During Cooking)

These are NOT single-ingredient transforms. These are what happens when
ingredients interact WITH EACH OTHER during cooking.

### Compound Effect 1: ROUX
```
Trigger: fat + flour + heat in sequence
Detection: instructions contain "melt butter" + "add/stir flour" or "cook flour in oil/butter"

Chemistry:
  1. Fat melts (fat rendering)
  2. Flour starch granules get coated in fat (prevents clumping)
  3. Heat activates starch gelatinization in fat medium
  4. If light roux (2-3 min): Silky+3, thickening, neutral flavor
  5. If dark roux (20-45 min): Maillard on flour proteins → Nutty+3, Smoky+2, Rich+2
     (Cajun cooking: dark roux loses thickening power but gains deep flavor)

Sensory override for the flour ingredient:
  Light roux: Grainy→0, Silky+3, Creamy+2
  Dark roux: Grainy→0, Silky+2, Nutty+3, Smoky+2, Rich+2, Earthy+1
```

### Compound Effect 2: MIREPOIX / AROMATIC BASE
```
Trigger: onion + carrot + celery sautéed together early in recipe
Detection: instructions start with "sauté/cook onion, carrot, celery" or
           "cook aromatics" in first few steps

Chemistry:
  1. Onion cell walls break → release sugars and sulfur compounds
  2. Carrot sugars concentrate as moisture evaporates
  3. Celery contributes herbal/fresh notes
  4. Together at moderate heat: partial Maillard + caramelization
  5. Creates a flavor BASE that other ingredients build on

Sensory contribution (as combined unit):
  Sweet: 1.5 (onion + carrot sugars)
  Sulfurous: 1.5 (onion, reduced from raw because cooking mellows)
  Herbal: 1.0 (celery)
  Earthy: 1.5
  Rich: 1.0
  Umami: 0.5 (Maillard products)
  Pungent: 0 (raw pungency cooked out)
```

### Compound Effect 3: DEGLAZING
```
Trigger: liquid added to hot pan after searing/browning
Detection: "deglaze with wine/broth/stock" or "add liquid to the pan, 
           scraping up the browned bits"

Chemistry:
  1. Fond (Maillard products stuck to pan) = concentrated umami + savory
  2. Liquid dissolves fond
  3. Fond compounds distribute into the sauce/liquid

Sensory contribution:
  Umami: +2 (Maillard products are rich in amino acids)
  Rich: +1.5
  Savory/Earthy: +1
  Smoky: +0.5
  
  If deglazed with WINE: add wine's own flavors (acid, tannin, fermented)
  If deglazed with BROTH: add broth's umami (stacking)
```

### Compound Effect 4: WINE/ALCOHOL REDUCTION
```
Trigger: wine or spirit added + simmered/reduced
Detection: "add wine and simmer" or "reduce wine by half"

Chemistry:
  1. Alcohol evaporates first (boiling point 78°C < water's 100°C)
  2. Water evaporates second → concentration
  3. Acid partially volatilizes
  4. Sugars concentrate
  5. Tannins (red wine) concentrate → can become bitter if over-reduced
  6. Maillard reaction products form as sugars + amino acids concentrate

Sensory evolution during reduction:
  Start:    Sour=1.5, Bitter=1.5, Fermented=2, Sweet=0.5
  25% reduced: Sour=1.0, Bitter=1.0, Fermented=1.5, Sweet=1.0, Rich+0.5
  50% reduced: Sour=0.5, Sweet=1.5, Rich+1.5, Umami+0.5
  75% reduced: Sweet=2.0, Rich+2.5, Umami+1.0, Bitter+0.5 (tannin concentration)
  Glaze:   Sweet=2.5, Rich+3.0, Bitter+1.0, Silky+3 (syrup consistency)
```

### Compound Effect 5: BRAISING LIQUID FORMATION
```
Trigger: meat + liquid + covered + long time
Detection: "braise", "cover and cook for X hours", "low and slow"

Chemistry (multi-reaction cascade):
  1. Collagen breaks down → gelatin enriches liquid (Silky, Rich)
  2. Fat renders from meat → enriches liquid (Rich)
  3. Maillard products from initial sear dissolve into liquid (Umami)
  4. Aromatic vegetables break down → flavor infusion
  5. Wine/acid tenderizes + deglazes
  6. Extended cooking → reduction → concentration

Final braising liquid sensory:
  Umami: HIGH (collagen amino acids + Maillard products + fond)
  Rich: VERY HIGH (gelatin + rendered fat + concentration)
  Silky: HIGH (gelatin viscosity)
  Earthy: MODERATE (vegetables + herbs)
  Sweet: MODERATE (caramelized onion/carrot sugars)
  Herbal: LOW (volatile herbs dissipate over hours)
  Fresh: ZERO (long cooking destroys all freshness)
  Sour: LOW (acid softens with time)
```

### Compound Effect 6: EMULSION SAUCES
```
Trigger: fat + liquid + emulsifier + agitation
Subtypes:
  
  COLD EMULSION (mayo, aioli):
    oil + egg yolk + acid + whisking
    Result: Creamy+5, Rich+4, Silky+3, Sour+0.5 (from acid)
    
  HOT EMULSION (hollandaise, beurre blanc):
    butter + egg yolk or wine reduction + heat + whisking
    Result: Creamy+4, Rich+5, Silky+4, Sour+0.5
    FRAGILE: breaks above 68°C → oily, Grainy+2
    
  PAN SAUCE MOUNT:
    reduced fond + cold butter whisked in off-heat
    Result: Silky+4, Rich+4, Umami+2 (from fond)
    
  VINAIGRETTE:
    oil + vinegar + mustard (emulsifier) + whisking
    Result: Sour+2, Rich+1, Pungent+1 (mustard), Fresh+1
    TEMPORARY: separates within hours
```

### Compound Effect 7: BREAD/DOUGH BAKING
```
Trigger: flour + water + leavening + heat (baking)

Chemistry cascade:
  1. Yeast produces CO2 + alcohol + organic acids (Fermented flavor)
  2. Gluten network traps gas → rise
  3. Oven heat: outer surface dries first
  4. Surface >140°C → Maillard reaction → brown crust
  5. Interior stays <100°C (water present) → starch gelatinizes → soft crumb
  6. Surface sugars caramelize >160°C → crust darkens

Sensory:
  Crust: Crunchy+4, Crispy+3, Nutty+2, Smoky+0.5, Sweet+1 (Maillard)
  Crumb: Chewy+3, Silky+1, Grainy+0.5, Fermented+1
  Overall: Chewy+3, Crunchy+2, Fermented+1, Nutty+1, Sweet+0.5
  
  Sourdough: add Sour+2, Fermented+3 (longer fermentation)
  Enriched dough (brioche): add Rich+2, Sweet+1, Silky+1 (butter + eggs)
```

### Compound Effect 8: DEEP FRYING
```
Trigger: ingredient submerged in hot oil (160-190°C)

Chemistry:
  1. Surface moisture evaporates rapidly (steam barrier)
  2. Surface dries → Maillard reaction begins
  3. Oil replaces water at surface → crisps
  4. Interior steams (stays moist if not overcooked)
  5. If battered: starch gelatinizes then dries → crispy shell

Sensory:
  Crispy: +5 (defining characteristic)
  Crunchy: +3
  Rich: +3 (oil absorption)
  Smoky: +0.5
  Fresh: →0 (destroyed by high heat)
  Silky: interior may be +2 (steamed interior)
  
  Battered (tempura): Crispy+6, Crunchy+4 (batter shell)
  Breaded (schnitzel): Crispy+5, Crunchy+5 (breadcrumb shell)
  Naked (fries): Crispy+4, Crunchy+3 (surface only)
```

### Compound Effect 9: GRILLING / CHARRING
```
Trigger: direct high heat from below (grill, broiler, char-grill)

Chemistry:
  1. Extreme surface temperature (300-500°C)
  2. Rapid Maillard on surface
  3. Fat drips → smoke rises → deposits on food surface
  4. Partial pyrolysis (charring) → carbon compounds

Sensory:
  Smoky: +4 (smoke deposition)
  Rich: +1
  Umami: +1 (Maillard)
  Bitter: +1 (char)
  Crispy: +2 (surface)
  Pungent: +0.5 (smoke compounds)
  Fresh: -3 (destroyed by extreme heat)
  
  Grill marks specifically: concentrated Maillard where metal contacts food
  → striped pattern of intense Smoky+, Bitter+ at marks vs milder between
```

### Compound Effect 10: PICKLING / QUICK PICKLE
```
Trigger: vegetable/fruit + vinegar/acid + time

Chemistry:
  1. Acid penetrates cell walls
  2. Partial pectin breakdown → slight softening
  3. Acid denatures surface proteins
  4. Salt (if brined) draws moisture via osmosis
  5. Flavor exchange: acid/spice flavors absorb into ingredient

Sensory:
  Sour: +3 (defining)
  Crunchy: -1 (slight softening, but still crunchy if quick pickle)
  Fresh: +1 (acid brightness)
  Fermented: +0.5 (quick pickle) to +3 (fermented pickle)
  Pungent: +0.5 (vinegar)
  
  Quick pickle (15 min): Sour+2, Crunchy maintained, Fresh+2
  Long ferment (weeks): Sour+3, Fermented+4, Crunchy-2, Pungent+1
```

---

## Part 4: Step-by-Step Cooking Sequence Model

Recipes are executed in STEPS. The order matters — searing THEN braising
produces different results than just braising. The model must track the
state of each ingredient through each step.

### Schema: `CookingStep` (parsed from instructions)

```
step_number:     1
action:          "sear"
ingredients:     ["beef short ribs"]
temperature:     HIGH
heat_source:     "stovetop"
medium:          DRY (oil on surface only)
duration:        "3 minutes per side"
duration_class:  SHORT
surface_exposure: FULL (all sides seared)
liquid_present:  false
covered:         false

→ Reactions activated:
  - MAILLARD on beef surface (protein + sugars + high dry heat)
  - FAT RENDERING on surface fat
  - FOND FORMATION on pan surface
```

```
step_number:     2
action:          "sauté"
ingredients:     ["onion", "carrot", "celery"]
temperature:     MEDIUM
medium:          FAT (rendered beef fat + olive oil)
duration:        "8 minutes"
duration_class:  SHORT-MODERATE
surface_exposure: PARTIAL (stirring)
liquid_present:  false
covered:         false

→ Compound Effect: MIREPOIX FORMATION
→ Reactions: partial Maillard, sugar concentration, cell wall breakdown
```

```
step_number:     3
action:          "deglaze"
ingredients:     ["red wine"]
temperature:     HIGH
medium:          WET (wine is liquid)
duration:        "2 minutes"
note:            "scraping up brown bits from pan"

→ Compound Effect: DEGLAZING (fond dissolves into wine)
→ Compound Effect: WINE REDUCTION begins (alcohol evaporates)
```

```
step_number:     4
action:          "braise"
ingredients:     ["beef short ribs", "broth", "wine (remaining)", "thyme", "rosemary"]
temperature:     LOW (300°F oven)
medium:          WET (submerged in liquid)
duration:        "2.5 hours"
duration_class:  EXTENDED
surface_exposure: NONE (submerged)
liquid_present:  true
covered:         true

→ Compound Effect: BRAISING LIQUID FORMATION
→ Reactions on beef: COLLAGEN BREAKDOWN (wet + low + long)
→ Reactions on vegetables: PECTIN BREAKDOWN (soft)
→ Reactions on liquid: REDUCTION (partial, uncovered would be more)
→ Herb behavior: volatile compounds infuse liquid, then dissipate
   - Thyme/rosemary: Herbal peaks at 30 min, fades after 90 min
   - Woody notes persist longer (non-volatile)
```

### Ingredient State Tracking

Each ingredient carries state through the steps:

```
Beef Short Ribs:
  After Step 1 (sear): surface Maillard → Umami+1.5, Smoky+1, Crispy+2 (surface)
  After Step 4 (braise): Collagen→gelatin → Chewy→0, Silky+4, Rich+2
  FINAL: Umami=4.5, Rich=5, Silky=4, Smoky=1, Earthy=1, Chewy=0
  
  Note: the sear's Crispy is LOST during braising (surface re-hydrates)
        but the Maillard FLAVOR persists (dissolved into braising liquid)
        
Carrot:
  After Step 2 (sauté): slight Maillard → Sweet+0.5, Crunchy-1
  After Step 4 (braise): pectin breakdown → Crunchy→0, Silky+2, Sweet+1
  FINAL: Sweet=3, Silky=2, Earthy=3, Crunchy=0, Fresh=0
```

---

## Part 5: Instruction Parsing Pipeline

### Input
Raw recipe instructions text.

### Output  
Array of `CookingStep` objects with:
- Action (sear, sauté, braise, bake, grill, etc.)
- Which ingredients are involved
- Temperature/heat level
- Duration
- Medium (dry, wet, fat)
- Whether ingredient is on surface or submerged

### Detection Keywords

```
SEAR: "sear", "brown on all sides", "get a good crust"
SAUTÉ: "sauté", "cook in pan", "stir-fry", "pan-fry"
BRAISE: "braise", "cover and cook", "low and slow", "Dutch oven"
ROAST: "roast", "bake at >375°F", "oven-roast"
BAKE: "bake", "oven at <375°F"
GRILL: "grill", "char-grill", "barbecue", "BBQ"
BOIL: "boil", "blanch", "poach", "simmer"
FRY: "deep fry", "fry in oil", "submerge in oil"
STEAM: "steam", "steamer basket"
SMOKE: "smoke", "smoker", "wood chips"
RAW: "garnish with", "top with", "serve with" (added at end, not cooked)
REDUCE: "reduce", "simmer until thickened", "cook down"
CARAMELIZE: "caramelize", "cook until golden brown" (with sugar/onion context)
DEGLAZE: "deglaze", "add liquid to pan, scraping"
PICKLE: "pickle", "quick pickle", "vinegar brine"
```

### Duration Extraction
```
"cook for 2-3 minutes" → SHORT
"sauté 8-10 minutes" → MODERATE
"roast for 45 minutes" → LONG
"braise for 2 hours" → EXTENDED
"simmer for 4-6 hours" → EXTENDED+

SHORT: <10 min
MODERATE: 10-30 min
LONG: 30-60 min
EXTENDED: 60-180 min
EXTENDED+: >180 min
```

### Temperature Extraction
```
"high heat" or >450°F → HIGH
"medium-high" or 375-450°F → MEDIUM-HIGH
"medium" or 325-375°F → MEDIUM
"low heat" or "gentle" or <325°F → LOW
"room temperature" → NONE
```

---

## Part 6: Complete Calculation Pipeline

For a recipe with N ingredients and M cooking steps:

```
1. PARSE recipe instructions → M cooking steps
2. For each ingredient:
   a. Get base AI-calibrated potency (25-dim, 0-6 scale)
   b. Get chemical properties (sugar, protein, fat, etc.)
   c. Track through each cooking step:
      - Determine which REACTIONS activate (based on conditions + properties)
      - Determine which COMPOUND EFFECTS trigger (based on step combos)
      - Apply sensory deltas from activated reactions
      - Update ingredient state (moisture, surface condition, etc.)
   d. Final ingredient potency = base + sum(reaction deltas) + compound effect adjustments
3. Weight by impact-adjusted mass fraction
4. Apply interaction rules (synergy, masking, etc.)
5. Normalize to 0-1 for storage
6. Validate against dish archetype
```

### Performance Target
- Step 1 (parsing): <50ms (regex/keyword matching)
- Step 2 (lookups): ~5ms per ingredient (cached)
- Step 3 (reaction computation): <1ms (pure math)
- Step 4 (weighted average): <1ms
- Step 5 (interaction rules): <1ms
- Step 6 (normalization): <1ms
- **Total: <100ms per recipe** (real-time capable)

---

## Part 7: Implementation Tables Summary

### New Tables
```
IngredientChemProperties    — chemical composition per ingredient (~200 rows)
CookingReactionRule         — the ~12 reactions with conditions + deltas
CompoundCookingEffect       — the ~10 compound effects (roux, mirepoix, etc.)
IngredientPotencyAnchor     — 30 calibration anchors
DishArchetype               — 15+ expected dish profiles
```

### Modified Tables
```
IngredientSensoryProfile    — add adminOverride, compoundEvidence columns
SensoryInteractionRule      — adjust thresholds for 0-6 scale
```

### New Services
```
instruction-parser.service.ts        — parse instructions → cooking steps
cooking-transform.service.ts         — apply reactions + compound effects
ingredient-potency-generation.service.ts — AI calibrated potency generation
dish-archetype-validation.service.ts — validate against archetypes
```

### New Scripts
```
seed-anchors.ts                — seed 30 calibration anchors
seed-archetypes.ts             — seed 15+ dish archetypes
seed-chem-properties.ts        — seed ingredient chemical properties
seed-cooking-reactions.ts      — seed 12 reaction rules
seed-compound-effects.ts       — seed 10 compound cooking effects
generate-calibrated-potency.ts — generate all ingredient potency via AI
```
