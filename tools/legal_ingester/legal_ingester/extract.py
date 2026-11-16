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
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    text = "\n\n".join(pages)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    title = ""
    if reader.metadata is not None:
        title = str(reader.metadata.get("/Title", "") or "")
    return ExtractedDocument(text=text.strip(), title=title)


def extract(data: bytes, content_type: str, base_url: str = "") -> ExtractedDocument:
    if "pdf" in content_type or data[:5] == b"%PDF-":
        return extract_pdf(data)
    html = data.decode("utf-8", errors="replace")
    return extract_html(html, base_url=base_url)
