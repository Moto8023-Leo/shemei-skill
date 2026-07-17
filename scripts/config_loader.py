"""
Social Auto-Poster config loader
"""

import sys
from pathlib import Path

import yaml

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_config() -> dict:
    """Load config.yaml"""
    config_path = ROOT_DIR / "config.yaml"
    if not config_path.exists():
        print(f"[ERROR] Config file not found: {config_path}")
        sys.exit(1)
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_proxy() -> dict | None:
    """Get proxy config for Playwright"""
    cfg = load_config()
    proxy_server = cfg.get("proxy", {}).get("server", "")
    if not proxy_server:
        return None
    return {"server": proxy_server}


def get_proxy_dict() -> dict | None:
    """Get proxy as a requests-compatible dict: {"http": "...", "https": "..."}"""
    cfg = load_config()
    server = cfg.get("proxy", {}).get("server", "")
    if not server:
        return None
    return {"http": server, "https": server}


def get_posting_config() -> dict:
    """Get posting settings (intervals, retries)"""
    return load_config().get("posting", {
        "post_interval": 35,
        "max_retries": 3,
        "retry_delay": 5,
    })
