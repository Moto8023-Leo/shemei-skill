"""
IG Pipeline -- orchestrates: load products -> generate captions -> post to Instagram.
Can be called from CLI or scheduler.

Usage:
    python scripts/ig_pipeline.py --limit 3           # Generate + post 3 products
    python scripts/ig_pipeline.py --limit 1 --dry-run  # Generate captions only, no posting
    python scripts/ig_pipeline.py --only-post          # Post already-generated captions
    python scripts/ig_pipeline.py --limit 1 --only-generate  # Generate captions only, no posting
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from scripts.content_generator import ContentGenerator
from scripts.ig_api import post_to_instagram
from scripts.config_loader import load_config

LOG_FILE = ROOT_DIR / "logs" / "published.json"
logger = logging.getLogger("ig_pipeline")


class IGPipeline:
    """Orchestrates the full Instagram content + publish workflow."""

    def __init__(self):
        self.config = load_config()
        self.generator = ContentGenerator(self.config)
        self.image_dir = self._resolve_path(self.config["paths"]["image_dir"])

    def _resolve_path(self, p: str) -> Path:
        """Resolve config path relative to project root."""
        path = Path(p)
        if not path.is_absolute():
            path = ROOT_DIR / path
        return path

    async def generate_captions(self, limit: Optional[int] = None) -> list[dict]:
        """Step 1: Generate captions via Claude API for pending products."""
        return await self.generator.generate_all(limit=limit)

    async def post_generated(self, limit: Optional[int] = None, dry_run: bool = False) -> list[dict]:
        """Step 2: Post products whose status is 'generated'."""
        df = self.generator.load_products("generated")
        if df.empty:
            logger.info("No 'generated' products to post.")
            return []

        if limit:
            df = df.head(limit)

        results = []
        for i, (_, product) in enumerate(df.iterrows()):
            pid = str(product["product_id"])
            img_name = str(product.get("image_filename", ""))
            image_path = self.image_dir / img_name

            if not image_path.exists():
                logger.error(f"[{i+1}/{len(df)}] Image missing: {image_path}, skipping {pid}")
                self.generator._update_status(pid, "failed")
                continue

            # Build caption from CSV (used when caption was pre-generated)
            caption = str(product.get("caption", product.get("product_name", "")))
            hashtags = str(product.get("hashtags", ""))

            logger.info(f"[{i+1}/{len(df)}] Posting: {pid} - {img_name}")

            if dry_run:
                logger.info(f"  [DRY RUN] Would post: {caption[:80]}...")
                results.append({
                    "product_id": pid,
                    "success": True,
                    "dry_run": True,
                    "caption_preview": caption[:100],
                })
                continue

            result = await post_to_instagram(
                caption=caption,
                image_path=str(image_path.resolve()),
                hashtags=hashtags if hashtags else None,
            )

            self._append_log({
                "product_id": pid,
                "product_name": str(product.get("product_name", "")),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "caption": caption[:100],
                "image": img_name,
                **result,
            })

            if result["success"]:
                self.generator._update_status(pid, "published")
                logger.info(f"  [OK] {pid} published")
            else:
                logger.error(f"  [FAIL] {pid}: {result.get('error', 'unknown')}")

            results.append(result)

            # Cooldown between posts
            if i < len(df) - 1:
                interval = self.config.get("instagram", {}).get("delays", {}).get("post_interval", 45)
                logger.info(f"  Waiting {interval}s until next post...")
                await asyncio.sleep(interval)

        return results

    async def run(self, limit: Optional[int] = None, dry_run: bool = False,
                  only_generate: bool = False, only_post: bool = False):
        """
        Run the full pipeline or specific stages.

        Args:
            limit: Max number of products to process
            dry_run: Generate captions but don't actually post
            only_generate: Only generate captions, skip posting
            only_post: Only post already-generated captions
        """
        if only_post:
            # Post products that already have generated captions
            logger.info("=== Posting generated captions ===")
            await self.post_generated(limit=limit, dry_run=dry_run)
            return

        # Step 1: Generate captions
        logger.info("=== Step 1: Generating captions ===")
        posts = await self.generate_captions(limit=limit)

        if not posts:
            logger.info("No pending products to process.")
            return

        logger.info(f"Generated {len(posts)} captions.")

        if only_generate:
            logger.info("=== Done (generate only) ===")
            return

        # Step 2: Post to Instagram
        logger.info("=== Step 2: Posting to Instagram ===")
        for i, post in enumerate(posts):
            image_path = self.image_dir / post["image_filename"]
            if not image_path.exists():
                logger.error(f"[{i+1}/{len(posts)}] Image missing: {image_path}, skipping {post['product_id']}")
                self.generator._update_status(post["product_id"], "failed")
                continue

            logger.info(f"[{i+1}/{len(posts)}] Posting: {post['product_id']} - {post['image_filename']}")

            if dry_run:
                logger.info(f"  [DRY RUN] Would post:\n  {post['full_text'][:120]}...")
                continue

            result = await post_to_instagram(
                caption=post["caption"],
                image_path=str(image_path.resolve()),
                hashtags=post.get("hashtags"),
            )

            self._append_log({
                "product_id": post["product_id"],
                "product_name": post.get("product_name", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "caption": post["full_text"][:100],
                "image": post["image_filename"],
                **result,
            })

            if result["success"]:
                self.generator._update_status(post["product_id"], "published")
                logger.info(f"  [OK] {post['product_id']} published")
            else:
                logger.error(f"  [FAIL] {post['product_id']}: {result.get('error', 'unknown')}")

            # Cooldown between posts
            if i < len(posts) - 1:
                interval = self.config.get("instagram", {}).get("delays", {}).get("post_interval", 45)
                logger.info(f"  Waiting {interval}s until next post...")
                await asyncio.sleep(interval)

        logger.info("=== Pipeline complete ===")

    def _append_log(self, entry: dict):
        """Append a posted entry to the log file."""
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        log = []
        if LOG_FILE.exists():
            try:
                log = json.loads(LOG_FILE.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, FileNotFoundError):
                log = []
        log.append(entry)
        LOG_FILE.write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")


# ------------------------------------------------------------------
# CLI entry
# ------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(
        description="Instagram auto-publisher pipeline -- generate captions + post"
    )
    parser.add_argument("--limit", "-l", type=int, default=None,
                        help="Max number of products to process")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview only, do not actually post")
    parser.add_argument("--only-generate", action="store_true",
                        help="Only generate captions, skip posting")
    parser.add_argument("--only-post", action="store_true",
                        help="Only post already-generated captions")
    args = parser.parse_args()

    pipeline = IGPipeline()
    await pipeline.run(
        limit=args.limit,
        dry_run=args.dry_run,
        only_generate=args.only_generate,
        only_post=args.only_post,
    )


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    asyncio.run(main())
