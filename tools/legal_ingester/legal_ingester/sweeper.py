"""Freshness sweep (spec §5): the weekly Convex cron
(legalKbFreshnessSweep, Mondays 06:10 UTC) re-queues every enabled seed
at FRESHNESS_RECHECK priority. This module is the manual counterpart:

    python -m legal_ingester sweep

It (a) force-requeues the seed list (same effect as the cron, runnable
on demand) and (b) runs the worker over the recheck tasks — conditional
GETs make unchanged documents cost a single 304, and hash diffs on
index pages surface new rulings/amendments for ingestion.
"""

from __future__ import annotations

from .config import Config
from .convex_api import ConvexClient
from .seeds import SEED_SOURCES
from .worker import Worker


def sweep(cfg: Config, client: ConvexClient | None = None, tasks: int = 20) -> None:
    client = client or ConvexClient(cfg)
    print("freshness sweep: requeueing seed sources (priority 8 = recheck)…")
    urls = [
        {
            "sourceUrl": s["sourceUrl"],
            "domainCategory": s["domainCategory"],
            "priority": 8,
            "discoveredFrom": "sweep:manual",
            "forceRecheck": True,
        }
        for s in SEED_SOURCES
    ]
    result = client.enqueue(urls)
    requeued = sum(1 for r in result if r.get("status") in ("requeued", "queued"))
    print(f"  {requeued} seed task(s) queued for recheck")

    worker = Worker(cfg, client)
    worker.run(tasks=tasks)
    print(
        f"sweep done: completed={worker.stats.completed} "
        f"not_modified={worker.stats.not_modified} "
        f"dedup_skipped={worker.stats.dedup_skipped} failed={worker.stats.failed}"
    )


def verify_artifacts(cfg: Config) -> None:
    """Re-hash the local artifact cache against recorded SHA-256s and
    audit the result (spec §2 zero-tampering check)."""
    from .storage import ArtifactStore

    store = ArtifactStore(cfg)
    result = store.verify_local()
    print(f"artifact integrity: {result['checked']} checked, {result['corrupt']} corrupt")
    client = ConvexClient(cfg)
    client.audit(
        "scrape.verify",
        actor="ingester:verify",
        status="ok",
        payload=result,
    )
