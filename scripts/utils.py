"""
Shared utilities for shemei_skill.
"""
from pathlib import Path

MIME_MAP = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}


def guess_mime(path: Path) -> str:
    """Guess MIME type from file extension."""
    return MIME_MAP.get(path.suffix.lower(), "application/octet-stream")
