"""HTML / PDF text extraction. Pure stdlib-friendly: BeautifulSoup for
HTML (nav/script/style stripped), pypdf for PDFs."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class ExtractedDocument:
    text: str
    title: str = ""
    links: list[str] = field(default_factory=list)
    # ── Workstream B (2026-11-24): tiered text-vs-OCR triage ──────────
    # Zero-OCR policy: pages with embedded selectable text extract
    # directly; scanned/image-only pages are counted, not guessed at.
    #   textPages   — pages with real embedded text (extracted as-is)
    #   ocrPages    — pages with little/no embedded text (scanned) —
    #                  marked ocr_pending; OCR runs only when a local
    #                  engine is available (see extract_pdf), never
    #                  silently skipped.
    #   ocrApplied  — True when OCR actually ran on the scanned pages
    #                  and their text is included in `text`.
    textPages: int = 0
    ocrPages: int = 0
    ocrApplied: bool = False


_BLOCK_TAGS = {
    "p", "div", "section", "article", "li", "ul", "ol", "table", "tr",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "br", "hr",
}
_STRIP_TAGS = {"script", "style", "nav", "header", "footer", "noscript", "aside", "form"}


def extract_html(html: str, base_url: str = "") -> ExtractedDocument:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    title = ""
    if soup.title and soup.title.get_text(strip=True):
        title = soup.title.get_text(strip=True)
    og_title = soup.find("meta", attrs={"property": "og:title"})
    if not title and og_title and og_title.get("content"):
        title = og_title["content"].strip()

    links: list[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        if base_url:
            from urllib.parse import urljoin, urldefrag

            absolute, _ = urldefrag(urljoin(base_url, href))
            links.append(absolute)
        else:
            links.append(href)

    for tag in soup.find_all(list(_STRIP_TAGS)):
        tag.decompose()

    for tag in soup.find_all(list(_BLOCK_TAGS)):
        # Insert a newline sentinel so legal structure survives stripping.
        tag.append("\n")

    text = soup.get_text()
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return ExtractedDocument(text=text.strip(), title=title, links=links)


def extract_pdf(data: bytes) -> ExtractedDocument:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("pypdf is required for PDF sources: pip install pypdf") from exc

    import io

    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    text_pages = 0
    ocr_pages = 0
    # A page whose embedded extraction yields fewer characters than this
    # is treated as scanned (image-only): a text-selectable page of real
    # legal prose never comes out this thin.
    MIN_PAGE_CHARS = 24
    scanned: list[int] = []
    for i, page in enumerate(reader.pages):
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        if len(page_text.strip()) >= MIN_PAGE_CHARS:
            text_pages += 1
            pages.append(page_text)
        else:
            ocr_pages += 1
            scanned.append(i)
            pages.append("")

    ocr_applied = False
    if scanned:
        # LOCAL OCR FIRST (Workstream B: "run local OCR first on
        # scanned/image-only pages"). If a local engine is available we
        # fill the scanned pages; otherwise they stay ocr_pending — the
        # document still ingests with its text pages, and the triage
        # counts report exactly what is missing. Batch escalation for
        # tough scans is a manual follow-up (the selftest reports
        # ocrPages), never a silent drop.
        ocr_text = _local_ocr(reader, scanned)
        if ocr_text is not None:
            for idx, chunk in zip(scanned, ocr_text):
                pages[idx] = chunk
            ocr_applied = True

    text = "\n\n".join(pages)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    title = ""
    if reader.metadata is not None:
        title = str(reader.metadata.get("/Title", "") or "")
    return ExtractedDocument(
        text=text.strip(),
        title=title,
        textPages=text_pages,
        ocrPages=ocr_pages,
        ocrApplied=ocr_applied,
    )


def _local_ocr(reader, page_indices: list[int]) -> list[str] | None:
    """OCR the given pages with a LOCAL engine only. Returns None when no
    engine is installed (pages stay ocr_pending). Never raises, never
    downloads anything, never requires a new key."""
    try:
        import pytesseract  # noqa: PLC0415
        from pdf2image import convert_from_path  # noqa: PLC0415
    except Exception:
        return None
    try:
        import io, tempfile, os

        out: list[str] = []
        for idx in page_indices:
            images = convert_from_path(io.BytesIO(reader.stream), first_page=idx + 1, last_page=idx + 1)
            if not images:
                out.append("")
                continue
            out.append(pytesseract.image_to_string(images[0]) or "")
        return out
    except Exception:
        return None


def extract(data: bytes, content_type: str, base_url: str = "") -> ExtractedDocument:
    if "pdf" in content_type or data[:5] == b"%PDF-":
        return extract_pdf(data)
    html = data.decode("utf-8", errors="replace")
    return extract_html(html, base_url=base_url)
