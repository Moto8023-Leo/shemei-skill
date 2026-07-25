"""
Content Similarity Engine — five-dimensional deduplication.

Ported from AI-Social-Operator-Studio v2.3 similarity.service.ts.

Compares new content against recent history across 5 dimensions:
  1. Opening hooks (headline patterns)
  2. Selling points (benefit claims)
  3. CTAs (call-to-action patterns)
  4. Scenes (visual scene descriptions)
  5. Composition styles (visual arrangement)

Returns 0-100 risk score with Chinese-language suggestions.
"""

import hashlib
import json
import logging
import re
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Stop words for tokenization
# ------------------------------------------------------------------

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "nor", "not", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some",
    "such", "only", "own", "same", "than", "too", "very", "just",
    "that", "this", "these", "those", "it", "its", "your", "you",
    "we", "our", "they", "them", "their", "get", "got", "one", "two",
}

# ------------------------------------------------------------------
# Dimension extractors
# ------------------------------------------------------------------


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase words, removing stop words and short tokens."""
    if not text:
        return []
    # Remove emojis and special chars
    cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
    tokens = cleaned.split()
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 2]


def extract_opening_hook(title: str, body: str = "") -> str:
    """Extract the opening hook pattern from headline + first sentence."""
    title_tokens = _tokenize(title)
    if not body:
        return " ".join(title_tokens[:5])

    # Get first sentence of body
    first_sent = re.split(r'[.!?]+', body)[0].strip()
    body_tokens = _tokenize(first_sent)

    # Combine: title tokens + first sentence tokens (unique)
    combined = title_tokens[:8] + body_tokens[:5]
    return " ".join(dict.fromkeys(combined))  # preserve order, remove dups


def extract_selling_points(body: str, tags: str = "") -> set[str]:
    """Extract selling points and benefit claims from body text."""
    tokens = _tokenize(body)
    tags_tokens = [t.lstrip('#') for t in _tokenize(tags.replace('#', ' '))]

    # Look for benefit words: numbers + units, superlatives, value claims
    benefit_patterns = []
    for i, t in enumerate(tokens):
        if t.isdigit() and i + 1 < len(tokens):
            benefit_patterns.append(f"{t} {tokens[i+1]}")
        if t in ("range", "speed", "motor", "battery", "brake", "suspension",
                 "power", "charge", "weight", "price", "warranty", "comfort"):
            # Include context: the word + previous adjective
            start = max(0, i - 1)
            benefit_patterns.append(" ".join(tokens[start:i+1]))

    return set(benefit_patterns) | set(tags_tokens)


def extract_cta_pattern(body: str) -> str:
    """Extract the CTA pattern from the body text."""
    cta_keywords = ["shop", "buy", "get", "order", "grab", "claim", "save",
                    "learn", "discover", "explore", "try", "ride", "go",
                    "click", "visit", "check", "start", "join", "sign"]
    tokens = _tokenize(body)

    # Find the last sentence (usually contains CTA)
    sentences = re.split(r'[.!?]+', body)
    last_sent = sentences[-1].strip() if sentences else body

    cta_tokens = _tokenize(last_sent)
    cta_words = [t for t in cta_tokens if t in cta_keywords]

    # Fallback: scan whole body if last sentence has no CTA
    if not cta_words:
        all_tokens = _tokenize(body)
        cta_words = [t for t in all_tokens if t in cta_keywords]

    # Last resort: use last few tokens
    result = " ".join(cta_words) if cta_words else " ".join(cta_tokens[-4:] if len(cta_tokens) >= 4 else cta_tokens)
    return result


def extract_scene(image_prompt: str) -> str:
    """Extract scene description from image prompt."""
    scene_keywords = ["city", "urban", "street", "road", "park", "campus",
                      "mountain", "beach", "studio", "night", "morning",
                      "sunset", "golden", "rain", "winter", "summer",
                      "commute", "office", "building", "bridge", "nature"]
    tokens = _tokenize(image_prompt)
    scene_words = [t for t in tokens if t in scene_keywords]
    return " ".join(scene_words[:5]) if scene_words else " ".join(tokens[:8])


def extract_composition(image_prompt: str) -> str:
    """Extract composition style from image prompt."""
    comp_keywords = ["close", "wide", "angle", "shot", "portrait", "landscape",
                     "overhead", "front", "side", "back", "diagonal",
                     "symmetry", "rule", "thirds", "shallow", "depth",
                     "bokeh", "blur", "focus", "lighting", "shadow",
                     "reflection", "neon", "cinematic", "minimal", "clean"]
    tokens = _tokenize(image_prompt)
    comp_words = [t for t in tokens if t in comp_keywords]
    return " ".join(comp_words[:5]) if comp_words else ""


# ------------------------------------------------------------------
# Similarity scoring
# ------------------------------------------------------------------


def _jaccard_similarity(set_a: set, set_b: set) -> float:
    """Jaccard similarity between two sets."""
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)


def _text_similarity(text_a: str, text_b: str) -> float:
    """Token-level Jaccard similarity between two texts."""
    tokens_a = set(_tokenize(text_a))
    tokens_b = set(_tokenize(text_b))
    return _jaccard_similarity(tokens_a, tokens_b)


# ------------------------------------------------------------------
# History management
# ------------------------------------------------------------------


def _get_history_dir() -> Path:
    d = Path(__file__).resolve().parent.parent / "storage"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_recent_history(days: int = 30) -> list[dict]:
    """Load recent content history for dedup comparison."""
    history_file = _get_history_dir() / "content_history.json"
    if not history_file.exists():
        return []

    try:
        data = json.loads(history_file.read_text(encoding="utf-8"))
        entries = data.get("entries", [])
        # Filter to recent entries
        cutoff = (datetime.now() - timedelta(days=days)).isoformat()
        return [e for e in entries if e.get("createdAt", "") >= cutoff]
    except Exception as e:
        logger.warning(f"Failed to load history: {e}")
        return []


def save_to_history(content_data: dict) -> bool:
    """Save generated content to dedup history."""
    try:
        history_file = _get_history_dir() / "content_history.json"

        if history_file.exists():
            data = json.loads(history_file.read_text(encoding="utf-8"))
        else:
            data = {"entries": [], "updatedAt": ""}

        entry = {
            "taskId": content_data.get("taskId", ""),
            "title": content_data.get("title", ""),
            "body": content_data.get("body", content_data.get("facebookText", "")),
            "tags": content_data.get("tags", ""),
            "imagePrompt": content_data.get("imagePrompt", content_data.get("image_prompt", "")),
            "createdAt": datetime.now().isoformat(),
            # Pre-computed fingerprints for fast lookup
            "hookFingerprint": extract_opening_hook(
                content_data.get("title", ""),
                content_data.get("body", content_data.get("facebookText", ""))
            ),
            "sellingPointFingerprint": " ".join(sorted(extract_selling_points(
                content_data.get("body", content_data.get("facebookText", "")),
                content_data.get("tags", "")
            ))),
            "ctaFingerprint": extract_cta_pattern(
                content_data.get("body", content_data.get("facebookText", ""))
            ),
            "sceneFingerprint": extract_scene(
                content_data.get("imagePrompt", content_data.get("image_prompt", ""))
            ),
            "compositionFingerprint": extract_composition(
                content_data.get("imagePrompt", content_data.get("image_prompt", ""))
            ),
        }

        # Keep last 200 entries
        data["entries"].append(entry)
        if len(data["entries"]) > 200:
            data["entries"] = data["entries"][-200:]
        data["updatedAt"] = datetime.now().isoformat()

        history_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logger.warning(f"Failed to save history: {e}")
        return False


# ------------------------------------------------------------------
# Main: compare against history
# ------------------------------------------------------------------


def check_similarity(
    title: str = "",
    body: str = "",
    tags: str = "",
    image_prompt: str = "",
    days: int = 30,
) -> dict:
    """
    Compare new content against recent history across 5 dimensions.
    Returns risk score and per-dimension results.
    """
    history = _load_recent_history(days)

    if not history:
        return {
            "riskScore": 0,
            "riskLevel": "none",
            "summary": "无历史内容可对比（首次生成）",
            "dimensions": {},
            "suggestions": [],
        }

    # Extract fingerprints from new content
    new_hook = extract_opening_hook(title, body)
    new_points = extract_selling_points(body, tags)
    new_cta = extract_cta_pattern(body)
    new_scene = extract_scene(image_prompt)
    new_composition = extract_composition(image_prompt)

    # Compare against each history entry
    hook_sims = []
    point_sims = []
    cta_sims = []
    scene_sims = []
    comp_sims = []

    for entry in history:
        h_hook = entry.get("hookFingerprint", "")
        h_points = set(entry.get("sellingPointFingerprint", "").split())
        h_cta = entry.get("ctaFingerprint", "")
        h_scene = entry.get("sceneFingerprint", "")
        h_comp = entry.get("compositionFingerprint", "")

        hook_sims.append(_text_similarity(new_hook, h_hook))
        point_sims.append(_jaccard_similarity(new_points, h_points))
        cta_sims.append(_text_similarity(new_cta, h_cta))
        scene_sims.append(_text_similarity(new_scene, h_scene))
        comp_sims.append(_text_similarity(new_composition, h_comp))

    # Take max similarity per dimension
    max_hook = max(hook_sims) if hook_sims else 0
    max_points = max(point_sims) if point_sims else 0
    max_cta = max(cta_sims) if cta_sims else 0
    max_scene = max(scene_sims) if scene_sims else 0
    max_comp = max(comp_sims) if comp_sims else 0

    # Weighted dimensions (hook and selling points matter most)
    risk_score = round((
        max_hook * 30 +
        max_points * 30 +
        max_cta * 15 +
        max_scene * 15 +
        max_comp * 10
    ))

    # Risk level
    if risk_score >= 70:
        risk_level = "high"
    elif risk_score >= 45:
        risk_level = "medium"
    elif risk_score >= 20:
        risk_level = "low"
    else:
        risk_level = "none"

    # Suggestions
    suggestions = []
    if max_hook > 0.6:
        suggestions.append(f"开场 Hook 与历史内容相似度 {max_hook:.0%}，建议更换角度")
    if max_points > 0.6:
        suggestions.append(f"卖点组合与历史内容相似度 {max_points:.0%}，建议突出不同规格")
    if max_cta > 0.7:
        suggestions.append(f"CTA 模式重复 {max_cta:.0%}，建议变换行动号召方式")
    if max_scene > 0.7:
        suggestions.append(f"场景与历史重复 {max_scene:.0%}，建议选择不同视觉场景")
    if max_comp > 0.6:
        suggestions.append(f"构图风格相似 {max_comp:.0%}，建议调整镜头角度或光线")

    return {
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "summary": f"与近 {days} 天 {len(history)} 条内容对比，相似度风险：{'高' if risk_level == 'high' else '中' if risk_level == 'medium' else '低' if risk_level == 'low' else '无'}",
        "dimensions": {
            "openingHook": {"similarity": round(max_hook * 100), "level": "high" if max_hook > 0.6 else "medium" if max_hook > 0.3 else "low"},
            "sellingPoints": {"similarity": round(max_points * 100), "level": "high" if max_points > 0.6 else "medium" if max_points > 0.3 else "low"},
            "cta": {"similarity": round(max_cta * 100), "level": "high" if max_cta > 0.7 else "medium" if max_cta > 0.4 else "low"},
            "scene": {"similarity": round(max_scene * 100), "level": "high" if max_scene > 0.7 else "medium" if max_scene > 0.4 else "low"},
            "composition": {"similarity": round(max_comp * 100), "level": "high" if max_comp > 0.6 else "medium" if max_comp > 0.3 else "low"},
        },
        "suggestions": suggestions,
    }
