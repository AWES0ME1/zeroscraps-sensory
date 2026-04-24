-- ═══════════════════════════════════════════════════════════════════════
-- @zeroscraps/sensory — Plugin Installation Migration 003
--
-- Decouples sensory columns from host's `recipe.recipes` table.
--   1. Creates sensory.recipe_snapshots with data copied from recipe.recipes
--   2. Drops all sensory columns from recipe.recipes (20+ columns)
--
-- After this migration, the host's Recipe table is clean again.
-- Plugin uninstall becomes a one-liner: DROP SCHEMA sensory CASCADE;
--
-- FORWARD-ONLY: once applied, rolling back requires restoring from git
-- history + reapplying the Phase 1 migration. Do not apply in environments
-- without a recent DB backup.
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: create recipe_snapshots table (structure matches plugin's Prisma model).
CREATE TABLE IF NOT EXISTS sensory.recipe_snapshots (
  id                             TEXT PRIMARY KEY,
  recipe_id                      TEXT NOT NULL UNIQUE,
  recipe_title                   TEXT NOT NULL DEFAULT '',
  sensory_profile                DOUBLE PRECISION[] DEFAULT '{}'::DOUBLE PRECISION[],
  sensory_vector                 vector(113),
  aftertaste_profile             DOUBLE PRECISION[] DEFAULT '{}'::DOUBLE PRECISION[],
  body_weight                    DOUBLE PRECISION,
  harmony_score_universal        DOUBLE PRECISION,
  harmony_score_cuisine          JSONB,
  detected_clashes               JSONB,
  detected_emergences            JSONB,
  dominant_archetype             TEXT,
  archetype_confidence           DOUBLE PRECISION,
  cuisine_tags                   TEXT[] DEFAULT '{}'::TEXT[],
  course_type                    TEXT,
  seasonal_context               TEXT[] DEFAULT '{}'::TEXT[],
  balance_score                  DOUBLE PRECISION,
  complexity_score               DOUBLE PRECISION,
  intensity_score                DOUBLE PRECISION,
  is_crunchy                     BOOLEAN NOT NULL DEFAULT false,
  is_creamy                      BOOLEAN NOT NULL DEFAULT false,
  is_rich                        BOOLEAN NOT NULL DEFAULT false,
  is_spicy                       BOOLEAN NOT NULL DEFAULT false,
  is_sweet                       BOOLEAN NOT NULL DEFAULT false,
  is_umami                       BOOLEAN NOT NULL DEFAULT false,
  is_fresh                       BOOLEAN NOT NULL DEFAULT false,
  is_smoky                       BOOLEAN NOT NULL DEFAULT false,
  is_bright                      BOOLEAN NOT NULL DEFAULT false,
  is_hearty                      BOOLEAN NOT NULL DEFAULT false,
  computed_by_ruleset_version    INTEGER,
  computed_at                    TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_snapshots_crunchy_rich_idx    ON sensory.recipe_snapshots(is_crunchy, is_rich);
CREATE INDEX IF NOT EXISTS recipe_snapshots_creamy_umami_idx    ON sensory.recipe_snapshots(is_creamy, is_umami);
CREATE INDEX IF NOT EXISTS recipe_snapshots_sweet_smoky_idx     ON sensory.recipe_snapshots(is_sweet, is_smoky);
CREATE INDEX IF NOT EXISTS recipe_snapshots_spicy_idx           ON sensory.recipe_snapshots(is_spicy);
CREATE INDEX IF NOT EXISTS recipe_snapshots_archetype_idx       ON sensory.recipe_snapshots(dominant_archetype);
CREATE INDEX IF NOT EXISTS recipe_snapshots_harmony_idx         ON sensory.recipe_snapshots(harmony_score_universal);
CREATE INDEX IF NOT EXISTS recipe_snapshots_course_idx          ON sensory.recipe_snapshots(course_type);

-- Step 2: copy data from host's recipe.recipes (if sensory columns still exist there).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'recipe' AND table_name = 'recipes' AND column_name = 'sensory_profile'
  ) THEN
    INSERT INTO sensory.recipe_snapshots (
      id, recipe_id, recipe_title, sensory_profile, sensory_vector, aftertaste_profile,
      body_weight, harmony_score_universal, harmony_score_cuisine,
      detected_clashes, detected_emergences, dominant_archetype, archetype_confidence,
      cuisine_tags, course_type, seasonal_context,
      balance_score, complexity_score, intensity_score,
      is_crunchy, is_creamy, is_rich, is_spicy, is_sweet, is_umami, is_fresh, is_smoky, is_bright, is_hearty,
      computed_by_ruleset_version, computed_at
    )
    SELECT
      gen_random_uuid()::TEXT,
      id,
      COALESCE(title, ''),
      COALESCE(sensory_profile, '{}'::DOUBLE PRECISION[]),
      sensory_vector,
      COALESCE(aftertaste_profile, '{}'::DOUBLE PRECISION[]),
      body_weight,
      harmony_score_universal,
      harmony_score_cuisine,
      detected_clashes,
      detected_emergences,
      dominant_archetype,
      archetype_confidence,
      COALESCE(cuisine_tags, '{}'::TEXT[]),
      course_type,
      COALESCE(seasonal_context, '{}'::TEXT[]),
      balance_score,
      complexity_score,
      intensity_score,
      COALESCE(is_crunchy, false),
      COALESCE(is_creamy, false),
      COALESCE(is_rich, false),
      COALESCE(is_spicy, false),
      COALESCE(is_sweet, false),
      COALESCE(is_umami, false),
      COALESCE(is_fresh, false),
      COALESCE(is_smoky, false),
      COALESCE(is_bright, false),
      COALESCE(is_hearty, false),
      computed_by_ruleset_version,
      COALESCE(computed_at, now())
    FROM recipe.recipes
    WHERE sensory_profile IS NOT NULL AND array_length(sensory_profile, 1) > 0
    ON CONFLICT (recipe_id) DO NOTHING;
  END IF;
END $$;

-- Step 3: drop sensory columns from host's recipes table.
DO $$
DECLARE
  col_name TEXT;
  sensory_cols TEXT[] := ARRAY[
    'sensory_vector',
    'aftertaste_profile',
    'body_weight',
    'harmony_score_universal',
    'harmony_score_cuisine',
    'detected_clashes',
    'detected_emergences',
    'dominant_archetype',
    'archetype_confidence',
    'cuisine_tags',
    'course_type',
    'seasonal_context',
    'balance_score',
    'complexity_score',
    'intensity_score',
    'is_crunchy',
    'is_creamy',
    'is_rich',
    'is_spicy',
    'is_sweet',
    'is_umami',
    'is_fresh',
    'is_smoky',
    'is_bright',
    'is_hearty',
    'computed_by_ruleset_version',
    'computed_at'
  ];
BEGIN
  FOREACH col_name IN ARRAY sensory_cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'recipe' AND table_name = 'recipes' AND column_name = col_name
    ) THEN
      EXECUTE format('ALTER TABLE recipe.recipes DROP COLUMN %I', col_name);
    END IF;
  END LOOP;
END $$;

-- sensory_profile is the "legacy" column used by v1 code. Keep it for
-- backward compatibility with ingredient-sensory.service.ts which returns
-- a legacy 25-dim profile. This can be dropped in a follow-up migration
-- once all host code is confirmed not to read it.
-- ALTER TABLE recipe.recipes DROP COLUMN IF EXISTS sensory_profile;

-- Drop indexes that reference dropped columns.
DROP INDEX IF EXISTS recipe.recipes_is_crunchy_is_rich_idx;
DROP INDEX IF EXISTS recipe.recipes_is_creamy_is_umami_idx;
DROP INDEX IF EXISTS recipe.recipes_is_sweet_is_smoky_idx;
DROP INDEX IF EXISTS recipe.recipes_is_spicy_idx;
DROP INDEX IF EXISTS recipe.recipes_dominant_archetype_idx;
DROP INDEX IF EXISTS recipe.recipes_harmony_score_universal_idx;
DROP INDEX IF EXISTS recipe.recipes_course_type_idx;
