"""
Facebook Page poster via Graph API.
Replaces Playwright browser automation — 100% reliable, zero maintenance.

Usage:
    from scripts.fb_api import post_to_facebook
    result = await post_to_facebook(text="Hello", image_path="pic.png")

Requirements:
    - FB_PAGE_ID and FB_ACCESS_TOKEN in .env
    - Page Access Token with pages_manage_posts permission
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

from scripts.config_loader import get_proxy_dict, get_posting_config
from scripts.utils import guess_mime

load_dotenv()
logger = logging.getLogger(__name__)

FB_GRAPH_URL = os.getenv("FB_GRAPH_URL", "https://graph.facebook.com/v22.0")
FB_PAGE_ID = os.getenv("FB_PAGE_ID", "")
FB_ACCESS_TOKEN = os.getenv("FB_ACCESS_TOKEN", "")


def _get_session() -> requests.Session:
    """Create a requests Session with proxy from config.yaml."""
    session = requests.Session()
    proxy = get_proxy_dict()
    if proxy:
        session.proxies.update(proxy)
    return session


async def post_to_facebook(
    text: str,
    image_path: Optional[str] = None,
    cross_post_instagram: bool = True,
) -> dict:
    """
    Publish text or photo to a Facebook Page via Graph API.

    Args:
        text: Post body text
        image_path: Optional local image file path
        cross_post_instagram: If True, attempt Instagram cross-post via Graph API
            (requires IG Business account connected to the FB Page)

    Returns:
        {"success": bool, "platforms": list, "url": str|None, "error": str|None, "timestamp": str}
    """
    result = {
        "success": False,
        "platforms": ["facebook"],
        "url": None,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if not FB_PAGE_ID or not FB_ACCESS_TOKEN:
        return {
            **result,
            "error": "FB_PAGE_ID or FB_ACCESS_TOKEN not set in .env\n"
                     "Run: python scripts/setup_auth.py --platform fb",
        }

    posting_cfg = get_posting_config()
    max_retries = posting_cfg.get("max_retries", 3)
    retry_delay = posting_cfg.get("retry_delay", 5)

    session = _get_session()
    logger.info(f"FB post: {text[:60]}...")

    for attempt in range(1, max_retries + 1):
        try:
            if image_path:
                # Photo post: multipart upload
                img = Path(image_path)
                if not img.is_absolute():
                    img = Path(__file__).resolve().parent.parent / image_path
                if not img.exists():
                    return {**result, "error": f"Image not found: {img}"}

                logger.info(f"Uploading photo: {img.name} ({img.stat().st_size} bytes)")
                with open(img, "rb") as f:
                    post_resp = session.post(
                        f"{FB_GRAPH_URL}/{FB_PAGE_ID}/photos",
                        params={
                            "access_token": FB_ACCESS_TOKEN,
                            "caption": text,
                            "published": "true",
                        },
                        files={"source": (img.name, f, guess_mime(img))},
                        timeout=120,
                    )
            else:
                # Text-only post
                post_resp = session.post(
                    f"{FB_GRAPH_URL}/{FB_PAGE_ID}/feed",
                    params={
                        "access_token": FB_ACCESS_TOKEN,
                        "message": text,
                    },
                    timeout=60,
                )

            resp_data = post_resp.json() if post_resp.text else {}

            if post_resp.status_code == 200 and "id" in resp_data:
                post_id = resp_data["id"]
                page_id = FB_PAGE_ID
                post_id_clean = post_id.split("_")[-1] if "_" in post_id else post_id
                result["success"] = True
                result["url"] = f"https://www.facebook.com/{page_id}/posts/{post_id_clean}"
                logger.info(f"FB post published: {result['url']}")
                break
            else:
                error_msg = _extract_fb_error(resp_data)
                logger.warning(f"FB API error (attempt {attempt}/{max_retries}): {error_msg}")

                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * attempt)
                else:
                    result["error"] = error_msg

        except requests.exceptions.RequestException as e:
            logger.error(f"FB network error (attempt {attempt}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(retry_delay * attempt)
            else:
                result["error"] = str(e)

    # Attempt Instagram cross-post if requested
    if result["success"] and cross_post_instagram:
        ig_user_id = os.getenv("IG_USER_ID", "")
        if ig_user_id:
            ig_result = await _cross_post_instagram(text, image_path)
            if ig_result["success"]:
                result["platforms"].append("instagram")
                logger.info("IG cross-post successful")
            else:
                logger.warning(f"IG cross-post failed: {ig_result.get('error')}")

    return result


async def _cross_post_instagram(text: str, image_path: Optional[str] = None) -> dict:
    """Attempt to cross-post to Instagram via Graph API."""
    # Delegates to ig_api's internal logic — avoids circular import
    try:
        from scripts.ig_api import post_to_instagram
        return await post_to_instagram(caption=text, image_path=image_path or "")
    except Exception as e:
        return {"success": False, "error": str(e)}


def _extract_fb_error(data: dict) -> str:
    """Extract human-readable error from FB Graph API response."""
    if not data:
        return "Empty response from Facebook API"
    error = data.get("error", {})
    msg = error.get("message", "Unknown API error")
    code = error.get("code", "")
    subcode = error.get("error_subcode", "")
    parts = [msg]
    if code:
        parts.append(f"(code={code}")
    if subcode:
        parts.append(f"subcode={subcode})")
    else:
        parts.append(")")
    return " ".join(parts)


def post_to_facebook_sync(text: str, image_path: str = None, cross_post_instagram: bool = True) -> dict:
    """Synchronous wrapper for post_to_facebook."""
    return asyncio.run(post_to_facebook(text, image_path, cross_post_instagram))
