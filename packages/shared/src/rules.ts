import type { HelperId } from './types';

/** Shared rule values for the cooperative Wolfgatti game. */
export const RULES = {
  minPlayers: 3,
  maxPlayers: 7,
  pictureCount: 168,
  handSize: { 3: 18, 4: 9, 5: 9, 6: 6, 7: 6 } as Record<number, number>,
  directors: { 3: 2, 4: 2, 5: 3, 6: 3, 7: 4 } as Record<number, number>,
  forgeries: 4,
  themes: 2,
  requestMin: 2,
  requestMax: 7,
  // House rule: after the ±1 helper the count may leave the 2–7 range by one.
  adjustedMin: 1,
  adjustedMax: 8,
  swapHandCount: 6,
  wolfgattiLimit: 6,
  winScore: 15,
  helperNumbers: { swapThemes: 3, swapHand: 4, plusMinus: 5, ask: 6 } as Record<HelperId, number>,
} as const;

export const HELPERS: HelperId[] = ['swapThemes', 'ask', 'plusMinus', 'swapHand'];

export const HELPER_ROLE: Record<HelperId, 'director' | 'painter'> = {
  swapThemes: 'director',
  ask: 'director',
  plusMinus: 'painter',
  swapHand: 'painter',
};

export type Rating = 'r30' | 'r25' | 'r20' | 'r15' | 'r10' | 'r0';

export function ratingFor(score: number): Rating {
  if (score >= 30) return 'r30';
  if (score >= 25) return 'r25';
  if (score >= 20) return 'r20';
  if (score >= 15) return 'r15';
  if (score >= 10) return 'r10';
  return 'r0';
}
