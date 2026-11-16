"""Judgment / instrument metadata extraction (spec §3).

Heuristic field extraction tuned for Nigerian judgment formats
(LII-style headers, LPELR citations, "SUIT NO: SC/123/2021", counsel
blocks). Everything is best-effort: missing fields come back as
empty/unknown and the document still ingests with a "unverified"
warning — honesty over invented data (the corpus philosophy).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .chunker import extract_citations

_SUIT_NO = re.compile(r"(?:SUIT\s*NO\.?|CASE\s*NO\.?|APPEAL\s*NO\.?)\s*[:\-]?\s*([A-Z]{1,6}(?:/[A-Z0-9]{1,6}){1,4}/\d{4})", re.IGNORECASE)
_BEFORE = re.compile(r"BEFORE\s*:\s*\n?((?:\s*[A-Z][A-Za-z.\s,]+J\.?SC\.?|\s*[A-Z][A-Za-z.\s,]+J\.?C\.?A\.?|\s*[A-Z][A-Za-z.\s,]+J\.?)\s*)+", re.IGNORECASE)
_JUDGE_LINE = re.compile(r"^\s*(HON\.?\s+)?JUSTICE\s+([A-Z][A-Z\s.,'-]+?),?\s*(JSC|J\.?SC|JCA|J\.?CA|J\.?|CJN|JUDGE)?\s*$", re.IGNORECASE)
_COURT_LINE = re.compile(r"(SUPREME\s+COURT\s+OF\s+NIGERIA|COURT\s+OF\s+APPEAL|FEDERAL\s+HIGH\s+COURT|HIGH\s+COURT\s+OF\s+[A-Z\s]+STATE|NATIONAL\s+INDUSTRIAL\s+COURT|SHARIA\s+COURT\s+OF\s+APPEAL|CUSTOMARY\s+COURT\s+OF\s+APPEAL)", re.IGNORECASE)
_DATE = re.compile(r"\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{4})\b", re.IGNORECASE)
_LPELR = re.compile(r"\[?(\d{4})\]?\s*LPELR-(\d+)\s*\(([A-Z]{2,5})\)", re.IGNORECASE)
_VS = re.compile(r"^(.+?)\s+(?:v\.?|vs\.?)\s+(.+)$", re.IGNORECASE)
_TREATMENT = re.compile(r"\b(applied|distinguished|overruled|affirmed|followed|considered)\b", re.IGNORECASE)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


@dataclass
class JudgmentMeta:
    citation: str = ""
    suit_number: str = ""
    court: str = ""
    court_level: str = ""
    date_delivered: str = ""
    parties: list[dict[str, str]] = field(default_factory=list)
    judges: dict[str, list[str]] = field(default_factory=lambda: {"lead": [], "concurring": [], "dissenting": []})
    counsel: list[dict[str, str]] = field(default_factory=list)
    ratio_decidendi: str = ""
    obiter_dicta: str = ""
    statutes_considered: list[str] = field(default_factory=list)
    cases_cited: list[dict[str, str]] = field(default_factory=list)


def _iso_date(text: str) -> str:
    m = _DATE.search(text)
    if not m:
        return ""
    parts = m.group(1).lower().replace("st", "").replace("nd", "").replace("rd", "").replace("th", "").split()
    try:
        day, month, year = int(parts[0]), _MONTHS[parts[1]], int(parts[2])
        return f"{year:04d}-{month:02d}-{day:02d}"
    except (KeyError, ValueError, IndexError):
        return ""


def _court_level(court: str) -> str:
    c = court.lower()
    if "supreme" in c:
        return "supreme"
    if "appeal" in c:
        return "court_of_appeal"
    if "federal high" in c:
        return "federal_high_court"
    if "industrial" in c:
        return "national_industrial_court"
    if "high court" in c:
        return "state_high_court"
    return "other"


def extract_judgment(text: str, title: str, source_url: str, citation_fallback: str = "") -> JudgmentMeta:
    meta = JudgmentMeta()
    head = text[:6000]

    # Citation: prefer an LPELR citation found anywhere in the document.
    if m := _LPELR.search(text):
        meta.citation = f"[{m.group(1)}] LPELR-{m.group(2)} ({m.group(3).upper()})"
    elif citation_fallback:
        meta.citation = citation_fallback
    else:
        meta.citation = title.strip()[:160] or source_url

    if m := _SUIT_NO.search(head):
        meta.suit_number = m.group(1).upper()

    if m := _COURT_LINE.search(head):
        meta.court = " ".join(m.group(1).title().split())
        meta.court_level = _court_level(meta.court)

    meta.date_delivered = _iso_date(text[:12000])

    # Parties from the title ("A v. B") or the first "X VS Y" line.
    party_src = title if _VS.search(title or "") else ""
    if not party_src:
        for line in head.splitlines()[:40]:
            if _VS.search(line) and len(line) < 220:
                party_src = line.strip()
                break
    if party_src:
        pm = _VS.search(party_src)
        if pm:
            meta.parties = [
                {"role": "appellant/plaintiff", "name": pm.group(1).strip(" .")},
                {"role": "respondent/defendant", "name": pm.group(2).strip(" .")},
            ]

    # Judges: lines like "JUSTICE OLUKAYODE ARIWOOLA, JSC".
    for line in head.splitlines():
        jm = _JUDGE_LINE.match(line.strip())
        if jm and len(meta.judges["lead"]) < 9:
            name = " ".join(jm.group(2).title().split())
            suffix = (jm.group(3) or "").upper().replace(".", "")
            label = f"Justice {name}" + (f" ({suffix})" if suffix else "")
            if label not in meta.judges["lead"]:
                meta.judges["lead"].append(label)

    # Counsel: "FOR THE APPELLANT: ...", "FOR THE RESPONDENT: ..."
    counsel_block = re.search(
        r"(FOR THE (?:APPELLANT|PLAINTIFF|CLAIMANT)[:\s].{5,200}?)(?:\n\s*\n|FOR THE|$)",
        text[:10000], re.IGNORECASE | re.DOTALL,
    )
    if counsel_block:
        meta.counsel.append({"party": "appellant", "names": " ".join(counsel_block.group(1).split())[:200]})

    # Ratio: text following a RATIO/RESOLUTION/HELD heading.
    ratio_m = re.search(
        r"(?:RATIO\s+DECIDENDI|HELD\s*:|I\s+RESOLVE)\s*[:\-]?\s*(.{80,1200}?)(?:\n\s*\n|\n[A-Z]{4,})",
        text, re.IGNORECASE | re.DOTALL,
    )
    if ratio_m:
        meta.ratio_decidendi = " ".join(ratio_m.group(1).split())[:1000]

    # Statutes considered + cases cited with treatment tags.
    citations = extract_citations(text)
    for citation in citations:
        if citation.startswith("Section") or citation.startswith("S."):
            if citation not in meta.statutes_considered:
                meta.statutes_considered.append(citation)
        elif "LPELR" in citation or "LR" in citation:
            # Look ahead in a window for a treatment verb near the citation.
            idx = text.find(citation)
            window = text[idx : idx + 400].lower() if idx >= 0 else ""
            treatment = next((t for t in ("applied", "distinguished", "overruled", "affirmed", "followed") if t in window), "considered")
            meta.cases_cited.append({"case": citation, "treatment": treatment})

    return meta


def build_instrument_meta(title: str, text: str, source_url: str, category: str) -> dict[str, Any]:
    """Instrument payload for ingestDocument — the amendmentTracker
    starts clean (in_force, not amended) and the weekly sweep's hash
    diffs + instrument_changes rows track what changes later."""
    year_m = re.search(r"\b(19|20)\d{2}\b", f"{title} {text[:2000]}")
    key = re.sub(r"[^a-z0-9]+", "_", title.lower()).strip("_")[:80] or source_url.split("/")[-1][:60]
    return {
        "title": title.strip()[:200] or key,
        "key": key,
        "issuingBody": _issuing_body(source_url, title, text),
        "instrumentType": _instrument_type(category, title, text),
        "commencementDate": _iso_date(text[:3000]) or None,
        "year": int(year_m.group(0)) if year_m else None,
        "status": "in_force",
        "structure": _structure_summary(text),
        "amendmentTracker": {"amended": False, "amendmentRefs": [], "repealed": False, "repealRef": None},
        "summary": " ".join(text[:600].split())[:500],
    }


def _issuing_body(source_url: str, title: str, text: str) -> str:
    url = source_url.lower()
    if "sec.gov.ng" in url:
        return "Securities and Exchange Commission (SEC)"
    if "inec" in url:
        return "Independent National Electoral Commission (INEC)"
    if "nass.gov.ng" in url or "national assembly" in text[:3000].lower():
        return "National Assembly"
    if any(s in url for s in ("lagos", "state")):
        return "State House of Assembly"
    if "court" in url or "rules" in title.lower():
        return "Judiciary (Rules Committee)"
    return "Federal Government of Nigeria"


def _instrument_type(category: str, title: str, text: str) -> str:
    t = f"{title} {text[:1000]}".lower()
    if category == "rules_of_court" or "rules of court" in t or "civil procedure rules" in t:
        return "rules_of_court"
    if category == "sec_regulations":
        return "regulation"
    if category == "electoral":
        return "guideline"
    if "regulation" in t:
        return "regulation"
    return "act"


def _structure_summary(text: str) -> list[dict[str, str]]:
    """Flattened Part/Section skeleton for the instrument row."""
    out: list[dict[str, str]] = []
    for line in text.splitlines():
        s = line.strip()
        if len(out) >= 400:
            break
        if m := re.match(r"^PART\s+([A-Z0-9]+)\s*[—\-–:]?\s*(.*)$", s, re.IGNORECASE):
            out.append({"level": "part", "number": m.group(1), "heading": (m.group(2) or "").strip()[:120]})
        elif m := re.match(r"^(?:SECTION|Section)\s+(\d+[A-Za-z]?)\.?\s*[—\-–:]?\s*(.*)$", s):
            out.append({"level": "section", "number": m.group(1), "heading": (m.group(2) or "").strip()[:160]})
    return out
