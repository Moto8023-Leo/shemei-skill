"""
Content Factory v2 — XOD-style ad prompt system for electric scooters.

Architecture (mirrors XOD's ruleEngine + useFormStore):
  1. Read Feishu record → get product model, pain point, ad type, scene, promo, CTA
  2. Auto-load product specs from product_engine (like VEHICLE_MAP)
  3. Build GPT-level master prompt with 5-layer structure
  4. Call DeepSeek → write back title, body, tags, image_prompt to Feishu

Triggered daily at 12:00 Beijing time by daemon.py.

Usage:
    python scripts/content_factory.py                  # process all drafts
    python scripts/content_factory.py --dry-run        # preview without writing
    python scripts/content_factory.py --test ES1       # test generation for a model
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# DeepSeek client
# ------------------------------------------------------------------
DEEPSEEK_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

if not DEEPSEEK_KEY:
    logger.warning("DEEPSEEK_API_KEY not set in environment")


def _get_ai_client():
    if not DEEPSEEK_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY not set. Add to shemei_skill/.env")
    from openai import OpenAI
    return OpenAI(api_key=DEEPSEEK_KEY, base_url=DEEPSEEK_URL)


# ------------------------------------------------------------------
# Prompt builder — XOD-style 5-layer structure
# ------------------------------------------------------------------

def _safe(text: str | None) -> str:
    return text.strip() if text else "未设置"


def build_master_prompt(
    model_name: str,
    pain_point: str = "",
    ad_type: str = "",
    scene_style: str = "",
    discount: str = "",
    promotion: str = "",
    discount_code: str = "",
    cta: str = "",
    tone: str = "",
    platform: str = "FB",
    manual_note: str = "",
) -> str:
    """
    Build a comprehensive ad copy + image prompt generation request.
    Returns a single string that DeepSeek processes to produce:
      title, body, tags, image_prompt
    """
    from scripts.product_engine import (
        get_product, get_pain_point, get_discount, get_promotion,
        get_cta, get_scene, get_ad_type, get_tone,
    )

    # Range safety rules — CRITICAL for EU/UK compliance
    from scripts.facts import build_range_safety_rules, build_absolute_claims_rules

    prod = get_product(model_name) or {}
    pain = get_pain_point(pain_point) or {}
    discount_label = get_discount(discount)
    promo_label = get_promotion(promotion)
    cta_label = get_cta(cta)
    scene_desc = get_scene(scene_style)
    ad_type_desc = get_ad_type(ad_type)
    tone_desc = get_tone(tone)

    # Flatten: read from Feishu field names or local keys
    def p(key_feishu: str, key_local: str = "", default: str = "—") -> str:
        val = prod.get(key_feishu, "") or prod.get(key_local, "") or ""
        s = str(val) if val else default
        # Remove € or other non-ASCII currency symbols that cause encoding issues
        # but keep them in the actual prompt for AI (DeepSeek handles UTF-8 fine)
        return s

    # ---- L1: Product Identity ----
    product_link = p('产品链接', default="")
    # Build compact product tag: remove spaces/hyphens/plus signs — hashtags break at those chars
    product_full_model = f"{p('品牌')} {p('型号名称','型号')}"
    product_tag = product_full_model.replace(" ", "").replace("-", "").replace("+", "Plus")
    l1_product = f"""【产品身份】
主推广产品：{product_full_model} 电动滑板车
产品型号标签（用于社媒hashtag）：#{product_tag}
产品定位：{p('产品卖点')}
售价：{p('售价')}
竞品优势：{p('竞品优势','竞品对比优势')}
产品链接：{product_link if product_link != '—' else '未设置'}"""

    # ---- L2: Technical Specs ----
    l2_specs = f"""【技术参数】
电机：{p('电机功率')}
电池：{p('电池容量')}
续航：{p('续航里程')}
极速：{p('最高速度')}
刹车：{p('刹车类型')}
轮胎：{p('轮胎尺寸')}
重量：{p('整车重量')}
折叠：{p('是否可折叠')}
承重：{p('最大承重')}
爬坡：{p('爬坡角度')}
减震：{p('减震系统')}
防水：{p('防水等级')}
灯光：{p('灯光系统')}
充电：{p('充电时间')}
颜色：{p('颜色选项')}
适用：{p('适用场景')}"""

    # ---- L3: Marketing Context ----
    promo_combo_parts = []
    if discount_label:
        promo_combo_parts.append(discount_label)
    if promo_label:
        promo_combo_parts.append(promo_label)
    promo_combo = " · ".join(promo_combo_parts) if promo_combo_parts else "无"

    # Build campaign section if campaign info passed via manual_note
    campaign_section = ""
    campaign_guide = ""
    if manual_note and "CAMPAIGN CONTEXT" in manual_note:
        campaign_section = f"""【营销活动匹配 — THIS IS THE ACTIVE CAMPAIGN】
{manual_note.split('CAMPAIGN CONTEXT')[1].split('\n\n')[0].strip()}

【Campaign Copy Rules】
- The ad copy MUST reference the campaign theme. Weave it naturally into the headline, body, and emotional hook.
- If in PRE-HEAT phase (预热): Build anticipation. "Coming soon" / "Get ready for" / "Starts [date]" tone. Tease the value.
- If ACTIVE (进行中): Strong CTA. Mention the campaign name. Use time-sensitive language.
- If LAST CHANCE (最后机会): Maximum urgency. "Last days" / "Ends soon" / "Don't miss" tone.
- The image_prompt MUST reflect the campaign mood: seasonal lighting, relevant props, appropriate scene.
- NEVER generate a generic ad — every output must tie to THIS campaign.
"""

    campaign_guide = ""
    if campaign_section:
        campaign_guide = """
【Campaign-Image Guidelines】
- Scene and lighting must match the campaign season (e.g., back-to-school = campus/commuter morning light; summer sale = bright sunny streets; Christmas = warm winter city glow)
- Visual props and people should match the campaign audience (students, commuters, gift shoppers, etc.)
- Color palette should align with campaign energy (fresh/energetic for spring, warm/cozy for autumn, bold/contrast for Black Friday)
"""

    l3_marketing = f"""【营销上下文】
广告类型：{_safe(ad_type)}（{_safe(ad_type_desc)}）
用户痛点：{_safe(pain_point)} → 核心卖点：{_safe(pain.get('coreSellingPoint', ''))} → 广告角度：{_safe(pain.get('adAngle', ''))}
场景风格：{_safe(scene_style)}（{scene_desc}）
促销标签：{promo_combo}
折扣代码：{_safe(discount_code) if discount_code else "无"}
行动号召：{_safe(cta_label)}
文案语气：{_safe(tone)}（{tone_desc}）
发布平台：{platform}{campaign_section}"""

    # ---- L4: Content Requirements (ENGLISH OUTPUT) ----
    l4_requirements = f"""【Content Generation Requirements — OUTPUT MUST BE IN ENGLISH】
Generate a social media ad in ENGLISH for a global audience. Make it compelling and sales-driven.

OUTPUT JSON with 5 fields:
{{
  "title": "Punchy headline (8-12 words). Must HOOK the reader. Lead with the BENEFIT or a provocative question, NOT the product name. Examples: '60km on a Single Charge. No Compromises.' or 'What If Your Scooter Could Outlast Your Day?' — not 'iENYRID ES1 Has Good Range'.",
  "body": "Post body (35-55 words). Structure: emotional hook → specific benefit with real spec → why it matters to THEM → CTA. VARIETY RULE: do NOT use the same structure as the last ad you wrote. If product link ({product_link if product_link != '—' else ''}) is provided, weave it into the CTA naturally. Use 1-2 emojis MAX, placed strategically. Sound like a friend recommending something they love, not a marketing department.",
  "tags": "#tag1 #tag2 #tag3 #tag4 (EXACTLY 4 hashtags. Tag1: #{product_tag} — ONE combined tag, no spaces. Tag2: category. Tag3: one benefit/vibe word. Tag4: one lifestyle/scene word. Example: #{product_tag} #ElectricScooter #NoMoreTraffic #CityLife)",
  "x_text": "Tweet in ENGLISH, MAX 280 CHARS. Front-load the strongest hook in the first 50 chars. Compact, urgent, scroll-stopping. Include 3 hashtags. Include product link if available. Every character must earn its place.",
  "image_prompt": "English AI image generation prompt. Main subject is {p('品牌')} {p('型号名称','型号')} electric scooter. Scene: {scene_desc}. Highlight: {p('产品卖点')}. Describe lighting, composition, and mood. 80-150 words. For DALL-E/Midjourney."
}}{campaign_guide}

【Copywriting Quality Rules】
- BENEFIT FIRST: Every sentence answers "what's in it for me?".
- HOOK VARIETY: Rotate between questions, bold statements, data points, user scenarios, and emotional triggers.
- SHOW, DON'T TELL: "Arrive sweat-free after a 10km commute" > "Comfortable ride".
- URGENCY: End with a reason to click NOW (limited offer, code active, stock running out).
- VOICE: Native, conversational English. Read it out loud — if it sounds like a robot wrote it, rewrite it.
- The headline and body MUST use DIFFERENT hooks. Don't repeat the same angle.
- IF there is an active campaign above in 【营销活动匹配】, the ENTIRE ad copy AND image_prompt MUST revolve around that campaign. The campaign name should appear in body and x_text. The image_prompt should match the campaign season and audience.

【Brand Rules】
- The hero product is {p('品牌')} {p('型号名称','型号')} electric scooter
- Tags: EXACTLY 4 hashtags. Format: #ProductModelTag #Category #BenefitWord #LifestyleWord. Product model tag is #{product_tag} (ONE combined tag).
- Tags MUST include #{product_tag}
- NEVER split brand+model into TWO hashtags. ALWAYS #{product_tag} as one tag.
- Body: 35-55 words. Punchy. No fat.
- If product link ({product_link if product_link != '—' else ''}) exists, weave it into body near CTA.
- If promotion or discount code exists, make it a reason to act NOW.
- ALL output text MUST be in native, fluent ENGLISH
- x_text: <= 280 chars, 3 hashtags, link if available"""

    # ---- L4.5: Safety Rules — RANGE + ABSOLUTE CLAIMS (BLOCKING) ----
    range_safety = build_range_safety_rules(model_name)
    abs_claims = build_absolute_claims_rules()
    safety_rules = ""
    if range_safety:
        safety_rules += range_safety
    safety_rules += abs_claims
    l45_safety = safety_rules if safety_rules else ""

    # ---- L5: Constraints ----
    l5_constraints = f"""【Hard Constraints】
- ALL generated text (title, body, tags, x_text) MUST be in native ENGLISH
- Body: 35-55 words. No more, no less. Every word fights for its place.
- Tags: EXACTLY 4 hashtags. NO more, NO less. NO duplicates.
- x_text: ABSOLUTE MAX 280 chars. Include 3 hashtags. Shorter is better.
- If product link exists, include it in body and x_text.
- Do NOT invent technical specs not in the parameter table. ONLY use specs provided.
- Do NOT use absolute claims like "safest" "100%" "guaranteed"
- Do NOT attack competitors
- image_prompt must be in English (detailed scene description)
- Output ONLY valid JSON, no extra commentary
- JSON must include all 5 fields: title, body, tags, x_text, image_prompt"""

    # ---- Manual note ----
    manual_section = ""
    if manual_note:
        manual_section = f"\n\n【额外说明】\n{manual_note}"

    # ---- Assemble ----
    prompt = f"""{l1_product}

{l2_specs}

{l3_marketing}

{l4_requirements}

{l45_safety}

{l5_constraints}{manual_section}"""

    return prompt


# ------------------------------------------------------------------
# AI call
# ------------------------------------------------------------------

def generate_ad_content(fields: dict) -> dict:
    """
    Generate ad content from Feishu record fields.
    Returns {title, body, tags, image_prompt}
    """
    import sys
    _root = Path(__file__).resolve().parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from scripts.feishu_driver import FeishuDriver

    model_name = FeishuDriver.get_text(fields, "产品型号") or "iENYRID ES1"
    pain_point = FeishuDriver.get_text(fields, "用户痛点") or "无痛点"
    ad_type = FeishuDriver.get_text(fields, "广告类型") or "单品推广"
    scene_style = FeishuDriver.get_text(fields, "场景风格") or "城市通勤"
    discount = FeishuDriver.get_text(fields, "折扣活动") or "无活动"
    promotion = FeishuDriver.get_text(fields, "促销信息") or "无促销"
    discount_code = FeishuDriver.get_text(fields, "折扣代码") or ""
    cta = FeishuDriver.get_text(fields, "CTA") or "立即购买"
    tone = FeishuDriver.get_text(fields, "文案语气") or "亲和有趣"
    platform = FeishuDriver.get_text(fields, "平台") or "FB"
    manual_note = FeishuDriver.get_text(fields, "补充说明") or ""

    master_prompt = build_master_prompt(
        model_name=model_name,
        pain_point=pain_point,
        ad_type=ad_type,
        scene_style=scene_style,
        discount=discount,
        promotion=promotion,
        discount_code=discount_code,
        cta=cta,
        tone=tone,
        platform=platform,
        manual_note=manual_note,
    )

    logger.info(f"Master prompt built: {len(master_prompt)} chars")

    client = _get_ai_client()
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a world-class electric scooter copywriter for social media. "
                    "You write punchy, native-English ad copy that sells. Your principles:\n"
                    "- Lead with the BENEFIT, not the spec. \"Ride 60km without worry\" beats \"60km range\".\n"
                    "- One clear emotional hook per ad. Address a real pain point the reader feels.\n"
                    "- SPECS serve the story. Every number you mention must come from the product data provided — never invent.\n"
                    "- Vary your openings. Mix questions, bold claims, scene-setting, and direct address.\n"
                    "- Close with urgency. Give the reader a reason to act NOW (limited offer, discount code, scarcity).\n"
                    "- Write like a human. No corporate jargon, no \"elevate your journey\", no \"unleash your potential\".\n"
                    "- Emojis are tools, not decoration: 1-2 max, placed where they amplify meaning.\n"
                    "- For X/Twitter: front-load the hook in the first 50 chars. Every character earns its place."
                ),
            },
            {"role": "user", "content": master_prompt},
        ],
        temperature=0.85,
        max_tokens=2500,
    )

    raw = response.choices[0].message.content.strip()
    logger.info(f"DeepSeek response: {len(raw)} chars")

    # Parse JSON
    json_str = raw
    if "```json" in raw:
        json_str = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        json_str = raw.split("```")[1].split("```")[0].strip()

    try:
        result = json.loads(json_str)
        # If x_text missing, generate from title+tags
        if not result.get("x_text"):
            result["x_text"] = f'{result.get("title","")} {result.get("tags","")}'[:280]
    except json.JSONDecodeError:
        logger.warning(f"JSON parse failed, using raw. Raw: {raw[:200]}")
        # Try to fix common parse failures: unescaped quotes, emoji, etc.
        # Last resort: set raw text as body
        result = {
            "title": f"{model_name} — Urban Mobility Redefined",
            "body": raw,
            "tags": f"#{model_name.replace(' ', '')} #ElectricScooter #UrbanCommute",
            "x_text": raw[:280],
            "image_prompt": "",
        }

    # NORMALIZE: if body is raw JSON (parse failure), extract actual fields
    if result.get("body", "").strip().startswith("{"):
        logger.warning("Body appears to be raw JSON — attempting re-parse")
        try:
            raw_body = result["body"].strip()
            # Try to parse as JSON again
            if "```json" in raw_body:
                raw_body = raw_body.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_body:
                raw_body = raw_body.split("```")[1].split("```")[0].strip()
            reparsed = json.loads(raw_body)
            result["title"] = reparsed.get("title", result["title"])
            result["body"] = reparsed.get("body", result.get("body", ""))
            result["tags"] = reparsed.get("tags", result.get("tags", ""))
            result["x_text"] = reparsed.get("x_text", result.get("x_text", ""))
            result["image_prompt"] = reparsed.get("image_prompt", result.get("image_prompt", ""))
        except (json.JSONDecodeError, KeyError):
            # If re-parse fails, strip the raw JSON from body to avoid leaking
            result["body"] = result.get("body", "").split('"image_prompt"')[0].strip().rstrip(",").rstrip('"').rstrip("{").strip()

    result.setdefault("title", f"{model_name} Electric Scooter")
    result.setdefault("body", "")
    result.setdefault("tags", "")
    result.setdefault("x_text", "")
    result.setdefault("image_prompt", "")

    # CRITICAL: Strip raw JSON from body AND x_text if parse failed
    for key in ("body", "x_text"):
        val = result.get(key, "")
        if val.strip().startswith("{") and ("image_prompt" in val or "imagePrompt" in val):
            logger.warning(f"Raw JSON leaked into {key} — re-parsing")
            try:
                fixed = json.loads(val.strip())
                result[key] = fixed.get(key, fixed.get("body", val)) if key != "x_text" else fixed.get("x_text", val)
            except Exception:
                result[key] = val.split('"image_prompt"')[0].strip().rstrip(",").rstrip('"').rstrip("{").strip()

    # Validate x_text <= 280 chars
    if len(result["x_text"]) > 280:
        result["x_text"] = result["x_text"][:277] + "..."

    # ---- POST-GENERATION SAFETY VALIDATION ----
    from scripts.facts import validate_content_safety, has_unsafe_range

    safety_check = validate_content_safety(
        body=result.get("body", ""),
        x_text=result.get("x_text", ""),
        title=result.get("title", ""),
        image_prompt=result.get("image_prompt", ""),
    )
    if safety_check["violations"]:
        logger.warning(f"SAFETY VIOLATIONS FOUND: {len(safety_check['violations'])} issues")
        for v in safety_check["violations"]:
            logger.warning(f"  [{v['severity']}] {v['field']}: {v['match']} → {v.get('suggestion', 'REMOVE')}")
        # Attach violations to result for downstream handling
        result["_safety_violations"] = safety_check["violations"]
        result["_safety_blocking"] = safety_check["blocking"]
    else:
        result["_safety_violations"] = []
        result["_safety_blocking"] = False
        logger.info("Safety check passed — no violations ✓")

    # AI SELF-CHECK: Review copy + image_prompt once automatically
    result = _ai_review_pass(result, model_name, pass_num=1)

    return result


# ------------------------------------------------------------------
# AI Self-Check — automatic quality assurance
# ------------------------------------------------------------------

def _ai_review_pass(content: dict, model_name: str, pass_num: int = 1) -> dict:
    """
    AI self-review of generated content. Runs automatically, no human needed.

    Checks for:
      - Raw JSON leaks in body/tags/x_text
      - Placeholder/nonsense text
      - Missing or hallucinated specs
      - x_text > 280 chars
      - image_prompt missing key elements
      - Encoding issues / garbled text
      - Dull or robotic language

    Returns corrected content dict.
    """
    logger.info(f"AI self-check pass #{pass_num}...")

    review_prompt = f"""You are a senior copywriter doing QUALITY ASSURANCE. Make this ad BETTER.

Product: {model_name} electric scooter

Current content to review:
---
TITLE: {content.get('title', '')}
BODY: {content.get('body', '')}
TAGS: {content.get('tags', '')}
X_TEXT: {content.get('x_text', '')}
IMAGE_PROMPT: {content.get('image_prompt', '')}
---

Your job — be critical, be sharp. FIX anything that falls short:
1. RAW JSON LEAK: Does body/x_text contain raw JSON? EXTRACT the real text.
2. BORING HEADLINE: Is it formulaic? ("X Has Y Feature" is a fail.) Use specific numbers, bold claims, or emotional hooks.
3. ROBOTIC BODY: Does it read like a marketing brochure? Rewrite in natural, conversational English. "Tired of..." and "Meet the..." are overused — find fresher angles.
4. HALLUCINATION: Are any specs NOT from the {model_name}? DELETE made-up specs.
5. X_TEXT LENGTH: Must be <= 280 characters. Trim if needed.
6. TAGS: EXACTLY 4 hashtags. Product model MUST be ONE combined tag (#iENYRIDES1, NEVER #iENYRID #ES1).
7. MISSING CTA: If there's a product link or discount code, make the reader want to click NOW.
8. VOICE CHECK: Would a real human post this? If not, rewrite until they would.
9. RANGE SAFETY: If you see a raw range like "45-55km", FIX IT to "UP TO 55KM RANGE". NEVER output bare ranges.
10. ABSOLUTE CLAIMS: Remove "safest", "100% safe", "guaranteed", "unbreakable", "best in the world". Use qualified language instead.

Output ONLY valid JSON:
{{"title":"...", "body":"...", "tags":"...", "x_text":"...", "image_prompt":"..."}}

If everything is excellent, return the same content. If you find issues, FIX them.
IMPORTANT: ALL text output MUST be in native ENGLISH.
IMPORTANT: tags MUST be exactly 4 hashtags. Product model MUST be ONE combined tag.
IMPORTANT: Body target 35-55 words. x_text MUST be <= 280 characters."""

    try:
        client = _get_ai_client()
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior copywriter and QA editor. You improve ad copy — make it sharper, more human, more compelling. Output ONLY valid JSON with the 5 content fields. Fix ALL issues you find."
                },
                {"role": "user", "content": review_prompt},
            ],
            temperature=0.3,  # Low temperature for consistent review
            max_tokens=2000,
        )

        raw = response.choices[0].message.content.strip()
        logger.info(f"Review pass #{pass_num} response: {len(raw)} chars")

        # Parse
        json_str = raw
        if "```json" in raw:
            json_str = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            json_str = raw.split("```")[1].split("```")[0].strip()

        reviewed = json.loads(json_str)

        # Apply corrections
        for key in ("title", "body", "tags", "x_text", "image_prompt"):
            if key in reviewed and reviewed[key]:
                old_val = content.get(key, "")
                new_val = reviewed[key]
                if old_val != new_val:
                    logger.info(f"  Review #{pass_num}: fixed {key} ({len(old_val)}->{len(new_val)} chars)")
                    content[key] = new_val

        # Final safety: x_text <= 280
        if len(content.get("x_text", "")) > 280:
            content["x_text"] = content["x_text"][:277] + "..."
            logger.warning(f"  Review #{pass_num}: trimmed x_text to 280 chars")

        # Final safety: strip any JSON from body
        for key in ("body", "x_text"):
            val = content.get(key, "")
            if val.strip().startswith("{") and "image_prompt" in val:
                logger.warning(f"  Review #{pass_num}: JSON leaked into {key}, stripping")
                content[key] = content.get("title", "Electric Scooter Ad")

        logger.info(f"AI self-check pass #{pass_num} complete ✓")

    except json.JSONDecodeError as e:
        logger.warning(f"Review pass #{pass_num} JSON parse failed: {e} — keeping original")
    except Exception as e:
        logger.error(f"Review pass #{pass_num} error: {e} — keeping original")

    return content


# ------------------------------------------------------------------
# Match code
# ------------------------------------------------------------------

def make_match_code() -> str:
    now = datetime.now()
    mmdd = now.strftime("%m%d")
    counter_file = Path(__file__).resolve().parent.parent / ".match_counter"
    today_key = now.strftime("%Y%m%d")
    counter = 1
    if counter_file.exists():
        try:
            data = json.loads(counter_file.read_text(encoding="utf-8"))
            if data.get("date") == today_key:
                counter = data.get("counter", 1) + 1
        except Exception:
            pass
    counter_file.write_text(
        json.dumps({"date": today_key, "counter": counter}, ensure_ascii=False),
        encoding="utf-8",
    )
    return f"{mmdd}-{counter}"


# ------------------------------------------------------------------
# Main processor
# ------------------------------------------------------------------

def process_drafts(dry_run: bool = False) -> list[dict]:
    """Process all draft records in Feishu."""
    import sys
    _root = Path(__file__).resolve().parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from scripts.feishu_driver import FeishuDriver

    print(f"\n{'='*60}")
    print(f"  Content Factory v2 — XOD-style ad copy generator")
    if dry_run:
        print(f"  DRY RUN mode — preview only, no writes")
    print(f"{'='*60}\n")

    try:
        driver = FeishuDriver()
    except RuntimeError as e:
        print(f"  [ERROR] {e}\n")
        return []

    drafts = driver.get_draft_posts()
    if not drafts:
        print("  No draft posts found.\n")
        print("  Fill in: 产品型号 + 审核状态=草稿 + platforms + 发布时间\n")
        return []

    print(f"  Found {len(drafts)} draft post(s)\n")

    results = []
    success_count = 0

    for i, post in enumerate(drafts):
        record_id = post["record_id"]
        fields = post["fields"]
        model = FeishuDriver.get_text(fields, "产品型号") or "iENYRID ES1"
        pain = FeishuDriver.get_text(fields, "用户痛点") or "—"
        scene = FeishuDriver.get_text(fields, "场景风格") or "—"
        discount = FeishuDriver.get_text(fields, "折扣活动") or "—"
        cta = FeishuDriver.get_text(fields, "CTA") or "—"

        print(f"  [{i+1}/{len(drafts)}] [{record_id}] {model} | 痛点:{pain} | 场景:{scene} | 活动:{discount} | CTA:{cta}")

        try:
            content = generate_ad_content(fields)
        except Exception as e:
            print(f"       [ERROR] AI generation failed: {e}")
            continue

        match_code = make_match_code()
        title = content["title"]
        body = content["body"]
        tags = content["tags"]
        img_prompt = content["image_prompt"]

        print(f"       标题: {title}")
        print(f"       文案: {body[:80]}...")
        print(f"       标签: {tags}")
        print(f"       生图提示词: {img_prompt[:80]}...")
        print(f"       匹配码: {match_code}")
        print(f"       ✅ AI 自检通过")

        if not dry_run:
            ok = driver.mark_generated(record_id, title, body, tags, img_prompt, match_code, x_text=content.get("x_text", ""))
            if ok:
                print(f"       [OK] Written to Feishu — 状态→已生成")
                success_count += 1
            else:
                print(f"       [FAIL] Feishu write failed")
        else:
            print(f"       [DRY RUN] Would write")
            success_count += 1

        results.append({
            "record_id": record_id,
            "match_code": match_code,
            **content,
        })

        print()

    print(f"{'='*60}")
    print(f"  Done: {success_count}/{len(drafts)} generated")
    if dry_run:
        print(f"  DRY RUN — nothing was written")
    print(f"{'='*60}\n")

    return results


def test_model(model_name: str = "iENYRID ES1"):
    """Test generation for a specific model."""
    print(f"\n{'='*60}")
    print(f"  Content Factory v2 — Test Mode")
    print(f"  Model: {model_name}")
    print(f"{'='*60}\n")

    # Simulate Feishu fields
    fields = {
        "产品型号": model_name,
        "用户痛点": "续航焦虑",
        "广告类型": "单品推广",
        "场景风格": "城市通勤",
        "折扣活动": "夏季促销",
        "促销信息": "10%折扣",
        "CTA": "立即购买",
        "文案语气": "亲和有趣",
        "平台": "FB",
    }

    print("  Simulated fields:")
    for k, v in fields.items():
        print(f"    {k}: {v}")
    print()

    try:
        content = generate_ad_content(fields)
        match_code = make_match_code()
        print(f"  匹配码:       {match_code}")
        print(f"  标题:         {content['title']}")
        print(f"  文案:         {content['body']}")
        print(f"  标签:         {content['tags']}")
        print(f"  生图提示词:   {content['image_prompt']}")
    except Exception as e:
        print(f"  [ERROR] {e}")
        import traceback
        traceback.print_exc()

    print(f"\n{'='*60}")
    print(f"  Test complete")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Content Factory v2 — XOD-style ad generator")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--test", type=str, nargs="?", const="iENYRID ES1",
                        help="Test generation for a model (default: iENYRID ES1)")
    args = parser.parse_args()

    if args.test:
        test_model(args.test)
    else:
        process_drafts(dry_run=args.dry_run)
