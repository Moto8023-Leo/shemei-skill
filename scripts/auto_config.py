"""
Auto Config — read global automation settings from Feishu 自动化配置 table.

Looks for the first row in the 自动化配置 table with 3 fields:
  - 自动任务开关: 单选 "开启" / "关闭"
  - 每日生成时间: 数字 (0-23, AI content factory hour)
  - 每日发布时间: 数字 (0-23, publish engine hour)

Usage:
    from scripts.auto_config import get_config
    cfg = get_config()
    if cfg["enabled"]: ...
"""

import logging
import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("auto_config")

# Cache: refresh every 60 seconds
_cache: dict = {"data": None, "ts": 0}
_CACHE_TTL = 60


def _get_access_token() -> str:
    from scripts.feishu_driver import _get_access_token
    return _get_access_token()


def _get_config_table_id(brand: str = "iENYRID") -> str:
    """Get config table ID for a brand. Tries: env var → brand_config → name discovery."""
    # Path 1: Explicit env var (legacy)
    table_id = os.getenv("FEISHU_CONFIG_TABLE_ID", "")
    if table_id:
        return table_id

    # Path 2: Brand config registry
    try:
        from scripts.brand_config import resolve_tables
        tables = resolve_tables(brand)
        config_id = tables.get("config_table_id", "")
        if config_id:
            return config_id
    except Exception:
        pass

    # Path 3: Discover by name (fallback — matches "{brand}自动化" or legacy "自动化配置")
    app_token = os.getenv("FEISHU_APP_TOKEN", "")
    if not app_token:
        return ""

    headers = {
        "Authorization": f"Bearer {_get_access_token()}",
        "Content-Type": "application/json; charset=utf-8",
    }

    try:
        resp = requests.get(
            f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables",
            headers=headers,
            timeout=15,
        )
        data = resp.json()
        if data.get("code") == 0:
            for t in data.get("data", {}).get("items", []):
                name = t.get("name", "")
                if name == f"{brand}自动化" or name == "自动化配置":
                    table_id = t.get("table_id", "")
                    logger.info(f"Discovered config table for {brand}: {name} ({table_id})")
                    return table_id
    except Exception as e:
        logger.warning(f"Failed to discover config table: {e}")

    return ""


def get_config(force_refresh: bool = False) -> dict:
    """
    Read automation config from Feishu 自动化配置 table.
    Returns dict with defaults if not found or table not available.

    Returns:
        {
            "enabled": True/False,
            "factory_hour": 12,
            "publish_hour": 23,
            "table_id": "tbl...",
            "record_id": "rec...",
        }
    """
    defaults = {
        "enabled": False,       # SAFE: off by default
        "factory_hour": 12,
        "publish_hour": 23,
        "table_id": "",
        "record_id": "",
    }

    # Return cached if fresh
    if not force_refresh and _cache["data"] and (time.time() - _cache["ts"]) < _CACHE_TTL:
        return _cache["data"]

    table_id = _get_config_table_id()
    if not table_id:
        logger.debug("Config table not available — using defaults (disabled)")
        _cache["data"] = defaults
        _cache["ts"] = time.time()
        return defaults

    app_token = os.getenv("FEISHU_APP_TOKEN", "")
    headers = {
        "Authorization": f"Bearer {_get_access_token()}",
        "Content-Type": "application/json; charset=utf-8",
    }

    try:
        # Read all records (config table should have only 1 row)
        resp = requests.get(
            f"https://open.feishu.cn/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records"
            f"?page_size=10",
            headers=headers,
            timeout=15,
        )
        data = resp.json()

        if data.get("code") != 0:
            logger.warning(f"Config table read error: {data}")
            _cache["data"] = defaults
            _cache["ts"] = time.time()
            return defaults

        items = data.get("data", {}).get("items", [])
        # Find the first non-empty row
        config_row = None
        for item in items:
            f = item.get("fields", {})
            # Skip truly empty rows (all 3 config fields empty)
            if not any(k in f for k in ("自动任务开关", "每日生成时间", "每日发布时间")):
                continue
            # Check if the row has actual data
            sw = f.get("自动任务开关", "")
            if isinstance(sw, list): sw = sw[0] if sw else ""
            gh = f.get("每日生成时间", "")
            ph = f.get("每日发布时间", "")
            if sw or gh or ph:
                config_row = item
                break

        if not config_row:
            logger.info("Config table has no data row — using defaults (disabled)")
            _cache["data"] = defaults
            _cache["ts"] = time.time()
            return defaults

        fields = config_row.get("fields", {})
        record_id = config_row.get("record_id", "")

        # Parse 开关
        switch_raw = fields.get("自动任务开关", "关闭")
        if isinstance(switch_raw, list):
            switch_raw = switch_raw[0] if switch_raw else "关闭"
        if isinstance(switch_raw, dict):
            switch_raw = switch_raw.get("text", switch_raw.get("value", "关闭"))
        enabled = str(switch_raw).strip() == "开启"

        # Parse hours
        factory_hour = _parse_int(fields.get("每日生成时间", 12), 12)
        factory_hour = max(0, min(23, factory_hour))

        publish_hour = _parse_int(fields.get("每日发布时间", 23), 23)
        publish_hour = max(0, min(23, publish_hour))

        config = {
            "enabled": enabled,
            "factory_hour": factory_hour,
            "publish_hour": publish_hour,
            "table_id": table_id,
            "record_id": record_id,
        }

        _cache["data"] = config
        _cache["ts"] = time.time()

        status = "🟢 ON" if enabled else "🔴 OFF"
        logger.info(f"Auto config: {status} | factory={factory_hour}:00 | publish={publish_hour}:00")

    except Exception as e:
        logger.warning(f"Config read exception: {e} — using defaults")
        config = dict(defaults)
        config["table_id"] = table_id
        _cache["data"] = config
        _cache["ts"] = time.time()

    return _cache["data"]


def _parse_int(val, default: int = 12) -> int:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        try:
            return int(val.strip())
        except ValueError:
            return default
    if isinstance(val, list) and len(val) > 0:
        return _parse_int(val[0], default)
    return default
