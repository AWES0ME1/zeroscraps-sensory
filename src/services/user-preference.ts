/**
 * User Sensory Preference Service
 *
 * Manages the per-user 113-dim preference vector used for personalized
 * recipe matching. Three ways to populate:
 *
 *   1. ONBOARDING — user answers ~15 Q's in a survey (explicit)
 *   2. LEARNING   — derived from recipes they like/dislike (implicit)
 *   3. HYBRID     — onboarding seeds it, likes refine it
 *
 * Schema reference: UserSensoryPreference in meal schema.
 */

import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('user-sensory-pref');
const SENSORY_DIM_COUNT = 113;

// ── Types ────────────────────────────────────────────────────────────────

export interface OnboardingAnswer {
  questionKey: string; // identifies which survey question
  score: number;       // -2 (strong dislike) to +2 (strong like)
}

export interface PreferenceSnapshot {
  preferences: number[];   // 113 dims: -1 (avoid) to +1 (want)
  weights: number[];       // 113 dims: 0 (don't care) to 1 (critical)
  avoid: string[];         // descriptors to always exclude
  preferredCuisines: Record<string, number>;
  likedCount: number;
  dislikedCount: number;
  lastUpdated: Date;
}

// ── Onboarding questions ─────────────────────────────────────────────────

/**
 * 15 survey questions that efficiently sample preference space.
 * Each question maps to a weighted set of dimensions.
 */
export const ONBOARDING_QUESTIONS = [
  {
    key: 'spicy_love',
    text: 'How much do you enjoy spicy food?',
    type: 'scale' as const,
    dimMappings: [{ dim: 7, weight: 1.0 }, { dim: 11, weight: 0.3 }],
  },
  {
    key: 'sweet_savory',
    text: 'Do you prefer sweet or savory dishes?',
    type: 'bipolar' as const,
    dimMappings: [
      { dim: 0, weight: 1.0 },   // Sweet
      { dim: 4, weight: -1.0 },  // Umami
    ],
  },
  {
    key: 'rich_light',
    text: 'Rich and indulgent or light and fresh?',
    type: 'bipolar' as const,
    dimMappings: [
      { dim: 106, weight: 1.0 }, // Rich
      { dim: 108, weight: -1.0 }, // Fresh
    ],
  },
  {
    key: 'texture_crunch',
    text: 'How important is crunchy texture?',
    type: 'scale' as const,
    dimMappings: [{ dim: 86, weight: 1.0 }, { dim: 87, weight: 0.7 }],
  },
  {
    key: 'creamy_love',
    text: 'Do you enjoy creamy/silky textures?',
    type: 'scale' as const,
    dimMappings: [{ dim: 95, weight: 1.0 }, { dim: 96, weight: 0.7 }],
  },
  {
    key: 'umami_seek',
    text: 'Do you gravitate toward umami-rich dishes?',
    type: 'scale' as const,
    dimMappings: [{ dim: 4, weight: 1.0 }, { dim: 5, weight: 0.5 }],
  },
  {
    key: 'bitter_tolerance',
    text: 'How do you feel about bitter flavors (coffee, dark chocolate, kale)?',
    type: 'scale' as const,
    dimMappings: [{ dim: 3, weight: 1.0 }],
  },
  {
    key: 'fermented_funk',
    text: 'Fermented/funky flavors (kimchi, blue cheese, miso)?',
    type: 'scale' as const,
    dimMappings: [{ dim: 64, weight: 0.7 }, { dim: 63, weight: 0.6 }, { dim: 67, weight: 0.7 }],
  },
  {
    key: 'herbs_florals',
    text: 'Do fresh herbs and floral flavors appeal to you?',
    type: 'scale' as const,
    dimMappings: [{ dim: 25, weight: 0.8 }, { dim: 21, weight: 0.5 }],
  },
  {
    key: 'smoky_grill',
    text: 'How much do you enjoy smoky/grilled flavors?',
    type: 'scale' as const,
    dimMappings: [{ dim: 48, weight: 0.8 }, { dim: 41, weight: 0.6 }, { dim: 50, weight: 0.4 }],
  },
  {
    key: 'cuisine_italian',
    text: 'How much do you enjoy Italian cuisine?',
    type: 'scale' as const,
    dimMappings: [{ dim: 62, weight: 0.4 }, { dim: 25, weight: 0.3 }],
    cuisineKey: 'italian',
  },
  {
    key: 'cuisine_asian',
    text: 'How much do you enjoy East Asian cuisines?',
    type: 'scale' as const,
    dimMappings: [{ dim: 67, weight: 0.5 }, { dim: 4, weight: 0.4 }, { dim: 72, weight: 0.3 }],
    cuisineKey: 'japanese',
  },
  {
    key: 'cuisine_mexican',
    text: 'How much do you enjoy Mexican/Latin cuisines?',
    type: 'scale' as const,
    dimMappings: [{ dim: 7, weight: 0.4 }, { dim: 14, weight: 0.4 }, { dim: 52, weight: 0.3 }],
    cuisineKey: 'mexican',
  },
  {
    key: 'cuisine_indian',
    text: 'How much do you enjoy Indian cuisine?',
    type: 'scale' as const,
    dimMappings: [{ dim: 35, weight: 0.7 }, { dim: 32, weight: 0.5 }],
    cuisineKey: 'indian',
  },
  {
    key: 'dietary_meat',
    text: 'How often do you want meat in your meals?',
    type: 'scale' as const,
    dimMappings: [{ dim: 76, weight: 0.6 }, { dim: 4, weight: 0.3 }],
  },
] as const;

// ── Build preference vector from onboarding answers ──────────────────────

export async function applyOnboardingAnswers(
  userId: string,
  answers: OnboardingAnswer[]
): Promise<PreferenceSnapshot> {
  const preferences = new Array(SENSORY_DIM_COUNT).fill(0);
  const weights = new Array(SENSORY_DIM_COUNT).fill(0);
  const preferredCuisines: Record<string, number> = {};

  for (const answer of answers) {
    const question = ONBOARDING_QUESTIONS.find((q) => q.key === answer.questionKey);
    if (!question) {
      log.warn({ questionKey: answer.questionKey }, 'Unknown onboarding question');
      continue;
    }

    // Normalize score to -1..+1 (from typical -2..+2 range)
    const normalized = Math.max(-1, Math.min(1, answer.score / 2));

    for (const mapping of question.dimMappings) {
      preferences[mapping.dim] += normalized * mapping.weight;
      weights[mapping.dim] = Math.max(weights[mapping.dim], Math.abs(mapping.weight) * 0.8);
    }

    // Track cuisine preferences
    const cuisineQuestion = question as unknown as { cuisineKey?: string };
    if (cuisineQuestion.cuisineKey && normalized > 0) {
      preferredCuisines[cuisineQuestion.cuisineKey] = normalized;
    }
  }

  // Normalize preferences to [-1, 1] bounds
  for (let i = 0; i < SENSORY_DIM_COUNT; i++) {
    preferences[i] = Math.max(-1, Math.min(1, preferences[i]));
    weights[i] = Math.max(0, Math.min(1, weights[i]));
  }

  const saved = await prisma.userSensoryPreference.upsert({
    where: { userId },
    update: {
      preferences,
      weights,
      preferredCuisines,
      onboardingVersion: 'v1',
      derivedFromLikes: false,
    },
    create: {
      userId,
      preferences,
      weights,
      preferredCuisines,
      onboardingVersion: 'v1',
      derivedFromLikes: false,
    },
  });

  return {
    preferences: saved.preferences,
    weights: saved.weights,
    avoid: saved.avoid,
    preferredCuisines: (saved.preferredCuisines as Record<string, number>) ?? {},
    likedCount: saved.likedRecipeIds.length,
    dislikedCount: saved.dislikedRecipeIds.length,
    lastUpdated: saved.lastUpdated,
  };
}

// ── Like/dislike tracking + implicit learning ────────────────────────────

export async function recordLike(userId: string, recipeId: string): Promise<void> {
  const pref = await prisma.userSensoryPreference.findUnique({ where: { userId } });
  if (!pref) {
    await prisma.userSensoryPreference.create({
      data: {
        userId,
        preferences: new Array(SENSORY_DIM_COUNT).fill(0),
        weights: new Array(SENSORY_DIM_COUNT).fill(0),
        likedRecipeIds: [recipeId],
      },
    });
    return;
  }
  if (pref.likedRecipeIds.includes(recipeId)) return;
  await prisma.userSensoryPreference.update({
    where: { userId },
    data: {
      likedRecipeIds: { push: recipeId },
      dislikedRecipeIds: pref.dislikedRecipeIds.filter((id) => id !== recipeId),
    },
  });
  await refreshDerivedPreferences(userId);
}

export async function recordDislike(userId: string, recipeId: string): Promise<void> {
  const pref = await prisma.userSensoryPreference.findUnique({ where: { userId } });
  if (!pref) {
    await prisma.userSensoryPreference.create({
      data: {
        userId,
        preferences: new Array(SENSORY_DIM_COUNT).fill(0),
        weights: new Array(SENSORY_DIM_COUNT).fill(0),
        dislikedRecipeIds: [recipeId],
      },
    });
    return;
  }
  if (pref.dislikedRecipeIds.includes(recipeId)) return;
  await prisma.userSensoryPreference.update({
    where: { userId },
    data: {
      dislikedRecipeIds: { push: recipeId },
      likedRecipeIds: pref.likedRecipeIds.filter((id) => id !== recipeId),
    },
  });
  await refreshDerivedPreferences(userId);
}

/**
 * Recompute preference vector as weighted avg of liked - disliked profiles.
 * Blends with onboarding preferences (if present) to avoid wiping user input.
 */
async function refreshDerivedPreferences(userId: string): Promise<void> {
  const pref = await prisma.userSensoryPreference.findUnique({ where: { userId } });
  if (!pref) return;

  const liked = await prisma.recipeSensorySnapshot.findMany({
    where: { recipeId: { in: pref.likedRecipeIds }, sensoryProfile: { isEmpty: false } },
    select: { sensoryProfile: true },
  });
  const disliked = await prisma.recipeSensorySnapshot.findMany({
    where: { recipeId: { in: pref.dislikedRecipeIds }, sensoryProfile: { isEmpty: false } },
    select: { sensoryProfile: true },
  });

  if (liked.length === 0 && disliked.length === 0) return;

  const derived = new Array(SENSORY_DIM_COUNT).fill(0);
  const derivedWeights = new Array(SENSORY_DIM_COUNT).fill(0);

  // Average liked recipes → positive signal
  for (const r of liked) {
    for (let i = 0; i < r.sensoryProfile.length && i < SENSORY_DIM_COUNT; i++) {
      derived[i] += (r.sensoryProfile[i] / 6) / liked.length; // normalize 0-6 to 0-1
    }
  }

  // Subtract disliked recipes → negative signal
  for (const r of disliked) {
    for (let i = 0; i < r.sensoryProfile.length && i < SENSORY_DIM_COUNT; i++) {
      derived[i] -= (r.sensoryProfile[i] / 6) / disliked.length;
    }
  }

  // Determine weights by variance — dims that differ between liked/disliked are important
  for (let i = 0; i < SENSORY_DIM_COUNT; i++) {
    derivedWeights[i] = Math.min(1, Math.abs(derived[i]) * 2);
  }

  // Blend with onboarding vector (if present)
  // 60% derived from likes + 40% onboarding (after enough signal: 5+ likes)
  const blendRatio = pref.likedRecipeIds.length >= 5 ? 0.6 : 0.3;
  const finalPrefs = new Array(SENSORY_DIM_COUNT).fill(0);
  const finalWeights = new Array(SENSORY_DIM_COUNT).fill(0);

  for (let i = 0; i < SENSORY_DIM_COUNT; i++) {
    finalPrefs[i] = Math.max(
      -1,
      Math.min(1, derived[i] * blendRatio + pref.preferences[i] * (1 - blendRatio))
    );
    finalWeights[i] = Math.max(
      0,
      Math.min(1, derivedWeights[i] * blendRatio + pref.weights[i] * (1 - blendRatio))
    );
  }

  await prisma.userSensoryPreference.update({
    where: { userId },
    data: {
      preferences: finalPrefs,
      weights: finalWeights,
      derivedFromLikes: true,
    },
  });
}

// ── Getters ──────────────────────────────────────────────────────────────

export async function getPreferenceSnapshot(userId: string): Promise<PreferenceSnapshot | null> {
  const pref = await prisma.userSensoryPreference.findUnique({ where: { userId } });
  if (!pref) return null;
  return {
    preferences: pref.preferences,
    weights: pref.weights,
    avoid: pref.avoid,
    preferredCuisines: (pref.preferredCuisines as Record<string, number>) ?? {},
    likedCount: pref.likedRecipeIds.length,
    dislikedCount: pref.dislikedRecipeIds.length,
    lastUpdated: pref.lastUpdated,
  };
}

export async function setAvoidanceList(userId: string, avoid: string[]): Promise<void> {
  await prisma.userSensoryPreference.upsert({
    where: { userId },
    update: { avoid },
    create: {
      userId,
      preferences: new Array(SENSORY_DIM_COUNT).fill(0),
      weights: new Array(SENSORY_DIM_COUNT).fill(0),
      avoid,
    },
  });
}

log.info('user-sensory-preference service loaded');
