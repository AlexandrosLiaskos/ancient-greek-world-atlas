from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Iterable

from .normalize import normalize_text


TRANSLATABLE_FIELDS = (
    "description_el",
    "date_note_el",
    "chronology_note_el",
    "spatial_note_el",
    "ancient_region",
    "metropolis_el",
    "associated_city_el",
    "representative_center_el",
    "deity_or_cult_el",
    "dynasty_el",
    "predecessor_el",
    "successor_el",
)


def text_key(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


class TranslationCache:
    def __init__(self, path: Path):
        self.path = Path(path)
        if self.path.exists():
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        else:
            payload = {
                "version": "1.0.0",
                "source_language": "el",
                "target_language": "en",
                "method": "machine-assisted Google translation; retained with review status",
                "entries": {},
            }
        self.payload = payload
        self.entries: dict[str, dict[str, str]] = payload.setdefault("entries", {})

    def get(self, text: str) -> str:
        normalized = normalize_text(text)
        if not normalized:
            return ""
        try:
            return normalize_text(self.entries[text_key(normalized)]["translated_text"])
        except KeyError as exc:
            raise KeyError(f"Missing English translation for: {normalized}") from exc

    def add(self, source_text: str, translated_text: str) -> None:
        source_text = normalize_text(source_text)
        translated_text = normalize_text(translated_text)
        if not source_text or not translated_text:
            raise ValueError("Translations require non-empty source and target text")
        self.entries[text_key(source_text)] = {
            "source_text": source_text,
            "translated_text": translated_text,
            "method": "machine_assisted_google_translate",
            "created_on": "2026-08-14",
            "review_status": "machine_assisted_unreviewed",
        }

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self.payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


def collect_texts(rows: Iterable[dict[str, str]]) -> list[str]:
    values = {
        normalize_text(row.get(field, ""))
        for row in rows
        for field in TRANSLATABLE_FIELDS
        if normalize_text(row.get(field, ""))
    }
    return sorted(values, key=lambda value: (len(value), value))


def fetch_translation(text: str, *, retries: int = 4) -> str:
    query = urllib.parse.urlencode(
        {
            "client": "gtx",
            "sl": "el",
            "tl": "en",
            "dt": "t",
            "q": text,
        }
    )
    request = urllib.request.Request(
        f"https://translate.googleapis.com/translate_a/single?{query}",
        headers={"User-Agent": "AncientGreekWorldAtlasData/1.0 (+scholarly-data-build)"},
    )
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            translated = "".join(part[0] for part in payload[0] if part and part[0])
            if not normalize_text(translated):
                raise ValueError("Translation service returned empty text")
            return normalize_text(translated)
        except Exception as exc:  # network errors are retried and surfaced after the bound
            last_error = exc
            time.sleep(0.5 * (2**attempt))
    raise RuntimeError(f"Translation failed after {retries} attempts") from last_error


def populate_cache(cache: TranslationCache, texts: Iterable[str], *, workers: int = 12) -> tuple[int, int]:
    missing = [text for text in texts if text_key(text) not in cache.entries]
    completed = 0
    failures: list[tuple[str, Exception]] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_translation, text): text for text in missing}
        for future in as_completed(futures):
            source = futures[future]
            try:
                cache.add(source, future.result())
                completed += 1
                if completed % 25 == 0:
                    cache.save()
            except Exception as exc:
                failures.append((source, exc))
    cache.save()
    if failures:
        examples = "; ".join(repr(text[:80]) for text, _ in failures[:3])
        raise RuntimeError(f"{len(failures)} translations failed: {examples}")
    return completed, len(cache.entries)
