# Build from the repo root:  docker build -f scoring/deploy/Dockerfile -t ec-scoring .
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends espeak-ng libespeak-ng1 \
 && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1

WORKDIR /app
COPY scoring/pyproject.toml scoring/uv.lock scoring/README.md ./
RUN uv sync --frozen --no-dev --no-install-project
COPY scoring/src ./src
# Curated IPA hint table shared with the web app (single source of truth).
COPY web/src/content/sound-hints.json /app/web/src/content/sound-hints.json
RUN uv sync --frozen --no-dev

# Models are mounted at runtime (MODELS_DIR=/models) — not baked into the image.
ENV MODELS_DIR=/models \
    SOUND_HINTS_PATH=/app/web/src/content/sound-hints.json
RUN useradd --system --uid 10001 scoring
USER scoring
EXPOSE 8001
# Call the venv binary directly: works under a read-only root filesystem (no uv cache writes).
CMD ["/app/.venv/bin/uvicorn", "scoring.app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1", "--no-access-log"]
