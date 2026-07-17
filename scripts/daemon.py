#!/usr/bin/env python3
"""
Social Auto Daemon — persistent background process.

Runs three loops:
  1. Content Factory   — once per day at 12:00 Beijing time
  2. Image Watcher     — every 60 seconds (monitors images/incoming/)
  3. Publish Engine    — every 60 seconds (checks for confirmed+due posts)

Usage:
    python scripts/daemon.py                    # run in foreground
    python scripts/daemon.py --once             # run one cycle and exit
    python scripts/daemon.py --factory-only     # only run content factory
    python scripts/daemon.py --publish-only     # only run publish engine

Time configuration:
    CONTENT_FACTORY_HOUR = 12   (12:00 Beijing time)
    PUBLISH_INTERVAL = 60       (check every 60 seconds)
    WATCHER_INTERVAL = 60       (scan incoming/ every 60 seconds)

To run as a Windows background task:
    pythonw scripts/daemon.py
Or use Windows Task Scheduler to start on boot.

Stop with Ctrl+C.
"""

import argparse
import asyncio
import logging
import os
import signal
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("daemon")

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

# --- Beijing time helpers ---
BEIJING_TZ = timezone(timedelta(hours=8))


def beijing_now() -> datetime:
    """Return current Beijing time as a naive datetime."""
    return datetime.now(tz=BEIJING_TZ).replace(tzinfo=None)


def beijing_hour() -> int:
    """Return current hour in Beijing time (0-23)."""
    return beijing_now().hour


# --- Config --- (now read from Feishu 自动化配置 table)
# Defaults used when config table is unavailable or disabled
DEFAULT_FACTORY_HOUR = 12
DEFAULT_PUBLISH_HOUR = 23
PUBLISH_INTERVAL = 60          # seconds between publish checks
WATCHER_INTERVAL = 60          # seconds between image watcher scans
CONFIG_CHECK_INTERVAL = 60     # seconds between config re-reads
CONTENT_FACTORY_DONE_TODAY = False  # flag to prevent running factory multiple times

# Dynamic config (refreshed from Feishu)
_current_config: dict = {"enabled": False, "factory_hour": DEFAULT_FACTORY_HOUR, "publish_hour": DEFAULT_PUBLISH_HOUR}


def _refresh_config() -> dict:
    """Re-read automation config from Feishu."""
    global _current_config
    try:
        from scripts.auto_config import get_config
        _current_config = get_config(force_refresh=True)
    except Exception as e:
        logger.warning(f"Config refresh failed: {e} — keeping current: {_current_config}")
    return _current_config


def _config_enabled() -> bool:
    """Check if automation is enabled."""
    return _current_config.get("enabled", False)


def _factory_hour() -> int:
    """Get configured content factory hour."""
    return _current_config.get("factory_hour", DEFAULT_FACTORY_HOUR)


def _publish_hour() -> int:
    """Get configured publish hour."""
    return _current_config.get("publish_hour", DEFAULT_PUBLISH_HOUR)


async def run_content_factory():
    """Run content factory if it hasn't run today."""
    global CONTENT_FACTORY_DONE_TODAY
    if CONTENT_FACTORY_DONE_TODAY:
        return

    logger.info("Running content factory...")
    try:
        from scripts.content_factory import process_drafts
        # Run in thread to not block
        await asyncio.to_thread(process_drafts, False)
        CONTENT_FACTORY_DONE_TODAY = True
        logger.info("Content factory complete")
    except Exception as e:
        logger.error(f"Content factory error: {e}")


async def run_image_watcher():
    """Scan images/incoming/ and upload matching files."""
    try:
        from scripts.image_watcher import process_all
        await asyncio.to_thread(process_all, False)
    except Exception as e:
        logger.error(f"Image watcher error: {e}")


async def run_publish_engine():
    """Check for confirmed+due posts and publish."""
    try:
        from scripts.publish_engine import process_confirmed_posts
        await process_confirmed_posts(dry_run=False)
    except Exception as e:
        logger.error(f"Publish engine error: {e}")


# --- Daemon time helpers ---
def reset_daily_flags():
    """Reset daily flags at midnight."""
    global CONTENT_FACTORY_DONE_TODAY
    CONTENT_FACTORY_DONE_TODAY = False


async def daemon_loop():
    """Main daemon loop."""
    print(f"\n{'='*60}")
    print(f"  Social Auto Daemon")
    # Initialize config
    _refresh_config()
    cfg = _current_config
    print(f"  Automation: {'🟢 ON' if cfg['enabled'] else '🔴 OFF'}")
    print(f"  Content Factory: daily at {cfg['factory_hour']:02d}:00 Beijing")
    print(f"  Publish Engine:  daily at {cfg['publish_hour']:02d}:00 Beijing")
    print(f"  Image Watcher:   every {WATCHER_INTERVAL}s")
    print(f"  Publish Engine:  every {PUBLISH_INTERVAL}s")
    print(f"  Time now:        {beijing_now().strftime('%Y-%m-%d %H:%M:%S')} Beijing")
    print(f"{'='*60}")
    print(f"\n  Press Ctrl+C to stop\n")

    last_factory_day = ""
    last_watcher = 0
    last_publish = 0
    last_config_check = 0

    while True:
        now = time.time()
        bj = beijing_now()
        today_key = bj.strftime("%Y%m%d")
        hour = bj.hour

        # Reset daily flags at midnight
        if today_key != last_factory_day:
            reset_daily_flags()
            last_factory_day = today_key
            logger.info(f"New day: {today_key}")

        # Re-read config from Feishu periodically
        if now - last_config_check >= CONFIG_CHECK_INTERVAL:
            last_config_check = now
            _refresh_config()

        # Skip everything if automation is disabled
        if not _config_enabled():
            await asyncio.sleep(10)
            continue

        # --- Content Factory: trigger at configured hour ---
        if hour == _factory_hour() and not CONTENT_FACTORY_DONE_TODAY:
            logger.info(f"⏰ {_factory_hour():02d}:00 — triggering content factory")
            await run_content_factory()
            await asyncio.sleep(5)

        # --- Image Watcher: every WATCHER_INTERVAL seconds ---
        if now - last_watcher >= WATCHER_INTERVAL:
            last_watcher = now
            await run_image_watcher()

        # --- Publish Engine: at configured hour ---
        if hour == _publish_hour():
            if now - last_publish >= PUBLISH_INTERVAL:
                last_publish = now
                await run_publish_engine()

        # Sleep 10 seconds between checks (responsive enough for both watcher and publisher)
        await asyncio.sleep(10)


async def run_once():
    """Run one full cycle: factory + watcher + publish."""
    logger.info("Running one cycle...")

    await run_content_factory()
    await asyncio.sleep(1)
    await run_image_watcher()
    await asyncio.sleep(1)
    await run_publish_engine()

    logger.info("Cycle complete")


async def main():
    parser = argparse.ArgumentParser(description="Social Auto Daemon")
    parser.add_argument("--once", action="store_true", help="Run one cycle and exit")
    parser.add_argument("--factory-only", action="store_true", help="Only run content factory")
    parser.add_argument("--publish-only", action="store_true", help="Only run publish engine")
    args = parser.parse_args()

    if args.factory_only:
        await run_content_factory()
    elif args.publish_only:
        await run_publish_engine()
    elif args.once:
        await run_once()
    else:
        # Handle Ctrl+C gracefully
        stop_event = asyncio.Event()

        def _handler(signum, frame):
            logger.info("Shutting down...")
            stop_event.set()

        signal.signal(signal.SIGINT, _handler)
        signal.signal(signal.SIGTERM, _handler)

        daemon_task = asyncio.create_task(daemon_loop())

        try:
            await stop_event.wait()
        except KeyboardInterrupt:
            pass

        daemon_task.cancel()
        try:
            await daemon_task
        except asyncio.CancelledError:
            pass

        print(f"\n  Daemon stopped. Goodbye!\n")


if __name__ == "__main__":
    asyncio.run(main())
