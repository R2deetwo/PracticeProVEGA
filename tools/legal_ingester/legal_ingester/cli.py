"""CLI entry point.

    python -m legal_ingester <command> [options]

Commands:
    selftest   offline sanity check (chunker, hashing, classifier — no
               network, no Convex). Run this first after installing.
    seed       register the authoritative seed sources in Convex and
               fill the scrape queue (idempotent).
    worker     claim + process queue tasks (the polite crawler).
    sweep      freshness recheck: requeue seeds + process (what the
               weekly cron queued gets processed by the next `worker`
               run; `sweep` does both immediately).
    status     queue + corpus stats from Convex.
    search     operator keyword search over ingested chunks.
    audit      recent system_audit_logs rows.
    verify     re-hash the local artifact cache (zero-tampering proof).
"""

from __future__ import annotations

import argparse
import sys


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="legal_ingester",
        description="Legal Knowledge Base ingester — the polite acquisition layer (see LEGAL_KB.md)",
    )
    parser.add_argument("--env", help="path to a .env file (default: auto-discovered)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("selftest", help="offline sanity check (no network, no Convex)")

    p_seed = sub.add_parser("seed", help="register seed sources + fill the queue")
    p_seed.add_argument("--dry-run", action="store_true", help="print seeds without writing")

    p_worker = sub.add_parser("worker", help="process scrape-queue tasks")
    p_worker.add_argument("--tasks", type=int, default=10, help="max tasks this run (default 10)")
    p_worker.add_argument("--category", help="only process this domain category")

    p_sweep = sub.add_parser("sweep", help="freshness recheck (seeds + worker)")
    p_sweep.add_argument("--tasks", type=int, default=20)

    sub.add_parser("status", help="queue + corpus stats")

    p_search = sub.add_parser("search", help="keyword search over ingested chunks")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)

    p_audit = sub.add_parser("audit", help="recent audit events")
    p_audit.add_argument("--event", help="filter by event type")
    p_audit.add_argument("--limit", type=int, default=30)

    sub.add_parser("verify", help="re-hash the local artifact cache")

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    if args.command == "selftest":
        from .selftest import run_selftest

        return run_selftest()

    from .config import load_config
    from .convex_api import ConvexApiError, ConvexClient

    cfg = load_config(env_file=args.env)

    if args.command == "seed":
        from .seeds import SEED_SOURCES

        if args.dry_run:
            for s in SEED_SOURCES:
                print(f"  [{s['domainCategory']:>15}] {s['sourceUrl']}  — {s['authority']}")
            return 0
        cfg.require()
        client = ConvexClient(cfg)
        result = client.seed_sources(SEED_SOURCES)
        print(f"seeds: {result.get('added', 0)} added, {result.get('updated', 0)} updated "
              "(index seeds are queued at priority 3)")
        return 0

    cfg.require()
    client = ConvexClient(cfg)

    try:
        if args.command == "worker":
            from .worker import Worker

            stats = Worker(cfg, client).run(tasks=args.tasks, domain_category=args.category)
            print(
                f"\nrun summary: claimed={stats.claimed} completed={stats.completed} "
                f"dedup_skipped={stats.dedup_skipped} not_modified={stats.not_modified} "
                f"failed={stats.failed} chunks_ingested={stats.chunks_ingested}"
            )
            return 0

        if args.command == "sweep":
            from .sweeper import sweep

            sweep(cfg, client, tasks=args.tasks)
            return 0

        if args.command == "status":
            stats = client.stats()
            print("queue:", stats.get("queue"))
            for key in ("chunks", "chunksEmbedded", "judgments", "instruments", "rawArtifacts"):
                print(f"{key}: {stats.get(key)}")
            return 0

        if args.command == "search":
            results = client.search(args.query, limit=args.limit)
            if not results:
                print("no ingested chunks matched — run `worker` first, or the corpus is still empty")
                return 0
            for r in results:
                print(f"\n{r.get('documentKey')}  {' / '.join(r.get('boundaryPath', []))}")
                print(f"  {r.get('heading', '')}")
                print(f"  {r.get('snippet', '')}")
                print(f"  warn={r.get('warnings')} src={r.get('sourceUrl')}")
            return 0

        if args.command == "audit":
            from .convex_api import ConvexClient as _C  # noqa: F401 (reuse client)

            rows = client._call("query", "legal/audit/recent", {
                "ingestToken": cfg.ingest_token,
                "eventType": args.event,
                "limit": args.limit,
            })
            for row in rows:
                print(f"{row.get('createdAt')} {row.get('eventType'):<18} {row.get('status'):<5} "
                      f"{row.get('actor')} {str(row.get('payload'))[:120]}")
            return 0

        if args.command == "verify":
            from .sweeper import verify_artifacts

            verify_artifacts(cfg)
            return 0

    except ConvexApiError as exc:
        print(f"Convex call failed: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
