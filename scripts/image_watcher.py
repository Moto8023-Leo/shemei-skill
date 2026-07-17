"""
Image Watcher — monitors images/incoming/ folder, matches to Feishu records,
uploads as attachments, archives to images/processed/.

Usage:
    python scripts/image_watcher.py              # scan once
    python scripts/image_watcher.py --watch      # watch continuously (for daemon)
    python scripts/image_watcher.py --dry-run    # preview matches without uploading

Matching logic:
    - Image filename format: {match_code}.{ext}  e.g. 0709-1.png
    - Match code is assigned by content_factory.py (e.g. 0709-1)
    - Script reads Feishu records to find matching 匹配码 field
    - Uploads image as attachment, sets 审核状态→已确认
    - Moves file to images/processed/
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
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

ROOT_DIR = Path(__file__).resolve().parent.parent
INCOMING_DIR = ROOT_DIR / "images" / "incoming"
PROCESSED_DIR = ROOT_DIR / "images" / "processed"

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def ensure_dirs():
    """Create required directories if they don't exist."""
    INCOMING_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def scan_incoming() -> list[Path]:
    """Scan incoming directory for supported image files."""
    ensure_dirs()
    images = []
    for f in sorted(INCOMING_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTS:
            images.append(f)
    return images


def parse_match_code(filename: str) -> str:
    """
    Extract match code from filename.
    Expected format: {match_code}.{ext}  e.g. '0709-1.png'
    Also supports: '0709-1_something.png' (extra text after code)
    """
    stem = Path(filename).stem  # Remove extension
    # Try to match MMDD-NN pattern
    import re
    m = re.match(r'^(\d{4}-\d+)', stem)
    if m:
        return m.group(1)
    # Fallback: try to match anything that looks like MMDD-N
    m = re.match(r'^(\d{4}-\d)', stem)
    if m:
        return m.group(1)
    return stem  # Fallback: use full stem


def find_matching_record(driver, match_code: str) -> dict | None:
    """
    Find a Feishu record with the given 匹配码.
    Returns {record_id, fields} or None.
    """
    import requests

    app_token = driver.app_token
    table_id = driver.table_id
    base_url = driver._base_url
    headers = driver._get_headers()

    page_token = None
    while True:
        params = {"page_size": 100}
        if page_token:
            params["page_token"] = page_token

        resp = requests.get(
            f"{base_url}/apps/{app_token}/tables/{table_id}/records",
            headers=headers, params=params, timeout=30
        )
        data = resp.json()
        if data.get("code") != 0:
            logger.error(f"Feishu search error: {data}")
            break

        items = data.get("data", {}).get("items", [])
        for item in items:
            fields = item.get("fields", {})
            record_code = driver.get_text(fields, "匹配码")
            if record_code == match_code:
                return {
                    "record_id": item.get("record_id", ""),
                    "fields": fields,
                }

        if not data.get("data", {}).get("has_more"):
            break
        page_token = data.get("data", {}).get("page_token")

    return None


def process_image(driver, image_path: Path, dry_run: bool = False) -> dict:
    """
    Process a single image: match → upload → archive.
    Returns {status, match_code, record_id, error}
    """
    result = {
        "filename": image_path.name,
        "match_code": "",
        "record_id": "",
        "status": "unknown",
        "error": "",
    }

    match_code = parse_match_code(image_path.name)
    result["match_code"] = match_code

    logger.info(f"Processing: {image_path.name} → match_code={match_code}")

    # Find matching record
    record = find_matching_record(driver, match_code)
    if not record:
        result["status"] = "no_match"
        result["error"] = f"No Feishu record found with 匹配码='{match_code}'"
        logger.warning(result["error"])
        return result

    record_id = record["record_id"]
    result["record_id"] = record_id

    # Check current status
    fields = record["fields"]
    review_status = driver.get_text(fields, "审核状态") or fields.get("审核状态", "")

    if review_status == "已确认":
        logger.info(f"  Record {record_id} already confirmed, skipping (will still archive)")
        # Still move to processed to avoid re-processing
        result["status"] = "already_confirmed"
    elif review_status in ("已生成", "草稿"):
        # Upload and confirm
        if dry_run:
            logger.info(f"  [DRY RUN] Would upload {image_path} to record {record_id}")
            result["status"] = "dry_run"
        else:
            ok = driver.upload_attachment(record_id, str(image_path), field_name="图片")
            if ok:
                # Now mark as confirmed (image uploaded = ready to publish)
                driver.mark_image_uploaded(record_id)
                logger.info(f"  Uploaded and confirmed: {record_id}")
                result["status"] = "uploaded"
            else:
                result["status"] = "upload_failed"
                result["error"] = "Attachment upload failed"
                logger.error(result["error"])
                return result  # Don't archive on failure
    else:
        logger.info(f"  Record {record_id} status={review_status}, skipping (not 已生成/草稿)")
        result["status"] = "wrong_status"
        return result  # Don't archive

    # Archive: move to processed/
    if not dry_run:
        dst = PROCESSED_DIR / image_path.name
        # Avoid overwriting: append number if exists
        if dst.exists():
            stem = image_path.stem
            ext = image_path.suffix
            counter = 1
            while dst.exists():
                dst = PROCESSED_DIR / f"{stem}_{counter}{ext}"
                counter += 1
        image_path.rename(dst)
        logger.info(f"  Archived: {image_path.name} → processed/")

    return result


def process_all(dry_run: bool = False) -> list[dict]:
    """Process all images in incoming/ directory."""
    import sys
    _root = Path(__file__).resolve().parent.parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from scripts.feishu_driver import FeishuDriver

    ensure_dirs()

    print(f"\n{'='*60}")
    print(f"  Image Watcher — scanning {INCOMING_DIR}")
    if dry_run:
        print(f"  DRY RUN mode")
    print(f"{'='*60}\n")

    images = scan_incoming()
    if not images:
        print(f"  No images found in images/incoming/")
        print(f"  Put images named as {{match_code}}.png (e.g. 0709-1.png)\n")
        return []

    print(f"  Found {len(images)} image(s)\n")

    try:
        driver = FeishuDriver()
    except RuntimeError as e:
        print(f"  [ERROR] {e}\n")
        return []

    results = []
    for i, img in enumerate(images):
        print(f"  [{i+1}/{len(images)}] {img.name}")
        r = process_image(driver, img, dry_run=dry_run)
        results.append(r)

        icon = {"uploaded": "[OK]", "already_confirmed": "[SKIP]", "dry_run": "[DRY]", "no_match": "[NO MATCH]", "upload_failed": "[FAIL]", "wrong_status": "[SKIP]"}.get(r["status"], "[?]")
        print(f"       {icon} {r['status']}: {r.get('error', '')}")

    ok = sum(1 for r in results if r["status"] in ("uploaded", "already_confirmed", "dry_run"))
    print(f"\n{'='*60}")
    print(f"  Done: {ok}/{len(images)} processed")
    if dry_run:
        print(f"  DRY RUN — nothing was uploaded")
    print(f"{'='*60}\n")

    return results


def watch_loop(interval: int = 30):
    """
    Continuously watch incoming/ directory.
    interval: seconds between scans (default 30s)
    """
    from scripts.feishu_driver import FeishuDriver

    ensure_dirs()
    print(f"\n  Image Watcher — watching {INCOMING_DIR} every {interval}s")
    print(f"  Press Ctrl+C to stop\n")

    try:
        driver = FeishuDriver()
    except RuntimeError as e:
        print(f"  [ERROR] {e}\n")
        return

    while True:
        images = scan_incoming()
        if images:
            print(f"\n  [{datetime.now().strftime('%H:%M:%S')}] Found {len(images)} image(s)")
            for img in images:
                r = process_image(driver, img)
                icon = "[OK]" if r["status"] in ("uploaded", "already_confirmed") else "[?]"
                print(f"       {icon} {img.name} → {r['status']}")

        time.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor and upload images to Feishu Bitable")
    parser.add_argument("--watch", action="store_true", help="Watch continuously")
    parser.add_argument("--dry-run", action="store_true", help="Preview without uploading")
    parser.add_argument("--interval", type=int, default=30, help="Watch interval in seconds (default: 30)")
    args = parser.parse_args()

    if args.watch:
        watch_loop(interval=args.interval)
    else:
        process_all(dry_run=args.dry_run)
