"""Polite worker execution (spec §1): robots.txt respect, randomized
jittered delays (3.0-6.0s), per-domain serialization, conditional GETs
and bounded retries. Max 2-3 concurrent workers is enforced by the
worker's semaphore; this module enforces per-domain politeness.
"""

from __future__ import annotations

import random
import threading
import time
import urllib.robotparser
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests

from .config import Config


@dataclass
class FetchResult:
    status: int                 # 200 | 304 | 4xx/5xx
    body: bytes = b""
    content_type: str = ""
    etag: str = ""
    last_modified: str = ""
    not_modified: bool = False
    skipped: bool = False       # robots.txt disallow or pre-fetch dedup skip
    skip_reason: str = ""
    error: str = ""


class PoliteFetcher:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": cfg.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8",
            "Accept-Language": "en-NG,en;q=0.9",
        })
        self._domain_locks: dict[str, threading.Lock] = {}
        self._domain_next_ok: dict[str, float] = {}
        self._domain_lock = threading.Lock()
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}

    # ── Domain pacing ────────────────────────────────────────────────────
    def _lock_for(self, domain: str) -> threading.Lock:
        with self._domain_lock:
            if domain not in self._domain_locks:
                self._domain_locks[domain] = threading.Lock()
            return self._domain_locks[domain]

    def _respect_domain_delay(self, domain: str) -> None:
        """Serialized per-domain access with a randomized jittered delay
        (3.0-6.0s). Two workers may fetch from DIFFERENT domains at
        once, never from the same one."""
        with self._lock_for(domain):
            with self._domain_lock:
                next_ok = self._domain_next_ok.get(domain, 0.0)
            wait = next_ok - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            delay = random.uniform(self.cfg.politeness_min_s, self.cfg.politeness_max_s)
            with self._domain_lock:
                self._domain_next_ok[domain] = time.monotonic() + delay

    # ── robots.txt ───────────────────────────────────────────────────────
    def _robots_allows(self, url: str) -> bool:
        parsed = urlparse(url)
        domain = parsed.netloc
        if domain not in self._robots:
            parser = urllib.robotparser.RobotFileParser()
            try:
                robots_url = f"{parsed.scheme}://{domain}/robots.txt"
                resp = self.session.get(robots_url, timeout=self.cfg.request_timeout_s)
                if resp.status_code == 200:
                    parser.parse(resp.text.splitlines())
                else:
                    parser = None  # no robots -> allowed
            except requests.RequestException:
                parser = None
            self._robots[domain] = parser
        parser = self._robots[domain]
        if parser is None:
            return True
        try:
            crawl_delay = parser.crawl_delay(self.cfg.user_agent)
            if crawl_delay:
                with self._domain_lock:
                    self._domain_next_ok[domain] = max(
                        self._domain_next_ok.get(domain, 0.0),
                        time.monotonic() + float(crawl_delay),
                    )
        except Exception:
            pass
        return parser.can_fetch(self.cfg.user_agent, url)

    # ── The fetch ────────────────────────────────────────────────────────
    def fetch(
        self,
        url: str,
        etag: str | None = None,
        last_modified: str | None = None,
    ) -> FetchResult:
        domain = urlparse(url).netloc
        if not self._robots_allows(url):
            return FetchResult(
                status=0, skipped=True, skip_reason="robots.txt disallows this path"
            )

        self._respect_domain_delay(domain)

        headers: dict[str, str] = {}
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        last_error = ""
        for attempt in range(1, self.cfg.max_attempts + 1):
            try:
                resp = self.session.get(
                    url,
                    headers=headers,
                    timeout=self.cfg.request_timeout_s,
                    allow_redirects=True,
                )
                if resp.status_code == 304:
                    return FetchResult(
                        status=304,
                        not_modified=True,
                        etag=etag or "",
                        last_modified=last_modified or "",
                    )
                if resp.status_code in (429, 403) and attempt < self.cfg.max_attempts:
                    # Server asked us to slow down: double the window and retry.
                    time.sleep(self.cfg.politeness_max_s * (2 ** attempt))
                    last_error = f"HTTP {resp.status_code}"
                    continue
                if resp.status_code >= 500 and attempt < self.cfg.max_attempts:
                    time.sleep(self.cfg.politeness_max_s * attempt)
                    last_error = f"HTTP {resp.status_code}"
                    continue
                return FetchResult(
                    status=resp.status_code,
                    body=resp.content,
                    content_type=resp.headers.get("Content-Type", "").split(";")[0].strip(),
                    etag=resp.headers.get("ETag", ""),
                    last_modified=resp.headers.get("Last-Modified", ""),
                    error="" if resp.status_code < 400 else f"HTTP {resp.status_code}",
                )
            except requests.RequestException as exc:
                last_error = str(exc)
                if attempt < self.cfg.max_attempts:
                    time.sleep(self.cfg.politeness_max_s * attempt)
        return FetchResult(status=0, error=last_error)
