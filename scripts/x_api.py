"""
X (Twitter) poster via twikit — cookie-based internal API.
Zero cost, no official API needed.

Auth: Copy auth_token + ct0 from browser cookies → saved to x_cookies.json.
Subsequent runs load cookies, no re-login needed.

Usage:
    from scripts.x_api import post_to_x
    result = await post_to_x(text="Hello World!", image_path="pic.png")

Setup (first time, 30 seconds):
    1. Open Chrome → login to x.com
    2. F12 → Application → Cookies → x.com
    3. Copy "auth_token" value
    4. Copy "ct0" value
    5. Run:  python scripts/x_api.py --set-cookies
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

COOKIES_FILE = Path(__file__).resolve().parent.parent / "x_cookies.json"


async def _get_client() -> "Client":
    """Get authenticated twikit Client from saved cookies."""
    from twikit import Client

    if not COOKIES_FILE.exists():
        raise RuntimeError(
            "x_cookies.json not found.\n"
            "  Setup: python scripts/x_api.py --set-cookies"
        )

    client = Client(language="en-US")

    # Only use proxy for X if explicitly requested via env var
    from scripts.config_loader import load_config
    cfg = load_config()
    proxy_url = cfg.get("proxy", {}).get("server", "")

    # X blocks proxy IPs aggressively. Default to direct connection.
    # Set X_USE_PROXY=1 to force proxy usage.
    use_proxy = os.getenv("X_USE_PROXY", "0") == "1"
    if proxy_url and use_proxy:
        client.proxy = proxy_url
        logger.info(f"X using proxy: {proxy_url}")
    else:
        logger.info("X connecting directly (no proxy)")

    client.load_cookies(str(COOKIES_FILE))
    user = await client.user()
    logger.info(f"X session OK (@{user.screen_name})")
    return client


async def post_to_x(
    text: str,
    image_path: Optional[str] = None,
) -> dict:
    """
    Post a tweet via twikit (X internal API, no official API key).

    Args:
        text: Tweet text
        image_path: Optional local image file path

    Returns:
        {"success": bool, "url": str|None, "error": str|None, "timestamp": str}
    """
    result = {
        "success": False,
        "url": None,
        "error": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    if not text.strip() and not image_path:
        return {**result, "error": "Text or image required"}

    logger.info(f"X post: {text[:60]}...")

    try:
        client = await _get_client()

        media_ids = []
        if image_path:
            img = Path(image_path)
            if not img.is_absolute():
                img = Path(__file__).resolve().parent.parent / image_path
            if not img.exists():
                return {**result, "error": f"Image not found: {img}"}
            logger.info(f"Uploading media: {img.name}")
            media_id = await client.upload_media(str(img.resolve()))
            media_ids = [media_id]
            logger.info(f"Media uploaded (id={media_id})")

        tweet = await client.create_tweet(
            text=text,
            media_ids=media_ids if media_ids else None,
        )

        username = "i"
        try:
            me = await client.user()
            username = me.screen_name
        except Exception:
            pass

        result["success"] = True
        result["url"] = f"https://x.com/{username}/status/{tweet.id}"
        logger.info(f"X post published: {result['url']}")

    except Exception as e:
        error_str = str(e)
        if "Duplicate" in error_str or "duplicate" in error_str:
            result["error"] = "Duplicate tweet (already posted or too similar)"
        elif "344" in error_str or "daily limit" in error_str.lower():
            result["error"] = (
                "X daily post limit reached. Free accounts have a per-day cap.\n"
                "Wait 24 hours or use a different account. Original: " + error_str
            )
        elif "auth" in error_str.lower() or "login" in error_str.lower() or "Forbidden" in error_str:
            result["error"] = (
                f"X cookies expired or invalid. Delete x_cookies.json and redo setup:\n"
                f"  python scripts/x_api.py --set-cookies\n"
                f"  Original error: {e}"
            )
        else:
            result["error"] = str(e)
        logger.error(f"X post failed: {result['error']}")

    return result


def post_to_x_sync(text: str, image_path: str = None) -> dict:
    """Synchronous wrapper."""
    return asyncio.run(post_to_x(text, image_path))


# ------------------------------------------------------------------
# CLI: cookie setup
# ------------------------------------------------------------------
async def _set_cookies_interactive():
    """Interactive: paste auth_token and ct0 from browser."""
    print("\n  === X Cookie Setup ===\n")
    print("  Step 1: Open Chrome, login to x.com")
    print("  Step 2: Press F12 → Application → Cookies → x.com")
    print("  Step 3: Find 'auth_token' and 'ct0'\n")

    auth_token = input("  Paste auth_token: ").strip()
    ct0 = input("  Paste ct0: ").strip()

    if not auth_token or not ct0:
        print("\n  [ERROR] Both auth_token and ct0 are required.\n")
        return

    cookies = {
        "auth_token": auth_token,
        "ct0": ct0,
    }
    COOKIES_FILE.write_text(json.dumps(cookies, indent=2), encoding="utf-8")
    print(f"\n  [OK] Cookies saved to {COOKIES_FILE}")

    # Validate
    print("  Verifying...")
    try:
        from twikit import Client
        client = Client(language="en-US")
        from scripts.config_loader import load_config
        cfg = load_config()
        proxy_url = cfg.get("proxy", {}).get("server", "")
        if proxy_url:
            client.proxy = proxy_url
        client.load_cookies(str(COOKIES_FILE))
        user = await client.user()
        print(f"  [OK] Authenticated as @{user.screen_name}\n")
    except Exception as e:
        print(f"  [FAIL] Cookie verification failed: {e}")
        print(f"  Make sure you copied the full values from the correct domain (x.com).\n")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    if "--set-cookies" in sys.argv:
        asyncio.run(_set_cookies_interactive())
    elif "--post" in sys.argv:
        test_text = " ".join([a for a in sys.argv[1:] if a != "--post"]) or "Test tweet from twikit"
        result = asyncio.run(post_to_x(test_text))
        print(result)
    else:
        print("Usage:")
        print("  python scripts/x_api.py --set-cookies  # Extract cookies from browser")
        print("  python scripts/x_api.py --post <text>   # Test post")
