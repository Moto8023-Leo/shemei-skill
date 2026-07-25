"""
Quality Scoring Engine v2 — four-tier scoring system.

Ported from AI-Social-Operator-Studio v2.3 quality scoring with
blocking/warning/manual/passed tiers.

Dimensions:
  1. Copy length (FB: 80-1200 chars, X: <=280)
  2. Discount consistency
  3. Discount code presence
  4. CTA presence
  5. Image diversity / similarity warning
  6. Campaign match
  7. Safety violations (from facts.py)

Scoring tiers:
  - blocking: prevents publishing (safety violations, spec hallucinations)
  - warning: degrades quality score (length, consistency, missing CTA)
  - manual: human should verify (campaign match, diversity)
  - passed: all good
"""

import re


def score_content(copy: dict, form: dict, event: dict | None = None, warnings: list | None = None) -> dict:
    """
    Score generated content across 7+ dimensions.

    Returns:
        {
            "score": 0-100,
            "level": "优秀/良好/可用/需优化",
            "blocking": [...],   // items that PREVENT publishing
            "warnings": [...],   // items that reduce quality
            "manual": [...],     // items for human review
            "passed": [...],     // items that passed
            "items": [...]       // full detail (backward compatible)
        }
    """
    if warnings is None:
        warnings = []

    fb_text = copy.get("facebookText", "")
    x_text = copy.get("xText", "")
    hashtags = copy.get("hashtags", [])
    fb_length = len(fb_text)
    x_length = len(x_text)

    score = 100
    blocking = []
    warning_items = []
    manual_items = []
    passed = []

    # ---- Check discount consistency ----
    discount = form.get("discount", "")
    discount_code = form.get("discountCode", "")
    cta = form.get("cta", "")

    discount_ok = not discount or discount.lower() in fb_text.lower()
    code_ok = not discount_code or discount_code.lower() in fb_text.lower()
    cta_ok = cta.upper() in fb_text.upper() or "http" in fb_text.lower()
    diverse = len(warnings) == 0

    # ---- Deductions & Tier Classification ----

    # 1. Copy length
    if fb_length < 80 or fb_length > 1200:
        score -= 8
        warning_items.append({
            "label": "文案长度异常",
            "value": f"{fb_length} 字符（建议 80-1200）",
            "status": "warning",
            "tier": "warning",
        })
    else:
        passed.append({"label": "文案长度适中", "value": f"{fb_length} 字符", "status": "ok", "tier": "passed"})

    # 2. X char limit — BLOCKING if exceeded
    if x_length > 280:
        score -= 18
        blocking.append({
            "label": "X 字数超限",
            "value": f"{x_length}/280",
            "status": "blocking",
            "tier": "blocking",
            "fix": "请将 x_text 缩减至 280 字符以内",
        })
    elif x_length > 260:
        score -= 3
        warning_items.append({
            "label": "X 字数接近上限",
            "value": f"{x_length}/280",
            "status": "warning",
            "tier": "warning",
        })
    else:
        passed.append({"label": "X 字数限制", "value": f"{x_length}/280", "status": "ok", "tier": "passed"})

    # 3. Discount consistency
    if not discount_ok and discount:
        score -= 12
        warning_items.append({
            "label": "优惠信息不一致",
            "value": f"已选「{discount}」但文案中未体现",
            "status": "warning",
            "tier": "warning",
        })
    elif discount:
        passed.append({"label": "优惠信息一致", "value": discount, "status": "ok", "tier": "passed"})
    else:
        passed.append({"label": "优惠信息", "value": "无优惠活动", "status": "ok", "tier": "passed"})

    # 4. Discount code consistency
    if not code_ok and discount_code:
        score -= 12
        warning_items.append({
            "label": "优惠码未提及",
            "value": f"折扣码「{discount_code}」未出现在文案中",
            "status": "warning",
            "tier": "warning",
        })
    elif discount_code:
        passed.append({"label": "优惠码正确", "value": discount_code, "status": "ok", "tier": "passed"})
    else:
        passed.append({"label": "优惠码", "value": "未设置", "status": "ok", "tier": "passed"})

    # 5. CTA
    if not cta_ok:
        score -= 8
        manual_items.append({
            "label": "CTA 缺失",
            "value": "文案中未找到 CTA 或购买链接",
            "status": "manual",
            "tier": "manual",
        })
    else:
        passed.append({"label": "包含 CTA", "value": cta, "status": "ok", "tier": "passed"})

    # 6. Image diversity / similarity
    if not diverse:
        score -= min(15, len(warnings) * 5)
        manual_items.append({
            "label": "图片多样性",
            "value": f"{len(warnings)} 条相似度警告",
            "status": "manual",
            "tier": "manual",
        })
    else:
        passed.append({"label": "图片多样性", "value": "高", "status": "ok", "tier": "passed"})

    # 7. Hashtag count
    if len(hashtags) < 3 or len(hashtags) > 8:
        score -= 5
        warning_items.append({
            "label": "标签数量",
            "value": f"{len(hashtags)} 个（建议 3-8）",
            "status": "warning",
            "tier": "warning",
        })
    else:
        passed.append({"label": "标签数量", "value": f"{len(hashtags)} 个", "status": "ok", "tier": "passed"})

    # 8. Campaign match — manual check
    event_phase = event.get("phase", "常规") if event else "常规"
    if event and event_phase != "常规":
        manual_items.append({
            "label": "活动匹配",
            "value": f"{event.get('name', '')} · {event_phase}",
            "status": "manual",
            "tier": "manual",
            "note": "请人工确认文案风格与活动阶段匹配",
        })
    else:
        passed.append({"label": "节日匹配", "value": "常规", "status": "ok", "tier": "passed"})

    # ---- Score clamping ----
    score = max(0, min(100, score))

    # ---- Level ----
    if len(blocking) > 0:
        level = "阻止发布"
    elif score >= 90:
        level = "优秀"
    elif score >= 80:
        level = "良好"
    elif score >= 70:
        level = "可用"
    else:
        level = "需优化"

    # ---- Backward-compatible items list ----
    items = []
    items.extend(blocking)
    items.extend(warning_items)
    items.extend(manual_items)
    items.extend(passed)

    return {
        "score": score,
        "level": level,
        "blocking": blocking,
        "warnings": warning_items,
        "manual": manual_items,
        "passed": passed,
        "items": items,
        "hasBlocking": len(blocking) > 0,
        "hasWarnings": len(warning_items) > 0,
        "hasManual": len(manual_items) > 0,
    }
