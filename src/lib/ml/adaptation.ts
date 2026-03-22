/**
 * Per-user online 3-D linear regression for NLP suggestion adaptation.
 *
 * Model:  days = lr_w_v × V + lr_w_a × A + lr_w_d × D + lr_bias
 *
 * Where V, A, D are the Valence-Arousal-Dominance centroid returned by the
 * Python NLP sidecar — a probability-weighted average over 7 emotion classes
 * (anger, disgust, fear, joy, neutral, sadness, surprise).
 *
 *   V: −1 (very unpleasant) → +1 (very pleasant)
 *   A: −1 (very calm)       → +1 (very aroused / activated)
 *   D: −1 (very helpless)   → +1 (very dominant / in-control)
 *
 * Default weights give an intuitive ordering that matches the user's intent:
 *   "hate" text  (anger + disgust mix)  ≈ 6 days   ← most urgent
 *   pure anger                          ≈ 6 days
 *   sadness                             ≈ 4 days
 *   neutral                             ≈ 0 days
 *   joy                                 ≈ −5 days  ← push leave further
 *
 * Default derivation (w_v=−8, w_a=4, w_d=−2, bias=0):
 *   anger   V=−0.51 A=0.59 D=0.25 → −8×(−0.51)+4×0.59+(−2)×0.25 ≈ +5.9 days
 *   fear    V=−0.62 A=0.60 D=−0.43 → 4.96+2.40+0.86             ≈ +8.2 → capped +7
 *   sadness V=−0.63 A=−0.27 D=−0.33 → 5.04−1.08+0.66            ≈ +4.6 days
 *   joy     V=0.76  A=0.48  D=0.35  → −6.08+1.92−0.70           ≈ −4.9 days
 *
 * The model is updated after each user override using stochastic gradient
 * descent (MSE loss) with L2 regularisation and gradient clipping.
 *
 * Stability guarantees:
 *   lr_w_v  clamped [−20, 0]:  must stay negative (neg valence → more days)
 *   lr_w_a  clamped [0, 14]:   must stay non-negative (arousal → urgency)
 *   lr_w_d  clamped [−8, 0]:   must stay non-positive (dominance ↓ days)
 *   lr_bias clamped [−7, 7]:   symmetric shift
 *   Gradient clip ±5:          single extreme override can't destabilise
 *   L2 λ=0.01:                 anchors weights toward defaults between sessions
 *   LR decay 0.97× per update, floor 0.01: converges after ~75 overrides
 */

export interface VADFeatures {
  V: number;  // valence:   −1 (unpleasant) → +1 (pleasant)
  A: number;  // arousal:   −1 (calm)       → +1 (aroused)
  D: number;  // dominance: −1 (helpless)   → +1 (dominant)
}

export interface VADModel {
  lr_w_v: number;           // weight for valence,   default −8.0
  lr_w_a: number;           // weight for arousal,   default +4.0
  lr_w_d: number;           // weight for dominance, default −2.0
  lr_bias: number;          // bias term,            default 0.0
  lr_learning_rate: number; // starts 0.1, decays 0.97× per update, floor 0.01
  sample_count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_W_V   = -8.0;
const DEFAULT_W_A   =   4.0;
const DEFAULT_W_D   =  -2.0;
const DEFAULT_BIAS  =  0.0;

const W_V_MIN       = -20.0;
const W_V_MAX       =   0.0;   // must stay ≤ 0 (neg valence → more days)
const W_A_MIN       =   0.0;   // must stay ≥ 0 (arousal → urgency)
const W_A_MAX       =  14.0;
const W_D_MIN       =  -8.0;
const W_D_MAX       =   0.0;   // must stay ≤ 0 (dominance decreases days)
const BIAS_MIN      =  -7.0;
const BIAS_MAX      =   7.0;
const HALF_RANGE    =   7;     // prediction output clamped to [−7, +7]
const LR_FLOOR      =   0.01;
const LR_DECAY      =   0.97;
const L2_LAMBDA     =   0.01;
const GRAD_CLIP     =   5.0;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Predict how many days to suggest given the VAD features from the NLP sidecar.
 *
 *   days = lr_w_v × V + lr_w_a × A + lr_w_d × D + lr_bias
 *
 * Result is rounded and clamped to [−7, +7].
 */
export function predict(model: VADModel, vad: VADFeatures): number {
  const raw =
    model.lr_w_v * vad.V +
    model.lr_w_a * vad.A +
    model.lr_w_d * vad.D +
    model.lr_bias;
  return Math.max(-HALF_RANGE, Math.min(HALF_RANGE, Math.round(raw)));
}

/**
 * Update the model given a (vad, chosenDays) observation.
 *
 * Online SGD on MSE loss:  L = ½(predicted − chosen)²
 *   ∂L/∂w_v   = error × V  +  λ × (w_v  − DEFAULT_W_V)
 *   ∂L/∂w_a   = error × A  +  λ × (w_a  − DEFAULT_W_A)
 *   ∂L/∂w_d   = error × D  +  λ × (w_d  − DEFAULT_W_D)
 *   ∂L/∂bias  = error      +  λ × bias
 *
 * L2 regularisation anchors each weight toward its default so the model
 * doesn't drift away from sensible behaviour between sparse feedback sessions.
 *
 * Returns a new model (immutable update).
 */
export function updateModel(
  model: VADModel,
  vad: VADFeatures,
  chosenDays: number
): VADModel {
  const predicted =
    model.lr_w_v * vad.V +
    model.lr_w_a * vad.A +
    model.lr_w_d * vad.D +
    model.lr_bias;

  const error = predicted - chosenDays;
  const lr    = model.lr_learning_rate;

  const gradWv   = error * vad.V + L2_LAMBDA * (model.lr_w_v  - DEFAULT_W_V);
  const gradWa   = error * vad.A + L2_LAMBDA * (model.lr_w_a  - DEFAULT_W_A);
  const gradWd   = error * vad.D + L2_LAMBDA * (model.lr_w_d  - DEFAULT_W_D);
  const gradBias = error          + L2_LAMBDA *  model.lr_bias;

  const clip = (g: number): number =>
    Math.max(-GRAD_CLIP, Math.min(GRAD_CLIP, g));

  const newWv   = model.lr_w_v  - lr * clip(gradWv);
  const newWa   = model.lr_w_a  - lr * clip(gradWa);
  const newWd   = model.lr_w_d  - lr * clip(gradWd);
  const newBias = model.lr_bias - lr * clip(gradBias);

  return {
    lr_w_v:          Math.max(W_V_MIN,  Math.min(W_V_MAX,  newWv)),
    lr_w_a:          Math.max(W_A_MIN,  Math.min(W_A_MAX,  newWa)),
    lr_w_d:          Math.max(W_D_MIN,  Math.min(W_D_MAX,  newWd)),
    lr_bias:         Math.max(BIAS_MIN, Math.min(BIAS_MAX, newBias)),
    lr_learning_rate: Math.max(LR_FLOOR, lr * LR_DECAY),
    sample_count:    model.sample_count + 1,
  };
}

/**
 * Default / initial model for a new (user, event) pair.
 *
 * These weights reproduce the intended ordering on first use:
 *   hate/anger ≈ 6 days > sadness ≈ 4 days > neutral 0 > joy ≈ −5 days
 */
export function defaultVADModel(): VADModel {
  return {
    lr_w_v:          DEFAULT_W_V,  // −8.0
    lr_w_a:          DEFAULT_W_A,  // +4.0
    lr_w_d:          DEFAULT_W_D,  // −2.0
    lr_bias:         DEFAULT_BIAS, //  0.0
    lr_learning_rate: 0.1,
    sample_count:    0,
  };
}

// Keep old export name as an alias so any remaining references don't break
/** @deprecated Use defaultVADModel() */
export const defaultLinearModel = defaultVADModel;
