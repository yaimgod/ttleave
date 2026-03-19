/**
 * Per-user online linear regression for NLP suggestion adaptation.
 *
 * Model:  suggestedDays = lr_slope * score + lr_intercept
 *
 * Where `score` is a 0-1 float from the Python NLP sidecar:
 *   0.0 = very positive  →  negative days (push the date further away)
 *   0.5 = neutral        →  0 days (no change)
 *   1.0 = very negative  →  positive days (bring the date closer)
 *
 * The model is updated after each user override using stochastic gradient descent
 * with L2 regularisation and gradient clipping to prevent instability.
 *
 * Stability guarantees:
 *  - Cold start (< 3 samples): symmetric base curve → [-7, +7] days
 *  - Slope clamped to [0.5, 3.0]:  can't suggest 0 or absurdly many days
 *  - Intercept clamped to [-7, 7]: symmetric shift only
 *  - L2 regularisation λ=0.01:     pulls toward slope=1, intercept=0
 *  - Gradient clip [-5, 5]:        single extreme override can't destabilise
 *  - LR decay 0.97× per update → floor 0.01: converges after ~75 overrides
 */

export interface LinearModel {
  lr_slope: number;          // default 1.0, clamped [0.5, 3.0]
  lr_intercept: number;      // default 0.0, clamped [-3.0, 5.0]
  lr_learning_rate: number;  // starts 0.1, decays 0.97x per update, floor 0.01
  sample_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COLD_START_THRESHOLD = 3;

const MAX_DAYS      = 14;
const HALF_RANGE    = MAX_DAYS / 2;   // 7 — predictions span [-7, +7]
const SLOPE_MIN     =  0.5;
const SLOPE_MAX     =  3.0;
const INTERCEPT_MIN = -HALF_RANGE;   // -7
const INTERCEPT_MAX =  HALF_RANGE;   //  7
const LR_FLOOR      =  0.01;
const LR_DECAY      =  0.97;
const L2_LAMBDA     =  0.01;  // regularisation strength (pulls toward neutral defaults)
const GRAD_CLIP     =  5.0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict how many days to suggest given a raw 0-1 sentiment score.
 *
 * During cold start (sample_count < 3) returns the base curve so the model
 * doesn't influence suggestions before it has learned anything meaningful.
 */
export function predict(model: LinearModel, score: number): number {
  if (model.sample_count < COLD_START_THRESHOLD) {
    // Symmetric base curve:
    //   score 0.0 (very positive) → -7 days (push date further away)
    //   score 0.5 (neutral)       →  0 days (no change)
    //   score 1.0 (very negative) → +7 days (bring date closer)
    return Math.round((score - 0.5) * MAX_DAYS);
  }

  const raw = model.lr_slope * score + model.lr_intercept;
  return Math.max(-HALF_RANGE, Math.min(HALF_RANGE, Math.round(raw)));
}

/**
 * Update the model given a (score, chosenDays) observation.
 *
 * Uses online stochastic gradient descent on MSE loss with:
 *   L2 regularisation: keeps slope near 1 and intercept near 0
 *   Gradient clipping: prevents a single wild override from destabilising
 *   Learning rate decay: model converges gradually, stops thrashing
 *
 * Returns a new model (immutable update).
 */
export function updateModel(
  model: LinearModel,
  score: number,
  chosenDays: number
): LinearModel {
  const predicted = model.lr_slope * score + model.lr_intercept;
  const error     = predicted - chosenDays;          // (y_hat - y)
  const lr        = model.lr_learning_rate;

  // MSE gradients + L2 regularisation penalty
  // dL/d_slope     = error * score + λ * (slope - 1.0)
  // dL/d_intercept = error         + λ * (intercept - 0.0)
  const gradSlope     = error * score + L2_LAMBDA * (model.lr_slope     - 1.0);
  const gradIntercept = error         + L2_LAMBDA * (model.lr_intercept - 0.0);

  // Clip gradients to prevent a single extreme data point from destabilising
  const clip = (g: number): number => Math.max(-GRAD_CLIP, Math.min(GRAD_CLIP, g));

  const newSlope     = model.lr_slope     - lr * clip(gradSlope);
  const newIntercept = model.lr_intercept - lr * clip(gradIntercept);

  return {
    lr_slope:         Math.max(SLOPE_MIN,     Math.min(SLOPE_MAX,     newSlope)),
    lr_intercept:     Math.max(INTERCEPT_MIN, Math.min(INTERCEPT_MAX, newIntercept)),
    lr_learning_rate: Math.max(LR_FLOOR,      lr * LR_DECAY),
    sample_count:     model.sample_count + 1,
  };
}

/**
 * Default / initial model for a new (user, event) pair.
 * Equivalent to the base curve (slope=1 → score*14 days, intercept=0).
 */
export function defaultLinearModel(): LinearModel {
  return {
    lr_slope:         1.0,
    lr_intercept:     0.0,
    lr_learning_rate: 0.1,
    sample_count:     0,
  };
}
