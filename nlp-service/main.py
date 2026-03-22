"""
TTLeave NLP sidecar — Emotion VAD model (v3)
--------------------------------------------
Primary model: j-hartmann/emotion-english-distilroberta-base
  7-class English emotion classifier:
    anger, disgust, fear, joy, neutral, sadness, surprise
  English-only; non-English text is translated before classification.

Translation: Helsinki-NLP/opus-mt-tc-big-he-en  (Hebrew → English)
  Loaded lazily on first Hebrew input (~300 MB MarianMT model).
  Other non-English languages are passed through as-is
  (model is English-optimised, results will be degraded but non-crashing).

Language detection: langdetect
  Identifies input language so translation is applied only when needed.

VAD mapping (Valence-Arousal-Dominance, Mehrabian 1996 PAD scale):
  Each emotion class is anchored to a 3-D emotional-space coordinate.
    V: -1 (very unpleasant) → +1 (very pleasant)
    A: -1 (very calm)       → +1 (very aroused/activated)
    D: -1 (very helpless)   → +1 (very dominant/in-control)

  The VAD centroid for a text is the probability-weighted average over all 7 classes.
  These raw V, A, D values are returned to the TypeScript layer so the per-user
  3-D linear regression can adapt them — downstream code must NOT re-derive
  the score from them independently.

Composite stress score (for UI display only):
  negV     = max(0, -V)       — how unpleasant
  posA     = max(0,  A)       — how aroused / activated
  helpless = max(0, -D)       — how helpless / out-of-control
  raw  = 0.50 * negV + 0.35 * posA + 0.15 * helpless
  score = clamp(raw / 0.585, 0, 1)   # 0.585 ≈ max of pure-fear centroid

  Natural ordering (approximate):
    fear/terror   → ~1.00
    hate text     (anger+disgust mix)  → ~0.67
    pure anger    → ~0.68
    sadness       → ~0.54
    neutral       → ~0.00
    joy           → ~0.00  (clamped; positivity formula contribution is 0)

Output per POST /score:
  score            float        0-1 composite stress (× 100 = sentimentScore)
  dominant_emotion str          highest-probability class, e.g. "anger"
  emotion_probs    dict[str,f]  all 7 class probabilities
  vad              {V, A, D}    weighted centroid in VAD space
  language         str          detected ISO 639-1 code, e.g. "en", "he"
  translated       bool         True if Hebrew→English translation was applied
"""

from __future__ import annotations
import warnings
warnings.filterwarnings("ignore", category=FutureWarning)

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from transformers import pipeline
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# ── Emotion VAD centroids (Mehrabian 1996 PAD scale) ──────────────────────────
# V: pleasant (+) / unpleasant (−)
# A: aroused (+)  / calm (−)
# D: dominant (+) / helpless (−)
EMOTION_VAD: dict[str, tuple[float, float, float]] = {
    "anger":    (-0.51,  0.59,  0.25),  # unpleasant, high arousal, moderately dominant
    "disgust":  (-0.60,  0.35,  0.11),  # very unpleasant, moderate arousal, slight dominance
    "fear":     (-0.62,  0.60, -0.43),  # very unpleasant, high arousal, very helpless
    "joy":      ( 0.76,  0.48,  0.35),  # very pleasant, moderate arousal, dominant
    "neutral":  ( 0.00,  0.00,  0.00),  # baseline
    "sadness":  (-0.63, -0.27, -0.33),  # very unpleasant, low arousal, helpless
    "surprise": ( 0.40,  0.67, -0.13),  # pleasant, very aroused, slight helplessness
}

# ── Normalization constant for stress score ────────────────────────────────────
# Maximum of (0.5*negV + 0.35*posA + 0.15*helpless) across all pure-emotion centroids.
# Pure fear: negV=0.62, posA=0.60, helpless=0.43 → 0.31 + 0.21 + 0.065 = 0.585
_SCORE_NORM: float = 0.585

# ── Primary: Emotion classifier ───────────────────────────────────────────────
_EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
emotion_clf = pipeline(
    "text-classification",
    model=_EMOTION_MODEL,
    top_k=None,   # return all 7 class probabilities
    device=-1,    # CPU
)

# ── Translation: Hebrew → English (lazy) ──────────────────────────────────────
_HE_EN_MODEL = "Helsinki-NLP/opus-mt-tc-big-he-en"
_he_en_translator = None


def _get_he_en_translator():
    global _he_en_translator
    if _he_en_translator is None:
        logger.warning("Loading Hebrew→English translation model (first Hebrew input)…")
        _he_en_translator = pipeline(
            "translation",
            model=_HE_EN_MODEL,
            device=-1,
        )
        logger.warning("Hebrew→English model loaded.")
    return _he_en_translator


# ── Language detection ─────────────────────────────────────────────────────────
def _detect_language(text: str) -> str:
    """Return ISO 639-1 code, or 'en' on any detection failure."""
    try:
        from langdetect import detect  # type: ignore[import]
        return detect(text)
    except Exception:
        return "en"


# ── Core computation ───────────────────────────────────────────────────────────
def _vad_and_score(
    all_scores: list[dict],
) -> tuple[float, str, dict[str, float], float, float, float]:
    """
    From the 7-class probability distribution, compute:
      (stress_score, dominant_emotion, probs_dict, V, A, D)
    """
    probs: dict[str, float] = {r["label"]: r["score"] for r in all_scores}
    dominant = max(probs, key=lambda k: probs[k])

    # Probability-weighted VAD centroid
    V = sum(probs.get(e, 0.0) * vad[0] for e, vad in EMOTION_VAD.items())
    A = sum(probs.get(e, 0.0) * vad[1] for e, vad in EMOTION_VAD.items())
    D = sum(probs.get(e, 0.0) * vad[2] for e, vad in EMOTION_VAD.items())

    # Composite stress score (display only)
    neg_v    = max(0.0, -V)
    pos_a    = max(0.0,  A)
    helpless = max(0.0, -D)
    raw_score = 0.50 * neg_v + 0.35 * pos_a + 0.15 * helpless
    score = max(0.0, min(1.0, raw_score / _SCORE_NORM))

    return round(score, 4), dominant, probs, round(V, 4), round(A, 4), round(D, 4)


# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(title="TTLeave NLP Service", version="3.0.0")


class ScoreRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v[:512]  # hard-cap; tokeniser also truncates


class VAD(BaseModel):
    V: float  # valence:   -1 (unpleasant) → +1 (pleasant)
    A: float  # arousal:   -1 (calm)       → +1 (aroused)
    D: float  # dominance: -1 (helpless)   → +1 (dominant)


class ScoreResponse(BaseModel):
    score: float                     # 0-1 composite stress score
    dominant_emotion: str            # e.g. "anger"
    emotion_probs: dict[str, float]  # all 7 class probabilities
    vad: VAD                         # weighted VAD centroid
    language: str                    # detected language code
    translated: bool                 # True if Hebrew→English translation applied


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    try:
        text = req.text
        lang = _detect_language(text)
        translated = False

        # Translate Hebrew → English before classifying
        if lang == "he":
            try:
                translator = _get_he_en_translator()
                result = translator(text, max_length=512)
                inner = result[0] if isinstance(result, list) else result
                translated_text = (
                    inner.get("translation_text", text)
                    if isinstance(inner, dict)
                    else text
                )
                logger.warning(
                    "HE→EN: %r → %r", req.text[:40], translated_text[:40]
                )
                text = translated_text
                translated = True
            except Exception as exc:
                logger.error("Translation failed, using original: %s", exc)
                # Fall through with original text (degraded but non-crashing)

        # Classify emotions
        raw = emotion_clf(text, truncation=True, max_length=128)
        # transformers ≥4.x with top_k=None returns [[{label,score}, ...]] for a single string
        all_scores: list[dict] = raw[0] if isinstance(raw[0], list) else raw

        score_val, dominant, probs, V, A, D = _vad_and_score(all_scores)

        return ScoreResponse(
            score=score_val,
            dominant_emotion=dominant,
            emotion_probs={k: round(v, 4) for k, v in probs.items()},
            vad=VAD(V=V, A=A, D=D),
            language=lang,
            translated=translated,
        )
    except Exception as exc:
        logger.error("Scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail="Scoring failed") from exc

# build trigger v3
