"""
X (Twitter) poster via Playwright + Chromium.
Uses x_cookies.json for auth. No API, no proxy.

Usage:
    python scripts/x_chrome.py --text "Hello World"
    python scripts/x_chrome.py --text "Hello" --image "pic.png"
"""

import asyncio
import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


async def post_to_x(text: str, image_path: Optional[str] = None) -> dict:
    """
    Post to X via Chromium with cookies auth.

    Returns {success, url, error, timestamp}
    """
    from playwright.async_api import async_playwright

    result = {"success": False, "url": None, "error": None, "timestamp": datetime.now(timezone.utc).isoformat()}

    logger.info(f"X post: {text[:60]}...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        try:
            # ---- Load cookies ----
            cookies_file = Path(__file__).resolve().parent.parent / "x_cookies.json"
            if cookies_file.exists():
                import json
                cookies_data = json.loads(cookies_file.read_text(encoding="utf-8"))
                cookies_to_set = []
                for name, value in cookies_data.items():
                    cookies_to_set.append({
                        "name": name,
                        "value": value,
                        "domain": ".x.com",
                        "path": "/",
                    })
                await context.add_cookies(cookies_to_set)
                logger.info(f"Loaded {len(cookies_to_set)} cookies from x_cookies.json")

            # ---- Open compose page ----
            logger.info("Opening X compose...")
            await page.goto("https://x.com/compose/post", wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(5)

            # Check login
            if "login" in page.url.lower() or "flow" in page.url.lower():
                return {**result, "error": "X not logged in. Run: python scripts/x_api.py --set-cookies"}

            # Dismiss any existing dialog/toast
            await _dismiss_dialogs(page)

            # ---- Find and fill text input ----
            logger.info("Typing text...")
            editor = None
            for sel in ['[data-testid="tweetTextarea_0"]', '[contenteditable="true"]', 'div[role="textbox"]']:
                try:
                    editor = await page.wait_for_selector(sel, timeout=10000)
                    if editor:
                        break
                except Exception:
                    continue

            if not editor:
                logger.warning("No input found, trying click-in-area...")
                try:
                    await page.click('div[data-testid="toolBar"]', timeout=5000)
                except Exception:
                    pass
                await asyncio.sleep(2)
                for sel in ['[data-testid="tweetTextarea_0"]', 'div[role="textbox"]', '[contenteditable="true"]']:
                    try:
                        editor = await page.wait_for_selector(sel, timeout=5000)
                        if editor: break
                    except Exception:
                        continue
            if not editor:
                return {**result, "error": "Could not find tweet input"}

            await editor.click()
            await asyncio.sleep(0.5)
            await editor.fill(text)
            await asyncio.sleep(1)

            # ---- Upload image ----
            tweet_url = ""
            img_uploaded = False
            if image_path:
                img = Path(image_path)
                if not img.is_absolute():
                    img = Path.cwd() / image_path
                if img.exists():
                    file_size_mb = img.stat().st_size / (1024 * 1024)
                    logger.info(f"Uploading image: {img.name} ({file_size_mb:.1f} MB)")
                    img_uploaded = False

                    # Strategy 1: File chooser via photo button
                    try:
                        photo_btn = await page.wait_for_selector(
                            'button[aria-label="Add media"], button[data-testid="addPhotoButton"]',
                            timeout=8000
                        )
                        if photo_btn:
                            async with page.expect_file_chooser(timeout=10000) as fc_info:
                                await photo_btn.click()
                            file_chooser = await fc_info.value
                            await file_chooser.set_files(str(img.resolve()))
                            img_uploaded = True
                            logger.info("Image uploaded via file chooser")
                    except Exception:
                        pass

                    # Strategy 2: Direct file input
                    if not img_uploaded:
                        try:
                            file_input = await page.wait_for_selector('input[type="file"]', timeout=10000)
                            if file_input:
                                await file_input.set_input_files(str(img.resolve()))
                                img_uploaded = True
                                logger.info("Image uploaded via file input")
                        except Exception:
                            pass

                    if img_uploaded:
                        # Wait generously for X to process the image
                        # Large images (2+ MB) need more time, plus network instability
                        wait_seconds = max(10, int(file_size_mb * 4))
                        logger.info(f"Waiting {wait_seconds}s for image processing...")
                        await asyncio.sleep(wait_seconds)

                        # Verify image is ready: X shows a progress overlay that disappears
                        try:
                            for _ in range(12):  # up to 36s for slow networks
                                overlay = await page.query_selector('[role="progressbar"], [data-testid="progressBar"]')
                                if overlay:
                                    logger.info("  Image still processing, waiting 3s...")
                                    await asyncio.sleep(3)
                                else:
                                    break
                        except Exception:
                            pass
                        # Extra safety wait after progress bar disappears
                        await asyncio.sleep(2)
                        logger.info("Image processing complete")
                    else:
                        logger.warning("Image upload failed — posting text only")

            # ---- Click Post ----
            logger.info("Clicking Post...")
            posted = False
            for sel in [
                'button[data-testid="tweetButton"]',
                'button[data-testid="tweetButtonInline"]',
                'button:has-text("Post")',
                'button[role="button"]:has-text("Post")',
            ]:
                try:
                    btn = await page.wait_for_selector(sel, timeout=5000)
                    if btn:
                        is_disabled = await btn.get_attribute("disabled")
                        if is_disabled is not None:
                            logger.info(f"  Button disabled, waiting...")
                            await asyncio.sleep(3)
                        await btn.click()
                        posted = True
                        break
                except Exception:
                    continue

            if not posted:
                logger.warning("Button click failed, trying Ctrl+Enter...")
                await page.keyboard.press("Control+Enter")

            # ---- Wait for post to complete ----
            logger.info("Waiting for post to complete...")
            await asyncio.sleep(8)

            # Dismiss any post-publish dialogs
            await _dismiss_dialogs(page)

            # Extra wait for slow network
            await asyncio.sleep(3)

            # ---- Get tweet URL from composer redirect ----
            # After a successful post, X redirects the compose page to the tweet itself
            if not tweet_url:
                try:
                    # The compose page will redirect to the new tweet on success
                    # Wait a bit more for the redirect
                    await asyncio.sleep(4)
                    current_url = page.url
                    logger.info(f"  Current URL after post: {current_url[:80]}")
                    if "/status/" in current_url:
                        tweet_url = current_url
                        logger.info(f"  Got tweet URL from redirect: {tweet_url}")
                except Exception as e:
                    logger.warning(f"  Could not get URL from redirect: {e}")

            # Fallback: force navigate to profile then find latest tweet
            if not tweet_url:
                try:
                    # Extract username from cookies or page
                    username = "DQ1irxUj9wKMZVR"  # hardcoded fallback
                    try:
                        profile_btn = await page.query_selector('a[href*="/"][data-testid="AppTabBar_Profile_Link"]')
                        if profile_btn:
                            href = await profile_btn.get_attribute("href")
                            if href:
                                username = href.strip("/")
                    except Exception:
                        pass

                    await page.goto(f"https://x.com/{username}", wait_until="domcontentloaded", timeout=20000)
                    await asyncio.sleep(4)

                    for attempt in range(5):
                        # Look for the FIRST status link on profile (our latest tweet)
                        links = await page.query_selector_all('a[href*="/status/"]')
                        if links:
                            href = await links[0].get_attribute("href")
                            tweet_url = f"https://x.com{href}" if href.startswith("/") else href
                            logger.info(f"  Found tweet on profile: {tweet_url}")
                            break
                        logger.info(f"  No tweets found on profile, retry {attempt+1}/5...")
                        await asyncio.sleep(3)
                except Exception as e:
                    logger.warning(f"  Profile fallback failed: {e}")

            if tweet_url:
                result["success"] = True
                result["url"] = tweet_url
                logger.info(f"OK: {tweet_url}")
            elif posted:
                # Posted but couldn't verify URL
                result["success"] = True
                result["url"] = "Posted (verification pending)"
                logger.warning("Post likely succeeded but couldn't verify URL")
            else:
                result["error"] = "Post may have failed — no confirmation"
                logger.error(result["error"])

        except Exception as e:
            result["error"] = str(e)
            logger.error(str(e))
        finally:
            await browser.close()

    return result


async def _dismiss_dialogs(page):
    """Dismiss any visible dialogs, toasts, or error popups on X."""
    dismiss_selectors = [
        'div[data-testid="toast"] button',
        'div[role="dialog"] button[aria-label="Close"]',
        'div[role="alertdialog"] button',
        'button[aria-label="Close"]',
        'div[data-testid="mask"]',
    ]
    for sel in dismiss_selectors:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                logger.info(f"  Dismissed dialog: {sel}")
                await asyncio.sleep(0.5)
        except Exception:
            pass


async def main():
    parser = argparse.ArgumentParser(description="Post to X via Playwright+Chromium")
    parser.add_argument("--text", "-t", type=str, required=True, help="Tweet text")
    parser.add_argument("--image", "-i", type=str, help="Image path")
    args = parser.parse_args()

    result = await post_to_x(text=args.text, image_path=args.image)

    if result["success"]:
        print(f"\n[OK] Posted: {result['url']}")
    else:
        print(f"\n[FAIL] {result['error']}")
    return 0 if result["success"] else 1


if __name__ == "__main__":
    import asyncio as _asyncio
    exit_code = _asyncio.run(main())
    sys.exit(exit_code)
