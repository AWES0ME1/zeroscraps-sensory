-- ═══════════════════════════════════════════════════════════════════════
-- @zeroscraps/sensory — Plugin Installation Migration 002
--
-- Moves existing sensory tables from `catalog` and `meal` schemas into
-- the plugin-owned `sensory` schema, renames them to plugin conventions,
-- and creates the new `recipe_snapshots` table populated from Recipe.
--
-- Run AFTER 001_create_sensory_schema.sql and AFTER Prisma has generated
-- the plugin's table definitions (so the target tables exist).
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: move existing sensory-related tables into sensory schema.
-- Original table → plugin table (new name).
-- IF EXISTS is used so this migration is idempotent / safe to rerun.

DO $$
BEGIN
  -- catalog.ingredient_sensory_profiles → sensory.ingredient_profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_sensory_profiles') THEN
    ALTER TABLE catalog.ingredient_sensory_profiles SET SCHEMA sensory;
    ALTER TABLE sensory.ingredient_sensory_profiles RENAME TO ingredient_profiles;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_chem_properties') THEN
    ALTER TABLE catalog.ingredient_chem_properties SET SCHEMA sensory;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='sensory_dimension_configs') THEN
    ALTER TABLE catalog.sensory_dimension_configs SET SCHEMA sensory;
    ALTER TABLE sensory.sensory_dimension_configs RENAME TO dimensions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='sensory_interaction_rules') THEN
    ALTER TABLE catalog.sensory_interaction_rules SET SCHEMA sensory;
    ALTER TABLE sensory.sensory_interaction_rules RENAME TO interaction_rules;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='physical_interaction_rules') THEN
    ALTER TABLE catalog.physical_interaction_rules SET SCHEMA sensory;
    ALTER TABLE sensory.physical_interaction_rules RENAME TO physical_rules;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='flavor_clash_rules') THEN
    ALTER TABLE catalog.flavor_clash_rules SET SCHEMA sensory;
    ALTER TABLE sensory.flavor_clash_rules RENAME TO clash_rules;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='combination_emergences') THEN
    ALTER TABLE catalog.combination_emergences SET SCHEMA sensory;
    ALTER TABLE sensory.combination_emergences RENAME TO emergences;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='dimension_dose_thresholds') THEN
    ALTER TABLE catalog.dimension_dose_thresholds SET SCHEMA sensory;
    ALTER TABLE sensory.dimension_dose_thresholds RENAME TO dose_thresholds;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='sensory_descriptors') THEN
    ALTER TABLE catalog.sensory_descriptors SET SCHEMA sensory;
    ALTER TABLE sensory.sensory_descriptors RENAME TO descriptors;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='calibration_rules') THEN
    ALTER TABLE catalog.calibration_rules SET SCHEMA sensory;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_change_logs') THEN
    ALTER TABLE catalog.ingredient_change_logs SET SCHEMA sensory;
    ALTER TABLE sensory.ingredient_change_logs RENAME TO change_logs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='rule_versions') THEN
    ALTER TABLE catalog.rule_versions SET SCHEMA sensory;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='sensory_regression_fixtures') THEN
    ALTER TABLE catalog.sensory_regression_fixtures SET SCHEMA sensory;
    ALTER TABLE sensory.sensory_regression_fixtures RENAME TO regression_fixtures;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='cooking_reaction_rules') THEN
    ALTER TABLE catalog.cooking_reaction_rules SET SCHEMA sensory;
    ALTER TABLE sensory.cooking_reaction_rules RENAME TO cooking_reactions;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='compound_cooking_effects') THEN
    ALTER TABLE catalog.compound_cooking_effects SET SCHEMA sensory;
    ALTER TABLE sensory.compound_cooking_effects RENAME TO compound_effects;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_potency_anchors') THEN
    ALTER TABLE catalog.ingredient_potency_anchors SET SCHEMA sensory;
    ALTER TABLE sensory.ingredient_potency_anchors RENAME TO anchors;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='dish_archetypes') THEN
    ALTER TABLE catalog.dish_archetypes SET SCHEMA sensory;
    ALTER TABLE sensory.dish_archetypes RENAME TO archetypes;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='serving_temp_modifiers') THEN
    ALTER TABLE catalog.serving_temp_modifiers SET SCHEMA sensory;
    ALTER TABLE sensory.serving_temp_modifiers RENAME TO temp_modifiers;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='volatile_timing_curves') THEN
    ALTER TABLE catalog.volatile_timing_curves SET SCHEMA sensory;
    ALTER TABLE sensory.volatile_timing_curves RENAME TO volatile_curves;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_synergy_pairs') THEN
    ALTER TABLE catalog.ingredient_synergy_pairs SET SCHEMA sensory;
    ALTER TABLE sensory.ingredient_synergy_pairs RENAME TO synergy_pairs;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='ingredient_food_mappings_sensory') THEN
    ALTER TABLE catalog.ingredient_food_mappings_sensory SET SCHEMA sensory;
    ALTER TABLE sensory.ingredient_food_mappings_sensory RENAME TO foodb_mappings;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='catalog' AND table_name='sensory_data_sources') THEN
    ALTER TABLE catalog.sensory_data_sources SET SCHEMA sensory;
    ALTER TABLE sensory.sensory_data_sources RENAME TO data_sources;
  END IF;

  -- meal.user_sensory_preferences → sensory.user_preferences
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='meal' AND table_name='user_sensory_preferences') THEN
    ALTER TABLE meal.user_sensory_preferences SET SCHEMA sensory;
    ALTER TABLE sensory.user_sensory_preferences RENAME TO user_preferences;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='meal' AND table_name='recipe_preference_matches') THEN
    ALTER TABLE meal.recipe_preference_matches SET SCHEMA sensory;
    ALTER TABLE sensory.recipe_preference_matches RENAME TO preference_matches;
  END IF;
END $$;
