/**
 * Resume Scoring — Open/Closed Principle
 *
 * Scoring weights and verdict thresholds are configurable constants,
 * not magic numbers buried in business logic. New scoring categories
 * can be added without modifying the calculation functions.
 */

// ─── Configurable Weights ────────────────────────────────────────────────────

export const SCORING_WEIGHTS = {
  matchScore: 0.40,
  atsScore: 0.20,
  impactScore: 0.25,
  verbScore: 0.15,
} as const;

export const VERDICT_THRESHOLDS = {
  strongMatch: 75,
  moderateMatch: 50,
  needsOptimization: 30,
} as const;

export type Verdict =
  | "Strong Match"
  | "Moderate Match"
  | "Needs Optimization"
  | "High Risk of Rejection";

// ─── Scoring Functions ───────────────────────────────────────────────────────

interface RawScores {
  overallMatchScore: number;
  atsScore: number;           // 0-10 scale
  quantifiableImpactScore: number; // 0-10 scale
  actionVerbScore: number;    // 0-10 scale
}

/** Clamps and rounds a value to a 0-max range */
function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

/**
 * Calculates the deterministic shortlist probability from raw AI scores.
 * Uses the configurable SCORING_WEIGHTS for a weighted average.
 */
export function calculateShortlistProbability(scores: RawScores): number {
  const matchScore = clamp(scores.overallMatchScore, 100);
  const atsScaled = clamp(scores.atsScore, 10) * 10;
  const impactScaled = clamp(scores.quantifiableImpactScore, 10) * 10;
  const verbScaled = clamp(scores.actionVerbScore, 10) * 10;

  return clamp(
    matchScore * SCORING_WEIGHTS.matchScore +
    atsScaled * SCORING_WEIGHTS.atsScore +
    impactScaled * SCORING_WEIGHTS.impactScore +
    verbScaled * SCORING_WEIGHTS.verbScore,
    100
  );
}

/**
 * Determines the verdict string based on shortlist probability.
 * Uses the configurable VERDICT_THRESHOLDS.
 */
export function determineVerdict(probability: number): Verdict {
  if (probability >= VERDICT_THRESHOLDS.strongMatch) return "Strong Match";
  if (probability >= VERDICT_THRESHOLDS.moderateMatch) return "Moderate Match";
  if (probability >= VERDICT_THRESHOLDS.needsOptimization) return "Needs Optimization";
  return "High Risk of Rejection";
}
