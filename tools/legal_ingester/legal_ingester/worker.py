"""The queue worker: claim → dedup-probe → polite fetch → SHA-256 →
artifact cache → extract → classify → chunk → embed → ingestDocument.

One run processes up to `--tasks` queue rows. Politeness: per-domain
jittered delays (3.0-6.0s) inside PoliteFetcher, and the worker itself
runs single-threaded by default (MAX_WORKERS applies to the optional
multi-process mode; the spec's 2-3 worker ceiling is enforced there).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from .chunker import chunk_document
from .classifier import classify_category, classify_document_type
from .config import Config
from .convex_api import ConvexClient
from .embedder import Embedder
from .extract import extract
from .hashing import sha256_bytes
from .metadata import build_instrument_meta, extract_judgment
from .polite_fetcher import FetchResult, PoliteFetcher
from .storage import ArtifactStore

# Only same-domain links under these paths are followed from index
# pages (link harvesting is deliberately conservative).
_MAX_LINKS_PER_INDEX = 25


@dataclass
class WorkerStats:
    claimed = 0
    completed = 0
    dedup_skipped = 0
    not_modified = 0
    failed = 0
    robots_skipped = 0
    chunks_ingested = 0


class Worker:
    def __init__(self, cfg: Config, client: ConvexClient | None = None):
        self.cfg = cfg
        self.client = client or ConvexClient(cfg)
        self.fetcher = PoliteFetcher(cfg)
        self.store = ArtifactStore(cfg)
        self.embedder = Embedder(cfg)
        self.stats = WorkerStats()
        self.worker_id = f"py-{int(time.time())}"

    # ── One queue task ───────────────────────────────────────────────────
    def process_task(self, task: dict[str, Any]) -> None:
        task_id = task["id"]
        url: str = task["sourceUrl"]
        print(f"→ [{task.get('priority', 5)}] {url}")

        result = self.fetcher.fetch(
            url,
            etag=task.get("etag") or None,
            last_modified=task.get("lastModified") or None,
        )

        if result.skipped:
            self.stats.robots_skipped += 1
            self.client.complete(task_id, "skipped_dedup", error=result.skip_reason)
            print(f"   ↷ skipped: {result.skip_reason}")
            return

        if result.not_modified:
            # Bandwidth saver: 304 Not Modified — nothing changed since
            # the last check. No parse, no storage, no tokens.
            self.stats.not_modified += 1
            self.client.complete(task_id, "not_modified", etag=result.etag, last_modified=result.last_modified)
            print("   ✓ 304 not modified (free)")
            return

        if result.status >= 400 or result.error:
            self.stats.failed += 1
            self.client.fail(task_id, result.error or f"HTTP {result.status}")
            print(f"   ✗ {result.error or result.status}")
            return

        body = result.body
        if not body:
            self.stats.failed += 1
            self.client.fail(task_id, "empty body")
            print("   ✗ empty body")
            return

        sha = sha256_bytes(body)

        # Pre-ingest dedup (spec §1): if this exact document already
        # parsed successfully, skip parse + storage entirely.
        probe = self.client.dedup_probe(url, expected_sha256=sha)
        if probe.get("artifactCompleted"):
            self.stats.dedup_skipped += 1
            self.client.complete(task_id, "skipped_dedup", rawDocumentHash=sha,
                                 etag=result.etag, last_modified=result.last_modified)
            print("   ⇄ dedup: identical artifact already ingested")
            return

        # Artifact cache (store once, content-addressed).
        descriptor = self.store.put(sha, body, result.content_type or "text/html")

        # Extract + classify.
        document = extract(body, result.content_type or "text/html", base_url=url)
        if not document.text.strip():
            self.stats.failed += 1
            self.client.fail(task_id, "no extractable text")
            print("   ✗ no extractable text")
            return

        category = classify_category(url, document.text, document.title)
        doc_type = classify_document_type(category, url, document.text)

        if doc_type == "index":
            # Index page: harvest child links into the queue.
            self._harvest_links(url, document.links, category)
            self.stats.completed += 1
            self.client.complete(task_id, "completed", rawDocumentHash=sha,
                                 documentType="index",
                                 etag=result.etag, last_modified=result.last_modified)
            print(f"   ✓ index harvested ({category})")
            return

        # Chunk along legal boundaries.
        chunks = chunk_document(doc_type, document.text)
        if not chunks:
            self.stats.failed += 1
            self.client.fail(task_id, "chunking produced no chunks")
            return

        # Optional embeddings (keyword-only when unconfigured).
        vectors: list[list[float]] = []
        if self.embedder.enabled:
            vectors = self.embedder.embed_texts([c.text for c in chunks])

        payload: dict[str, Any] = {
            "artifact": {
                "sha256": sha,
                "storageBackend": descriptor["storageBackend"],
                "storageKey": descriptor["storageKey"],
                "contentType": result.content_type or "text/html",
                "byteSize": len(body),
                "sourceUrl": url,
                "fetchedAt": int(time.time() * 1000),
                "parserVersion": "1.0.0",
            },
            "chunks": [],
        }
        for i, chunk in enumerate(chunks):
            item = chunk.to_payload()
            if i < len(vectors):
                item["embedding"] = vectors[i]
            payload["chunks"].append(item)

        if doc_type == "judgment":
            meta = extract_judgment(document.text, document.title, url)
            payload["judgment"] = {
                "citation": meta.citation,
                "suitNumber": meta.suit_number or "UNKNOWN",
                "court": meta.court or "Unknown court",
                "courtLevel": meta.court_level or None,
                "dateDelivered": meta.date_delivered or "1970-01-01",
                "parties": meta.parties,
                "judges": meta.judges,
                "counsel": meta.counsel,
                "ratioDecidendi": meta.ratio_decidendi or "See judgment text (ratio section not machine-detectable).",
                "obiterDicta": meta.obiter_dicta or None,
                "summary": " ".join(document.text[:400].split())[:400] or None,
                "statutesConsidered": meta.statutes_considered,
                "casesCited": meta.cases_cited,
            }
            doc_key = meta.citation
        else:
            instrument = build_instrument_meta(document.title or url, document.text, url, category)
            payload["instrument"] = instrument
            doc_key = instrument["key"]

        response = self.client.ingest_document(payload)
        self.stats.completed += 1
        self.stats.chunks_ingested += response.get("chunksIngested", 0)
        self.client.complete(
            task_id, "completed",
            rawDocumentHash=sha,
            documentType=doc_type,
            documentKey=doc_key,
            etag=result.etag,
            last_modified=result.last_modified,
        )
        embedded = response.get("chunksEmbedded", 0)
        print(f"   ✓ {doc_type} '{doc_key[:60]}' — {response.get('chunksIngested', 0)} chunks"
              + (f" ({embedded} embedded)" if embedded else " (keyword-only)"))

    def _harvest_links(self, parent_url: str, links: list[str], parent_category: str) -> None:
        """Conservatively enqueue child links from an index page."""
        from urllib.parse import urlparse

        parent_host = urlparse(parent_url).netloc
        same_domain: list[str] = []
        for link in links:
            if urlparse(link).netloc == parent_host and link != parent_url:
                same_domain.append(link)
        if not same_domain:
            return
        batch = [
            {"sourceUrl": link, "domainCategory": parent_category, "discoveredFrom": parent_url}
            for link in same_domain[:_MAX_LINKS_PER_INDEX]
        ]
        try:
            self.client.enqueue(batch)
        except Exception as exc:  # queue full / transient — never fatal
            print(f"   ! link harvest enqueue failed: {exc}")

    # ── Run loop ─────────────────────────────────────────────────────────
    def run(self, tasks: int = 10, domain_category: str | None = None) -> WorkerStats:
        print(f"worker {self.worker_id}: politeness "
              f"{self.cfg.politeness_min_s}-{self.cfg.politeness_max_s}s jitter, "
              f"storage={self.store.backend}, embeddings={'on' if self.embedder.enabled else 'off (keyword-only)'}")
        remaining = tasks
        while remaining > 0:
            batch_limit = min(5, remaining)
            batch = self.client.claim(self.worker_id, limit=batch_limit, domain_category=domain_category)
            if not batch:
                print("queue empty — worker exiting")
                break
            for task in batch:
                self.stats.claimed += 1
                try:
                    self.process_task(task)
                except Exception as exc:
                    self.stats.failed += 1
                    try:
                        self.client.fail(task["id"], str(exc)[:400])
                    except Exception:
                        pass
                    print(f"   ✗ task error: {exc}")
                remaining -= 1
        return self.stats
