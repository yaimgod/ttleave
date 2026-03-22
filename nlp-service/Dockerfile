FROM python:3.11-slim

WORKDIR /app

# ── System deps ─────────────────────────────────────────────────────────────
# build-essential needed by some tokenizer wheels at compile time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps ─────────────────────────────────────────────────────────────
COPY requirements.txt .

# Install torch first with the right variant for the target platform:
#   linux/amd64  → CPU-only wheel from pytorch.org (~250 MB vs ~800 MB CUDA)
#   linux/arm64  → plain torch from PyPI (already CPU-only on ARM)
# Then install the rest (includes sentencepiece for MarianMT tokeniser).
RUN arch="$(uname -m)" && \
    if [ "$arch" = "x86_64" ]; then \
      pip install --no-cache-dir \
        torch==2.3.0 \
        --index-url https://download.pytorch.org/whl/cpu; \
    else \
      pip install --no-cache-dir torch==2.3.0; \
    fi && \
    pip install --no-cache-dir -r requirements.txt

# ── Model cache ──────────────────────────────────────────────────────────────
# Bake both model weights into this image layer so container startup is instant.
# The named volume in docker-compose mounts over HF_HOME and is also populated
# on first run, so subsequent image rebuilds that hit the layer cache skip the
# download entirely.
#
# Models baked:
#   1. j-hartmann/emotion-english-distilroberta-base  (~330 MB)
#      7-class English emotion classifier (anger/disgust/fear/joy/neutral/sadness/surprise)
#   2. Helsinki-NLP/opus-mt-tc-big-he-en  (~300 MB)
#      MarianMT Hebrew→English translator (requires sentencepiece)
#
ENV HF_HOME=/app/.cache/huggingface
ENV PYTHONWARNINGS="ignore::FutureWarning"

RUN python - <<'PYEOF'
from transformers import pipeline

# ── 1. Emotion classifier ──────────────────────────────────────────────────
print("Downloading emotion classifier…")
clf = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
    device=-1,
)
results = clf("I am absolutely furious")
inner = results[0] if isinstance(results[0], list) else results
assert len(inner) == 7, f"Expected 7 emotion classes, got {len(inner)}"
labels = sorted(r["label"] for r in inner)
expected = sorted(["anger","disgust","fear","joy","neutral","sadness","surprise"])
assert labels == expected, f"Unexpected labels: {labels}"
print("Emotion classifier OK:", {r["label"]: round(r["score"],3) for r in inner})

# ── 2. Hebrew→English translation model ───────────────────────────────────
print("Downloading Hebrew→English translation model…")
translator = pipeline(
    "translation",
    model="Helsinki-NLP/opus-mt-tc-big-he-en",
    device=-1,
)
# Smoke-test with a simple Hebrew phrase ("I am angry")
result = translator("אני כועס", max_length=128)
inner_t = result[0] if isinstance(result, list) else result
translation = inner_t.get("translation_text", "") if isinstance(inner_t, dict) else str(inner_t)
assert translation.strip(), "Translation returned empty string"
print(f"Translation OK: 'אני כועס' → {translation!r}")
PYEOF

# ── App ──────────────────────────────────────────────────────────────────────
COPY main.py .

EXPOSE 8080

# Single worker: torch model is not fork-safe; inference load is light
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "1", \
     "--log-level", "warning"]
