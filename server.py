"""
FastAPI backend for Social Auto-Poster Web UI (multi-brand).
Serves API endpoints for the React frontend.
"""
import asyncio
import hashlib
import json
import logging
import os
import re as _re
import sys
import tempfile
import time as _time_module
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# Add project root to path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("server")

from scripts.brand_config import list_brands, resolve_tables, DEFAULT_BRAND
from scripts.studio_data import brands as studio_brands, countries as studio_countries, products as studio_products
from scripts.calendar_engine import get_campaign_events, resolve_campaign, calendar_disclaimer
from scripts.quality_engine import score_content
from scripts.visual_engine import select_visual_style

app = FastAPI(title="Social Auto-Poster API", version="3.0.0")

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    """Simple health check endpoint."""
    return {"ok": True, "mode": "demo" if not os.getenv("DEEPSEEK_API_KEY") else "live", "uptime": 0, "timestamp": datetime.now().isoformat()}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def _get_brand(req_brand: str = "") -> str:
    """Normalize brand param, fall back to DEFAULT_BRAND."""
    brand = (req_brand or "").strip()
    return brand if brand in list_brands() else DEFAULT_BRAND


def _get_product_table_id(brand: str) -> str:
    return resolve_tables(brand).get("product_table_id", "")


def _get_schedule_table_id(brand: str) -> str:
    return resolve_tables(brand).get("schedule_table_id", "")


def _get_product_for_overlay(model_name: str) -> dict:
    """Get product info for building overlay support text."""
    try:
        from scripts.product_engine import get_product
        return get_product(model_name) or {}
    except Exception:
        return {}


def _pick_campaign_pain_point(campaign: dict | None, fallback: str) -> str:
    """If a campaign is active, pick a pain point that matches the campaign theme."""
    if not campaign:
        return fallback
    name = campaign.get("name", "")
    phase = campaign.get("phase", "")
    # Back-to-school: portability + range + safety
    if "返校" in name:
        return "通勤续航与便携安全"
    # Summer sale: cost + value
    if "夏季" in name:
        return "性价比与出行自由"
    # Black Friday: discount urgency
    if "黑色" in name or "黑五" in name:
        return "限时优惠与超高性价比"
    # Christmas: gifting
    if "圣诞" in name:
        return "圣诞送礼与年末出行"
    # Spring: renewal + commuting
    if "春季" in name:
        return "春季通勤活力焕新"
    # Autumn: reliability
    if "秋季" in name:
        return "通勤可靠性与全天候适应性"
    return fallback


# ---------------------------------------------------------------
# Models
# ---------------------------------------------------------------

class GenerateRequest(BaseModel):
    model: str = "iENYRID ES1"
    pain_point: str = "续航焦虑"
    ad_type: str = "单品推广"
    scene_style: str = "城市通勤"
    discount: str = "无活动"
    promotion: str = "无促销"
    discount_code: str = ""
    cta: str = "立即购买"
    tone: str = "亲和有趣"
    platform: str = "FB"
    brand: str = "iENYRID"
    country: str = "GB"
    campaign_mode: str = "auto"
    manual_campaign: str = ""
    extra_requirements: str = ""
    creative_seed: str = ""
    style_locked: bool = False
    visual_dna: list[str] = []
    manual_campaign: str = ""
    extra_requirements: str = ""


class PublishRequest(BaseModel):
    text: str
    x_text: str = ""
    image_url: str = ""
    brand: str = "iENYRID"
    model_name: str = ""
    title: str = ""
    tags: str = ""
    body: str = ""
    image_prompt: str = ""
    pain_point: str = ""
    ad_type: str = ""
    scene_style: str = ""
    discount: str = ""
    promotion: str = ""
    discount_code: str = ""
    cta: str = ""
    tone: str = ""
    platform: str = ""
    match_code: str = ""


class FeishuWritebackRequest(BaseModel):
    model_name: str
    title: str
    body: str
    tags: str
    x_text: str
    image_prompt: str
    result_text: str
    brand: str = "iENYRID"


# ---------------------------------------------------------------
# API: Get available brands
# ---------------------------------------------------------------

@app.get("/api/brands")
def get_brands():
    """Return all available brand names."""
    return {"brands": list_brands(), "default": DEFAULT_BRAND}


# ---------------------------------------------------------------
# API: Get Models from Feishu
# ---------------------------------------------------------------

@app.get("/api/models")
def get_models(brand: str = ""):
    """Return all product models from the brand's product table."""
    try:
        from scripts.feishu_driver import FeishuDriver
        b = _get_brand(brand)
        p_table_id = _get_product_table_id(b)
        driver = FeishuDriver()
        saved = driver.table_id
        driver.table_id = p_table_id
        records = driver._get_all_records()
        driver.table_id = saved

        models = []
        for r in records:
            f = r.get("fields", {})
            if f.get("型号名称"):
                models.append({
                    "name": f.get("型号名称", ""),
                    "brand": f.get("品牌", ""),
                    "motor": f.get("电机功率", ""),
                    "battery": f.get("电池容量", ""),
                    "range": f.get("续航里程", ""),
                    "speed": f.get("最高速度", ""),
                    "weight": f.get("整车重量", ""),
                    "climb": f.get("爬坡角度", ""),
                    "price": f.get("售价", ""),
                    "selling_point": f.get("产品卖点", ""),
                    "advantage": f.get("竞品优势", ""),
                    "link": f.get("产品链接", ""),
                    "has_image": bool(f.get("产品图片")),
                })
        return {"models": models, "brand": b}
    except Exception as e:
        logger.error(f"get_models error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Generate Content
# ---------------------------------------------------------------

@app.post("/api/generate")
def generate_content(req: GenerateRequest):
    """Generate English ad copy via DeepSeek. Returns full GeneratedContent shape."""
    try:
        from scripts.content_factory import generate_ad_content
        from scripts.studio_data import lockedNegativePrompt, languageText
        from scripts.calendar_engine import resolve_campaign
        import time as _time, hashlib as _hashlib

        # ---- Request dedup: SHA-256 fingerprint, 5-min cache ----
        req_dict = req.model_dump()
        fingerprint = _hashlib.sha256(
            json.dumps(req_dict, sort_keys=True, ensure_ascii=False).encode()
        ).hexdigest()

        # In-memory cache: {fingerprint: (timestamp, result)}
        if not hasattr(generate_content, "_dedup_cache"):
            generate_content._dedup_cache = {}
        _cache = generate_content._dedup_cache
        _now = _time.time()

        # Clean expired entries
        _cache = {k: v for k, v in _cache.items() if _now - v[0] < 300}
        generate_content._dedup_cache = _cache

        if fingerprint in _cache:
            cached_time, cached_result = _cache[fingerprint]
            logger.info(f"Request dedup: fingerprint {fingerprint[:12]} matched (cached {_now - cached_time:.0f}s ago)")
            return cached_result

        # Resolve current campaign for context
        campaign = resolve_campaign(
            country_code=req.country or "GB",
            campaign_mode=req.campaign_mode or "auto",
            manual_campaign=req.manual_campaign or "",
        )

        # ---- Seeded visual style selection ----
        from scripts.visual_engine import select_visual_style
        visual_dna_cn = getattr(req, 'visual_dna', []) or ["城市通勤", "性能机械"]
        visual_style = select_visual_style(
            visual_dna=visual_dna_cn,
            scene_preference=req.scene_style or "受控随机",
            creative_seed=getattr(req, 'creative_seed', '') or f"{_time.time()}-{req.model}",
            style_locked=getattr(req, 'style_locked', False),
        )
        style_summary_text = visual_style.get("summary", f"Scene: {req.scene_style} | DNA: {'+'.join(visual_dna_cn)}")

        # Build campaign-aware context for the prompt
        campaign_note = ""
        if campaign:
            campaign_note = (
                f"[{campaign['phase']}] {campaign['name']}: {campaign['recommendation']}\n"
                f"Campaign period: {campaign.get('startDate','')} ~ {campaign.get('endDate','')}\n"
                f"Days until start: {campaign.get('daysUntil',0)}"
            )
            if campaign.get('daysUntil', 0) > 0 and campaign.get('daysUntil', 0) <= 14:
                campaign_note += "\n(Pre-heat phase — build anticipation, mention the upcoming campaign)"
            elif campaign.get('phase') == '最后机会':
                campaign_note += "\n(Last chance — create urgency, use countdown language)"

        fields = {
            "产品型号": req.model,
            "用户痛点": _pick_campaign_pain_point(campaign, req.pain_point),
            "广告类型": req.ad_type,
            "场景风格": req.scene_style,
            "折扣活动": campaign.get('name', '') if campaign else req.discount,
            "促销信息": req.promotion,
            "折扣代码": req.discount_code,
            "CTA": req.cta,
            "文案语气": req.tone,
            "平台": req.platform,
            "补充说明": f"CAMPAIGN CONTEXT (IMPORTANT):\n{campaign_note}\n\n{req.extra_requirements or ''}".strip(),
        }
        content = generate_ad_content(fields)

        # Build hashtags from tags string
        tags_raw = content.get("tags", "")
        hashtags = [t.strip() for t in tags_raw.split() if t.strip().startswith("#")]
        if not hashtags:
            hashtags = ["#iENYRID", "#ElectricScooter", "#UrbanMobility"]

        # Build overlay text — campaign-aware and AI-title-matched
        # Eyebrow: campaign name (or branded default)
        if campaign:
            eyebrow = campaign.get("name", "").replace(" 2026", "").upper()
        else:
            eyebrow = "URBAN MOBILITY"

        # Headline: use AI-generated title as overlay headline (shortened if needed)
        ai_title = content.get("title", "").strip()
        # Strip emojis for overlay (Canvas renders them poorly)
        import re as _re
        ai_title_clean = _re.sub(r'[^\x00-\x7F]+', '', ai_title).strip()
        # If title is too long for overlay, take first sentence
        if len(ai_title_clean) > 60:
            ai_title_clean = ai_title_clean[:57].rsplit(' ', 1)[0] + '...'
        headline = ai_title_clean or "GO FURTHER. WORRY LESS."

        # Support: product specs line — use real product data
        prod = _get_product_for_overlay(req.model)
        model_display = prod.get("型号名称", "") or prod.get("model", "") or req.model
        brand_name = prod.get("品牌", "") or "iENYRID"
        # Build a compact spec summary: 续航 · 电机 · 极速
        spec_parts = []
        if prod.get("续航里程"):
            spec_parts.append(prod["续航里程"])
        if prod.get("电机功率"):
            spec_parts.append(prod["电机功率"])
        if prod.get("最高速度"):
            spec_parts.append(prod["最高速度"])
        spec_line = " · ".join(spec_parts) if spec_parts else "Electric Scooter"
        support = f"{brand_name} {model_display} · {spec_line}"

        # Offer: campaign-aware — show discount or campaign tagline
        discount_label = (req.discount or "").strip()
        if campaign and campaign.get("phase") == "预热":
            offer = f"COMING SOON · {campaign.get('daysUntil', 0)} DAYS"
        elif discount_label:
            code = (req.discount_code or "").strip()
            offer = f"{discount_label}{' · Code ' + code if code else ''}"
        else:
            offer = campaign.get("name", "").replace(" 2026", "").upper() if campaign else "BUILT FOR EVERYDAY RIDES"

        # CTA
        cta_text = req.cta or "SHOP NOW"

        overlay = {
            "eyebrow": eyebrow,
            "headline": headline,
            "support": support,
            "offer": offer,
            "cta": cta_text,
        }

        # Create full texts for different platforms
        body_text = content.get("body", "")
        title_text = content.get("title", "")
        full_facebook = f"{title_text}\n\n{body_text}\n\n{tags_raw}"
        full_instagram = f"{title_text}\n\n{body_text}"
        full_x = content.get("x_text", "")[:280]

        # Quality scoring
        from scripts.quality_engine import score_content
        quality = score_content({
            "facebookText": full_facebook,
            "xText": full_x,
            "hashtags": hashtags,
        }, {
            "discount": req.discount or "",
            "discountCode": req.discount_code or "",
            "cta": req.cta or "",
        })

        # Task ID
        task_id = f"TASK-{datetime.now().strftime('%Y%m%d')}-{_hashlib.md5(str(datetime.now().timestamp()).encode()).hexdigest()[:6].upper()}"

        # ---- Save version snapshot ----
        try:
            from scripts.version_engine import make_version_snapshot, save_version
            snapshot = make_version_snapshot(
                task_id=task_id,
                title=title_text,
                body=body_text,
                tags=tags_raw,
                x_text=full_x,
                image_prompt=content.get("image_prompt", ""),
                quality_score=quality["score"],
                quality_level=quality["level"],
                platform=req.platform or "FB",
                campaign=campaign.get("name", "") if campaign else "",
                style_summary=style_summary_text,
                reason="content_generation",
            )
            save_version(task_id, snapshot, sync_to_feishu=False)
        except Exception as e:
            logger.warning(f"Version snapshot save failed: {e}")

        # ---- Content similarity check ----
        similarity_result = {"riskScore": 0, "riskLevel": "none", "summary": "", "dimensions": {}, "suggestions": []}
        try:
            from scripts.similarity_engine import check_similarity, save_to_history
            similarity_result = check_similarity(
                title=title_text,
                body=body_text,
                tags=tags_raw,
                image_prompt=content.get("image_prompt", ""),
            )
            # Save to history for future comparisons
            save_to_history({
                "taskId": task_id,
                "title": title_text,
                "body": body_text,
                "tags": tags_raw,
                "imagePrompt": content.get("image_prompt", ""),
            })
        except Exception as e:
            logger.warning(f"Similarity check failed: {e}")

        result = {
            "taskId": task_id,
            "title": title_text,
            "facebookText": full_facebook,
            "instagramText": full_instagram,
            "xText": full_x,
            "hashtags": hashtags,
            "imagePrompt": content.get("image_prompt", ""),
            "negativePrompt": lockedNegativePrompt,
            "overlay": overlay,
            "event": campaign,
            "styleSummary": style_summary_text,
            "quality": quality,
            "images": None,
            "createdAt": datetime.now().isoformat(),
            "mode": "demo" if not os.getenv("DEEPSEEK_API_KEY") else "live",
            # Safety validation results
            "safetyViolations": content.get("_safety_violations", []),
            "safetyBlocking": content.get("_safety_blocking", False),
            # Similarity check results
            "similarity": similarity_result,
        }

        # Cache for dedup (5 min)
        _cache[fingerprint] = (_now, result)
        generate_content._dedup_cache = _cache

        return result
    except Exception as e:
        logger.error(f"generate error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Publish to Facebook
# ---------------------------------------------------------------

@app.post("/api/publish/fb")
async def publish_fb(req: PublishRequest):
    """Publish to Facebook."""
    try:
        from scripts.fb_api import post_to_facebook
        img_path = _resolve_image(req)
        result = await post_to_facebook(text=req.text, image_path=img_path)
        _cleanup(img_path)
        return {"success": result.get("success"), "url": result.get("url"), "error": result.get("error")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------
# API: Publish to Instagram
# ---------------------------------------------------------------

@app.post("/api/publish/ig")
async def publish_ig(req: PublishRequest):
    """Publish to Instagram."""
    try:
        from scripts.ig_api import post_to_instagram
        img_path = _resolve_image(req)
        if not img_path:
            return {"success": False, "error": "IG requires an image — upload one or set product image in Feishu"}
        result = await post_to_instagram(caption=req.text, image_path=img_path)
        _cleanup(img_path)
        return {"success": result.get("success"), "url": result.get("url"), "error": result.get("error")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------
# API: Publish to X (Twitter)
# ---------------------------------------------------------------

@app.post("/api/publish/x")
async def publish_x(req: PublishRequest):
    """Publish to X via twikit API, fallback to Chrome if Cloudflare blocks."""
    try:
        x_text = req.x_text or req.text[:280]
        img_path = _resolve_image(req)

        # Try twikit API first (fast, no browser)
        from scripts.x_api import post_to_x as _x_api_post
        result = await _x_api_post(text=x_text, image_path=img_path)

        # Fallback to Playwright if Cloudflare blocks
        if not result.get("success"):
            logger.warning(f"x_api failed, falling back to x_chrome: {result.get('error','')[:80]}")
            from scripts.x_chrome import post_to_x as post_to_x_chrome
            import asyncio
            result = await asyncio.to_thread(
                lambda: asyncio.run(post_to_x_chrome(text=x_text, image_path=img_path))
            )

        _cleanup(img_path)
        return {"success": result.get("success"), "url": result.get("url"), "error": result.get("error")}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------
# API: Publish All (FB + IG + X) — unified engine, single Feishu writeback
# ---------------------------------------------------------------

@app.post("/api/publish/all")
async def publish_all(req: PublishRequest):
    """Publish to all three channels. Single summary writeback to Feishu."""
    from scripts.publish_engine import publish_single_record

    img_path = _resolve_image(req)

    result = await publish_single_record(
        record_id="web_" + str(int(__import__("time").time())),
        full_text=req.text,
        x_text=req.x_text or req.text[:280],
        platforms=["fb", "ig", "x"],
        image_path=img_path,
    )

    # Writeback to Feishu schedule table — complete fields (matching content_factory)
    summary = result.get("summary_urls", "")
    all_ok = result.get("all_ok", False)
    try:
        from scripts.brand_config import resolve_tables
        from scripts.feishu_driver import FeishuDriver
        import time as _time, json as _json
        b_tables = resolve_tables(req.brand)
        s_table_id = b_tables.get("schedule_table_id", "")
        if s_table_id:
            driver = FeishuDriver()
            saved = driver.table_id
            driver.table_id = s_table_id
            now_ms = int(_time.time() * 1000)
            # Generate match_code for manual web posts (MMDD-N format)
            from datetime import datetime as _dt
            match_code = req.match_code or ""
            if not match_code:
                mmdd = _dt.now().strftime("%m%d")
                counter_file = Path(__file__).resolve().parent / ".match_counter"
                today_key = _dt.now().strftime("%Y%m%d")
                counter = 1
                if counter_file.exists():
                    try:
                        data = _json.loads(counter_file.read_text(encoding="utf-8"))
                        if data.get("date") == today_key:
                            counter = data.get("counter", 1) + 1
                    except Exception:
                        pass
                counter_file.write_text(_json.dumps({"date": today_key, "counter": counter}, ensure_ascii=False), encoding="utf-8")
                match_code = f"{mmdd}-{counter}"
            fields = {
                "产品型号": req.model_name or "",
                "大标题": req.title or "",
                "文本": req.body or req.text or "",
                "标签": req.tags or "",
                "x_text": req.x_text or "",
                "生图提示词": req.image_prompt or "",
                "用户痛点": req.pain_point or "",
                "广告类型": req.ad_type or "",
                "场景风格": req.scene_style or "",
                "折扣活动": req.discount or "",
                "促销信息": req.promotion or "",
                "折扣代码": getattr(req, 'discount_code', '') or "",
                "CTA": req.cta or "",
                "文案语气": req.tone or "",
                "平台": req.platform or "",
                "匹配码": match_code,
                "审核状态": "已发布" if all_ok else "失败",
                "发布结果": summary,
                "发布时间": now_ms,
            }
            body = _json.dumps({"fields": fields}, ensure_ascii=False).encode("utf-8")
            import requests as _requests
            headers = driver._get_headers()
            base = driver._base_url
            url = f"{base}/apps/{driver.app_token}/tables/{s_table_id}/records"
            resp = _requests.post(url, headers=headers, data=body, timeout=15)
            data = resp.json()
            result["feishu_updated"] = data.get("code") == 0
            logger.info(f"Feishu writeback: {'OK' if result['feishu_updated'] else 'FAIL'} — {len(fields)} fields")

            # Upload image as attachment to the new record if available
            if result["feishu_updated"] and img_path:
                new_rid = data.get("data", {}).get("record", {}).get("record_id", "")
                if new_rid:
                    try:
                        driver.upload_attachment(new_rid, img_path, field_name="图片")
                        logger.info(f"Image attached to schedule record {new_rid[:16]}...")
                    except Exception as e:
                        logger.warning(f"Image attachment failed: {e}")

            driver.table_id = saved
    except Exception as e:
        logger.error(f"Feishu writeback error: {e}")
        result["feishu_updated"] = False

    _cleanup(img_path)

    response = {}
    for platform, r in result.get("results", {}).items():
        response[platform] = {
            "success": r.get("success", False),
            "url": r.get("url", ""),
            "error": r.get("error", ""),
        }
    response["summary"] = summary
    response["all_ok"] = all_ok
    return response


# ---------------------------------------------------------------
# API: Version History
# ---------------------------------------------------------------

@app.get("/api/versions/{task_id}")
def get_versions(task_id: str):
    """List all versions for a task."""
    try:
        from scripts.version_engine import list_versions, get_version_count
        versions = list_versions(task_id)
        return {
            "taskId": task_id,
            "count": len(versions),
            "versions": versions,
        }
    except Exception as e:
        logger.error(f"get_versions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/versions/{task_id}/compare")
def compare_versions(task_id: str, from_ver: int = 0, to_ver: int = 0):
    """Compare two versions for a task."""
    try:
        from scripts.version_engine import compare_versions
        if not from_ver or not to_ver:
            raise HTTPException(status_code=400, detail="from_ver and to_ver required")
        diff = compare_versions(task_id, from_ver, to_ver)
        return diff
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"compare_versions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/versions/{task_id}/restore")
def restore_version(task_id: str, version: int = 0):
    """Restore content to a historical version."""
    try:
        from scripts.version_engine import restore_version
        if not version:
            raise HTTPException(status_code=400, detail="version required")
        data = restore_version(task_id, version)
        if not data:
            raise HTTPException(status_code=404, detail=f"Version #{version} not found")
        return {"taskId": task_id, "restoredVersion": version, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"restore_version error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Drafts — auto-save + restore
# ---------------------------------------------------------------

# In-memory draft storage (server-side)
_drafts_store: dict[str, dict] = {}


@app.get("/api/drafts/{draft_key}")
def get_draft(draft_key: str):
    """Get a saved draft by key."""
    draft = _drafts_store.get(draft_key)
    if draft:
        return {"found": True, "data": draft, "savedAt": draft.get("_savedAt", "")}
    return {"found": False, "data": None}


@app.put("/api/drafts/{draft_key}")
def save_draft(draft_key: str, data: dict = None):
    """Save a draft to server-side storage."""
    try:
        from datetime import datetime
        if data is None:
            data = {}
        data["_savedAt"] = datetime.now().isoformat()
        _drafts_store[draft_key] = data
        # Persist to file
        try:
            draft_file = Path(__file__).resolve().parent / "storage" / "drafts" / f"{draft_key}.json"
            draft_file.parent.mkdir(parents=True, exist_ok=True)
            draft_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Draft file save failed: {e}")
        return {"ok": True}
    except Exception as e:
        logger.error(f"save_draft error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Writeback to Feishu
# ---------------------------------------------------------------

@app.post("/api/feishu/writeback")
def feishu_writeback(req: FeishuWritebackRequest):
    """Write results back to the brand's schedule table."""
    try:
        from scripts.feishu_driver import FeishuDriver
        import time, json as j
        import requests

        b = _get_brand(req.brand)
        s_table_id = _get_schedule_table_id(b)
        driver = FeishuDriver()
        headers = driver._get_headers()
        base = driver._base_url

        now_ms = int(time.time() * 1000)
        body = j.dumps({"fields": {
            "产品型号": req.model_name,
            "大标题": req.title,
            "文本": req.body,
            "标签": req.tags,
            "生图提示词": req.image_prompt,
            "审核状态": "已发布",
            "发布结果": req.result_text,
            "发布时间": now_ms,
            "平台": "FB+X+IG",
        }}, ensure_ascii=False).encode("utf-8")

        url = f"{base}/apps/{driver.app_token}/tables/{s_table_id}/records"
        resp = requests.post(url, headers=headers, data=body, timeout=15)
        data = resp.json()
        if data.get("code") == 0:
            return {"success": True, "record_id": data["data"]["record"]["record_id"]}
        else:
            return {"success": False, "error": str(data)}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------
# API: Get product image URL
# ---------------------------------------------------------------

@app.get("/api/product-image/{model_name}")
def get_product_image(model_name: str, brand: str = ""):
    """Get the Feishu attachment download URL for a model's product image."""
    try:
        from scripts.feishu_driver import FeishuDriver
        b = _get_brand(brand)
        p_table_id = _get_product_table_id(b)
        driver = FeishuDriver()
        saved = driver.table_id
        driver.table_id = p_table_id
        records = driver._get_all_records()
        driver.table_id = saved
        for r in records:
            f = r.get("fields", {})
            name = f.get("型号名称", "")
            if name == model_name or (name and model_name.endswith(name)) or (name and name in model_name):
                imgs = f.get("产品图片", [])
                if imgs:
                    return {"image_url": imgs[0].get("url", "")}
        return {"image_url": ""}
    except Exception as e:
        return {"image_url": "", "error": str(e)}


# ---------------------------------------------------------------
# API: Upload image to product table
# ---------------------------------------------------------------

@app.post("/api/upload-image")
async def upload_image(
    brand: str = Form("iENYRID"),
    model: str = Form(""),
    file: UploadFile = File(...),
):
    """Upload a product image to the brand's product table."""
    try:
        from scripts.feishu_driver import FeishuDriver
        b = _get_brand(brand)
        p_table_id = _get_product_table_id(b)
        driver = FeishuDriver()
        saved = driver.table_id
        driver.table_id = p_table_id

        # Find the record for this model
        records = driver._get_all_records()
        target_rid = None
        for r in records:
            f = r.get("fields", {})
            if f.get("型号名称") == model:
                target_rid = r.get("record_id", "")
                break

        if not target_rid:
            driver.table_id = saved
            return {"success": False, "error": f"Model '{model}' not found in product table"}

        # Save uploaded file to temp
        tmp_path = tempfile.mktemp(suffix=f"_{file.filename}")
        with open(tmp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        logger.info(f"Uploading {file.filename} ({len(content)} bytes) to {b} product table, record={target_rid}")

        # Upload to Feishu
        ok = driver.upload_attachment(target_rid, tmp_path, field_name="产品图片")
        driver.table_id = saved
        _cleanup(tmp_path)

        if ok:
            return {"success": True, "file_name": file.filename, "size": len(content)}
        else:
            return {"success": False, "error": "Feishu upload failed"}
    except Exception as e:
        logger.error(f"upload-image error: {e}")
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------

def _download_fs_image(image_url: str) -> Optional[str]:
    """Download image from Feishu URL to temp file. Returns path or None."""
    if not image_url:
        return None
    try:
        from scripts.feishu_driver import FeishuDriver
        driver = FeishuDriver()
        tmp = tempfile.mktemp(suffix=".png")
        ok = driver.download_attachment(image_url, tmp)
        return tmp if ok and os.path.getsize(tmp) > 0 else None
    except Exception:
        return None


def _get_product_image_url(model_name: str, brand: str) -> str:
    """Get the first product image URL from the product table for a given model."""
    try:
        from scripts.feishu_driver import FeishuDriver
        driver = FeishuDriver()
        p_table_id = _get_product_table_id(brand)
        saved = driver.table_id
        driver.table_id = p_table_id
        records = driver._get_all_records()
        driver.table_id = saved
        for r in records:
            f = r.get("fields", {})
            name = f.get("型号名称", "")
            # Match: exact, or model_name ends with/exists in the full model name
            if name == model_name or (name and model_name.endswith(name)) or (name and name in model_name):
                imgs = f.get("产品图片", [])
                if imgs and isinstance(imgs[0], dict):
                    return imgs[0].get("url", "") or imgs[0].get("tmp_url", "")
    except Exception:
        pass
    return ""


def _resolve_image(req: PublishRequest) -> Optional[str]:
    """Resolve image for a publish request: explicit URL → product table → None."""
    if req.image_url:
        img_path = _download_fs_image(req.image_url)
        if img_path:
            return img_path
    if req.model_name:
        img_url = _get_product_image_url(req.model_name, req.brand)
        if img_url:
            return _download_fs_image(img_url)
    return None


def _cleanup(path: Optional[str]):
    if path and os.path.exists(path):
        try:
            os.unlink(path)
        except Exception:
            pass


# ---------------------------------------------------------------
# API: Bootstrap (combined init data)
# ---------------------------------------------------------------

@app.get("/api/bootstrap")
def get_bootstrap(brand: str = ""):
    """Return all init data needed by the frontend in one call."""
    try:
        b = _get_brand(brand)
        country_code = "GB"  # Default for bootstrap

        # Get live products from Feishu
        models = []
        try:
            from scripts.feishu_driver import FeishuDriver
            p_table_id = _get_product_table_id(b)
            driver = FeishuDriver()
            saved = driver.table_id
            driver.table_id = p_table_id
            records = driver._get_all_records()
            driver.table_id = saved
            for r in records:
                f = r.get("fields", {})
                if f.get("型号名称"):
                    models.append({
                        "id": f"{b.lower()}-{f.get('型号名称','').replace(' ','-').lower()}",
                        "brandId": b.lower(),
                        "model": f.get("型号名称", ""),
                        "motor": f.get("电机功率", ""),
                        "battery": f.get("电池容量", ""),
                        "range": f.get("续航里程", ""),
                        "topSpeed": f.get("最高速度", ""),
                        "brakes": f.get("刹车系统", ""),
                        "tires": f.get("轮胎规格", ""),
                        "suspension": f.get("减震系统", ""),
                        "foldable": "折叠" in str(f.get("产品卖点", "")),
                        "maxLoad": f.get("整车重量", ""),
                        "price": f.get("售价", ""),
                        "currency": "EUR",
                        "sellingPoints": [f.get("产品卖点", "")] if f.get("产品卖点") else [],
                        "structureLock": "",
                        "url": f.get("产品链接", ""),
                        "hasImage": bool(f.get("产品图片")),
                    })
        except Exception:
            # Fallback to hardcoded products
            models = studio_products

        # Get service status
        demo_mode = not bool(os.getenv("DEEPSEEK_API_KEY"))
        service_status = {
            "deepseek": bool(os.getenv("DEEPSEEK_API_KEY")),
            "feishu": bool(os.getenv("FEISHU_APP_ID") and os.getenv("FEISHU_APP_SECRET")),
            "meta": bool(os.getenv("FB_PAGE_ID") and os.getenv("FB_ACCESS_TOKEN")),
        }
        runtime_mode = "demo" if demo_mode else "live"

        return {
            "mode": runtime_mode,
            "brands": studio_brands,
            "products": models or studio_products,
            "countries": studio_countries,
            "currentDate": datetime.now().strftime("%Y-%m-%d"),
            "events": get_campaign_events(country_code),
            "serviceStatus": service_status,
            "calendarDisclaimer": calendar_disclaimer(),
            "limits": {"maxUploadMb": 10},
        }
    except Exception as e:
        logger.error(f"bootstrap error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Calendar Events
# ---------------------------------------------------------------

@app.get("/api/events")
def get_events(country: str = "GB", date: str = ""):
    """Get marketing campaign events for a country. Supports optional date."""
    try:
        from datetime import date as date_type
        country_code = country.strip().upper()
        if not any(c["code"] == country_code for c in studio_countries):
            raise HTTPException(status_code=400, detail=f"Unsupported country code: {country_code}")
        now = date_type.today()
        if date:
            try:
                now = date_type.fromisoformat(date)
            except ValueError:
                pass
        return {"events": get_campaign_events(country_code, now)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"events error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Quality Score (on-demand evaluation)
# ---------------------------------------------------------------

class QualityRequest(BaseModel):
    facebookText: str = ""
    xText: str = ""
    hashtags: list = []
    discount: str = ""
    discountCode: str = ""
    cta: str = ""
    event: Optional[dict] = None
    warnings: list = []


@app.post("/api/quality/score")
def evaluate_quality(req: QualityRequest):
    """Score generated content on demand."""
    try:
        copy_data = {
            "facebookText": req.facebookText,
            "xText": req.xText,
            "hashtags": req.hashtags or [],
        }
        form_data = {
            "discount": req.discount,
            "discountCode": req.discountCode,
            "cta": req.cta,
        }
        return score_content(copy_data, form_data, req.event, req.warnings)
    except Exception as e:
        logger.error(f"quality score error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: Visual Style Pool
# ---------------------------------------------------------------

@app.get("/api/visual/style-pool")
def get_visual_pool(language: str = "zh"):
    """Get visual style dimension pools for the frontend."""
    try:
        from scripts.studio_data import visualPools, visualPoolsEn
        if language == "en":
            return {"pools": visualPoolsEn}
        return {"pools": visualPools}
    except Exception as e:
        logger.error(f"visual style-pool error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------
# API: History
# ---------------------------------------------------------------

@app.get("/api/history")
def get_history_list(brandId: str = "", productId: str = "", limit: int = 50, offset: int = 0):
    """Get paginated generation history."""
    try:
        from scripts.history_engine import get_history
        return get_history(
            brand_id=brandId or None,
            product_id=productId or None,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        logger.error(f"history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class HistorySaveRequest(BaseModel):
    taskId: str = ""
    brandId: str = ""
    productId: str = ""
    title: str = ""
    facebookText: str = ""
    styleSummary: str = ""
    createdAt: str = ""


@app.post("/api/history")
def save_history_entry(req: HistorySaveRequest):
    """Save a generation entry to history."""
    try:
        from scripts.history_engine import save_history
        save_history({
            "taskId": req.taskId,
            "brandId": req.brandId,
            "productId": req.productId,
            "title": req.title,
            "facebookText": req.facebookText,
            "styleSummary": req.styleSummary,
            "createdAt": req.createdAt,
        })
        return {"ok": True}
    except Exception as e:
        logger.error(f"history save error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _ts_to_ms(val):
    """Convert ISO timestamp string or int to millisecond timestamp."""
    if not val:
        return 0
    if isinstance(val, (int, float)):
        return int(val) if val > 1e12 else int(val * 1000)  # ms already or seconds
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


# ---------------------------------------------------------------
# API: Publish Records — read from Feishu schedule table + local history
# ---------------------------------------------------------------

@app.get("/api/publish-records")
def get_publish_records(brand: str = "", limit: int = 100):
    """Read publish history from Feishu schedule table + local history."""
    records = []
    b = _get_brand(brand)

    # 1) Try Feishu schedule table first
    try:
        s_table_id = _get_schedule_table_id(b)
        if s_table_id:
            from scripts.feishu_driver import FeishuDriver
            driver = FeishuDriver()
            saved = driver.table_id
            driver.table_id = s_table_id
            raw = driver._get_all_records()
            driver.table_id = saved
            for item in raw:
                f = item.get("fields", {})
                status = (f.get("审核状态") or f.get("状态") or "")
                if status and status not in ("已发布", "失败"):
                    continue
                records.append({
                    "record_id": item.get("record_id", ""),
                    "title": f.get("大标题", ""),
                    "platform": f.get("平台", ""),
                    "status": status or "待发布",
                    "url": f.get("发布结果", ""),
                    "model": f.get("产品型号", ""),
                    "schedule_time": f.get("发布时间", 0),
                    "brand": b,
                    "source": "feishu",
                })
    except Exception as e:
        logger.warning(f"Feishu publish-records read failed: {e}")

    # 2) Merge in local history entries (published from web UI)
    try:
        from scripts.history_engine import get_history
        hist = get_history(brand_id=b, limit=500)
        for entry in hist.get("entries", []):
            records.append({
                "record_id": entry.get("taskId", ""),
                "title": entry.get("title", ""),
                "platform": "FB+IG+X",
                "status": "已发布",
                "url": "",
                "model": entry.get("productId", ""),
                "schedule_time": _ts_to_ms(entry.get("createdAt", "")),
                "brand": b,
                "source": "web",
            })
    except Exception as e:
        logger.warning(f"History merge for publish-records failed: {e}")

    # Dedupe by record_id
    seen = set()
    deduped = []
    for r in sorted(records, key=lambda r: r.get("schedule_time", 0) or 0, reverse=True):
        rid = r.get("record_id", "")
        if rid and rid not in seen:
            seen.add(rid)
            deduped.append(r)
        elif not rid:
            deduped.append(r)

    return {"records": deduped[:limit], "total": len(deduped)}


# ---------------------------------------------------------------
# Creative Brief Workflow (Phase 1)
# ---------------------------------------------------------------

# In-memory stores (migrate to proper DB later)
_brief_tasks: dict[str, dict] = {}
_brief_content_jobs: dict[str, dict] = {}

CREATIVE_BRIEF_SYSTEM = """You are a senior overseas social media strategist for consumer mobility brands (electric scooters, e-bikes, personal EVs).
Your job is to transform an operator's natural-language idea into a structured Creative Brief.

Rules:
1. Preserve explicit facts. Never invent product specifications, compatibility claims, discounts, dates, or legal claims.
2. Separate facts from reasonable interpretations and note what's missing.
3. Avoid fear-based safety marketing, absolute safety claims, and exaggerated performance claims.
4. The brief is a SUGGESTION. It will NOT be applied until the operator confirms it.
5. When a critical fact is missing, add it to clarificationQuestions rather than guessing. ALL clarificationQuestions MUST be written in Chinese (中文).
6. Only write content for the specific brand mentioned in the context. Do NOT reference other brands, products, or part categories (e.g. do not mention hydraulic brakes unless the brand's product explicitly includes them).
7. If the operator doesn't mention a discount, do NOT invent one. Set offer.label to an empty string.
8. All hashtag suggestions must include the correct brand name (e.g. #iENYRID).
9. Return VALID JSON ONLY, matching the schema below. No markdown, no commentary.

Output JSON schema:
{
  "campaignTheme": "string — catchy campaign theme name in English",
  "market": { "country": "string — ISO country code", "language": "string — BCP-47 language tag" },
  "audience": ["string — target audience segments"],
  "painPoints": ["string — specific user pain points this addresses"],
  "productBenefits": ["string — which product features solve those pain points"],
  "messageAngle": "string — the angle/core message, 5-8 words max",
  "emotionalDirection": ["string — emotional tones to strike"],
  "tone": ["string — tone descriptors in English"],
  "visualDirection": "string — visual style description for image generation",
  "offer": { "label": "string — promotion text", "verified": false },
  "avoid": ["string — topics/phrases to avoid"],
  "clarificationQuestions": ["string — 需要用户澄清的问题，必须用中文撰写"]
}"""

CONTENT_GENERATION_SYSTEM = """You are a world-class social media copywriter specializing in electric scooters and personal mobility brands.

You receive a confirmed Creative Brief and must produce platform-native content for 4 channels.
Use only verified facts from the brief. Do NOT invent specs, prices, or compatibility claims.

BRAND-SPECIFIC RULES:
- Every hashtag MUST include the brand name (e.g. #iENYRID, not generic #ElectricScooter).
- Never mention other brands, products, or part categories not in the brief.
- If no discount/promo code was specified, do NOT include one.
- Use the actual product name and specs from the brief context.

Platform Rules:
- Facebook: primary text (35-55 words), headline (8-12 words), hashtags (3-5 tags, all brand-specific)
- Instagram: caption with hook, body, hashtags (3-5 tags, all brand-specific)
- X (Twitter): one post <=280 chars, 2-3 hashtags, all brand-specific
- Image Prompt: production-ready AI image prompt (80-150 words) + negative prompt

Tone must follow the brief. Respect avoidance rules. Do not repeat the same opening sentence across platforms.

Return VALID JSON ONLY:
{
  "facebook": { "title": "...", "body": "...", "footer": "..." },
  "instagram": { "title": "...", "body": "...", "footer": "..." },
  "x": { "title": "...", "body": "...", "footer": "..." },
  "image": { "title": "Image Prompt", "body": "...", "footer": "..." }
}"""


def _compute_confidence(brief: dict) -> dict:
    """Compute confidence from objective metrics instead of trusting AI self-report.

    Returns {"score": 0-100, "factors": {...}} so the UI can explain the number.
    """
    factors = {}
    score = 100

    # --- 1. Clarification questions: -15 each, max -45 ---
    q_count = len(brief.get("clarificationQuestions") or [])
    factors["clarificationQuestions"] = {"count": q_count, "penalty": min(q_count * 15, 45)}
    score -= factors["clarificationQuestions"]["penalty"]

    # --- 2. Key fields (cardinal): -10 to -15 each ---
    key_checks = {
        "campaignTheme":  (brief.get("campaignTheme", "").strip(), 15),
        "messageAngle":   (brief.get("messageAngle", "").strip(), 10),
        "visualDirection":(brief.get("visualDirection", "").strip(), 10),
    }
    key_labels_cn = {
        "campaignTheme": "活动主题",
        "messageAngle": "传播角度",
        "visualDirection": "视觉方向",
    }
    missing_keys = []
    for field, (val, penalty) in key_checks.items():
        if not val:
            score -= penalty
            missing_keys.append(key_labels_cn.get(field, field))
    factors["missingKeyFields"] = {"fields": missing_keys, "penalty": sum(key_checks[f][1] for f in missing_keys)}

    # --- 3. Lists (audience / painPoints / productBenefits): -5 to -10 each ---
    list_checks = {
        "audience":        (brief.get("audience") or [], 10),
        "painPoints":      (brief.get("painPoints") or [], 5),
        "productBenefits": (brief.get("productBenefits") or [], 5),
    }
    list_labels_cn = {
        "audience": "目标用户",
        "painPoints": "核心痛点",
        "productBenefits": "产品优势",
    }
    missing_lists = []
    for field, (vals, penalty) in list_checks.items():
        if not vals or len(vals) == 0:
            score -= penalty
            missing_lists.append(list_labels_cn.get(field, field))
    factors["missingLists"] = {"fields": missing_lists, "penalty": sum(list_checks[f][1] for f in missing_lists)}

    # --- 4. Market completeness ---
    market = brief.get("market") or {}
    market_labels_cn = {"country": "国家", "language": "语言"}
    market_missing = []
    if not (market.get("country") or "").strip():
        market_missing.append("国家")
    if not (market.get("language") or "").strip():
        market_missing.append("语言")
    market_penalty = len(market_missing) * 5
    if market_penalty:
        score -= market_penalty
    factors["market"] = {"missing": market_missing, "penalty": market_penalty}

    # --- 5. Offer unverified ---
    offer = brief.get("offer") or {}
    offer_label = (offer.get("label") or "").strip()
    offer_penalty = 5 if offer_label and not offer.get("verified") else 0
    if offer_penalty:
        score -= offer_penalty
    factors["offerUnverified"] = {"hasLabel": bool(offer_label), "penalty": offer_penalty}

    # --- 6. Bonus: avoid list present (+3), good audience segmentation (+2) ---
    avoid_bonus = 3 if len(brief.get("avoid") or []) >= 2 else 0
    audience_bonus = 2 if len(brief.get("audience") or []) >= 2 else 0
    factors["bonuses"] = {"avoidList": avoid_bonus, "audienceSegments": audience_bonus, "total": avoid_bonus + audience_bonus}
    score += avoid_bonus + audience_bonus

    score = max(15, min(100, score))
    factors["computedScore"] = score
    return factors


def _get_brief_ds_client():
    """Get DeepSeek client for Creative Brief pipeline."""
    DS_KEY = os.getenv("DEEPSEEK_API_KEY", "")
    if not DS_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY not set")
    from openai import OpenAI
    return OpenAI(api_key=DS_KEY, base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"))


def _parse_brief_json(text: str) -> dict:
    """Safely parse JSON from AI response, stripping markdown fences."""
    import re as _re
    text = text.strip()
    m = _re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, _re.DOTALL)
    if m:
        text = m.group(1).strip()
    text = text.strip('`').strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = _re.search(r'\{.*\}', text, _re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise ValueError(f"Could not parse JSON from response: {text[:200]}...")


def _build_creative_brief_prompt(idea: str, brand_id: str = "", product_id: str = "") -> str:
    brand_display = brand_id.replace("_", " ").title() if brand_id else "iENYRID"

    # Fetch real product specs from Feishu if a product ID is given
    product_context = ""
    if product_id:
        try:
            from scripts.feishu_driver import FeishuDriver
            from scripts.brand_config import resolve_tables, DEFAULT_BRAND
            b = brand_id or DEFAULT_BRAND
            tables = resolve_tables(b)
            driver = FeishuDriver()
            saved = driver.table_id
            driver.table_id = tables.get("product_table_id", "")
            records = driver._get_all_records()
            driver.table_id = saved
            # Find matching product by name or use the first one
            for r in records:
                f = r.get("fields", {})
                model_name = f.get("型号名称", "")
                if model_name and (product_id.lower() in model_name.lower() or model_name.lower() in product_id.lower()):
                    product_context = f"""Current product selected by operator:
- Model: {f.get('型号名称', '')}
- Motor: {f.get('电机功率', '')}
- Battery: {f.get('电池容量', '')}
- Range: {f.get('续航里程', '')}
- Top Speed: {f.get('最高速度', '')}
- Weight: {f.get('整车重量', '')}
- Climb: {f.get('爬坡角度', '')}
- Price: {f.get('售价', '')}
- Brakes: {f.get('刹车系统', '')}
- Tires: {f.get('轮胎规格', '')}
- Key Selling Points: {f.get('产品卖点', '')}
- Competitive Edge: {f.get('竞品优势', '')}
"""
                    break
            if not product_context and records:
                # Fallback: use first product
                f = records[0].get("fields", {})
                if f.get("型号名称"):
                    product_context = f"""Default product (use unless operator specifies otherwise):
- Model: {f.get('型号名称', '')}
- Motor: {f.get('电机功率', '')}
- Battery: {f.get('电池容量', '')}
- Range: {f.get('续航里程', '')}
- Key Selling Points: {f.get('产品卖点', '')}
- Price: {f.get('售价', '')}
"""
        except Exception as e:
            logger.warning(f"Could not fetch product specs from Feishu: {e}")

    # Fetch brand profile
    brand_context = ""
    try:
        from scripts.studio_data import brands as studio_brands
        for b in studio_brands:
            if b.get("id") == brand_id.lower():
                brand_context = f"""Brand profile:
- Name: {b.get('name', brand_display)}
- Tone: {b.get('tone', '')}
- Positioning: {', '.join(b.get('positioning', []))}
- Target Audiences: {', '.join(b.get('audiences', []))}
- Visual DNA: {', '.join(b.get('visualDna', []))}
"""
                break
    except Exception:
        pass

    return f"""Operator's idea (original language — preserve meaning, output in English):

"{idea}"

{brand_context}
{product_context}
Analyze this idea and produce a Creative Brief. The brand operates in overseas markets (primarily Europe and North America) selling electric scooters and related accessories.

IMPORTANT: Never invent product specifications, discounts, prices, or compatibility claims. If the operator hasn't explicitly mentioned a discount, do NOT include one. If no specific product model is mentioned, use the default product information provided above. All hashtags and brand mentions MUST use the correct brand name from the brand profile above."""


def _build_content_from_brief_prompt(brief: dict) -> str:
    return f"""Generate social media content from this confirmed Creative Brief:

Campaign Theme: {brief.get('campaignTheme', '')}
Target Market: {brief.get('market', {}).get('country', 'US')} · {brief.get('market', {}).get('language', 'en')}
Target Audience: {', '.join(brief.get('audience', []))}
Pain Points: {', '.join(brief.get('painPoints', []))}
Product Benefits: {', '.join(brief.get('productBenefits', []))}
Message Angle: {brief.get('messageAngle', '')}
Emotional Direction: {', '.join(brief.get('emotionalDirection', []))}
Tone: {', '.join(brief.get('tone', []))}
Visual Direction: {brief.get('visualDirection', '')}
Offer: {brief.get('offer', {}).get('label', 'No offer specified')}
Avoid: {', '.join(brief.get('avoid', []))}

Produce platform-specific content for Facebook, Instagram, X, and Image Prompt.
All text MUST be in English."""


class CreativeBriefRequest(BaseModel):
    idea: str
    brandId: str = "ienyrid"
    productId: str = ""


class ApplyBriefRequest(BaseModel):
    taskId: str
    editedFields: dict = {}


class ContentJobRequest(BaseModel):
    creativeBriefId: str
    assets: list[str] = ["facebook", "instagram", "x", "image_prompt"]


@app.post("/api/creative-brief")
def create_creative_brief(req: CreativeBriefRequest):
    """Generate a Creative Brief from a natural-language idea using DeepSeek."""
    DEMO_MODE = not bool(os.getenv("DEEPSEEK_API_KEY"))
    if DEMO_MODE:
        task_id = f"brief_{uuid.uuid4().hex[:10]}"
        brief = {
            "campaignTheme": "iENYRID Summer City Ride",
            "market": {"country": "GB", "language": "en"},
            "audience": ["Urban commuters", "Electric scooter enthusiasts"],
            "painPoints": ["City traffic congestion", "Last-mile commute challenges"],
            "productBenefits": ["Long-range battery", "Portable folding design", "Smooth ride quality"],
            "messageAngle": "Your City, Your Freedom",
            "emotionalDirection": ["Confident", "Free", "Excited"],
            "tone": ["Energetic", "Friendly"],
            "visualDirection": "iENYRID electric scooter in a sunny European city street, golden hour light, confident rider, clean composition",
            "offer": {"label": "Free shipping on orders over 500 EUR", "verified": False},
            "avoid": ["Fear-based copy", "Absolute safety claims", "Unverified specs", "Competitor bashing"],
            "clarificationQuestions": ["你具体想推广哪个型号？", "目标国家是哪里？", "是否正在进行促销活动？"],
        }
        confidence_result = _compute_confidence(brief)
        brief["confidence"] = round(confidence_result["computedScore"] / 100, 2)
        brief["_confidenceFactors"] = confidence_result

        result = {
            "taskId": task_id,
            "brief": brief,
            "confidence": brief["confidence"],
            "confidenceFactors": confidence_result,
            "warnings": brief["clarificationQuestions"],
            "mode": "demo",
            "createdAt": datetime.now().isoformat(),
        }
        _brief_tasks[task_id] = {**result, "status": "draft", "applied": False, "appliedAt": None}
        return result

    try:
        client = _get_brief_ds_client()
        task_id = f"brief_{uuid.uuid4().hex[:10]}"
        logger.info(f"[{task_id}] Generating Creative Brief for: {req.idea[:80]}...")

        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {"role": "system", "content": CREATIVE_BRIEF_SYSTEM},
                {"role": "user", "content": _build_creative_brief_prompt(req.idea, req.brandId, req.productId)},
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        raw = response.choices[0].message.content
        brief_data = _parse_brief_json(raw)

        brief = {
            "campaignTheme": brief_data.get("campaignTheme", ""),
            "market": brief_data.get("market", {"country": "US", "language": "en"}),
            "audience": brief_data.get("audience", []),
            "painPoints": brief_data.get("painPoints", []),
            "productBenefits": brief_data.get("productBenefits", []),
            "messageAngle": brief_data.get("messageAngle", ""),
            "emotionalDirection": brief_data.get("emotionalDirection", []),
            "tone": brief_data.get("tone", []),
            "visualDirection": brief_data.get("visualDirection", ""),
            "offer": brief_data.get("offer", {"label": "", "verified": False}),
            "avoid": brief_data.get("avoid", []),
            "clarificationQuestions": brief_data.get("clarificationQuestions", []),
            "confidence": 0.0,  # placeholder — real value computed below
        }
        confidence_result = _compute_confidence(brief)
        brief["confidence"] = round(confidence_result["computedScore"] / 100, 2)
        brief["_confidenceFactors"] = confidence_result

        result = {
            "taskId": task_id,
            "brief": brief,
            "confidence": brief["confidence"],
            "confidenceFactors": confidence_result,
            "warnings": brief.get("clarificationQuestions", []),
            "mode": "live",
            "createdAt": datetime.now().isoformat(),
        }
        _brief_tasks[task_id] = {**result, "status": "draft", "applied": False, "appliedAt": None}
        return result

    except Exception as e:
        logger.error(f"Creative Brief generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/creative-brief/{task_id}/apply")
def apply_creative_brief(task_id: str, body: dict = None):
    """Confirm and apply a Creative Brief. Records audit trail."""
    if task_id not in _brief_tasks:
        raise HTTPException(status_code=404, detail=f"Brief task '{task_id}' not found")

    brief_record = _brief_tasks[task_id]
    brief_record["status"] = "confirmed"
    brief_record["applied"] = True
    brief_record["appliedAt"] = datetime.now().isoformat()

    if body and body.get("editedFields"):
        for key, value in body["editedFields"].items():
            if key in brief_record.get("brief", {}):
                brief_record["brief"][key] = value
        brief_record["editedFields"] = body["editedFields"]

    logger.info(f"[{task_id}] Brief applied")
    return {
        "taskId": task_id,
        "status": "confirmed",
        "brief": brief_record["brief"],
        "appliedAt": brief_record.get("appliedAt"),
    }


@app.post("/api/content-jobs/stream")
async def create_content_job_stream(req: ContentJobRequest):
    """Create a content generation job and stream results via SSE."""
    brief_id = req.creativeBriefId
    if brief_id not in _brief_tasks:
        raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found or not applied")

    brief_record = _brief_tasks[brief_id]
    if not brief_record.get("applied"):
        raise HTTPException(status_code=400, detail="Brief must be applied before generating content")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    brief = brief_record["brief"]
    DEMO_MODE = not bool(os.getenv("DEEPSEEK_API_KEY"))

    def generate():
        if DEMO_MODE:
            import time as _time
            chunks = [
                {"type": "status", "key": "copy", "status": "running"},
                '{"facebook":{"title":"Your City, Your Freedom. Ride iENYRID.","body":"Discover the joy of zipping through city streets with iENYRID electric scooters. Long-range battery, portable folding design, and a smooth ride that makes every commute feel like an adventure.\\n\\nFree shipping on orders over 500 EUR.","footer":"#iENYRID #ElectricScooter #CityCommute #RideFree"}}',
                {"type": "status", "key": "image", "status": "running"},
                '{"instagram":{"title":"Freedom on two wheels.","body":"From last-mile commutes to weekend explorations, iENYRID gets you there with style and confidence.\\n\\nLong battery life. Foldable design.","footer":"#iENYRID #ScooterLife #UrbanMobility #RideElectric"},"x":{"title":"","body":"Zip through the city with iENYRID. Long range, foldable, and free shipping on orders over 500 EUR.","footer":"#iENYRID #EScooter"},"image":{"title":"Image Prompt","body":"Premium summer lifestyle shot of an iENYRID electric scooter on a sunny city street.","footer":"Avoid: incorrect proportions, unsafe riding posture."}}',
                {"type": "status", "key": "done", "status": "done"}
            ]
            for chunk in chunks:
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
                _time.sleep(0.5)

            # Persist demo data to history.json
            try:
                from scripts.history_engine import save_history
                fb_data = {"title": "Your City, Your Freedom. Ride iENYRID.", "body": "Discover the joy of zipping through city streets...", "footer": "#iENYRID #ElectricScooter #CityCommute #RideFree"}
                save_history({
                    "taskId": job_id,
                    "brandId": "ienyrid",
                    "productId": "",
                    "title": fb_data["title"],
                    "facebookText": f"{fb_data['title']}\n\n{fb_data['body']}\n\n{fb_data['footer']}",
                    "styleSummary": "Urban environment, golden hour, clean composition",
                    "createdAt": datetime.now().isoformat(),
                })
            except Exception as e:
                logger.warning(f"Failed to save demo history: {e}")
            return

        try:
            client = _get_brief_ds_client()
            logger.info(f"[{job_id}] Streaming content generation from brief...")

            # Phase 1: copy generation
            yield f"data: {json.dumps({'type': 'status', 'key': 'copy', 'status': 'running'}, ensure_ascii=False)}\n\n"

            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": CONTENT_GENERATION_SYSTEM},
                    {"role": "user", "content": _build_content_from_brief_prompt(brief)},
                ],
                temperature=0.85,
                max_tokens=3000,
            )
            raw = response.choices[0].message.content
            content_data = _parse_brief_json(raw)

            # Phase 2: image prompt (status)
            yield f"data: {json.dumps({'type': 'status', 'key': 'image', 'status': 'running'}, ensure_ascii=False)}\n\n"

            defaults = {
                "facebook": {"title": brief.get("messageAngle", "Upgrade Your Ride"), "body": "Discover the difference with our latest upgrade.", "footer": "#iENYRID #ElectricScooter #RideBetter"},
                "instagram": {"title": "Ride with confidence ☀️", "body": "Smoother rides, better control.", "footer": "#iENYRID #ScooterLife #RideBetter"},
                "x": {"title": "", "body": brief.get("messageAngle", "Better control for your ride."), "footer": "#iENYRID #EScooter"},
                "image": {"title": "Image Prompt", "body": brief.get("visualDirection", "Urban environment, golden hour, clean composition."), "footer": "Avoid: incorrect proportions, unsafe posture."},
            }
            generated = {}
            for key in ["facebook", "instagram", "x", "image"]:
                asset = content_data.get(key, {})
                d = defaults[key]
                generated[key] = {"title": asset.get("title", d["title"]), "body": asset.get("body", d["body"]), "footer": asset.get("footer", d["footer"])}

            # Send final data
            yield f"data: {json.dumps(generated, ensure_ascii=False)}\n\n"

            # Done
            yield f"data: {json.dumps({'type': 'status', 'key': 'done', 'status': 'done'}, ensure_ascii=False)}\n\n"

            result = {
                "jobId": job_id,
                "status": "completed",
                "generated": generated,
                "briefId": brief_id,
                "createdAt": datetime.now().isoformat(),
                "mode": "live",
            }
            _brief_content_jobs[job_id] = result

            # Persist to history.json so ContentTasks page can read it
            try:
                from scripts.history_engine import save_history
                fb = generated.get("facebook", {})
                save_history({
                    "taskId": job_id,
                    "brandId": brief_record.get("brief", {}).get("_brandId", "ienyrid"),
                    "productId": brief_record.get("brief", {}).get("_productId", ""),
                    "title": fb.get("title", ""),
                    "facebookText": f"{fb.get('title','')}\n\n{fb.get('body','')}\n\n{fb.get('footer','')}",
                    "styleSummary": brief.get("visualDirection", ""),
                    "createdAt": datetime.now().isoformat(),
                })
                logger.info(f"[{job_id}] History saved")
            except Exception as e:
                logger.warning(f"Failed to save history: {e}")

        except Exception as e:
            logger.error(f"Streaming content generation failed: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/content-jobs")
def create_content_job(req: ContentJobRequest):
    """Create a content generation job from a confirmed brief."""
    brief_id = req.creativeBriefId
    if brief_id not in _brief_tasks:
        raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found or not applied")

    brief_record = _brief_tasks[brief_id]
    if not brief_record.get("applied"):
        raise HTTPException(status_code=400, detail="Brief must be applied before generating content")

    job_id = f"job_{uuid.uuid4().hex[:10]}"
    brief = brief_record["brief"]
    DEMO_MODE = not bool(os.getenv("DEEPSEEK_API_KEY"))

    if DEMO_MODE:
        generated = {
            "facebook": {
                "title": "Your City, Your Freedom. Ride iENYRID.",
                "body": "Discover the joy of zipping through city streets with iENYRID electric scooters. Long-range battery, portable folding design, and a smooth ride that makes every commute feel like an adventure.\n\nFree shipping on orders over 500 EUR.",
                "footer": "#iENYRID #ElectricScooter #CityCommute #RideFree",
            },
            "instagram": {
                "title": "Freedom on two wheels. ☀️",
                "body": "From last-mile commutes to weekend explorations, iENYRID gets you there with style and confidence.\n\nLong battery life. Foldable design. Pure electric freedom.\n\nFree shipping on orders over 500 EUR.",
                "footer": "#iENYRID #ScooterLife #UrbanMobility #RideElectric",
            },
            "x": {
                "title": "",
                "body": "Zip through the city with iENYRID. Long range, foldable, and free shipping on orders over 500 EUR.",
                "footer": "#iENYRID #EScooter",
            },
            "image": {
                "title": "Image Prompt",
                "body": "Premium summer lifestyle shot of an iENYRID electric scooter on a sunny city street. Confident rider, golden hour light. Clean product composition showing the scooter's design lines. Space for headline.",
                "footer": "Avoid: incorrect proportions, unsafe riding posture, fake UI overlays, warped wheels.",
            },
        }
    else:
        try:
            client = _get_brief_ds_client()
            logger.info(f"[{job_id}] Generating content from brief...")
            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {"role": "system", "content": CONTENT_GENERATION_SYSTEM},
                    {"role": "user", "content": _build_content_from_brief_prompt(brief)},
                ],
                temperature=0.85,
                max_tokens=3000,
            )
            raw = response.choices[0].message.content
            content_data = _parse_brief_json(raw)

            defaults = {
                "facebook": {"title": brief.get("messageAngle", "Upgrade Your Ride"), "body": "Discover the difference with our latest upgrade.", "footer": "#iENYRID #ElectricScooter #RideBetter"},
                "instagram": {"title": "Ride with confidence ☀️", "body": "Smoother rides, better control.", "footer": "#iENYRID #ScooterLife #RideBetter"},
                "x": {"title": "", "body": brief.get("messageAngle", "Better control for your ride."), "footer": "#iENYRID #EScooter"},
                "image": {"title": "Image Prompt", "body": brief.get("visualDirection", "Urban environment, golden hour, clean composition."), "footer": "Avoid: incorrect proportions, unsafe posture."},
            }
            generated = {}
            for key in ["facebook", "instagram", "x", "image"]:
                asset = content_data.get(key, {})
                d = defaults[key]
                generated[key] = {"title": asset.get("title", d["title"]), "body": asset.get("body", d["body"]), "footer": asset.get("footer", d["footer"])}
        except Exception as e:
            logger.error(f"Content generation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    result = {
        "jobId": job_id,
        "status": "completed",
        "generated": generated,
        "briefId": brief_id,
        "createdAt": datetime.now().isoformat(),
        "mode": "demo" if DEMO_MODE else "live",
    }
    _brief_content_jobs[job_id] = result

    # Persist to history.json so ContentTasks page can read it
    try:
        from scripts.history_engine import save_history
        fb = generated.get("facebook", {})
        save_history({
            "taskId": job_id,
            "brandId": "ienyrid",
            "productId": "",
            "title": fb.get("title", ""),
            "facebookText": f"{fb.get('title','')}\n\n{fb.get('body','')}\n\n{fb.get('footer','')}",
            "styleSummary": brief.get("visualDirection", ""),
            "createdAt": datetime.now().isoformat(),
        })
        logger.info(f"[{job_id}] History saved")
    except Exception as e:
        logger.warning(f"Failed to save history: {e}")

    return result


@app.get("/api/content-jobs/{job_id}")
def get_content_job(job_id: str):
    """Get completed content job results."""
    if job_id not in _brief_content_jobs:
        raise HTTPException(status_code=404, detail=f"Content job '{job_id}' not found")
    return _brief_content_jobs[job_id]


@app.get("/api/creative-brief/{task_id}")
def get_creative_brief(task_id: str):
    """Retrieve a Creative Brief by task ID."""
    if task_id not in _brief_tasks:
        raise HTTPException(status_code=404, detail=f"Brief task '{task_id}' not found")
    return _brief_tasks[task_id]


# ---------------------------------------------------------------
# Main
# ---------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    print("\n  Social Auto-Poster API (Multi-Brand)")
    print(f"  Brands: {list_brands()}")
    print("  http://localhost:8000")
    print("  http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
