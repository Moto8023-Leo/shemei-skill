"""
One-click manual post entry point

Usage:
    python post_now.py "Hello World!" --platform x
    python post_now.py "Post with image" --image "D:\\images\\photo.png" --platform fb,x
    python post_now.py "FB Only" --platform fb --no-cross-post
    python post_now.py "Preview" --platform fb --dry-run
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.fb_api import post_to_facebook
from scripts.x_api import post_to_x
from scripts.ig_api import post_to_instagram

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("post_now")

LOG_FILE = ROOT_DIR / "posted_log.json"


def save_log(entry: dict):
    log = []
    if LOG_FILE.exists():
        try:
            with open(LOG_FILE, "r", encoding="utf-8") as f:
                log = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            log = []
    log.append(entry)
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


async def publish(
    text: str,
    platforms: list,
    image_path: Optional[str] = None,
    cross_post_instagram: bool = True,
    dry_run: bool = False,
):
    if image_path:
        img = Path(image_path)
        if not img.is_absolute():
            absolute_img = ROOT_DIR / image_path
        else:
            absolute_img = img
        if not absolute_img.exists():
            print(f"\n  [ERROR] Image not found: {absolute_img}")
            return
        image_path = str(absolute_img)

    print(f"\n{'='*60}")
    task_names = [{"fb": "Facebook (+Instagram)", "x": "X (Twitter)", "ig": "Instagram"}.get(p, p) for p in platforms]
    print(f"  Posting to: {', '.join(task_names)}")
    print(f"  Text length: {len(text)} chars")
    print(f"  Image: {image_path or 'none'}")
    if dry_run:
        print(f"  MODE: DRY RUN - will not actually post")
    print(f"{'='*60}\n")

    if dry_run:
        print("  [DRY RUN] Content preview:\n")
        print(f"  {text}")
        print()
        return

    total_success = 0
    total_fail = 0

    for i, platform in enumerate(platforms):
        platform = platform.strip().lower()

        if i > 0:
            print("  Waiting 35 seconds between posts...")
            await asyncio.sleep(35)

        try:
            if platform == "fb":
                result = await post_to_facebook(
                    text=text,
                    image_path=image_path,
                    cross_post_instagram=cross_post_instagram,
                )
            elif platform == "x":
                result = await post_to_x(
                    text=text,
                    image_path=image_path,
                )
            elif platform == "ig":
                result = await post_to_instagram(
                    caption=text,
                    image_path=image_path,
                )
            else:
                print(f"  [WARN] Unknown platform: {platform}")
                continue

            log_entry = {
                "id": f"manual-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "text": text[:100],
                "image": image_path,
                "platform": platform,
                **result,
            }
            save_log(log_entry)

            if result.get("success"):
                total_success += 1
                display = result.get("platforms", [platform])
                print(f"  [OK] {'+'.join(display).upper()} posted successfully!")
            else:
                total_fail += 1
                print(f"  [FAIL] {platform.upper()} failed: {result.get('error', 'unknown error')}")

        except Exception as e:
            total_fail += 1
            print(f"  [ERROR] {platform.upper()} exception: {e}")
            save_log({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "text": text[:100],
                "image": image_path,
                "platform": platform,
                "success": False,
                "error": str(e),
            })

    print(f"\n{'='*60}")
    print(f"  Done: {total_success} success, {total_fail} fail")
    print(f"  Log: {LOG_FILE.resolve()}")
    print(f"{'='*60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Social one-click post - browser automation, no API token needed",
    )
    parser.add_argument("text", type=str, help="Post text content")
    parser.add_argument("--image", "-i", type=str, help="Image file path")
    parser.add_argument(
        "--platform", "-p",
        type=str,
        default="fb,x",
        help="Target platforms, comma-separated: fb, x (default: fb,x)",
    )
    parser.add_argument(
        "--no-cross-post",
        action="store_true",
        help="Do NOT cross-post FB post to Instagram",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview only, do not actually post",
    )
    args = parser.parse_args()
    platforms = [p.strip().lower() for p in args.platform.split(",")]

    asyncio.run(publish(
        text=args.text,
        platforms=platforms,
        image_path=args.image,
        cross_post_instagram=not args.no_cross_post,
        dry_run=args.dry_run,
    ))


if __name__ == "__main__":
    main()
