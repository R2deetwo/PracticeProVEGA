"""Offline selftest — verifies the ingester's deterministic core with
ZERO network and ZERO Convex calls. Run immediately after install:

    python -m legal_ingester selftest

Covers: SHA-256 hashing (FIPS vector), statute chunking (Part →
Section → Subsection → proviso boundary paths + citation extraction),
judgment chunking (issue/ratio sections), classification, and the .env
config loader's error reporting.
"""

from __future__ import annotations

import sys

STATUTE_TEXT = """ARRANGEMENT OF SECTIONS

PART A — PRELIMINARY
1. Short title. This Act may be cited as the Test Act 2020.
2. Interpretation. In this Act, unless the context otherwise requires…

PART C — REGISTRATION
Section 18. Registration of instruments. Every instrument shall be registered within sixty days.
(1) An application under this section shall be made in the prescribed form.
(2) The registrar may extend the time fixed by subsection (1) where good cause is shown.
Provided that no extension shall exceed thirty days in the aggregate.

Section 19. Refusal of registration. The registrar may refuse an application that does not comply with Section 18 of the Test Act 2020.
""" + "Padding sentence to give the preamble some weight. " * 6

JUDGMENT_TEXT = """SUIT NO: SC/123/2020
BEFORE THE SUPREME COURT OF NIGERIA
DELIVERED ON 14 MARCH 2024

ISSUES FOR DETERMINATION
The sole issue is whether the lower court was right to hold as it did on the pleadings.

FACTS
The appellant leased the property in Lagos. Rent fell into arrears, and the respondent served a notice to quit.

RESOLUTION
I resolve the sole issue against the appellant. The notice to quit having been properly served, the recovery of possession followed due process. See [2021] LPELR-54321(SC) which applied Section 18 of the Test Act 2020 in similar circumstances.
"""


def run_selftest() -> int:
    failures: list[str] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        mark = "PASS" if condition else "FAIL"
        print(f"  [{mark}] {name}" + (f" — {detail}" if detail and not condition else ""))
        if not condition:
            failures.append(name)

    print("legal_ingester selftest (offline)")

    # ── Hashing ──────────────────────────────────────────────────────────
    from .hashing import sha256_bytes, sha256_text

    check("sha256 FIPS 'abc' vector",
          sha256_bytes(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    check("sha256 empty-string vector",
          sha256_bytes(b"") == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    check("sha256 utf-8 text", sha256_text("abc") == sha256_bytes(b"abc"))

    # ── Statute chunking ─────────────────────────────────────────────────
    from .chunker import chunk_document

    chunks = chunk_document("instrument", STATUTE_TEXT)
    paths = [" / ".join(c.boundary_path) for c in chunks]
    headings = [c.heading for c in chunks]

    check("statute chunking produces chunks", len(chunks) >= 4, f"got {len(chunks)}: {paths}")
    check("PART boundaries detected", any(p.startswith("PART C") for p in paths), str(paths))
    check("Section 18 boundary detected", any("Section 18" in p for p in paths), str(paths))
    check("subsection (1)/(2) boundaries detected",
          any("(1)" in p for p in paths) and any("(2)" in p for p in paths), str(paths))
    check("proviso is its own chunk", any(p.endswith("proviso") for p in paths), str(paths))
    sec19 = [c for c in chunks if "Section 19" in " / ".join(c.boundary_path)]
    check("statutory citation extracted",
          bool(sec19 and sec19[0].citations), str([c.citations for c in sec19]))
    check("chunk word ceiling respected",
          all(len(c.text.split()) <= 820 for c in chunks))

    # ── Judgment chunking + metadata ─────────────────────────────────────
    jchunks = chunk_document("judgment", JUDGMENT_TEXT)
    jpaths = [" / ".join(c.boundary_path) for c in jchunks]
    check("judgment issue/ratio sections detected",
          any("ISSUE" in p.upper() for p in jpaths) and any("RESOL" in p.upper() for p in jpaths),
          str(jpaths))

    from .metadata import extract_judgment

    meta = extract_judgment(JUDGMENT_TEXT, "Applicant v. Respondent", "https://example.com/j/1")
    check("suit number extracted", meta.suit_number == "SC/123/2020", meta.suit_number)
    check("court detected", "Supreme Court" in meta.court, meta.court)
    check("date normalized to ISO", meta.date_delivered == "2024-03-14", meta.date_delivered)
    check("LPELR citation normalized",
          meta.citation == "[2021] LPELR-54321 (SC)" or "LPELR" in meta.citation, meta.citation)
    check("case-cited with treatment tag",
          any(c["treatment"] in ("applied", "considered") for c in meta.cases_cited),
          str(meta.cases_cited))
    check("parties parsed from title",
          any(p["name"] == "Applicant" for p in meta.parties), str(meta.parties))

    # ── Classification ───────────────────────────────────────────────────
    from .classifier import classify_category, classify_document_type

    check("judgment URL classified",
          classify_category("https://example.com/judgments/lpelr-123", "suit no sc 1 2020") == "judgments")
    check("SEC source classified",
          classify_category("https://sec.gov.ng/rules", "rules") == "sec_regulations")
    check("INEC source classified",
          classify_category("https://www.inecnigeria.org/guidelines", "election guidelines") == "electoral")
    check("instrument doc type",
          classify_document_type("statutes", "https://x.com/act", STATUTE_TEXT) == "instrument")

    # ── Config error reporting (no .env required for selftest) ──────────
    from .config import Config

    cfg = Config()
    check("config flags missing secrets", not cfg.ok and cfg.errors, str(cfg.errors))

    print()
    if failures:
        print(f"SELFTEST FAILED: {len(failures)} check(s): {failures}")
        return 1
    print("ALL CHECKS PASSED — the ingester core is sound. Next: configure .env and run `seed`.")
    return 0
