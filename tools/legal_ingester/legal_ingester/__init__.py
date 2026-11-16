"""legal_ingester — the polite acquisition layer of the Legal KB.

Owner spec (2026-11-16): continuously crawl, parse, structure, chunk,
embed, cache and audit Nigerian court judgments, statutes, subsidiary
legislation, rules of court, SEC regulations and INEC electoral
guidelines into the Convex backend — powering ALOA and ARIA with
strictly-cited legal intelligence while minimising network overhead.

Module map:
    config         env + secrets (never hardcoded; .env only)
    convex_api     thin Convex HTTP API client (query/mutation)
    hashing        SHA-256 provenance helpers
    storage        raw-artifact cache: Cloudflare R2 with local fallback
    polite_fetcher robots.txt + jittered delays (3.0-6.0s) + conditional
                   GET + retry/backoff, max 2-3 concurrent workers
    extract        HTML -> text (BeautifulSoup), PDF -> text (pypdf)
    classifier     domain category + document type detection
    metadata       judgment/instrument field extraction (heuristic)
    chunker        legal-boundary hierarchical chunking
    embedder       optional embeddings (OpenAI-compatible / Gemini REST)
    seeds          authoritative Nigerian legal source list
    worker         the queue worker: claim -> fetch -> hash -> cache ->
                   parse -> chunk -> embed -> ingestDocument
    sweeper        manual freshness sweep (the weekly cron re-queues;
                   this command processes what it queued)
    cli            `python -m legal_ingester <command>` entry point
"""

__version__ = "1.0.0"
