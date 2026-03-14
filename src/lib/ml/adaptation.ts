/**
 * Exponential Moving Average (EMA) adaptation for NLP day suggestions.
 *
 * Tracks the ratio of user-chosen days vs NLP-suggested days per event.
 * Over time, suggestions are scaled by the user's personal ratio.
 */

export interface FeedbackRecord {
  ema_ratio: number; // current smoothed ratio (chosen/suggested)
  ema_alpha: number; // learning rate, decays over time
  sample_count: number;
}

export const COLD_START_THRESHOLD = 3;

/**
 * Update the EMA record after a user accepts or overrides a suggestion.
 *
 * @param record  Current EMA state from DB
 * @param suggestedDays  What the NLP model suggested
 * @param chosenDays  What the user actually chose
 */
export function updateEMA(
  record: FeedbackRecord,
  suggestedDays: number,
  chosenDays: number
): FeedbackRecord {
  if (suggestedDays === 0 && chosenDays === 0) return record;

  // Avoid division by zero: if suggested is 0 but user chose > 0, treat ratio as 2.0 (scale up)
  const ratio =
    suggestedDays === 0 ? 2.0 : chosenDays / suggestedDays;

  const alpha = record.ema_alpha;
  const newEMA = alpha * ratio + (1 - alpha) * record.ema_ratio;

  // Decay learning rate gradually, floor at 0.1
  const newAlpha = Math.max(0.1, alpha * 0.98);

  return {
    ema_ratio: Math.round(newEMA * 1000) / 1000, // 3 decimal precision
    ema_alpha: Math.round(newAlpha * 1000) / 1000,
    sample_count: record.sample_count + 1,
  };
}

/**
 * Apply the personalized multiplier to a raw NLP suggestion.
 * During cold start (< COLD_START_THRESHOLD samples), return raw unchanged.
 *
 * @param rawSuggestion  Days suggested by NLP scorer
 * @param record  Current EMA state
 */
export function adaptSuggestion(
  rawSuggestion: number,
  record: FeedbackRecord
): number {
  if (record.sample_count < COLD_START_THRESHOLD) return rawSuggestion;
  return Math.max(0, Math.round(rawSuggestion * record.ema_ratio));
}

/**
 * Default / initial EMA record for a new user-event pair.
 */
export function defaultFeedbackRecord(): FeedbackRecord {
  return {
    ema_ratio: 1.0,
    ema_alpha: 0.3,
    sample_count: 0,
  };
}
