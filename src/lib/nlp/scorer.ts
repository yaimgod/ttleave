import { STRESS_VOCABULARY, NEGATIONS, INTENSIFIERS } from "./vocabulary";

export interface ScoreResult {
  /** Raw accumulated score before clamping */
  rawScore: number;
  /** Final 0-100 normalized score */
  normalizedScore: number;
  /** Keywords matched with their contribution */
  matchedWords: Array<{ word: string; score: number }>;
  /** Number of meaningful tokens */
  wordCount: number;
}

/**
 * Score a "boss event" input text for work-stress level.
 * Returns a 0-100 normalizedScore.
 */
export function scoreText(text: string): ScoreResult {
  const tokens = text
    .toLowerCase()
    .replace(/['']/g, "'")
    .split(/[\s,!?.;:]+/)
    .filter(Boolean);

  let totalScore = 0;
  const matched: Array<{ word: string; score: number }> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const weight = STRESS_VOCABULARY[token];

    if (weight !== undefined) {
      let contribution = weight;

      // Check preceding negation (window of 2)
      const prev1 = i > 0 ? tokens[i - 1] : "";
      const prev2 = i > 1 ? tokens[i - 2] : "";
      if (NEGATIONS.has(prev1) || NEGATIONS.has(prev2)) {
        contribution *= -0.5; // negation reverses / halves
      } else {
        // Check preceding intensifier
        const intensifier = INTENSIFIERS[prev1] ?? INTENSIFIERS[prev2] ?? 1;
        contribution *= intensifier;
      }

      totalScore += contribution;
      matched.push({ word: token, score: Math.round(contribution) });
    }
  }

  // Sigmoid-style clamping: map raw score to 0-100
  // Multiple high-score words stack, but single mild word stays mild
  const normalized = Math.max(0, Math.min(100, totalScore));

  return {
    rawScore: totalScore,
    normalizedScore: Math.round(normalized),
    matchedWords: matched,
    wordCount: tokens.length,
  };
}
