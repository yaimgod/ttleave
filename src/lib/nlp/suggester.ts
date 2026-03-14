/**
 * Map a 0-100 stress score to a suggested number of days to advance (shorten)
 * a mutable event's countdown.
 *
 * Curve:
 *   0-19  → 0 days (no change)
 *  20-39  → 1-2 days
 *  40-69  → 3-7 days
 *  70-100 → 7-14 days
 */
export function scoreToSuggestedDays(score: number): number {
  if (score < 20) return 0;
  if (score < 40) {
    // 20→1, 39→2
    return Math.max(1, Math.round(1 + (score - 20) / 20));
  }
  if (score < 70) {
    // 40→3, 69→7
    return Math.round(3 + ((score - 40) / 30) * 4);
  }
  // 70→7, 100→14
  return Math.round(7 + ((score - 70) / 30) * 7);
}

/**
 * Label a score bucket for display purposes.
 */
export function scoreToBucketLabel(
  score: number
): "calm" | "mild" | "stressed" | "high" | "critical" {
  if (score < 20) return "calm";
  if (score < 40) return "mild";
  if (score < 60) return "stressed";
  if (score < 80) return "high";
  return "critical";
}
