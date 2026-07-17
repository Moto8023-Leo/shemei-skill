"""
Content generator -- reads product CSV, calls Claude API, writes captions.
Returns structured data for the publisher to consume.

Usage:
    from scripts.content_generator import ContentGenerator
    cg = ContentGenerator(config)
    results = await cg.generate_all(limit=5)
"""

import asyncio
import logging
import os
from pathlib import Path
from typing import Optional

import pandas as pd
from dotenv import load_dotenv

from anthropic import AsyncAnthropic, RateLimitError, APIStatusError

load_dotenv()

logger = logging.getLogger(__name__)


class ContentGenerator:
    """Generate Instagram captions via Claude API from product CSV data."""

    def __init__(self, config: dict):
        self.config = config
        ac = config["anthropic"]
        self.model = ac["model"]
        self.fallback_model = ac.get("fallback_model", "claude-haiku-4-5-20251001")
        self.max_tokens = ac.get("max_tokens", 500)
        self.temperature = ac.get("temperature", 0.8)

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY not set. "
                "Create a .env file with: ANTHROPIC_API_KEY=sk-ant-..."
            )
        self.client = AsyncAnthropic(api_key=api_key)

        # Load prompt templates
        prompt_dir = Path(config["paths"]["prompt_dir"])
        if not prompt_dir.is_absolute():
            prompt_dir = Path(__file__).resolve().parent.parent / prompt_dir
        self.system_prompt = (prompt_dir / "caption_system.txt").read_text(encoding="utf-8")
        self.user_template = (prompt_dir / "caption_user_template.txt").read_text(encoding="utf-8")

        # Resolve data paths relative to project root
        root = Path(__file__).resolve().parent.parent
        self.csv_path = root / config["paths"]["data_dir"] / "products.csv"

    # ------------------------------------------------------------------
    # CSV helpers
    # ------------------------------------------------------------------

    def load_products(self, status_filter: str = "pending") -> pd.DataFrame:
        """Load products CSV, return DataFrame filtered by status."""
        if not self.csv_path.exists():
            raise FileNotFoundError(f"products.csv not found at: {self.csv_path}")
        df = pd.read_csv(self.csv_path)
        df.columns = df.columns.str.strip()
        return df[df["status"] == status_filter]

    def _update_status(self, product_id: str, new_status: str):
        """Update product status in CSV."""
        df = pd.read_csv(self.csv_path)
        df.columns = df.columns.str.strip()
        pid_col = df.columns[0]  # product_id column
        df.loc[df[pid_col].astype(str) == str(product_id), "status"] = new_status
        df.to_csv(self.csv_path, index=False)

    # ------------------------------------------------------------------
    # Prompt building
    # ------------------------------------------------------------------

    def build_prompt(self, product: pd.Series) -> str:
        """Interpolate product data into the user prompt template."""
        return self.user_template.format(
            product_name=product.get("product_name", "Product"),
            category=product.get("category", "General"),
            price=product.get("price", "N/A"),
            features=product.get("features", ""),
            tone=product.get("tone", "professional"),
        )

    def parse_response(self, text: str) -> dict:
        """Extract caption body and hashtags from Claude's response."""
        lines = text.strip().split("\n")
        hashtag_lines = [l for l in lines if l.strip().startswith("#")]
        body_lines = [l for l in lines if not l.strip().startswith("#")]
        caption = "\n".join(body_lines).strip()
        hashtags = " ".join(h.strip() for h in hashtag_lines).strip()
        return {"caption": caption, "hashtags": hashtags, "full_text": text.strip()}

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    async def generate_one(self, product: pd.Series, retries: int = 3) -> dict:
        """
        Generate caption for a single product.
        Retries up to 3 times with fallback model on API errors.
        """
        user_msg = self.build_prompt(product)
        last_error = None

        for attempt in range(1, retries + 1):
            model = self.model if attempt == 1 else self.fallback_model
            try:
                response = await self.client.messages.create(
                    model=model,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    system=self.system_prompt,
                    messages=[{"role": "user", "content": user_msg}],
                )
                text = response.content[0].text
                parsed = self.parse_response(text)
                parsed["product_id"] = str(product["product_id"])
                parsed["product_name"] = str(product.get("product_name", ""))
                parsed["image_filename"] = str(product.get("image_filename", ""))
                return parsed

            except (RateLimitError, APIStatusError) as e:
                last_error = e
                logger.warning(
                    f"Claude API error (attempt {attempt}/{retries}, model={model}): {e}"
                )
                if attempt < retries:
                    wait = 2 ** attempt
                    logger.info(f"Retrying in {wait}s...")
                    await asyncio.sleep(wait)
            except Exception as e:
                last_error = e
                logger.error(f"Unexpected error generating caption: {e}")
                if attempt < retries:
                    await asyncio.sleep(2)
                else:
                    raise

        raise last_error or RuntimeError("Failed to generate caption after retries")

    async def generate_all(self, limit: Optional[int] = None) -> list[dict]:
        """
        Generate captions for all pending products.
        Returns list of dicts ready for publisher consumption.
        """
        df = self.load_products("pending")
        if df.empty:
            logger.info("No pending products found.")
            return []

        if limit:
            df = df.head(limit)

        results = []
        for i, (_, product) in enumerate(df.iterrows()):
            logger.info(
                f"[{i+1}/{len(df)}] Generating caption for: {product.get('product_name', '?')}"
            )
            try:
                caption_data = await self.generate_one(product)
                results.append(caption_data)
                self._update_status(caption_data["product_id"], "generated")
                logger.info(f"  -> OK: {caption_data['caption'][:60]}...")
            except Exception as e:
                logger.error(f"  -> FAIL: {e}")
                self._update_status(str(product["product_id"]), "failed")

            # Pause between API calls
            if i < len(df) - 1:
                await asyncio.sleep(2)

        logger.info(f"Generated {len(results)} captions ({len(df) - len(results)} failed).")
        return results
