"""Authoritative Nigerian legal seed sources (spec §1 discovery +
§5 weekly sweeps).

OPERATOR NOTE: these are well-known public entry points of the relevant
authorities. Review this list before large-scale crawling: confirm each
domain's robots.txt policy and adjust `authority` labels to your
curation standard. Every seed row lands in Convex `legal_seed_sources`
(where it can be disabled without touching code) and the queue at
CURATED priority.
"""

from __future__ import annotations

SEED_SOURCES: list[dict[str, str]] = [
    {
        "sourceUrl": "https://nigerialii.org",
        "domainCategory": "index",
        "kind": "index",
        "authority": "NigeriaLII (AfricanLII) — judgments index",
        "notes": "Legal Information Institute layer for Nigerian case law.",
    },
    {
        "sourceUrl": "https://supremecourt.gov.ng",
        "domainCategory": "judgments",
        "kind": "index",
        "authority": "Supreme Court of Nigeria — official site",
        "notes": "Judgments section; verify robots.txt before deep crawls.",
    },
    {
        "sourceUrl": "https://nass.gov.ng",
        "domainCategory": "statutes",
        "kind": "index",
        "authority": "National Assembly — bills and legislation",
        "notes": "Federal statutes and subsidiary legislation index.",
    },
    {
        "sourceUrl": "https://sec.gov.ng",
        "domainCategory": "sec_regulations",
        "kind": "index",
        "authority": "Securities and Exchange Commission, Nigeria",
        "notes": "SEC rules, regulations, codes and guidelines.",
    },
    {
        "sourceUrl": "https://www.inecnigeria.org",
        "domainCategory": "electoral",
        "kind": "index",
        "authority": "Independent National Electoral Commission (INEC)",
        "notes": "Electoral guidelines, regulations and manuals.",
    },
    {
        "sourceUrl": "https://www.cac.gov.ng",
        "domainCategory": "subsidiary",
        "kind": "index",
        "authority": "Corporate Affairs Commission (CAC)",
        "notes": "Company regulations, forms and practice directions.",
    },
    # Rules of court: institutional home pages (Lagos Judiciary etc.) are
    # best crawled once the founder confirms which courts to prioritise —
    # add them here or directly in Convex legal_seed_sources.
]
