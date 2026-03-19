/**
 * Per-user online linear regression for NLP suggestion adaptation.
 *
 * Model:  days = lr_slope × (0.5 − score) + lr_intercept
 *
 * Where `score` is a 0-1 float from the Python NLP sidecar:
 *   0.0 = very positive/happy  →  +slope/2 + intercept  →  positive (bring date closer)
 *   0.5 = neutral              →  intercept (~0)         →  no change
 *   1.0 = very negative/mad    →  −slope/2 + intercept  →  negative (push date further)
 *
 * The input is centred at (0.5 − score) so that:
 *   - slope is always positive (magnitude of response), clamped [1, 28]
 *   - defaultLinearModel() exactly reproduces the (0.5−score)×14 base curve
 *   - no cold-start jump: the model is used from the very first prediction
 *   - L2 regularisation pulls slope back toward 14 (not 1) between overrides
 *
 * The model is updated after each user override using stochastic gradient descent
 * with L2 regularisation and gradient clipping to prevent instability.
 *
 * Stability guarantees:
 *  - Slope clamped to [1, 28]:    always positive, at most 2× default range
 *  - Intercept clamped to [-7, 7]: symmetric shift only
 *  - L2 regularisation λ=0.01:    pulls toward slope=14, intercept=0
 *  - Gradient clip [-5, 5]:       single extreme override can't destabilise
 *  - LR decay 0.97× per update → floor 0.01: converges after ~75 overrides
 */

export interface LinearModel {
  lr_slope: number;          // default 14.0, clamped [1.0, 28.0]
  lr_intercept: number;      // default 0.0,  clamped [-7.0, 7.0]
  lr_learning_rate: number;  // starts 0.1, decays 0.97x per update, floor 0.01
  sample_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// No cold-start threshold — defaultLinearModel() is already the base curve,
// so the model gives correct predictions from sample 0 and learns from sample 1.
export const COLD_START_THRESHOLD = 0;

const HALF_RANGE      =  7;          // predictions span [-7, +7]
const SLOPE_DEFAULT   = 14.0;        // slope s.t. score 0→+7, 0.5→0, 1→-7
const SLOPE_MIN       =  1.0;
const SLOPE_MAX       = 28.0;
const INTERCEPT_MIN   = -HALF_RANGE;
const INTERCEPT_MAX   =  HALF_RANGE;
const LR_FLOOR        =  0.01;
const LR_DECAY        =  0.97;
const L2_LAMBDA       =  0.01;  // pulls slope toward SLOPE_DEFAULT, intercept toward 0
const GRAD_CLIP       =  5.0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict how many days to suggest given a raw 0-1 sentiment score.
 *
 * Formula: days = lr_slope × (0.5 − score) + lr_intercept
 *   score 0.0 (happy)   → +7  (bring date closer — you're keen, do it sooner)
 *   score 0.5 (neutral) →  0  (no change)
 *   score 1.0 (mad)     → -7  (push date further — you need more time)
 */
export function predict(model: LinearModel, score: number): number {
  const raw = model.lr_slope * (0.5 - score) + model.lr_intercept;
  return Math.max(-HALF_RANGE, Math.min(HALF_RANGE, Math.round(raw)));
}

/**
 * Update the model given a (score, chosenDays) observation.
 *
 * Uses online SGD on MSE loss:  L = ½(predicted − chosen)²
 *   ∂L/∂slope     = error × (0.5 − score)  +  λ × (slope − SLOPE_DEFAULT)
 *   ∂L/∂intercept = error                  +  λ × intercept
 *
 * L2 regularisation anchors slope toward 14 so the model doesn't drift away
 * from the sensible default between sessions with few overrides.
 *
 * Returns a new model (immutable update).
 */
export function updateModel(
  model: LinearModel,
  score: number,
  chosenDays: number
): LinearModel {
  const centred   = 0.5 - score;                                // centred input
  const predicted = model.lr_slope * centred + model.lr_intercept;
  const error     = predicted - chosenDays;
  const lr        = model.lr_learning_rate;

  const gradSlope     = error * centred + L2_LAMBDA * (model.lr_slope     - SLOPE_DEFAULT);
  const gradIntercept = error            + L2_LAMBDA *  model.lr_intercept;

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
 * slope=14 + intercept=0 exactly reproduces (0.5−score)×14:
 *   score 0 → +7, score 0.5 → 0, score 1 → -7
 */
export function defaultLinearModel(): LinearModel {
  return {
    lr_slope:         SLOPE_DEFAULT,  // 14.0
    lr_intercept:     0.0,
    lr_learning_rate: 0.1,
    sample_count:     0,
  };
}
