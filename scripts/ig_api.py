"""
Instagram poster via Facebook Graph API.
Replaces Playwright browser automation — 100% reliable, zero maintenance.

Usage:
    from scripts.ig_api import post_to_instagram
    result = await post_to_instagram(caption="Hello", image_path="pic.png")

Requirements:
    - IG_USER_ID, FB_PAGE_ID, FB_ACCESS_TOKEN in .env
    - Instagram Business or Creator account connected to a Facebook Page
    - Permissions: instagram_basic, instagram_content_publish, pages_manage_posts

Image posting flow:
    1. Upload image to FB Page as unpublished photo → get public CDN URL
    2. POST /{ig-user-id}/media?image_url=...&caption=... → get container ID
    3. Poll GET /{container-id}?fields=status_code until FINISHED
    4. POST /{ig-user-id}/media_publish?creation_id=... → get media ID
    5. Post URL: https://www.instagram.com/p/{media_id}/
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
from PIL import Image

from scripts.config_loader import get_proxy_dict, get_posting_config
from scripts.utils import guess_mime

load_dotenv()
logger = logging.getLogger(__name__)

FB_GRAPH_URL = os.getenv("FB_GRAPH_URL", "https://graph.facebook.com/v22.0")
FB_PAGE_ID = os.getenv("FB_PAGE_ID", "")
FB_ACCESS_TOKEN = os.getenv("FB_ACCESS_TOKEN", "")
IG_USER_ID = os.getenv("IG_USER_ID", "")

# IG image requirements
IG_MIN_WIDTH = 320
IG_MAX_WIDTH = 1440
IG_MIN_HEIGHT = 320
IG_MAX_HEIGHT = 1440
IG_MIN_ASPECT = 4.0 / 5.0   # 0.8 (4:5 portrait)
IG_MAX_ASPECT = 1.91         # 1.91:1 landscape


def _get_session() -> requests.Session:
    session = requests.Session()
    proxy = get_proxy_dict()
    if proxy:
        session.proxies.update(proxy)
    return session


async def post_to_instagram(
    caption: str,
    image_path: str,
    hashtags: Optional[str] = None,
) -> dict:
    """
    Post image + caption to Instagram via Graph API.

    Args:
        caption: Caption body text
        image_path: Local image file path (required)
        hashtags: Optional hashtags to append after caption

    Returns:
        {"success": bool, "url": str|None, "error": str|None, "timestamp": str}
    """
    result = {
        "success": False,
        "url": None,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Validate credentials
    if not IG_USER_ID:
        return {
            **result,
            "error": "IG_USER_ID not set in .env\n"
                     "Run: python scripts/setup_auth.py --platform fb",
        }
    if not FB_PAGE_ID or not FB_ACCESS_TOKEN:
        return {
            **result,
            "error": "FB_PAGE_ID or FB_ACCESS_TOKEN not set in .env\n"
                     "FB Page token is needed to upload images as a bridge for IG.\n"
                     "Run: python scripts/setup_auth.py --platform fb",
        }

    # Validate image
    img = Path(image_path)
    if not img.is_absolute():
        img = Path(__file__).resolve().parent.parent / image_path
    if not img.exists():
        return {**result, "error": f"Image not found: {img}"}

    # Validate IG image requirements
    img_check = _validate_ig_image(img)
    if img_check:
        return {**result, "error": img_check}

    # Compose full caption
    full_caption = caption
    if hashtags:
        full_caption = f"{caption}\n\n{hashtags}"

    posting_cfg = get_posting_config()
    max_retries = posting_cfg.get("max_retries", 3)
    retry_delay = posting_cfg.get("retry_delay", 5)

    session = _get_session()
    logger.info(f"IG post: {full_caption[:60]}... | image={img.name}")

    for attempt in range(1, max_retries + 1):
        try:
            # === Step 1: Upload image to FB as unpublished photo ===
            public_url = await asyncio.to_thread(
                _upload_unpublished_photo, session, img
            )
            if not public_url:
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * attempt)
                    continue
                result["error"] = "Failed to upload image to Facebook bridge"
                return result

            logger.info(f"Image bridged to FB CDN: {public_url[:80]}...")

            # === Step 2: Create Instagram media container ===
            container_id = await asyncio.to_thread(
                _create_ig_container, session, public_url, full_caption
            )
            if not container_id:
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * attempt)
                    continue
                result["error"] = "Failed to create Instagram media container"
                return result

            logger.info(f"IG container created: {container_id}")

            # === Step 3: Wait for container to be ready ===
            ready = await asyncio.to_thread(
                _wait_for_container_ready, session, container_id
            )
            if not ready:
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * attempt)
                    continue
                result["error"] = "Instagram media container did not become ready"
                return result

            # === Step 4: Publish ===
            media_id = await asyncio.to_thread(
                _publish_ig_container, session, container_id
            )
            if not media_id:
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay * attempt)
                    continue
                result["error"] = "Failed to publish Instagram media"
                return result

            result["success"] = True
            result["url"] = f"https://www.instagram.com/p/{media_id}/"
            logger.info(f"IG post published: {result['url']}")
            break

        except Exception as e:
            logger.error(f"IG error (attempt {attempt}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(retry_delay * attempt)
            else:
                result["error"] = str(e)

    return result


# ------------------------------------------------------------------
# Internal: FB image bridge
# ------------------------------------------------------------------

def _upload_unpublished_photo(session: requests.Session, img: Path) -> str | None:
    """
    Upload image to FB Page as an unpublished photo.
    Returns the public CDN URL of the uploaded image.
    """
    try:
        # Step 1: Upload
        with open(img, "rb") as f:
            resp = session.post(
                f"{FB_GRAPH_URL}/{FB_PAGE_ID}/photos",
                params={
                    "access_token": FB_ACCESS_TOKEN,
                    "published": "false",
                },
                files={"source": (img.name, f, guess_mime(img))},
                timeout=120,
            )

        if resp.status_code != 200:
            logger.error(f"FB photo upload failed: {resp.status_code} {resp.text[:300]}")
            return None

        data = resp.json()
        photo_id = data.get("id")
        if not photo_id:
            logger.error(f"No photo ID in response: {data}")
            return None

        # Step 2: Retrieve image URLs
        resp2 = session.get(
            f"{FB_GRAPH_URL}/{photo_id}",
            params={
                "access_token": FB_ACCESS_TOKEN,
                "fields": "images",
            },
            timeout=30,
        )
        if resp2.status_code != 200:
            logger.error(f"FB photo query failed: {resp2.status_code}")
            return None

        data2 = resp2.json()
        images = data2.get("images", [])
        if images:
            # images[0] is the highest resolution
            return images[0].get("source")

        return None

    except Exception as e:
        logger.error(f"FB photo bridge error: {e}")
        return None


# ------------------------------------------------------------------
# Internal: IG container creation + polling + publish
# ------------------------------------------------------------------

def _create_ig_container(
    session: requests.Session, image_url: str, caption: str
) -> str | None:
    """POST /{ig-user-id}/media → returns container ID."""
    try:
        resp = session.post(
            f"{FB_GRAPH_URL}/{IG_USER_ID}/media",
            params={
                "access_token": FB_ACCESS_TOKEN,
                "image_url": image_url,
                "caption": caption,
            },
            timeout=60,
        )
        data = resp.json() if resp.text else {}

        if resp.status_code == 200:
            return data.get("id")

        error = _extract_fb_error(data)
        logger.error(f"IG container creation failed: {error}")
        return None

    except Exception as e:
        logger.error(f"IG container creation error: {e}")
        return None


def _wait_for_container_ready(
    session: requests.Session,
    container_id: str,
    max_wait: int = 60,
) -> bool:
    """
    Poll container status until FINISHED or error.
    Instagram typically processes images in 5-15 seconds.
    """
    started = time.time()
    while time.time() - started < max_wait:
        try:
            resp = session.get(
                f"{FB_GRAPH_URL}/{container_id}",
                params={
                    "access_token": FB_ACCESS_TOKEN,
                    "fields": "status_code,status",
                },
                timeout=30,
            )
            data = resp.json() if resp.text else {}
            status = data.get("status_code", data.get("status", "UNKNOWN"))

            if status == "FINISHED":
                return True
            if status in ("ERROR", "EXPIRED"):
                logger.error(f"IG container {status}: {data}")
                return False

            logger.debug(f"IG container status: {status} — waiting...")
            time.sleep(3)

        except Exception as e:
            logger.warning(f"IG container poll error: {e}")
            time.sleep(3)

    logger.error(f"IG container not ready after {max_wait}s")
    return False


def _publish_ig_container(session: requests.Session, container_id: str) -> str | None:
    """POST /{ig-user-id}/media_publish → returns media ID."""
    try:
        resp = session.post(
            f"{FB_GRAPH_URL}/{IG_USER_ID}/media_publish",
            params={
                "access_token": FB_ACCESS_TOKEN,
                "creation_id": container_id,
            },
            timeout=60,
        )
        data = resp.json() if resp.text else {}

        if resp.status_code == 200:
            return data.get("id")

        error = _extract_fb_error(data)
        logger.error(f"IG publish failed: {error}")
        return None

    except Exception as e:
        logger.error(f"IG publish error: {e}")
        return None


# ------------------------------------------------------------------
# Image validation
# ------------------------------------------------------------------

def _validate_ig_image(img: Path) -> str | None:
    """
    Validate image meets Instagram requirements.
    Returns error string or None if valid.
    """
    try:
        with Image.open(img) as im:
            w, h = im.size
            aspect = w / h if h > 0 else 1.0

            if w < IG_MIN_WIDTH or h < IG_MIN_HEIGHT:
                return (
                    f"Image too small ({w}x{h}). "
                    f"Instagram requires at least {IG_MIN_WIDTH}x{IG_MIN_HEIGHT}px."
                )
            if w > IG_MAX_WIDTH or h > IG_MAX_HEIGHT:
                logger.warning(
                    f"Image ({w}x{h}) exceeds IG max ({IG_MAX_WIDTH}x{IG_MAX_HEIGHT}). "
                    "Instagram may downscale it."
                )

            if aspect < IG_MIN_ASPECT:
                return (
                    f"Image too tall (aspect {aspect:.2f}:1). "
                    f"Instagram requires aspect ratio between 4:5 and 1.91:1."
                )
            if aspect > IG_MAX_ASPECT:
                return (
                    f"Image too wide (aspect {aspect:.2f}:1). "
                    f"Instagram requires aspect ratio between 4:5 and 1.91:1."
                )

            return None

    except Exception as e:
        return f"Cannot open image: {e}"


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _extract_fb_error(data: dict) -> str:
    if not data:
        return "Empty response"
    error = data.get("error", {})
    msg = error.get("message", "Unknown error")
    code = error.get("code", "")
    if code:
        msg = f"{msg} (code={code})"
    return msg


def post_to_instagram_sync(caption: str, image_path: str, hashtags: str = None) -> dict:
    """Synchronous wrapper for post_to_instagram."""
    return asyncio.run(post_to_instagram(caption, image_path, hashtags))
