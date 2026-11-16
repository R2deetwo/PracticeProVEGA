"""Thin Convex HTTP API client.

The Convex deployment exposes plain-JSON HTTP endpoints:

    POST {CONVEX_URL}/api/query     {"path": "...", "args": {...}, "format": "json"}
    POST {CONVEX_URL}/api/mutation  {"path": "...", "args": {...}, "format": "json"}

Every call carries the LEGAL_INGEST_TOKEN inside args (the Convex
functions gate on it against their own environment variable). TLS is
enforced by the requests session; secrets never appear in URLs.
"""

from __future__ import annotations

from typing import Any

import requests

from .config import Config


class ConvexApiError(RuntimeError):
    def __init__(self, path: str, status: int, message: str):
        super().__init__(f"Convex {path} failed ({status}): {message}")
        self.path = path
        self.status = status
        self.message = message


class ConvexClient:
    def __init__(self, cfg: Config):
        if not cfg.convex_url:
            raise SystemExit("CONVEX_URL is not configured.")
        self.cfg = cfg
        self.base = cfg.convex_url.rstrip("/")
        if not (self.base.startswith("https://") or self.base.startswith("http://localhost")):
            # Spec §2: TLS 1.3 in production; localhost is the only
            # plaintext escape hatch (local `npx convex dev`).
            raise SystemExit(
                f"Refusing non-TLS CONVEX_URL: {self.base!r} (https required)"
            )
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def _call(self, kind: str, path: str, args: dict[str, Any]) -> Any:
        url = f"{self.base}/api/{kind}"
        body = {"path": path, "args": args, "format": "json"}
        resp = self.session.post(url, json=body, timeout=60)
        if resp.status_code >= 400:
            raise ConvexApiError(path, resp.status_code, resp.text[:500])
        return resp.json()

    # ── Queue lifecycle ──────────────────────────────────────────────────
    def seed_sources(self, sources: list[dict[str, Any]]) -> dict[str, Any]:
        return self._call("mutation", "legal/queue/seedSources", {
            "ingestToken": self.cfg.ingest_token,
            "sources": sources,
        })

    def enqueue(self, urls: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return self._call("mutation", "legal/queue/enqueue", {
            "ingestToken": self.cfg.ingest_token,
            "urls": urls,
        })

    def claim(self, worker_id: str, limit: int = 5, domain_category: str | None = None) -> list[dict[str, Any]]:
        args: dict[str, Any] = {
            "ingestToken": self.cfg.ingest_token,
            "workerId": worker_id,
            "limit": limit,
        }
        if domain_category:
            args["domainCategory"] = domain_category
        return self._call("mutation", "legal/queue/claim", args)

    def complete(self, task_id: str, outcome: str, **kwargs: Any) -> dict[str, Any]:
        args = {"ingestToken": self.cfg.ingest_token, "taskId": task_id, "outcome": outcome}
        args.update(kwargs)
        return self._call("mutation", "legal/queue/complete", args)

    def fail(self, task_id: str, error: str, retryable: bool = True) -> dict[str, Any]:
        return self._call("mutation", "legal/queue/fail", {
            "ingestToken": self.cfg.ingest_token,
            "taskId": task_id,
            "error": error,
            "retryable": retryable,
        })

    def stats(self) -> dict[str, Any]:
        return self._call("query", "legal/queue/stats", {
            "ingestToken": self.cfg.ingest_token,
        })

    # ── Ingestion ────────────────────────────────────────────────────────
    def ingest_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        payload = {"ingestToken": self.cfg.ingest_token, **payload}
        return self._call("mutation", "legal/ingest/ingestDocument", payload)

    def dedup_probe(self, source_url: str, expected_sha256: str | None = None) -> dict[str, Any]:
        args: dict[str, Any] = {
            "ingestToken": self.cfg.ingest_token,
            "sourceUrl": source_url,
        }
        if expected_sha256:
            args["expectedSha256"] = expected_sha256
        return self._call("query", "legal/ingest/dedupProbe", args)

    # ── Search / audit (operator tooling) ────────────────────────────────
    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        return self._call("query", "legal/search/searchAsOperator", {
            "ingestToken": self.cfg.ingest_token,
            "query": query,
            "limit": limit,
        })

    def audit(self, event_type: str, actor: str, status: str = "ok", payload: Any = None) -> dict[str, Any]:
        return self._call("mutation", "legal/audit/log", {
            "ingestToken": self.cfg.ingest_token,
            "eventType": event_type,
            "actor": actor,
            "status": status,
            "payload": payload or {},
        })
