"""Centralized raw-artifact caching (spec §1).

Every fetched HTML/PDF binary is stored ONCE, content-addressed by its
SHA-256. Priority: Cloudflare R2 (when configured) → local content-
addressed directory. Parser upgrades re-run extraction from this cache
(`reparse`) instead of re-fetching from public servers.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .config import Config

R2_PREFIX = "legal-raw"


class ArtifactStore:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._local_root = Path(cfg.artifacts_dir).expanduser().resolve()
        self._s3 = None
        if cfg.r2_enabled:
            try:
                import boto3  # type: ignore

                self._s3 = boto3.client(
                    "s3",
                    endpoint_url=f"https://{cfg.r2_account_id}.r2.cloudflarestorage.com",
                    aws_access_key_id=cfg.r2_access_key_id,
                    aws_secret_access_key=cfg.r2_secret_access_key,
                )
            except ImportError as exc:  # pragma: no cover
                raise SystemExit(
                    "R2 credentials are configured but boto3 is not installed. "
                    "Run: pip install boto3   (or clear the R2_* env vars to use the local cache)"
                ) from exc

    @property
    def backend(self) -> str:
        return "r2" if self._s3 else "local"

    def put(self, sha256: str, data: bytes, content_type: str) -> dict[str, Any]:
        """Store the artifact once. Returns the descriptor recorded in
        Convex (backend + storageKey)."""
        if self._s3:
            key = f"{R2_PREFIX}/{sha256}"
            self._s3.put_object(
                Bucket=self.cfg.r2_bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return {"storageBackend": "r2", "storageKey": key}
        shard = self._local_root / sha256[:2]
        shard.mkdir(parents=True, exist_ok=True)
        path = shard / sha256
        if not path.exists():
            path.write_bytes(data)
        return {"storageBackend": "local", "storageKey": str(path.relative_to(self._local_root))}

    def get(self, storage_backend: str, storage_key: str) -> bytes:
        """Read an artifact back (reparse path)."""
        if storage_backend == "r2":
            if not self._s3:
                raise RuntimeError("Artifact is in R2 but R2 credentials are not configured.")
            obj = self._s3.get_object(Bucket=self.cfg.r2_bucket, Key=storage_key)
            return obj["Body"].read()
        path = (self._local_root / storage_key).resolve()
        if not str(path).startswith(str(self._local_root)):
            raise RuntimeError(f"Refusing to read outside the artifact cache: {storage_key}")
        return path.read_bytes()

    def verify_local(self) -> dict[str, int]:
        """Re-hash every local artifact to prove zero tampering
        (`verify` CLI command)."""
        from .hashing import sha256_bytes

        checked = 0
        corrupt: list[str] = []
        if not self._local_root.exists():
            return {"checked": 0, "corrupt": 0}
        for path in self._local_root.glob("*/*"):
            if not path.is_file() or len(path.name) != 64:
                continue
            checked += 1
            if sha256_bytes(path.read_bytes()) != path.name:
                corrupt.append(path.name)
        if corrupt:
            raise RuntimeError(f"Hash mismatch in local artifact cache: {corrupt[:5]}")
        return {"checked": checked, "corrupt": 0}
