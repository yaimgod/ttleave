FROM python:3.11-slim

WORKDIR /app

# ── System deps ────────────────────────────────────────────────────────────────
# build-essential is needed by some torch/tokenizer wheels at compile time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps ────────────────────────────────────────────────────────────────
COPY requirements.txt .

# Install torch first with the right variant for the target platform:
#   linux/amd64  → CPU-only wheel from pytorch.org (~250 MB vs ~800 MB CUDA wheel)
#   linux/arm64  → plain torch from PyPI (already CPU-only on ARM)
# Then install the rest of the requirements normally.
RUN arch="$(uname -m)" && \
    if [ "$arch" = "x86_64" ]; then \
      pip install --no-cache-dir \
        torch==2.3.0 \
        --index-url https://download.pytorch.org/whl/cpu; \
    else \
      pip install --no-cache-dir torch==2.3.0; \
    fi && \
    pip install --no-cache-dir -r requirements.txt

# ── Model cache ────────────────────────────────────────────────────────────────
# Bake the model weights into this layer so container startup is instant
# (no network download at runtime).  The named volume in docker-compose mounts
# over this path and will also be populated on first run, so subsequent
# image rebuilds that hit the layer cache skip the download entirely.
#
# Model: nlptown/bert-base-multilingual-uncased-sentiment
#   - 5-class star-rating (1-5) trained on multilingual product reviews
#   - Uses standard BertTokenizerFast — no sentencepiece or protobuf needed
#   - Works on ARM64 and x86_64 without extra deps
#   - ~680 MB model file
ENV HF_HOME=/app/.cache/huggingface
# Suppress FutureWarning from transformers calling hf_hub_download(resume_download=True)
# internally — deprecated in huggingface_hub but not yet fixed in transformers 4.40.x.
ENV PYTHONWARNINGS="ignore::FutureWarning"

RUN python - <<'PYEOF'
from transformers import pipeline
# Trigger full download: model weights + tokenizer vocab
p = pipeline(
    "text-classification",
    model="nlptown/bert-base-multilingual-uncased-sentiment",
    top_k=None,
    device=-1,
)
# Smoke-test: results is [[{label,score},...]] for a single string
results = p("test")
inner = results[0] if isinstance(results[0], list) else results
assert len(inner) == 5, f"Expected 5 class scores, got {len(inner)}"
print("Model loaded and smoke-tested OK:", [r["label"] for r in inner])
PYEOF

# ── App ────────────────────────────────────────────────────────────────────────
COPY main.py .

EXPOSE 8080

# Single worker: torch model is not fork-safe; inference load is light
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "1", \
     "--log-level", "warning"]
