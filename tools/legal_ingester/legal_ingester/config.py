"""Configuration — every secret comes from environment variables (spec §2:
strict secret isolation). A local `.env` next to this package is loaded
if present; committed code NEVER contains tokens.

Required:
    CONVEX_URL         e.g. https://gregarious-malamute-537.convex.cloud
                       (same deployment as the app's NEXT_PUBLIC/VITE
                       CONVEX URL — the non-public copy lives here)
    LEGAL_INGEST_TOKEN the shared secret ALSO set in the Convex
                       deployment's environment variables (Dashboard →
                       Settings → Environment Variables)

Optional:
    R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET
                       -> raw artifacts go to Cloudflare R2 (boto3)
                       (no R2 config -> local content-addressed cache)
    ARTIFACTS_DIR      local artifact cache dir (default ./artifacts)
    EMBEDDINGS_API_KEY / EMBEDDINGS_BASE_URL / EMBEDDINGS_MODEL
                       -> 768-dim vectors attached to chunks; without a
                       key, ingestion is keyword-only (still searchable)
    USER_AGENT         polite crawler identity (default identifies us)
    MAX_WORKERS        2-3 per spec; hard-capped at 3
    POLITENESS_MIN_S / POLITENESS_MAX_S   jitter window (default 3.0-6.0)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # python-dotenv is nice-to-have; a tiny loader is the fallback.
    from dotenv import load_dotenv  # type: ignore

    _HAS_DOTENV = True
except Exception:  # pragma: no cover
    _HAS_DOTENV = False


def _load_env_file(path: Path) -> None:
    """Minimal .env loader (KEY=VALUE lines, # comments) when
    python-dotenv isn't installed."""
    if _HAS_DOTENV:
        load_dotenv(dotenv_path=str(path), override=False)
        return
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _default_env_dir() -> Path:
    """.env lookup: package dir, then repo root (two parents up from
    tools/legal_ingester/legal_ingester)."""
    here = Path(__file__).resolve().parent
    return here


@dataclass
class Config:
    convex_url: str = ""
    ingest_token: str = ""

    # Cloudflare R2 (optional; local cache otherwise)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""

    artifacts_dir: str = "./artifacts"

    # Optional embeddings (768-dim to match the platform pipeline)
    embeddings_api_key: str = ""
    embeddings_base_url: str = "https://api.openai.com/v1"
    embeddings_model: str = "text-embedding-3-small"

    user_agent: str = (
        "PracticePro-LegalKB/1.0 (+polite crawler; contact: founders@practicepro.ng)"
    )
    max_workers: int = 2
    politeness_min_s: float = 3.0
    politeness_max_s: float = 6.0
    request_timeout_s: float = 45.0
    max_attempts: int = 3

    errors: list[str] = field(default_factory=list)

    @property
    def r2_enabled(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key and self.r2_bucket)

    @property
    def embeddings_enabled(self) -> bool:
        return bool(self.embeddings_api_key)

    @property
    def ok(self) -> bool:
        return bool(self.convex_url and self.ingest_token) and not self.errors

    def __post_init__(self) -> None:
        # Direct construction (tests) gets the same honest error report
        # as load_config().
        if not self.convex_url and "CONVEX_URL is not set" not in self.errors:
            self.errors.append("CONVEX_URL is not set")
        if not self.ingest_token and "LEGAL_INGEST_TOKEN is not set" not in self.errors:
            self.errors.append("LEGAL_INGEST_TOKEN is not set")

    def require(self) -> None:
        if not self.ok:
            raise SystemExit(
                "Missing configuration: "
                + (", ".join(self.errors) if self.errors else "CONVEX_URL and LEGAL_INGEST_TOKEN are required. ")
                + " Copy tools/legal_ingester/.env.example to .env and fill it in."
            )


def load_config(env_file: str | None = None) -> Config:
    """Load configuration from .env files + the process environment."""
    here = Path(__file__).resolve().parent
    repo_root = here.parent.parent.parent  # tools/legal_ingester -> tools -> repo
    for candidate in ([Path(env_file)] if env_file else []):
        if candidate.exists():
            _load_env_file(candidate)
    _load_env_file(here / ".env")
    _load_env_file(repo_root / ".env.local")
    _load_env_file(repo_root / ".env")

    cfg = Config(
        convex_url=os.environ.get("CONVEX_URL", "").rstrip("/"),
        ingest_token=os.environ.get("LEGAL_INGEST_TOKEN", ""),
        r2_account_id=os.environ.get("R2_ACCOUNT_ID", ""),
        r2_access_key_id=os.environ.get("R2_ACCESS_KEY_ID", ""),
        r2_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
        r2_bucket=os.environ.get("R2_BUCKET", ""),
        artifacts_dir=os.environ.get("ARTIFACTS_DIR", "./artifacts"),
        embeddings_api_key=os.environ.get("EMBEDDINGS_API_KEY", ""),
        embeddings_base_url=os.environ.get("EMBEDDINGS_BASE_URL", "https://api.openai.com/v1"),
        embeddings_model=os.environ.get("EMBEDDINGS_MODEL", "text-embedding-3-small"),
        user_agent=os.environ.get(
            "USER_AGENT",
            "PracticePro-LegalKB/1.0 (+polite crawler; contact: founders@practicepro.ng)",
        ),
    )
    try:
        cfg.max_workers = max(1, min(3, int(os.environ.get("MAX_WORKERS", "2"))))
    except ValueError:
        cfg.max_workers = 2
    try:
        cfg.politeness_min_s = float(os.environ.get("POLITENESS_MIN_S", "3.0"))
        cfg.politeness_max_s = float(os.environ.get("POLITENESS_MAX_S", "6.0"))
    except ValueError:
        pass
    try:
        cfg.request_timeout_s = float(os.environ.get("REQUEST_TIMEOUT_S", "45"))
    except ValueError:
        pass

    if not cfg.convex_url:
        cfg.errors.append("CONVEX_URL is not set")
    if not cfg.ingest_token:
        cfg.errors.append("LEGAL_INGEST_TOKEN is not set")
    if cfg.politeness_min_s < 1.0:
        # Hard floor: never let a config typo turn us into a hammer.
        cfg.politeness_min_s = 3.0
        cfg.politeness_max_s = max(cfg.politeness_max_s, 6.0)
    return cfg
