"""
TTLeave NLP sidecar
-------------------
Model: nlptown/bert-base-multilingual-uncased-sentiment
  Multilingual BERT fine-tuned on product reviews (EN, DE, FR, NL, ES, IT).
  Outputs 5 star-rating classes (1–5 stars).
  Uses standard BertTokenizerFast — no sentencepiece or protobuf required.
  Works on linux/amd64, linux/arm64, and macOS without extra native deps.

Negativity score formula:
  score = Σ P(k stars) * (5 - k) / 4   for k in {1,2,3,4,5}
  → 1 star (very negative) = 1.0
  → 3 stars (neutral)      = 0.5
  → 5 stars (very positive) = 0.0

Examples (approximate):
  "im mad as hell fuck my life"         → ~0.77
  "my boss yelled at me, i am stressed" → ~0.55
  "i am a bit annoyed"                  → ~0.60
  "everything is fine today"            → ~0.17
"""

from __future__ import annotations
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, field_validator
from transformers import pipeline
import logging

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

MODEL_NAME = "nlptown/bert-base-multilingual-uncased-sentiment"

# Loaded once at process startup; weights are pre-baked into the Docker layer
clf = pipeline(
    "text-classification",
    model=MODEL_NAME,
    top_k=None,   # return all 5 class probabilities
    device=-1,    # CPU
)

# Negativity weight per star label: 1-star = most negative (1.0), 5-stars = positive (0.0)
_NEG_WEIGHT: dict[str, float] = {
    "1 star":  1.00,
    "2 stars": 0.75,
    "3 stars": 0.50,
    "4 stars": 0.25,
    "5 stars": 0.00,
}

app = FastAPI(title="TTLeave NLP Service", version="2.0.0")


class ScoreRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v[:512]  # hard-cap; tokenizer also truncates


class ScoreResponse(BaseModel):
    score: float   # 0.0 (very positive / calm) → 1.0 (very negative / stressed)
    label: str     # dominant star label, e.g. "2 stars"


def _to_negativity(all_scores: list[dict]) -> tuple[float, str]:
    """
    Convert the 5-class probability distribution to a single negativity float.

    Uses a weighted average so that ambiguous mid-range inputs (e.g. "this is hard")
    get a smooth intermediate score rather than snapping to 0 or 1.
    """
    neg = sum(r["score"] * _NEG_WEIGHT[r["label"]] for r in all_scores)
    neg = max(0.0, min(1.0, neg))  # clamp for float precision safety

    # Dominant label = highest probability class
    dominant = max(all_scores, key=lambda r: r["score"])["label"]

    return round(neg, 4), dominant


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    try:
        # clf with top_k=None returns either:
        #   [[{label,score}, ...]]  (transformers >= 4.x, single string)
        #   [{label,score}, ...]    (some versions)
        raw = clf(req.text, truncation=True, max_length=128)
        all_scores: list[dict] = raw[0] if isinstance(raw[0], list) else raw
        neg_score, label = _to_negativity(all_scores)
        return ScoreResponse(score=neg_score, label=label)
    except Exception as exc:
        logger.error("Scoring failed: %s", exc)
        raise HTTPException(status_code=500, detail="Scoring failed") from exc
