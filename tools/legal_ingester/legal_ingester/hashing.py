"""SHA-256 provenance helpers (spec §2: zero tampering, historical
integrity)."""

from __future__ import annotations

import hashlib


def sha256_bytes(data: bytes) -> str:
    """Immediate SHA-256 of a fetched artifact."""
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def verify_sha256(data: bytes, expected: str) -> bool:
    """Re-verify a stored artifact against its recorded hash (the
    `verify` CLI command re-runs this across the local cache)."""
    return sha256_bytes(data) == expected.lower()
