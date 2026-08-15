from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import math
import re
import shutil
import sys
import tempfile
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = (
    "AncientGreekWorldAtlas/1.0 "
    "(https://github.com/AlexandrosLiaskos/ancient-greek-world-atlas; educational media curation)"
)
MEDIA_FIELDS = (
    "media_id",
    "entity_id",
    "position",
    "role",
    "file_path",
    "source_url",
    "original_url",
    "title",
    "creator",
    "license",
    "license_url",
    "attribution",
    "caption_el",
    "caption_en",
    "alt_el",
    "alt_en",
    "width",
    "height",
    "sha256",
    "retrieved_on",
    "review_state",
)
STOPWORDS = {
    "ancient",
    "city",
    "kingdom",
    "league",
    "of",
    "sanctuary",
    "the",
}
POSITIVE_WORDS = {
    "acropolis": 34,
    "agora": 30,
    "ancient": 34,
    "archaeological": 38,
    "archaeology": 38,
    "archaic": 30,
    "columns": 18,
    "classical": 22,
    "excavation": 24,
    "fortification": 22,
    "gate": 18,
    "hellenistic": 22,
    "monument": 18,
    "mosaic": 18,
    "mycenaean": 30,
    "odeon": 25,
    "ruin": 30,
    "ruins": 30,
    "site": 14,
    "stoa": 25,
    "temple": 32,
    "theatre": 26,
    "theater": 26,
    "tomb": 24,
}
NEGATIVE_WORDS = {
    "apartment": -48,
    "airport": -90,
    "beach": -42,
    "beetle": -180,
    "botanical": -180,
    "butterfly": -180,
    "church": -28,
    "coat of arms": -120,
    "collage": -95,
    "entrance": -18,
    "flag": -120,
    "flower": -180,
    "herbarium": -180,
    "house": -38,
    "hotel": -65,
    "insect": -180,
    "logo": -120,
    "modern": -68,
    "montage": -95,
    "moth": -180,
    "nightlife": -80,
    "plant": -180,
    "panorama": -28,
    "sign": -35,
    "skyline": -82,
    "specimen": -180,
    "traffic": -75,
    "town": -38,
    "waterfront": -52,
}
ENTITY_EXCLUSIONS = {
    "city-alexandria-egypt": ("alexandria troas",),
    "city-larissa-thessaly": ("castle larissa", "larissa of argos"),
    "city-rhodes-city": ("kameiros", "kamiros"),
    "colony-abydos": (" egypt", "osireion", "ramesses", "seti i"),
    "colony-barca-cyrenaica": (" iglesia", " municipio", " navarra", " spain", " spanien"),
    "colony-issa-vis": (" haiku", " hokkushyu", " japan", " kobayashi issa"),
    "colony-locri-epizephyrii": (" war memorial",),
    "colony-naucratis": ("naucratis painter",),
    "colony-neapolis-campania": ("neapolis macedonia", "neapolis (macedonia"),
    "colony-olbia-pontica": (" sardegna", " sardinia", " costa smeralda"),
    "colony-pharos-hvar": ("alexandria", "pharos lighthouse"),
    "colony-selinus": ("cilicia",),
    "colony-sinope": (" river sinope", " riviere sinope", " rivière sinope"),
    "colony-syracuse": ("baroque facade", "cathedral", "saint paul", "statue of saint"),
    "colony-taras": ("shevchenko",),
    "colony-theodosia-crimea": (" agia theodosia", " saint theodosia"),
    "kingdom-athens-mycenaean": ("tiryns",),
    "sanctuary-chersonesos-parthenos-sanctuary": ("first turkic", "khaganate"),
    "sanctuary-croton-hera-lacinia-sanctuary": ("agrigentum", "agrigento"),
    "sanctuary-naukratis-hellenion": ("naucratis painter",),
    "sanctuary-olbia-apollo-delphinios-sanctuary": (" sardegna", " sardinia", " costa smeralda"),
}


def clean_html(value: str | None) -> str:
    text = str(value or "")
    text = re.sub(r"<\s*br\s*/?\s*>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _https_url(value: str | None) -> str:
    url = clean_html(value)
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("http://"):
        return f"https://{url.removeprefix('http://')}"
    return url


def normalize_license(name: str | None, url: str | None) -> tuple[str, str]:
    raw_name = clean_html(name).replace("Creative Commons ", "CC ")
    compact = re.sub(r"[_-]+", " ", raw_name).upper()
    compact = re.sub(r"\s+", " ", compact).strip()
    normalized_url = _https_url(url)
    cc_match = re.search(r"CC\s*BY(?:\s*SA)?\s*(\d\.\d)", compact)
    if cc_match:
        share_alike = bool(re.search(r"BY\s*SA", compact))
        license_name = f"CC BY{'-SA' if share_alike else ''} {cc_match.group(1)}"
        slug = "by-sa" if share_alike else "by"
        return license_name, normalized_url or f"https://creativecommons.org/licenses/{slug}/{cc_match.group(1)}/"
    if "CC0" in compact or "CC ZERO" in compact:
        return "CC0 1.0", normalized_url or "https://creativecommons.org/publicdomain/zero/1.0/"
    if "PUBLIC DOMAIN" in compact or compact.startswith("PD"):
        return "Public domain", normalized_url or "https://creativecommons.org/publicdomain/mark/1.0/"
    raise ValueError(f"Unsupported or unclear media licence: {raw_name or '(blank)'}")


def _fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


def score_candidate(entity: dict, candidate: dict) -> float:
    title = _fold(str(candidate.get("title", "")))
    name = _fold(str(entity.get("preferred_name_en", "")))
    entity_class = str(entity.get("entity_class", ""))
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", name)
        if len(token) > 2 and token not in STOPWORDS
    }
    score = sum(18 for token in tokens if token in title)
    if name and name in title:
        score += 36
    for keyword, weight in POSITIVE_WORDS.items():
        if keyword in title:
            score += weight
    for keyword, weight in NEGATIVE_WORDS.items():
        if keyword in title:
            score += weight

    is_map = any(word in title for word in (" map", "map of", "plan", "atlas"))
    is_object = any(word in title for word in ("coin", "stater", "tetradrachm", "vase", "statue", "bust", "relief"))
    if entity_class == "polity":
        if is_map:
            score += 46
        if is_object:
            score += 42
    else:
        if is_map:
            score += 8
        if is_object:
            score += 18

    source = str(candidate.get("source", ""))
    if source == "override":
        score += 1000
    elif source == "search-override":
        score += 54
    elif source == "wikidata-ancient":
        score += 72
    elif source == "wikidata":
        score += 20

    width = int(candidate.get("width") or 0)
    height = int(candidate.get("height") or 0)
    pixels = width * height
    if pixels >= 8_000_000:
        score += 18
    elif pixels >= 2_000_000:
        score += 12
    elif pixels >= 700_000:
        score += 5
    if width and height:
        ratio = width / height
        if 1.15 <= ratio <= 2.15:
            score += 18
        elif ratio > 3.2:
            score -= 30
        elif ratio < 0.65 and entity_class != "polity":
            score -= 12
    return score


def candidate_is_relevant(entity: dict, candidate: dict) -> bool:
    raw_title = str(candidate.get("title", "")).removeprefix("File:")
    title = _fold(raw_title)
    if any(
        marker in title
        for marker in (
            " beetle",
            " butterfly",
            " flower",
            " herbarium",
            " insect",
            " moth",
            " species",
            " specimen",
            " sp.",
        )
    ):
        return False
    if re.match(r"^[A-Z][a-z]+\s+[a-z]{4,}(?:\s+\(|\s+[A-Z][a-z]+,?\s+\d{4})", raw_title):
        return False
    entity_id = str(entity.get("entity_id", ""))
    if any(marker in title for marker in ENTITY_EXCLUSIONS.get(entity_id, ())):
        return False
    source = str(candidate.get("source", ""))
    if source in {"override", "search-override", "wikidata-ancient"}:
        return True
    name = _fold(str(entity.get("preferred_name_en", "")))
    tokens = {
        token
        for token in re.findall(r"[a-z0-9]+", name)
        if len(token) > 2 and token not in STOPWORDS
    }
    title_tokens = set(re.findall(r"[a-z0-9]+", title))
    return bool(tokens & title_tokens)


def media_copy(entity: dict, commons_title: str) -> dict[str, str]:
    folded = _fold(commons_title)
    if any(word in folded for word in (" map", "map of", "plan", "atlas")):
        label_el, label_en = "Ιστορικός χάρτης", "Historical map"
    elif any(word in folded for word in ("coin", "stater", "tetradrachm", "vase", "statue", "bust", "relief", "mosaic")):
        label_el, label_en = "Αρχαίο έργο ή εύρημα", "Ancient artwork or object"
    else:
        label_el, label_en = "Αρχαιολογική άποψη", "Archaeological view"
    name_el = str(entity["preferred_name_el"]).strip()
    name_en = str(entity["preferred_name_en"]).strip()
    return {
        "caption_el": f"{name_el} · {label_el}",
        "caption_en": f"{name_en} · {label_en}",
        "alt_el": f"{name_el}: {label_el.casefold()}",
        "alt_en": f"{name_en}: {label_en.casefold()}",
    }


def optimize_image(source: Path, target: Path, *, max_dimension: int = 1600) -> dict[str, int | str]:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        image.seek(0)
        image.load()
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, "#f7f7f4")
            background.paste(image, mask=image.getchannel("A"))
            image = background
        image.save(target, "WEBP", quality=84, method=6, exif=b"")
        width, height = image.size
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    return {"width": width, "height": height, "sha256": digest}


def retry_delay(attempt: int, retry_after: str | None) -> float:
    try:
        server_delay = float(retry_after) if retry_after else 0.0
    except (TypeError, ValueError):
        server_delay = 0.0
    if server_delay > 0:
        return min(server_delay, 60.0)
    return min(30.0, 2.0 * (2**attempt))


def _request_json(url: str, params: dict[str, str], *, post: bool = False) -> dict:
    encoded = urlencode(params).encode("utf-8")
    request = Request(
        url if post else f"{url}?{encoded.decode('utf-8')}",
        data=encoded if post else None,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": USER_AGENT,
        },
    )
    error: Exception | None = None
    for attempt in range(6):
        try:
            with urlopen(request, timeout=45) as response:
                return json.load(response)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as caught:
            error = caught
            if attempt == 5:
                break
            retry_after = caught.headers.get("Retry-After") if isinstance(caught, HTTPError) else None
            time.sleep(retry_delay(attempt, retry_after))
    status = f" (HTTP {error.code})" if isinstance(error, HTTPError) else ""
    raise RuntimeError(f"Media API request failed{status}: {url}") from error


def _metadata_value(metadata: dict, key: str) -> str:
    value = metadata.get(key, {})
    return clean_html(value.get("value", "") if isinstance(value, dict) else value)


def _candidate_from_page(page: dict, source: str) -> dict | None:
    imageinfo = (page.get("imageinfo") or [None])[0]
    if not imageinfo:
        return None
    mime = str(imageinfo.get("mime", ""))
    if mime not in {"image/jpeg", "image/png", "image/webp"}:
        return None
    metadata = imageinfo.get("extmetadata") or {}
    try:
        license_name, license_url = normalize_license(
            _metadata_value(metadata, "LicenseShortName") or _metadata_value(metadata, "UsageTerms"),
            _metadata_value(metadata, "LicenseUrl"),
        )
    except ValueError:
        return None
    title = str(page.get("title", ""))
    if not title.startswith("File:"):
        return None
    creator = _metadata_value(metadata, "Artist") or "Unknown creator"
    attribution = _metadata_value(metadata, "Attribution") or _metadata_value(metadata, "Credit")
    if not attribution:
        attribution = f"{creator} / Wikimedia Commons / {license_name}"
    return {
        "title": title,
        "width": int(imageinfo.get("width") or 0),
        "height": int(imageinfo.get("height") or 0),
        "mime": mime,
        "original_url": _https_url(imageinfo.get("url")),
        "download_url": _https_url(imageinfo.get("thumburl") or imageinfo.get("url")),
        "source_url": f"https://commons.wikimedia.org/wiki/{quote(title.replace(' ', '_'), safe=':()_-')}",
        "creator": creator[:600],
        "license": license_name,
        "license_url": license_url,
        "attribution": attribution[:1000],
        "description": _metadata_value(metadata, "ImageDescription")[:1000],
        "source": source,
    }


def _commons_pages(params: dict[str, str], source: str) -> list[dict]:
    payload = _request_json(
        COMMONS_API,
        {
            "action": "query",
            "format": "json",
            "formatversion": "2",
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": "1600",
            "iiextmetadatafilter": (
                "LicenseShortName|LicenseUrl|Artist|ImageDescription|Credit|Attribution|"
                "AttributionRequired|UsageTerms"
            ),
            **params,
        },
    )
    pages = payload.get("query", {}).get("pages", [])
    return [candidate for page in pages if (candidate := _candidate_from_page(page, source))]


def commons_search(query: str, *, limit: int = 18) -> list[dict]:
    return _commons_pages(
        {
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": "6",
            "gsrlimit": str(limit),
        },
        "search",
    )


def commons_metadata(titles: list[str], source_by_title: dict[str, str] | None = None) -> list[dict]:
    candidates: list[dict] = []
    source_by_title = source_by_title or {}
    for start in range(0, len(titles), 20):
        batch = titles[start : start + 20]
        pages = _commons_pages({"titles": "|".join(batch)}, "wikidata")
        for candidate in pages:
            candidate["source"] = source_by_title.get(candidate["title"], candidate["source"])
            candidates.append(candidate)
    return candidates


def _wikidata_media(pleiades_ids: list[str]) -> dict[str, list[dict[str, str]]]:
    if not pleiades_ids:
        return {}
    values = " ".join(json.dumps(identifier) for identifier in pleiades_ids)
    query = f"""
SELECT ?pleiades ?item ?itemLabel ?itemDescription ?image ?commonsCategory WHERE {{
  VALUES ?pleiades {{ {values} }}
  ?item wdt:P1584 ?pleiades.
  OPTIONAL {{ ?item wdt:P18 ?image. }}
  OPTIONAL {{ ?item wdt:P373 ?commonsCategory. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en,el". }}
}}
"""
    payload = _request_json(WIKIDATA_SPARQL, {"query": query, "format": "json"}, post=True)
    mapping: dict[str, list[dict[str, str]]] = {}
    for binding in payload.get("results", {}).get("bindings", []):
        identifier = binding["pleiades"]["value"]
        image_url = binding.get("image", {}).get("value", "")
        image_title = ""
        marker = "/Special:FilePath/"
        if marker in image_url:
            image_title = f"File:{unquote(image_url.split(marker, 1)[1])}"
        mapping.setdefault(identifier, []).append(
            {
                "item": binding.get("item", {}).get("value", ""),
                "label": binding.get("itemLabel", {}).get("value", ""),
                "description": binding.get("itemDescription", {}).get("value", ""),
                "image_title": image_title,
                "category": binding.get("commonsCategory", {}).get("value", ""),
            }
        )
    return mapping


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_entities(canonical: Path) -> list[dict]:
    entities = _read_csv(canonical / "entities.csv")
    pleiades = {
        row["entity_id"]: row["identifier"]
        for row in _read_csv(canonical / "external_ids.csv")
        if row["scheme"] == "pleiades" and row["entity_id"]
    }
    places = {
        row["place_id"]: row["entity_id"]
        for row in _read_csv(canonical / "places.csv")
    }
    for row in _read_csv(canonical / "external_ids.csv"):
        if row["scheme"] == "pleiades" and row["place_id"] in places:
            pleiades[places[row["place_id"]]] = row["identifier"]
    return [{**entity, "pleiades_id": pleiades.get(entity["entity_id"], "")} for entity in entities]


def _query_for(entity: dict, *, broad: bool = False) -> str:
    name = entity["preferred_name_en"]
    if broad:
        return name
    if entity["entity_class"] == "polity":
        return f"{name} ancient coin map"
    if entity["entity_class"] == "sanctuary":
        return f"{name} temple archaeological"
    return f"{name} ancient archaeological ruins"


def search_queries(entity: dict, aliases: list[str] | None = None) -> list[str]:
    name = clean_html(entity["preferred_name_en"])
    core = re.sub(
        r"(?i)^(?:sacred center of the|sacred centre of the)\s+|"
        r"\b(?:polity|sanctuary|kingdom|late client)\b",
        " ",
        name,
    )
    core = re.sub(r"\s+", " ", core).strip(" -—·")
    queries = [*(aliases or []), _query_for(entity)]
    if entity["entity_class"] == "polity":
        queries.extend((f"{core} ancient coin", f"{core} coin", core))
    elif entity["entity_class"] == "sanctuary":
        queries.extend((f"{core} archaeological", f"{core} ancient coin", core))
    else:
        queries.extend((f"{core} ancient ruins", f"{core} ancient coin", core))
    unique: list[str] = []
    seen: set[str] = set()
    for query in queries:
        normalized = re.sub(r"\s+", " ", clean_html(query)).strip()
        folded = _fold(normalized)
        if normalized and folded not in seen:
            unique.append(normalized)
            seen.add(folded)
    return unique


def _usable(candidate: dict) -> bool:
    width = int(candidate.get("width") or 0)
    height = int(candidate.get("height") or 0)
    return max(width, height) >= 900 and width * height >= 450_000 and bool(candidate.get("download_url"))


def discover_candidates(
    entity: dict,
    wikidata_candidates: list[dict],
    desired: int,
    search_aliases: list[str] | None = None,
) -> list[dict]:
    candidates = list(wikidata_candidates)
    unique = {
        candidate["title"]: candidate
        for candidate in candidates
        if _usable(candidate) and candidate_is_relevant(entity, candidate)
    }
    target_pool = max(6, desired * 3)
    for query in search_queries(entity, search_aliases):
        for candidate in commons_search(query, limit=20):
            if search_aliases and query in search_aliases:
                candidate = {**candidate, "source": "search-override"}
            if _usable(candidate) and candidate_is_relevant(entity, candidate):
                unique.setdefault(candidate["title"], candidate)
        strong = sum(score_candidate(entity, item) >= 80 for item in unique.values())
        if strong >= target_pool:
            break
    return sorted(unique.values(), key=lambda item: (-score_candidate(entity, item), item["title"]))


def load_overrides(path: Path | None) -> dict[tuple[str, int], str]:
    if not path or not path.exists():
        return {}
    return {
        (row["entity_id"], int(row["position"])): row["commons_title"]
        for row in _read_csv(path)
        if row.get("entity_id") and row.get("position") and row.get("commons_title")
    }


def entity_has_complete_overrides(
    entity_id: str,
    overrides: dict[tuple[str, int], str],
    per_entity: int,
) -> bool:
    return all((entity_id, position) in overrides for position in range(1, per_entity + 1))


def load_search_overrides(path: Path | None) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    if not path or not path.exists():
        return grouped
    for row in _read_csv(path):
        entity_id = clean_html(row.get("entity_id"))
        query = clean_html(row.get("query"))
        if entity_id and query:
            grouped.setdefault(entity_id, []).append(query)
    return grouped


def _download(url: str, target: Path) -> None:
    error: Exception | None = None
    for attempt in range(6):
        request = Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urlopen(request, timeout=90) as response:
                target.write_bytes(response.read())
            return
        except (HTTPError, URLError, TimeoutError) as caught:
            error = caught
            if attempt < 5:
                retry_after = caught.headers.get("Retry-After") if isinstance(caught, HTTPError) else None
                time.sleep(retry_delay(attempt, retry_after))
    status = f" (HTTP {error.code})" if isinstance(error, HTTPError) else ""
    raise RuntimeError(f"Media download failed{status}: {url}") from error


def _safe_media_root(root: Path, media_root: Path) -> Path:
    resolved_root = root.resolve()
    resolved_media = media_root.resolve()
    expected_parent = (resolved_root / "assets").resolve()
    if resolved_media.parent != expected_parent or resolved_media.name != "media":
        raise ValueError(f"Media output must be the workspace assets/media directory: {resolved_media}")
    return resolved_media


def _select(
    entity: dict,
    ranked: list[dict],
    override_candidates: dict[str, dict],
    overrides: dict[tuple[str, int], str],
    desired: int,
) -> list[dict]:
    selected: list[dict] = []
    used: set[str] = set()
    for position in range(1, desired + 1):
        forced_title = overrides.get((entity["entity_id"], position))
        if forced_title:
            candidate = override_candidates.get(forced_title)
            if not candidate:
                raise ValueError(f"Missing Commons metadata for override {entity['entity_id']} #{position}: {forced_title}")
        else:
            candidate = next((item for item in ranked if item["title"] not in used), None)
            if not candidate:
                break
        selected.append(candidate)
        used.add(candidate["title"])
    return selected


def _write_manifest(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MEDIA_FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def merge_media_rows(
    existing: list[dict],
    replacements: list[dict],
    entity_ids: set[str],
) -> list[dict]:
    merged = [row for row in existing if str(row.get("entity_id", "")) not in entity_ids]
    merged.extend(replacements)
    return sorted(merged, key=lambda row: (str(row.get("entity_id", "")), int(row.get("position") or 0)))


def _write_attributions(path: Path, rows: list[dict[str, object]]) -> None:
    def escape(value: object) -> str:
        return str(value).replace("|", "\\|").replace("\n", " ")

    lines = [
        "# Third-party media attributions / Αναφορές πολυμέσων τρίτων",
        "",
        "Every local WebP is a resized, format-converted copy of the linked Wikimedia Commons file. "
        "Each work retains its stated licence. / Κάθε τοπικό WebP είναι αντίγραφο αλλαγμένου μεγέθους "
        "και μορφής του συνδεδεμένου αρχείου Wikimedia Commons. Κάθε έργο διατηρεί τη δηλωμένη άδειά του.",
        "",
        "| Entity | Position | Work | Creator | Licence | Local file |",
        "|---|---:|---|---|---|---|",
    ]
    for row in rows:
        work = f"[{escape(row['title'])}]({row['source_url']})"
        license_link = f"[{escape(row['license'])}]({row['license_url']})"
        lines.append(
            f"| `{escape(row['entity_id'])}` | {row['position']} | {work} | "
            f"{escape(row['creator'])} | {license_link} | `{escape(row['file_path'])}` |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _contact_sheets(rows: list[dict[str, object]], entities: dict[str, dict], output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for position in sorted({int(row["position"]) for row in rows}):
        position_rows = [row for row in rows if int(row["position"]) == position]
        for page_number, start in enumerate(range(0, len(position_rows), 40), start=1):
            page_rows = position_rows[start : start + 40]
            sheet = Image.new("RGB", (1600, 1760), "white")
            from PIL import ImageDraw

            draw = ImageDraw.Draw(sheet)
            for index, row in enumerate(page_rows):
                column, line = index % 5, index // 5
                x, y = column * 320, line * 220
                path = ROOT / str(row["file_path"])
                with Image.open(path) as image:
                    thumb = ImageOps.fit(image.convert("RGB"), (300, 170), method=Image.Resampling.LANCZOS)
                sheet.paste(thumb, (x + 10, y + 8))
                entity = entities[str(row["entity_id"])]
                label = f"{entity['preferred_name_en']} | {row['entity_id']}"
                draw.text((x + 10, y + 183), label[:48], fill="#171916")
            sheet.save(output / f"position-{position}-{page_number:02d}.webp", "WEBP", quality=82, method=6)


def build(args: argparse.Namespace) -> int:
    canonical = args.canonical.resolve()
    media_root = _safe_media_root(ROOT, args.assets)
    all_entities = load_entities(canonical)
    entities_by_id = {row["entity_id"]: row for row in all_entities}
    requested_entities = set(args.entity or [])
    unknown_entities = sorted(requested_entities - set(entities_by_id))
    if unknown_entities:
        raise ValueError(f"Unknown --entity values: {', '.join(unknown_entities)}")
    entities = [row for row in all_entities if not requested_entities or row["entity_id"] in requested_entities]
    existing_manifest = _read_csv(args.manifest) if requested_entities and args.manifest.exists() else []
    if requested_entities and not existing_manifest:
        raise ValueError("A targeted media rebuild requires an existing complete manifest")
    overrides = load_overrides(args.overrides)
    search_overrides = load_search_overrides(args.search_overrides)
    discovery_entities = [
        entity
        for entity in entities
        if not entity_has_complete_overrides(entity["entity_id"], overrides, args.per_entity)
    ]
    mappings = _wikidata_media(
        sorted({row["pleiades_id"] for row in discovery_entities if row["pleiades_id"]})
    )

    p18_sources: dict[str, str] = {}
    p18_by_entity: dict[str, list[str]] = {}
    for entity in discovery_entities:
        for item in mappings.get(entity["pleiades_id"], []):
            title = item["image_title"]
            if not title:
                continue
            context = _fold(f"{item['label']} {item['description']} {item['category']}")
            source = "wikidata-ancient" if any(word in context for word in ("ancient", "antiqu", "archaeolog")) else "wikidata"
            p18_sources[title] = source
            p18_by_entity.setdefault(entity["entity_id"], []).append(title)
    p18_metadata = {row["title"]: row for row in commons_metadata(sorted(p18_sources), p18_sources)}

    override_titles = sorted(
        {
            title
            for (entity_id, _position), title in overrides.items()
            if not requested_entities or entity_id in requested_entities
        }
    )
    override_candidates = {
        row["title"]: {**row, "source": "override"}
        for row in commons_metadata(override_titles, {title: "override" for title in override_titles})
    }

    discovered: dict[str, list[dict]] = {
        entity["entity_id"]: []
        for entity in entities
        if entity_has_complete_overrides(entity["entity_id"], overrides, args.per_entity)
    }
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {}
        for entity in discovery_entities:
            seeded = [
                p18_metadata[title]
                for title in p18_by_entity.get(entity["entity_id"], [])
                if title in p18_metadata
            ]
            future = executor.submit(
                discover_candidates,
                entity,
                seeded,
                args.per_entity,
                search_overrides.get(entity["entity_id"]),
            )
            futures[future] = entity
        completed = len(entities) - len(discovery_entities)
        if completed == len(entities):
            print(f"discovered={completed}/{len(entities)}", flush=True)
        for future in as_completed(futures):
            entity = futures[future]
            try:
                discovered[entity["entity_id"]] = future.result()
            except Exception as error:  # report every failed entity together
                failures.append(f"{entity['entity_id']}: {error}")
            completed += 1
            if completed % 25 == 0 or completed == len(entities):
                print(f"discovered={completed}/{len(entities)}", flush=True)
    if failures:
        raise RuntimeError("Candidate discovery failed:\n" + "\n".join(failures))

    selections: dict[str, list[dict]] = {}
    missing: list[str] = []
    for entity in entities:
        selected = _select(
            entity,
            discovered[entity["entity_id"]],
            override_candidates,
            overrides,
            args.per_entity,
        )
        if len(selected) < args.per_entity:
            missing.append(f"{entity['entity_id']} ({len(selected)}/{args.per_entity})")
        selections[entity["entity_id"]] = selected
    if missing:
        raise RuntimeError("Insufficient reusable media candidates:\n" + "\n".join(missing))

    media_root.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="agw-media-download-") as temp:
        temporary = Path(temp)
        total = len(entities) * args.per_entity
        jobs = []
        job_index = 0
        for entity in entities:
            entity_dir = media_root / entity["entity_id"]
            entity_dir.mkdir(parents=True, exist_ok=True)
            for position, candidate in enumerate(selections[entity["entity_id"]], start=1):
                jobs.append((job_index, entity, position, candidate, entity_dir))
                job_index += 1

        def process_media(job) -> dict[str, object]:
            index, entity, position, candidate, entity_dir = job
            try:
                source = temporary / f"source-{index:04d}"
                target = entity_dir / f"{position:02d}.webp"
                prepared = temporary / f"output-{index:04d}.webp"
                _download(candidate["download_url"], source)
                image = optimize_image(source, prepared, max_dimension=args.max_dimension)
                prepared.replace(target)
                copy = media_copy(entity, candidate["title"])
                relative_path = target.relative_to(ROOT).as_posix()
                return {
                    "media_id": f"media-{entity['entity_id']}-{position:02d}",
                    "entity_id": entity["entity_id"],
                    "position": position,
                    "role": "primary" if position == 1 else "gallery",
                    "file_path": relative_path,
                    "source_url": candidate["source_url"],
                    "original_url": candidate["original_url"],
                    "title": candidate["title"].removeprefix("File:"),
                    "creator": candidate["creator"],
                    "license": candidate["license"],
                    "license_url": candidate["license_url"],
                    "attribution": candidate["attribution"],
                    **copy,
                    **image,
                    "retrieved_on": args.retrieved_on,
                    "review_state": "reviewed",
                }
            except Exception as error:
                raise RuntimeError(
                    f"Failed to prepare {entity['entity_id']} media position {position}: {candidate['title']}"
                ) from error

        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = [executor.submit(process_media, job) for job in jobs]
            completed = 0
            for future in as_completed(futures):
                rows.append(future.result())
                completed += 1
                if completed % 25 == 0 or completed == total:
                    print(f"downloaded={completed}/{total}", flush=True)

    rows.sort(key=lambda row: (str(row["entity_id"]), int(row["position"])))
    if requested_entities:
        rows = merge_media_rows(existing_manifest, rows, requested_entities)
    _write_manifest(args.manifest, rows)
    _write_attributions(args.attributions, rows)
    if args.contact_sheets:
        _contact_sheets(rows, entities_by_id, args.contact_sheets)
    updated_review_payload = {
        entity_id: [
            {
                "title": item["title"],
                "score": score_candidate(entities_by_id[entity_id], item),
                "source_url": item["source_url"],
            }
            for item in candidates[:10]
        ]
        for entity_id, candidates in sorted(discovered.items())
    }
    review_payload = {}
    if requested_entities and args.review.exists():
        try:
            review_payload = json.loads(args.review.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            review_payload = {}
    review_payload.update(updated_review_payload)
    args.review.parent.mkdir(parents=True, exist_ok=True)
    args.review.write_text(json.dumps(review_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"media={len(rows)} entities={len(all_entities)} manifest={args.manifest}")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Curate licensed Wikimedia Commons media for the atlas")
    parser.add_argument("--canonical", type=Path, default=ROOT / "data" / "canonical")
    parser.add_argument("--assets", type=Path, default=ROOT / "assets" / "media")
    parser.add_argument("--manifest", type=Path, default=ROOT / "data" / "research" / "media.csv")
    parser.add_argument("--overrides", type=Path, default=ROOT / "data" / "research" / "media-overrides.csv")
    parser.add_argument(
        "--search-overrides",
        type=Path,
        default=ROOT / "data" / "research" / "media-search-overrides.csv",
    )
    parser.add_argument("--attributions", type=Path, default=ROOT / "THIRD_PARTY_MEDIA.md")
    parser.add_argument("--review", type=Path, default=ROOT / "reports" / "media-candidates.json")
    parser.add_argument("--contact-sheets", type=Path, default=ROOT / "reports" / "media-review")
    parser.add_argument("--per-entity", type=int, choices=range(1, 5), default=2)
    parser.add_argument("--max-dimension", type=int, default=1600)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--retrieved-on", default=date.today().isoformat())
    parser.add_argument(
        "--entity",
        action="append",
        default=[],
        help="Rebuild one entity and merge it into an existing complete manifest; repeat as needed",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        return build(parse_args(argv))
    except (RuntimeError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
