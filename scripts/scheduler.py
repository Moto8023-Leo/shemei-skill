"""
Content queue scheduler -- scheduled + manual posting

Usage:
    python scripts/scheduler.py --add --text "content" --image "content/pic.png" --platform fb,x --time "2026-07-07 10:00"
    python scripts/scheduler.py --run
    python scripts/scheduler.py --list
    python scripts/scheduler.py --delete <task_id>
    python scripts/scheduler.py --clean
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Fix Windows console encoding for emoji support
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.fb_api import post_to_facebook
from scripts.x_api import post_to_x
from scripts.ig_api import post_to_instagram

QUEUE_FILE = ROOT_DIR / "content_queue.json"
LOG_FILE = ROOT_DIR / "posted_log.json"

logger = logging.getLogger(__name__)


def load_queue() -> list:
    if not QUEUE_FILE.exists():
        return []
    try:
        with open(QUEUE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_queue(queue: list):
    with open(QUEUE_FILE, "w", encoding="utf-8") as f:
        json.dump(queue, f, ensure_ascii=False, indent=2)


def load_log() -> list:
    if not LOG_FILE.exists():
        return []
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def save_log(log: list):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=2)


def append_log(entry: dict):
    log = load_log()
    log.append(entry)
    save_log(log)


async def add_task(text: str, platforms: list, scheduled_time: str, image: Optional[str] = None):
    queue = load_queue()
    task = {
        "id": str(uuid.uuid4())[:8],
        "text": text,
        "image": image,
        "platforms": platforms,
        "scheduled_time": scheduled_time,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    queue.append(task)
    save_queue(queue)
    print(f"\n  Task added to queue:")
    print(f"     ID:      {task['id']}")
    print(f"     Text:    {text[:60]}{'...' if len(text) > 60 else ''}")
    print(f"     Image:   {image or 'none'}")
    print(f"     Platforms: {', '.join(platforms)}")
    print(f"     Time:    {scheduled_time}")
    print(f"\n  Windows Task Scheduler checks queue every 5 minutes.")


async def run_due_tasks():
    queue = load_queue()
    now = datetime.now()
    due_tasks = []
    for task in queue:
        if task.get("status") != "pending":
            continue
        scheduled = datetime.fromisoformat(task["scheduled_time"])
        if scheduled <= now:
            due_tasks.append(task)

    if not due_tasks:
        logger.info("No due tasks")
        return

    print(f"\n{'='*60}")
    print(f"  Running {len(due_tasks)} due task(s)")
    print(f"{'='*60}")

    for i, task in enumerate(due_tasks):
        print(f"\n  [{i+1}/{len(due_tasks)}] ID: {task['id']} - {task['text'][:50]}...")
        platforms = task.get("platforms", [])
        image_path = task.get("image")

        for platform in platforms:
            platform = platform.strip().lower()
            print(f"    -> Posting to {platform.upper()}...")
            try:
                if platform == "fb":
                    img_abs = str(ROOT_DIR / image_path) if image_path else None
                    result = await post_to_facebook(text=task["text"], image_path=img_abs, cross_post_instagram=True)
                elif platform == "x":
                    img_abs = str(ROOT_DIR / image_path) if image_path else None
                    result = await post_to_x(text=task["text"], image_path=img_abs)
                elif platform == "ig":
                    img_abs = str(ROOT_DIR / image_path) if image_path else None
                    result = await post_to_instagram(caption=task["text"], image_path=img_abs)
                else:
                    print(f"    [WARN] Unknown platform: {platform}")
                    continue
                log_entry = {
                    "id": task["id"],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "text": task["text"][:100],
                    "image": task.get("image"),
                    "platform": platform,
                    **result,
                }
                append_log(log_entry)
                if result.get("success"):
                    print(f"    [OK] {platform.upper()} posted")
                else:
                    print(f"    [FAIL] {platform.upper()}: {result.get('error', 'unknown')}")
            except Exception as e:
                print(f"    [ERROR] {platform.upper()}: {e}")
                append_log({
                    "id": task["id"], "timestamp": datetime.now(timezone.utc).isoformat(),
                    "text": task["text"][:100], "image": task.get("image"),
                    "platform": platform, "success": False, "error": str(e),
                })

        task["status"] = "completed"
        save_queue(queue)
        if i < len(due_tasks) - 1:
            print(f"\n    Waiting 35 seconds before next post...")
            await asyncio.sleep(35)

    print(f"\n{'='*60}")
    print(f"  All {len(due_tasks)} task(s) complete")
    print(f"{'='*60}\n")


def list_tasks():
    queue = load_queue()
    if not queue:
        print("\n  Queue is empty.\n")
        return
    print(f"\n{'='*80}")
    print(f"  Content Queue ({len(queue)} items)")
    print(f"{'='*80}")
    for t in queue:
        icon = {"pending": "[PENDING]", "completed": "[DONE]", "failed": "[FAILED]"}.get(t.get("status"), "[?]")
        print(f"  {icon} [{t['id']}] {t['scheduled_time']}")
        print(f"       {t['text'][:70]}")
        print(f"       Platforms: {', '.join(t.get('platforms', []))} | Image: {t.get('image') or 'none'}")
        print()
    print(f"{'='*80}\n")


def delete_task(task_id: str):
    queue = load_queue()
    new_queue = [t for t in queue if t["id"] != task_id]
    if len(new_queue) == len(queue):
        print(f"\n  [WARN] Task not found: {task_id}\n")
        return
    save_queue(new_queue)
    print(f"\n  [OK] Task deleted: {task_id}\n")


def clean_completed():
    queue = load_queue()
    new_queue = [t for t in queue if t.get("status") != "completed"]
    removed = len(queue) - len(new_queue)
    save_queue(new_queue)
    print(f"\n  [OK] Cleaned {removed} completed record(s)\n")


# ------------------------------------------------------------------
# Feishu Bitable mode
# ------------------------------------------------------------------

async def _post_single(text: str, platform: str, image_path: Optional[str] = None) -> dict:
    """Post to a single platform. Returns {success, url, error, ...}"""
    if platform == "fb":
        return await post_to_facebook(text=text, image_path=image_path)
    elif platform == "x":
        return await post_to_x(text=text, image_path=image_path)
    elif platform == "ig":
        return await post_to_instagram(caption=text, image_path=image_path or "")
    else:
        return {"success": False, "error": f"Unknown platform: {platform}"}


async def run_feishu_tasks():
    """Fetch confirmed+due posts from Feishu, publish, write single summary back.
    Now delegates to publish_engine.py for unified 3-channel posting."""
    from scripts.publish_engine import process_confirmed_posts
    await process_confirmed_posts(dry_run=False)


async def main():
    parser = argparse.ArgumentParser(description="Social post scheduler")
    parser.add_argument("--add", action="store_true")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--delete", type=str, metavar="TASK_ID")
    parser.add_argument("--clean", action="store_true")
    parser.add_argument("--text", type=str)
    parser.add_argument("--image", type=str)
    parser.add_argument("--platform", type=str)
    parser.add_argument("--time", type=str)
    parser.add_argument("--from-feishu", action="store_true",
                        help="Run due tasks from Feishu Bitable instead of local queue")
    args = parser.parse_args()

    if args.add:
        if not args.text or not args.platform or not args.time:
            print('\n  [WARN] --add requires --text, --platform, --time\n')
            return
        platforms = [p.strip() for p in args.platform.split(",")]
        await add_task(args.text, platforms, args.time, args.image)
    elif args.run:
        if args.from_feishu:
            await run_feishu_tasks()
        else:
            await run_due_tasks()
    elif args.list:
        list_tasks()
    elif args.delete:
        delete_task(args.delete)
    elif args.clean:
        clean_completed()
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
