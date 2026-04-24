/**
 * @zeroscraps/sensory — public entry point.
 *
 * A self-contained sensory compound engine: 113-dim flavor profiles,
 * cooking transforms, interaction rules, natural-language recipe matching.
 *
 * Installs as a plug-in with an isolated `sensory` PostgreSQL schema.
 * See INSTALL.md for full integration steps.
 */

export {
  createSensoryPlugin,
  composeRecipeSensoryV2,
  persistV2Result,
  invalidateV2Cache,
  findRecipesByQuery,
  findSimilarRecipes,
  findSubstitutes,
  findComplements,
  parseQuery,
  explainQuery,
  lockFixture,
  runRegressionSuite,
  detectDrift,
  bootstrapFixtures,
  applyOnboardingAnswers,
  recordLike,
  recordDislike,
  getPreferenceSnapshot,
  setAvoidanceList,
  ONBOARDING_QUESTIONS,
  runEnhancement,
  findGaps,
  prisma,
} from './plugin';

export type {
  SensoryPlugin,
  SensoryPluginConfig,
  HostAdapter,
  HostRecipe,
  V2Result,
  V2IngredientInput,
  V2Instruction,
} from './plugin';
