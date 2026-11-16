"""Domain-category + document-type classification (spec §3 taxonomy)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

CATEGORIES = (
    "judgments",
    "statutes",
    "subsidiary",
    "rules_of_court",
    "sec_regulations",
    "electoral",
    "index",
)

_JUDGMENT_DOMAINS = (
    "supremecourt.gov.ng",
    "courtofappeal.gov.ng",
    "nigerialii.org",
    "liiofindia.org",
    "lawpivot",
    "lawnigeria.com",
)
_JUDGMENT_URL_WORDS = ("judgment", "judgement", "decision", "lpelr", "suit-no", "suit_no")
_JUDGMENT_TEXT_WORDS = ("ratio decidendi", "obiter", "suit no", "before the supreme court", "court of appeal")

_STATUTE_URL_WORDS = ("constitution", "act", "law", "statute", "laws-of-the-federation")
_REGULATION_URL_WORDS = ("sec.gov.ng", "regulation", "rules", "guideline", "guidelines", "code")
_ELECTORAL_URL_WORDS = ("inecnigeria.org", "inec", "electoral", "election")


def classify_category(url: str, text: str, title: str = "") -> str:
    host = urlparse(url).netloc.lower()
    path = urlparse(url).path.lower()
    hay = f"{path} {title.lower()} {text[:2000].lower()}"

    if any(d in host for d in ("sec.gov.ng",)):
        return "sec_regulations"
    if any(w in host for w in ("inec",)) or any(w in path for w in _ELECTORAL_URL_WORDS):
        return "electoral"
    if any(d in host for d in _JUDGMENT_DOMAINS) and any(w in path for w in _JUDGMENT_URL_WORDS):
        return "judgments"
    if any(w in hay for w in _JUDGMENT_TEXT_WORDS) and re.search(r"\b(suit no|sc/|ca/|fhc/|nicn/|llr)\b", hay):
        return "judgments"
    if "rules of court" in hay or "high court rules" in hay or "civil procedure rules" in hay:
        return "rules_of_court"
    if any(w in path for w in _REGULATION_URL_WORDS) and not any(w in path for w in _JUDGMENT_URL_WORDS):
        return "subsidiary"
    if any(w in path for w in _STATUTE_URL_WORDS):
        return "statutes"
    return "judgments" if any(w in hay for w in _JUDGMENT_TEXT_WORDS[:2]) else "statutes"


def classify_document_type(category: str, url: str, text: str) -> str:
    """judgment | instrument | index — decides which Convex document
    table the parsed payload targets (or whether we only harvest links)."""
    path = urlparse(url).path.lower()
    if category == "judgments" and re.search(r"(judgment|decision|lpelr)", path):
        return "judgment"
    if re.search(r"(judgment|decision|lpelr)", path) and re.search(r"\bsuit no\b", text[:4000].lower()):
        return "judgment"
    if category in ("judgments", "statutes", "subsidiary", "rules_of_court", "sec_regulations", "electoral"):
        head = text[:4000].lower()
        if re.search(r"\b(part|section)\s+[0-9ivx]+\b", head):
            return "instrument"
    return "index"
