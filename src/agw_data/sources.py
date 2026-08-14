from __future__ import annotations

import html
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit


@dataclass(frozen=True)
class UrlCheck:
    url: str
    checked_on: str
    http_status: int | None
    url_status: str
    final_url: str
    title: str
    error: str


def canonicalize_url(url: str) -> str:
    parsed = urlsplit(url.strip())
    scheme = parsed.scheme.casefold()
    host = parsed.netloc.casefold()
    if host == "pleiades.stoa.org":
        scheme = "https"
    path = parsed.path
    if path != "/":
        path = path.rstrip("/")
    return urlunsplit((scheme, host, path, parsed.query, ""))


def classify_http_status(status: int | None, redirected: bool) -> str:
    if status is None:
        return "unavailable"
    if 200 <= status < 400:
        return "redirected" if redirected else "ok"
    return "unavailable"


def _html_title(data: bytes, content_type: str) -> str:
    if "html" not in content_type.casefold():
        return ""
    text = data.decode("utf-8", errors="replace")
    match = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    value = re.sub(r"\s+", " ", html.unescape(match.group(1))).strip()
    return value[:500]


def check_url(url: str, *, checked_on: str, retries: int = 2) -> UrlCheck:
    canonical = canonicalize_url(url)
    request = urllib.request.Request(
        canonical,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; AncientGreekWorldAtlasData/1.0; scholarly source check)",
            "Accept": "text/html,application/json,application/pdf;q=0.8,*/*;q=0.5",
        },
    )
    last_error = ""
    for _ in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                data = response.read(512_000)
                final_url = response.geturl()
                status = response.status
                title = _html_title(data, response.headers.get("Content-Type", ""))
            return UrlCheck(
                url=canonical,
                checked_on=checked_on,
                http_status=status,
                url_status=classify_http_status(status, canonicalize_url(final_url) != canonical),
                final_url=final_url,
                title=title,
                error="",
            )
        except urllib.error.HTTPError as exc:
            return UrlCheck(
                url=canonical,
                checked_on=checked_on,
                http_status=exc.code,
                url_status=classify_http_status(exc.code, False),
                final_url=exc.geturl() or canonical,
                title="",
                error=f"HTTP {exc.code}",
            )
        except Exception as exc:
            last_error = f"{type(exc).__name__}: {exc}"
    return UrlCheck(canonical, checked_on, None, "unavailable", canonical, "", last_error)
