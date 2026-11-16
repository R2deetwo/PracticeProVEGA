"""Optional embedding leg (768 dimensions, matching the platform's
Gemini text-embedding-004 pipeline used by statutes /
instrument_provisions / court_forms).

Two supported providers:
  - OpenAI-compatible REST (EMBEDDINGS_BASE_URL + EMBEDDINGS_API_KEY),
    including OpenAI itself: request 768 output dims.
  - Google Gemini REST (set EMBEDDINGS_BASE_URL to the Gemini
    embeddings endpoint) — same contract, 768 dims native.

Without a key, chunks ingest WITHOUT vectors — keyword search still
works (the Convex dense leg just doesn't run). Each skip is audited.
"""

from __future__ import annotations

import requests

from .config import Config

TARGET_DIMS = 768


class Embedder:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.enabled = cfg.embeddings_enabled
        self._tokens_spent = 0

    @property
    def tokens_spent(self) -> int:
        return self._tokens_spent

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch. Returns [] vectors if disabled; raises no
        fatal error on provider failure (caller falls back to
        keyword-only and audits)."""
        if not self.enabled:
            return []
        try:
            url = f"{self.cfg.embeddings_base_url.rstrip('/')}/embeddings"
            resp = requests.post(
                url,
                headers={"Authorization": f"Bearer {self.cfg.embeddings_api_key}"},
                json={
                    "model": self.cfg.embeddings_model,
                    "input": [t[:8000] for t in texts],
                    # text-embedding-3-* accepts dimensions; Gemini-style
                    # endpoints ignore the field safely.
                    "dimensions": TARGET_DIMS,
                },
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            vectors = [item["embedding"] for item in data]
            if any(len(v) != TARGET_DIMS for v in vectors):
                raise RuntimeError(
                    f"Provider returned {len(vectors[0])}-dim vectors; "
                    f"the legal_chunks vector index requires {TARGET_DIMS}. "
                    "Use a 768-dim model (e.g. Gemini text-embedding-004 "
                    "or text-embedding-3-small with dimensions=768)."
                )
            self._tokens_spent += sum(len(t.split()) for t in texts)
            return vectors
        except Exception:
            return []

    def embed_query(self, text: str) -> list[float] | None:
        vectors = self.embed_texts([text])
        return vectors[0] if vectors else None
