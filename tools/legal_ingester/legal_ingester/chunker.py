"""Legal-boundary hierarchical chunking (spec §4).

STATUTES  : Part → Section → Subsection (+ Proviso). Each chunk carries
            its full boundary path so retrieval returns COMPLETE legal
            context ("Part C / Section 18 / (3) / proviso").
JUDGMENTS : Issue → Reasoning → Ratio heuristics (Nigerian judgments
            are commonly structured with ISSUES FOR DETERMINATION and
            resolution blocks; when headings are absent we fall back to
            paragraph windows that never split mid-sentence).

Chunks are bounded ~200-800 words: small enough for precise citation,
large enough to carry a whole provision.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

MAX_CHUNK_WORDS = 800
MIN_CHUNK_WORDS = 15

_PART = re.compile(r"^\s*PART\s+([A-Z0-9]+)\s*[—\-–:]?\s*(.*)$", re.IGNORECASE)
_SECTION = re.compile(r"^\s*(?:SECTION|Section|s\.|S\.)\s*(\d+[A-Za-z]?)\.?\s*[—\-–:]?\s*(.*)$")
_SUBSECTION = re.compile(r"^\s*\((\d+[a-z]?)\)\s+(.*)$")
_PROVISO = re.compile(r"^\s*Provided\s+that\b", re.IGNORECASE)
_SCHEDULE = re.compile(r"^\s*SCHEDULE\s+([0-9A-Z]*)", re.IGNORECASE)
_NUMBERED_PARA = re.compile(r"^\s*(\d+)\.\s+(.*)$")

_ISSUES = re.compile(r"^\s*(?:ISSUES?\s+FOR\s+DETERMINATION|ISSUES?\s+RAISED|THE\s+ISSUES?)\b", re.IGNORECASE)
_RATIO = re.compile(r"^\s*(?:RATIO\s+DECIDENDI|RESOLUTION|HOLD\s*:|I\s+RESOLVE|APPEAL\s+DISMISSED|APPEAL\s+ALLOWED)\b", re.IGNORECASE)
_HEADING = re.compile(r"^\s*(ISSUE\s+\w+|ARGUMENTS?|CONCLUSION|SUMMARY|BACKGROUND|FACTS|ANALYSIS)\b", re.IGNORECASE)


@dataclass
class Chunk:
    boundary_path: list[str] = field(default_factory=list)
    heading: str = ""
    text: str = ""
    citations: list[str] = field(default_factory=list)

    def to_payload(self) -> dict:
        return {
            "boundaryPath": self.boundary_path,
            "heading": self.heading,
            "text": self.text.strip(),
            "citations": self.citations,
        }


_CITATION_PATTERNS = (
    re.compile(r"\[\d{4}\]\s*LPELR-\d+\s*\([A-Z]{2,4}\)"),
    re.compile(r"\(\d{4}\)\s*\d+\s*N?W?L?R\s*\([^)]+\)\s*\d+", re.IGNORECASE),
    re.compile(r"\bSection\s+\d+[A-Za-z]?\s+of\s+the\s+[A-Z][\w\s Act(),]{3,80}"),
    re.compile(r"\bS\.\s*\d+\s+\([^)]{2,30}\)"),
)


def extract_citations(text: str) -> list[str]:
    found: list[str] = []
    for pattern in _CITATION_PATTERNS:
        found.extend(m.group(0).strip() for m in pattern.finditer(text))
    # de-dup, cap
    seen: list[str] = []
    for c in found:
        if c not in seen:
            seen.append(c)
    return seen[:10]


def _flush(chunks: list[Chunk], path: list[str], heading: str, buf: list[str]) -> None:
    text = "\n".join(buf).strip()
    words = len(text.split())
    if words >= MIN_CHUNK_WORDS:
        chunks.append(Chunk(boundary_path=list(path), heading=heading, text=text,
                            citations=extract_citations(text)))
    elif words > 0:
        # Short remainders merge upward ONLY within the same boundary —
        # never across a heading boundary (a short legal provision is
        # legitimately short, and merging it into its parent section
        # would destroy the citation boundary).
        same_boundary = bool(chunks) and chunks[-1].boundary_path == path
        if same_boundary:
            chunks[-1].text += "\n" + text
            chunks[-1].citations = extract_citations(chunks[-1].text)
        else:
            chunks.append(Chunk(boundary_path=list(path), heading=heading, text=text,
                                citations=extract_citations(text)))


def _split_long(text: str) -> list[str]:
    """Oversized blocks are split on sentence boundaries, never
    mid-sentence."""
    words = text.split()
    if len(words) <= MAX_CHUNK_WORDS:
        return [text]
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    cur: list[str] = []
    count = 0
    for sentence in sentences:
        sw = len(sentence.split())
        if count + sw > MAX_CHUNK_WORDS and cur:
            out.append(" ".join(cur))
            cur, count = [], 0
        cur.append(sentence)
        count += sw
    if cur:
        out.append(" ".join(cur))
    return out


def chunk_instrument(text: str) -> list[Chunk]:
    """Part → Section → Subsection (+ Proviso) chunking."""
    chunks: list[Chunk] = []
    path: list[str] = []
    heading = "Preamble"
    buf: list[str] = []

    for line in text.splitlines():
        line = line.rstrip()
        stripped = line.strip()
        if not stripped:
            buf.append("")
            continue

        if m := _PART.match(stripped):
            _flush(chunks, path, heading, buf)
            path = [f"PART {m.group(1)}"]
            heading = (m.group(2) or f"Part {m.group(1)}").strip()
            buf = [f"PART {m.group(1)} — {heading}"]
            continue
        if m := _SCHEDULE.match(stripped):
            _flush(chunks, path, heading, buf)
            path = [f"SCHEDULE {m.group(1)}".strip()]
            heading = stripped
            buf = [stripped]
            continue
        if m := _SECTION.match(stripped):
            _flush(chunks, path, heading, buf)
            path = [*(path[:1]), f"Section {m.group(1)}"]
            heading = (m.group(2) or f"Section {m.group(1)}").strip()
            buf = [f"Section {m.group(1)} — {heading}"]
            continue
        if (m := _SUBSECTION.match(stripped)) and len(path) >= 2:
            _flush(chunks, path, heading, buf)
            path = [*path[:2], f"({m.group(1)})"]
            heading = f"Section {path[1]} ({m.group(1)})" if len(path) > 1 else f"({m.group(1)})"
            buf = [stripped]
            continue
        if _PROVISO.match(stripped):
            # A proviso is its own chunk — it carves exceptions and is
            # exactly what practitioners cite.
            _flush(chunks, path, heading, buf)
            proviso_path = [*path, "proviso"]
            chunks.append(Chunk(boundary_path=proviso_path, heading="Proviso", text=stripped,
                                citations=extract_citations(stripped)))
            buf = []
            continue
        buf.append(stripped)

    _flush(chunks, path, heading, buf)

    # Split any oversized chunk on sentence boundaries.
    final: list[Chunk] = []
    for c in chunks:
        for i, part in enumerate(_split_long(c.text)):
            final.append(Chunk(
                boundary_path=c.boundary_path + ([f"cont.{i + 1}"] if i else []),
                heading=c.heading,
                text=part,
                citations=extract_citations(part),
            ))
    return final


def chunk_judgment(text: str) -> list[Chunk]:
    """Issue → Reasoning → Ratio chunking with paragraph fallback."""
    chunks: list[Chunk] = []
    section = "Introduction"
    buf: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            buf.append("")
            continue
        if _ISSUES.match(stripped) or _HEADING.match(stripped) or _RATIO.match(stripped):
            _flush(chunks, [section], section, buf)
            section = stripped.title()[:80]
            buf = [stripped]
            continue
        buf.append(stripped)
    _flush(chunks, [section], section, buf)

    final: list[Chunk] = []
    for c in chunks:
        for i, part in enumerate(_split_long(c.text)):
            final.append(Chunk(
                boundary_path=[c.heading] + ([f"¶{i + 1}"] if i else []),
                heading=c.heading,
                text=part,
                citations=extract_citations(part),
            ))
    return final


def chunk_document(document_type: str, text: str) -> list[Chunk]:
    if document_type == "judgment":
        return chunk_judgment(text)
    return chunk_instrument(text)
