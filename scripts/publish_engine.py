"""
Publish Engine — unified 3-channel social media publishing.

Posts to FB + IG + X simultaneously, then writes a single summary
result back to Feishu Bitable (not per-platform).

Usage:
    python scripts/publish_engine.py                    # process all confirmed+due
    python scripts/publish_engine.py --record-id <id>   # publish specific record
    python scripts/publish_engine.py --dry-run          # preview without posting
"""

import asyncio
import json
import logging
import os
import shutil
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

logger = logging.getLogger("publish_engine")


# ------------------------------------------------------------------
# Single post to one platform
# ------------------------------------------------------------------

async def _post_single(text: str, platform: str, image_path: Optional[str] = None) -> dict:
    """Post to a single platform. Returns {success, url, error, ...}"""
    if platform == "fb":
        from scripts.fb_api import post_to_facebook
        return await post_to_facebook(text=text, image_path=image_path, cross_post_instagram=False)
    elif platform == "x":
        from scripts.x_api import post_to_x as _x_api_post
        result = await _x_api_post(text=text, image_path=image_path)
        if not result.get("success"):
            logger.warning(f"  x_api failed ({result.get('error','')[:60]}), falling back to x_chrome...")
            from scripts.x_chrome import post_to_x as _x_chrome_post
            result = await _x_chrome_post(text=text, image_path=image_path)
        return result
    elif platform == "ig":
        from scripts.ig_api import post_to_instagram
        return await post_to_instagram(caption=text, image_path=image_path or "")
    else:
        return {"success": False, "error": f"Unknown platform: {platform}"}


# ------------------------------------------------------------------
# Publish one record to all platforms
# ------------------------------------------------------------------

async def publish_record(
    record_id: str,
    full_text: str,
    x_text: str,
    platforms: list[str],
    image_path: Optional[str] = None,
    driver=None,  # FeishuDriver instance for image download
    fields: Optional[dict] = None,
    dry_run: bool = False,
) -> dict:
    """
    Publish one record to all specified platforms.
    Returns {record_id, results: {fb: {...}, ig: {...}, x: {...}}, all_ok, summary_urls}
    """
    if driver is None:
        from scripts.feishu_driver import FeishuDriver
        driver = FeishuDriver()

    results = {}
    all_ok = True

    # Resolve image
    img_abs = None
    tmp_dir = None

    if image_path:
        p = Path(image_path)
        if not p.is_absolute():
            p = ROOT_DIR / image_path
        if p.exists() and p.is_file():
            img_abs = str(p.resolve())
            logger.info(f"  Image from path: {img_abs}")
    elif fields:
        # Try Feishu attachment
        file_url = driver.get_first_attachment_url(fields, "图片")
        if file_url:
            tmp_dir = tempfile.mkdtemp(prefix="soc_pub_")
            tmp_path = os.path.join(tmp_dir, f"post_{record_id[:8]}.jpg")
            ok = driver.download_attachment(file_url, tmp_path)
            if ok and os.path.getsize(tmp_path) > 0:
                img_abs = tmp_path
                logger.info(f"  Image from Feishu: {os.path.getsize(tmp_path)} bytes")

    for platform in platforms:
        platform = platform.strip().lower()
        logger.info(f"  -> Posting to {platform.upper()}...")

        if dry_run:
            results[platform] = {"success": True, "url": f"DRY_RUN_{platform}", "error": None}
            continue

        # Select the right text per platform
        if platform == "x":
            post_text = x_text if x_text else full_text[:280]
        else:
            post_text = full_text

        # Retry up to 2 times for X (API rate limits / network issues)
        max_attempts = 2 if platform == "x" else 1
        result = {"success": False, "error": "No attempt made"}
        for attempt in range(1, max_attempts + 1):
            try:
                result = await _post_single(post_text, platform, img_abs)
                if result.get("success"):
                    break
                if attempt < max_attempts:
                    logger.warning(f"  X attempt {attempt} failed, retrying in 5s...")
                    await asyncio.sleep(5)
            except Exception as e:
                result = {"success": False, "error": str(e)}
                if attempt < max_attempts:
                    await asyncio.sleep(5)

        results[platform] = result

        if result.get("success"):
            logger.info(f"  [OK] {platform.upper()}")
        else:
            all_ok = False
            logger.error(f"  [FAIL] {platform.upper()}: {result.get('error', '?')[:80]}")

        # Small delay between platforms
        if len(platforms) > 1:
            await asyncio.sleep(2)

    # Cleanup
    if tmp_dir:
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

    # Build summary
    summary_urls = " | ".join([
        f"{p.upper()}: {results[p].get('url', results[p].get('error', '?'))}"
        for p in platforms
    ])

    return {
        "record_id": record_id,
        "results": results,
        "all_ok": all_ok,
        "summary_urls": summary_urls,
    }


# ------------------------------------------------------------------
# Write single summary result to Feishu
# ------------------------------------------------------------------

def write_feishu_result(driver, record_id: str, all_ok: bool, summary_urls: str) -> bool:
    """
    Write a SINGLE summary result to Feishu after all channels are done.
    One write per record, not per platform.
    """
    if all_ok:
        return driver.mark_published(record_id, summary_urls)
    else:
        return driver.mark_failed(record_id, summary_urls)


# ------------------------------------------------------------------
# Process all confirmed+due posts from Feishu
# ------------------------------------------------------------------

async def process_confirmed_posts(dry_run: bool = False) -> dict:
    """
    Fetch all confirmed+due posts from Feishu, publish to all platforms,
    write back a single summary result per record.
    Returns {total, ok, fail, details: [...]}
    """
    from scripts.feishu_driver import FeishuDriver

    print(f"\n{'='*60}")
    print(f"  Publish Engine — unified 3-channel posting")
    if dry_run:
        print(f"  DRY RUN — no actual posting")
    print(f"{'='*60}")

    try:
        driver = FeishuDriver()
    except RuntimeError as e:
        print(f"\n  [ERROR] {e}\n")
        return {"total": 0, "ok": 0, "fail": 0, "details": []}

    posts = driver.get_confirmed_posts()
    if not posts:
        print("  No confirmed posts ready to publish.\n")
        return {"total": 0, "ok": 0, "fail": 0, "details": []}

    print(f"\n  Found {len(posts)} confirmed post(s)\n")

    total_ok = 0
    total_fail = 0
    details = []

    for i, post in enumerate(posts):
        record_id = post["record_id"]
        fields = post["fields"]

        title = driver.get_text(fields, "大标题")
        body = driver.get_text(fields, "文本")
        tags = driver.get_text(fields, "标签")
        x_text = driver.get_text(fields, "x_text")

        # Compose full text (for FB/IG)
        parts = []
        if title:
            parts.append(title)
        if body:
            parts.append(body)
        if tags:
            parts.append(f"\n\n{tags}")
        full_text = "\n\n".join(parts) if parts else body

        platforms_raw = fields.get("平台", "FB")
        if isinstance(platforms_raw, list):
            platforms = [str(p).lower() for p in platforms_raw]
        elif isinstance(platforms_raw, str):
            platforms = [p.strip().lower() for p in platforms_raw.replace("+", " ").split()]
        else:
            platforms = ["fb"]

        print(f"  [{i+1}/{len(posts)}] [{record_id[:16]}...]")
        print(f"       Title: {title[:50]}...")
        print(f"       Platforms: {platforms}")

        result = await publish_record(
            record_id=record_id,
            full_text=full_text,
            x_text=x_text,
            platforms=platforms,
            driver=driver,
            fields=fields,
            dry_run=dry_run,
        )

        # Write back SINGLE summary (not per-platform)
        if not dry_run:
            write_feishu_result(driver, record_id, result["all_ok"], result["summary_urls"])

        if result["all_ok"]:
            total_ok += 1
        else:
            total_fail += 1

        details.append(result)

        # Status line
        statuses = " ".join([
            f"{p.upper()}:{'✅' if r.get('success') else '❌'}"
            for p, r in result["results"].items()
        ])
        print(f"       {statuses}")
        print(f"       Feishu: {'已发布' if result['all_ok'] else '失败'} — {result['summary_urls'][:80]}")

        # Sleep between posts
        if i < len(posts) - 1:
            print(f"       Waiting 35 seconds...")
            await asyncio.sleep(35)

    print(f"\n{'='*60}")
    print(f"  Publish complete: {total_ok} OK, {total_fail} failed")
    if dry_run:
        print(f"  DRY RUN — nothing was actually posted")
    print(f"{'='*60}\n")

    return {"total": len(posts), "ok": total_ok, "fail": total_fail, "details": details}


# ------------------------------------------------------------------
# Publish a single record by ID (for Web UI)
# ------------------------------------------------------------------

async def publish_single_record(
    record_id: str,
    full_text: str,
    x_text: str,
    platforms: list[str],
    image_path: Optional[str] = None,
    record_fields: Optional[dict] = None,
) -> dict:
    """
    Publish a single record (from Web UI). Returns {fb, ig, x} results dict
    plus a summary string suitable for Feishu writeback.
    """
    result = await publish_record(
        record_id=record_id,
        full_text=full_text,
        x_text=x_text,
        platforms=platforms,
        image_path=image_path,
        fields=record_fields,
    )

    # Also write to Feishu if we have the record_id
    # web_ records use a separate writeback path (handled in server.py)
    if record_id and not record_id.startswith("web_"):
        try:
            from scripts.feishu_driver import FeishuDriver
            driver = FeishuDriver()
            write_feishu_result(driver, record_id, result["all_ok"], result["summary_urls"])
            result["feishu_updated"] = True
        except Exception as e:
            logger.error(f"Feishu writeback failed: {e}")
            result["feishu_updated"] = False
    elif record_id.startswith("web_"):
        result["feishu_updated"] = False  # caller (server.py) handles writeback

    return result


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------

async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Publish Engine — unified 3-channel posting")
    parser.add_argument("--dry-run", action="store_true", help="Preview without posting")
    parser.add_argument("--record-id", type=str, help="Publish a specific record")
    parser.add_argument("--text", type=str, help="Post text (with --record-id)")
    parser.add_argument("--x-text", type=str, default="", help="X tweet text")
    parser.add_argument("--image", type=str, help="Image path")
    parser.add_argument("--platforms", type=str, default="fb,ig,x", help="Comma-separated platforms")
    args = parser.parse_args()

    if args.record_id:
        platforms = [p.strip().lower() for p in args.platforms.split(",")]
        result = await publish_single_record(
            record_id=args.record_id,
            full_text=args.text or "Test post from iENYRID",
            x_text=args.x_text or (args.text or "")[:280],
            platforms=platforms,
            image_path=args.image,
        )
        print(f"\n  Results: {json.dumps(result['results'], indent=2, ensure_ascii=False)}")
        print(f"  Summary: {result['summary_urls']}")
    else:
        await process_confirmed_posts(dry_run=args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
