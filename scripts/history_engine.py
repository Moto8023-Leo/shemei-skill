"""
History Engine — content dedup and history tracking.
Ported from ienyrid-social-studio-cn/server/services/history.mjs.
Uses JSON file storage.

Usage:
    from scripts.history_engine import get_recent_warnings, save_history
"""

import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HISTORY_FILE = ROOT / "storage" / "history.json"
MAX_HISTORY = 500


# ---------------------------------------------------------------
# Jaccard similarity for Chinese + alphanumeric text
# ---------------------------------------------------------------
def _tokenize(text: str) -> set[str]:
    """Tokenize mixed Chinese/English text into uni/bi-grams."""
    tokens = set()
    # Chinese: pick unigrams and bigrams
    chinese_chars = re.findall(r"[一-鿿]", text)
    for ch in chinese_chars:
        tokens.add(ch)
    for i in range(len(chinese_chars) - 1):
        tokens.add(chinese_chars[i] + chinese_chars[i + 1])
    # Alphanumeric: pick lowercase unigrams and bigrams
    alpha_words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    for w in alpha_words:
        tokens.add(w)
    for w in alpha_words:
        for i in range(len(w) - 1):
            tokens.add(w[i : i + 2])
    return tokens


def _jaccard_similarity(a: str, b: str) -> float:
    if not a and not b:
        return 0.0
    set_a = _tokenize(a)
    set_b = _tokenize(b)
    union = len(set_a | set_b)
    if union == 0:
        return 0.0
    return len(set_a & set_b) / union


# ---------------------------------------------------------------
# Public API
# ---------------------------------------------------------------
def get_recent_warnings(product_id: str, proposed_style: str | None = None) -> list[str]:
    """
    Scan recent history for this product and generate dedup warnings.

    Returns:
        List of warning strings (empty if no issues found).
    """
    if not HISTORY_FILE.exists():
        return []

    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    # Filter to this product, last 30 entries
    entries = [e for e in data if e.get("productId") == product_id][-30:]
    if not entries:
        return []

    warnings = []

    # Golden hour overuse
    golden_count = sum(1 for e in entries if "golden hour" in str(e.get("imagePrompt", "")).lower())
    if golden_count > 2:
        warnings.append("视觉效果：golden hour 使用过于频繁")

    # Range keyword overuse
    range_count = sum(
        1 for e in entries
        if "续航" in str(e.get("title", ""))
        or "range" in str(e.get("title", "")).lower()
        or "续航" in str(e.get("facebookText", ""))
        or "range" in str(e.get("facebookText", "")).lower()
    )
    if range_count > 4:
        warnings.append("话题：续航/range 相关已使用较频繁")

    # Style similarity check
    if proposed_style:
        for e in entries:
            existing_style = e.get("styleSummary", "")
            if _jaccard_similarity(proposed_style, existing_style) > 0.72:
                warnings.append("风格：与近期内容过于相似")
                break

    return warnings


def save_history(entry: dict) -> None:
    """
    Save a generation entry to history file.

    Args:
        entry: {"taskId": str, "brandId": str, "productId": str,
                 "createdAt": str, "title": str, "facebookText": str,
                 "styleSummary": str, ...}
    """
    os.makedirs(HISTORY_FILE.parent, exist_ok=True)

    if HISTORY_FILE.exists():
        try:
            data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            data = []
    else:
        data = []

    data.append(entry)

    # Keep only last MAX_HISTORY entries
    if len(data) > MAX_HISTORY:
        data = data[-MAX_HISTORY:]

    HISTORY_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def get_history(
    brand_id: str | None = None,
    product_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Get paginated history entries with optional filtering.

    Returns:
        {"entries": [...], "total": int}
    """
    if not HISTORY_FILE.exists():
        return {"entries": [], "total": 0}

    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"entries": [], "total": 0}

    # Filter
    if brand_id:
        data = [e for e in data if e.get("brandId") == brand_id]
    if product_id:
        data = [e for e in data if e.get("productId") == product_id]

    # Sort newest first
    data.sort(key=lambda e: e.get("createdAt", ""), reverse=True)

    return {
        "entries": data[offset : offset + limit],
        "total": len(data),
    }
