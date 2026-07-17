"""
FastAPI backend for Social Auto-Poster Web UI (multi-brand).
Serves API endpoints for the React frontend.
"""
import asyncio
import json
import logging
import os
import sys
import tempfile
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
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("server")

from scripts.brand_config import list_brands, resolve_tables, DEFAULT_BRAND

app = FastAPI(title="Social Auto-Poster API", version="2.0.0")

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    """Generate English ad copy via DeepSeek."""
    try:
        from scripts.content_factory import generate_ad_content
        fields = {
            "产品型号": req.model,
            "用户痛点": req.pain_point,
            "广告类型": req.ad_type,
            "场景风格": req.scene_style,
            "折扣活动": req.discount,
            "促销信息": req.promotion,
            "折扣代码": req.discount_code,
            "CTA": req.cta,
            "文案语气": req.tone,
            "平台": req.platform,
        }
        content = generate_ad_content(fields)
        return {
            "title": content.get("title", ""),
            "body": content.get("body", ""),
            "tags": content.get("tags", ""),
            "x_text": content.get("x_text", ""),
            "image_prompt": content.get("image_prompt", ""),
        }
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
# Main
# ---------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    print("\n  Social Auto-Poster API (Multi-Brand)")
    print(f"  Brands: {list_brands()}")
    print("  http://localhost:8000")
    print("  http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
