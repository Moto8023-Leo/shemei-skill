"""
Visual Style Engine v2 — deterministic random with creative seed.

Ported from AI-Social-Operator-Studio v2.3 visual engine.

Key improvements over v1:
  - creativeSeed + SHA-256: reproducible random style selection
  - styleLocked: freeze current combination
  - Full style summary output for transparency
  - History-aware dedup preserved

Usage:
    from scripts.visual_engine import select_visual_style

    # Random with seed
    style = select_visual_style(..., creative_seed="abc123")

    # Locked mode: re-use previous style
    style = select_visual_style(..., style_locked=True, previous_style=old_style)
"""

import hashlib
import logging
from typing import Optional

from scripts.studio_data import visualPools, visualPoolsEn, brands

logger = logging.getLogger(__name__)

# Build visual DNA English mapping from brand data
_visual_dna_en_map = {}
for b in brands:
    if "visualDnaEn" in b:
        _visual_dna_en_map.update(b["visualDnaEn"])


def _seeded_pick(items: list[str], seed: str, dimension: str, warnings: list[str] | None = None) -> str:
    """
    Pick an item deterministically using seed + dimension name as the hash input.
    Falls back to filtered random if warnings are provided.
    """
    if not items:
        return ""

    # Filter out warned values if needed
    if warnings:
        filtered = [i for i in items if not any(w.lower() in i.lower() for w in warnings)]
        pool = filtered if filtered else items
    else:
        pool = items

    # Deterministic selection using SHA-256
    hash_input = f"{seed}:{dimension}"
    hash_hex = hashlib.sha256(hash_input.encode()).hexdigest()
    # Take first 8 hex chars as a 32-bit integer, modulo pool size
    idx = int(hash_hex[:8], 16) % len(pool)
    return pool[idx]


def _pick_en_matching(cn_pool: list[str], en_pool: list[str], picked_cn: str) -> str:
    """Get the English equivalent at the same index position."""
    try:
        idx = cn_pool.index(picked_cn)
        if idx < len(en_pool):
            return en_pool[idx]
    except ValueError:
        pass
    return en_pool[0] if en_pool else picked_cn


def build_style_summary(style: dict, visual_dna: list[str]) -> str:
    """Build a human-readable style summary string."""
    parts = []
    # DNA tags
    dna_en = [_visual_dna_en_map.get(t, t) for t in visual_dna]
    parts.append(f"Style: {'+'.join(dna_en)}")
    # Scene
    if style.get("sceneEn"):
        parts.append(f"Scene: {style['sceneEn']}")
    # Time
    if style.get("timeEn"):
        parts.append(f"Time: {style['timeEn']}")
    # Weather
    if style.get("weatherEn"):
        parts.append(f"Weather: {style['weatherEn']}")
    # Camera angle
    if style.get("angleEn"):
        parts.append(f"Angle: {style['angleEn']}")
    # People
    if style.get("peopleEn"):
        parts.append(f"People: {style['peopleEn']}")
    # Overlay
    if style.get("overlayTemplate"):
        parts.append(f"Layout: {style['overlayTemplate']}")
    return " | ".join(parts)


def select_visual_style(
    visual_dna: list[str] | None = None,
    scene_preference: str = "受控随机",
    overlay_template: str = "促销",
    overlay_position: str = "左侧",
    warnings: list[str] | None = None,
    creative_seed: str = "",
    style_locked: bool = False,
    previous_style: dict | None = None,
) -> dict:
    """
    Select a complete visual style from all 8 dimension pools.

    Args:
        visual_dna: List of visual DNA tags (Chinese), e.g. ["城市通勤", "性能机械"]
        scene_preference: "受控随机" or a specific scene name
        overlay_template: "极简", "促销", "卖点"
        overlay_position: "左侧", "右侧", "底部"
        warnings: list of recent warning strings for dedup
        creative_seed: A seed string for deterministic random (empty = true random)
        style_locked: If True, re-use previous_style instead of generating new
        previous_style: The previously selected style (required if style_locked=True)

    Returns:
        dict with cn/en keys for all dimensions, plus dna, overlay, seed, and summary.
    """
    if visual_dna is None:
        visual_dna = ["城市通勤", "性能机械", "明亮科技"]

    # Locked mode: return previous style unchanged
    if style_locked and previous_style:
        result = dict(previous_style)
        result["locked"] = True
        return result

    # Use seed for deterministic selection
    if creative_seed:
        import random as _random
        # Seed Python's random module for any non-deterministic fallback
        seed_int = int(hashlib.sha256(creative_seed.encode()).hexdigest()[:8], 16)
        _random.seed(seed_int)

        scene = _seeded_pick(visualPools["scenes"], creative_seed, "scene", warnings) if scene_preference == "受控随机" else scene_preference
        time_v = _seeded_pick(visualPools["times"], creative_seed, "time", warnings)
        weather = _seeded_pick(visualPools["weather"], creative_seed, "weather", warnings)
        angle = _seeded_pick(visualPools["angles"], creative_seed, "angle", warnings)
        people = _seeded_pick(visualPools["people"], creative_seed, "people", warnings)
        placement = _seeded_pick(visualPools["placements"], creative_seed, "placement", warnings)
        whitespace = _seeded_pick(visualPools["whitespace"], creative_seed, "whitespace", warnings)
        lighting = _seeded_pick(visualPools["lighting"], creative_seed, "lighting", warnings)

        # Reset random seed to prevent affecting other code
        _random.seed()
    else:
        import random as _random

        scene = (
            _random.choice(visualPools["scenes"])
            if scene_preference == "受控随机"
            else scene_preference
        )
        time_v = _random.choice(visualPools["times"])
        weather = _random.choice(visualPools["weather"])
        angle = _random.choice(visualPools["angles"])
        people = _random.choice(visualPools["people"])
        placement = _random.choice(visualPools["placements"])
        whitespace = _random.choice(visualPools["whitespace"])
        lighting = _random.choice(visualPools["lighting"])

    style = {
        "dna": visual_dna,
        "dnaEn": [_visual_dna_en_map.get(cn, cn) for cn in visual_dna],
        "scene": scene,
        "time": time_v,
        "weather": weather,
        "angle": angle,
        "people": people,
        "placement": placement,
        "whitespace": whitespace,
        "lighting": lighting,
        "overlayTemplate": overlay_template,
        "overlayPosition": overlay_position,
        # English equivalents for AI prompts
        "sceneEn": _pick_en_matching(visualPools["scenes"], visualPoolsEn["scenes"], scene),
        "timeEn": _pick_en_matching(visualPools["times"], visualPoolsEn["times"], time_v),
        "weatherEn": _pick_en_matching(visualPools["weather"], visualPoolsEn["weather"], weather),
        "angleEn": _pick_en_matching(visualPools["angles"], visualPoolsEn["angles"], angle),
        "peopleEn": _pick_en_matching(visualPools["people"], visualPoolsEn["people"], people),
        "placementEn": _pick_en_matching(visualPools["placements"], visualPoolsEn["placements"], placement),
        "whitespaceEn": _pick_en_matching(visualPools["whitespace"], visualPoolsEn["whitespace"], whitespace),
        "lightingEn": _pick_en_matching(visualPools["lighting"], visualPoolsEn["lighting"], lighting),
        # Seed info
        "creativeSeed": creative_seed,
        "locked": False,
    }

    style["summary"] = build_style_summary(style, visual_dna)
    return style


def reroll_style(
    visual_dna: list[str],
    scene_preference: str = "受控随机",
    overlay_template: str = "促销",
    overlay_position: str = "左侧",
    warnings: list[str] | None = None,
    previous_seed: str = "",
) -> dict:
    """
    Generate a new random style (ignoring seed).
    Useful for the "re-randomize" button.
    Returns a new style with a fresh seed.
    """
    import random as _random
    import time

    new_seed = f"{previous_seed or ''}{time.time()}{_random.random()}"
    return select_visual_style(
        visual_dna=visual_dna,
        scene_preference=scene_preference,
        overlay_template=overlay_template,
        overlay_position=overlay_position,
        warnings=warnings,
        creative_seed=new_seed,
    )


def lock_style(current_style: dict) -> dict:
    """Lock the current style so it won't change on re-generation."""
    locked = dict(current_style)
    locked["locked"] = True
    return locked


# Backward-compatible alias
select_visual_style_v2 = select_visual_style
