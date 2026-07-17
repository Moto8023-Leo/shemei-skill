"""
Brand Config — maps brand names to their Feishu table IDs and social media credentials.

All brand tables live in the same Bitable document (FEISHU_APP_TOKEN).
Each brand gets 3 tables + social credentials:
  - {brand}数据表     → schedule/content
  - {brand}数据表2    → product catalog
  - {brand}自动化     → automation config
  - fb_page_id, fb_access_token, ig_user_id → Facebook/Instagram
  - x_cookies_file → X/Twitter cookie file

Usage:
    from scripts.brand_config import list_brands, resolve_tables, get_credentials
    brands = list_brands()
    tables = resolve_tables("iENYRID")
    creds = get_credentials("iENYRID")  # {"fb_page_id":"...", "x_cookies_file":"..."}
"""

import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("brand_config")

DEFAULT_BRAND = "iENYRID"

BRAND_TABLES = {
    "iENYRID": {
        "schedule_table_id": "tblTZTeXWry93slq",
        "product_table_id": "tblHbkPBjJ3uQOf9",
        "config_table_id": "tblS9CatxxC9og5e",
        "fb_page_id": os.getenv("IENYRID_FB_PAGE_ID") or os.getenv("FB_PAGE_ID", ""),
        "fb_access_token": os.getenv("IENYRID_FB_ACCESS_TOKEN") or os.getenv("FB_ACCESS_TOKEN", ""),
        "ig_user_id": os.getenv("IENYRID_IG_USER_ID") or os.getenv("IG_USER_ID", ""),
        "x_cookies_file": "x_cookies.json",
    },
    "Kukirin": {
        "schedule_table_id": "tblw90DsOkPcqp5T",
        "product_table_id": "tblLuzRzU99fBwqw",
        "config_table_id": "tblWu2mnf0637FX9",
        "fb_page_id": os.getenv("KUKIRIN_FB_PAGE_ID", ""),
        "fb_access_token": os.getenv("KUKIRIN_FB_ACCESS_TOKEN", ""),
        "ig_user_id": os.getenv("KUKIRIN_IG_USER_ID", ""),
        "x_cookies_file": "x_cookies_kukirin.json",
    },
}


def list_brands() -> list[str]:
    """Return all available brand names for the frontend dropdown."""
    return list(BRAND_TABLES.keys())


def resolve_tables(brand: str) -> dict:
    """
    Resolve table IDs for a brand.
    Falls back to DEFAULT_BRAND if the requested brand doesn't exist.

    Returns:
        {"brand": "iENYRID", "schedule_table_id": "...",
         "product_table_id": "...", "config_table_id": "..."}
    """
    if brand in BRAND_TABLES:
        tables = BRAND_TABLES[brand]
        return {**tables, "brand": brand}
    logger.warning(f"Brand '{brand}' not found, falling back to '{DEFAULT_BRAND}'")
    tables = BRAND_TABLES.get(DEFAULT_BRAND, {})
    return {**tables, "brand": DEFAULT_BRAND}


def get_credentials(brand: str) -> dict:
    """
    Get social media credentials for a brand.
    Returns empty strings for brands without credentials configured.

    Returns:
        {"fb_page_id": "...", "fb_access_token": "...",
         "ig_user_id": "...", "x_cookies_file": "x_cookies.json",
         "has_fb": True/False, "has_x": True/False}
    """
    tables = resolve_tables(brand)
    fb_id = tables.get("fb_page_id", "")
    fb_token = tables.get("fb_access_token", "")
    ig_id = tables.get("ig_user_id", "")
    x_cookies = tables.get("x_cookies_file", f"x_cookies_{brand.lower()}.json")

    return {
        "fb_page_id": fb_id,
        "fb_access_token": fb_token,
        "ig_user_id": ig_id,
        "x_cookies_file": x_cookies,
        "has_fb": bool(fb_id and fb_token),
        "has_x": True,  # X cookies may be added later
    }


def brand_has_credentials(brand: str) -> bool:
    """Check if a brand has the minimum credentials to publish (FB at least)."""
    creds = get_credentials(brand)
    return creds["has_fb"]
