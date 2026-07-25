"""
Version History Engine — content version snapshots + diff + restore.

Each content generation, recompose, approval, or publish creates a version snapshot.
Stored in a "版本历史" (Version History) JSON text field in the Feishu schedule table,
plus locally in storage/versions.json for offline access.

Usage:
    from scripts.version_engine import save_version, list_versions, compare_versions, restore_version
"""

import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Local version cache
# ------------------------------------------------------------------

def _get_storage_dir() -> Path:
    """Get or create the versions storage directory."""
    d = Path(__file__).resolve().parent.parent / "storage" / "versions"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _get_versions_file(task_id: str) -> Path:
    """Get the versions JSON file for a task."""
    return _get_storage_dir() / f"{task_id}.json"


# ------------------------------------------------------------------
# Version data model
# ------------------------------------------------------------------

def make_version_snapshot(
    task_id: str,
    title: str = "",
    body: str = "",
    tags: str = "",
    x_text: str = "",
    image_prompt: str = "",
    quality_score: int = 0,
    quality_level: str = "",
    platform: str = "",
    campaign: str = "",
    style_summary: str = "",
    reason: str = "content_generation",
    record_id: str = "",
) -> dict:
    """
    Create a version snapshot dict.

    Args:
        reason: One of "content_generation", "recompose", "review_approved", "published", "restored"
    """
    return {
        "version": 0,  # filled by save_version
        "timestamp": int(time.time() * 1000),
        "isoTime": datetime.now().isoformat(),
        "reason": reason,
        "recordId": record_id,
        "data": {
            "title": title,
            "body": body,
            "tags": tags,
            "xText": x_text,
            "imagePrompt": image_prompt,
            "qualityScore": quality_score,
            "qualityLevel": quality_level,
            "platform": platform,
            "campaign": campaign,
            "styleSummary": style_summary,
        },
    }


def save_version(
    task_id: str,
    snapshot: dict,
    sync_to_feishu: bool = True,
    feishu_driver=None,
    record_id: str = "",
) -> int:
    """
    Save a version snapshot locally. Returns the version number.
    If sync_to_feishu and driver provided, also writes to Feishu "版本历史" field.
    """
    file_path = _get_versions_file(task_id)

    # Load existing versions
    try:
        if file_path.exists():
            data = json.loads(file_path.read_text(encoding="utf-8"))
        else:
            data = {"taskId": task_id, "versions": [], "createdAt": datetime.now().isoformat()}
    except Exception:
        data = {"taskId": task_id, "versions": [], "createdAt": datetime.now().isoformat()}

    # Assign version number
    next_ver = len(data["versions"]) + 1

    # Clean old version data keys that might've leaked
    snap_clean = {k: v for k, v in snapshot.items() if k in ("version", "timestamp", "isoTime", "reason", "recordId", "data")}
    snap_clean["version"] = next_ver

    data["versions"].append(snap_clean)
    data["updatedAt"] = datetime.now().isoformat()

    # Write locally
    try:
        file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"Failed to write version file: {e}")

    # Sync to Feishu
    if sync_to_feishu and feishu_driver and record_id:
        try:
            compact = json.dumps(data, ensure_ascii=False)
            feishu_driver._update_record(record_id, {"版本历史": compact})
        except Exception as e:
            logger.warning(f"Failed to sync version to Feishu: {e}")

    logger.info(f"Version #{next_ver} saved for {task_id}: {snapshot.get('reason', 'unknown')}")
    return next_ver


def list_versions(task_id: str) -> list[dict]:
    """List all versions for a task. Returns list of version snapshots."""
    file_path = _get_versions_file(task_id)
    if not file_path.exists():
        return []

    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        versions = data.get("versions", [])
        # Sort by version number ascending
        versions.sort(key=lambda v: v.get("version", 0))
        return versions
    except Exception as e:
        logger.error(f"Failed to read versions: {e}")
        return []


def get_version(task_id: str, version_num: int) -> dict | None:
    """Get a specific version by number (1-indexed)."""
    versions = list_versions(task_id)
    for v in versions:
        if v.get("version") == version_num:
            return v
    return None


def compare_versions(task_id: str, from_ver: int, to_ver: int) -> dict:
    """
    Compare two versions. Returns a diff dict with changed fields.
    """
    v1 = get_version(task_id, from_ver)
    v2 = get_version(task_id, to_ver)

    if not v1 or not v2:
        return {"error": "Version not found", "from": from_ver, "to": to_ver}

    d1 = v1.get("data", {})
    d2 = v2.get("data", {})

    diff = {}
    all_keys = set(list(d1.keys()) + list(d2.keys()))
    for key in sorted(all_keys):
        old_val = d1.get(key, "")
        new_val = d2.get(key, "")
        if old_val != new_val:
            diff[key] = {"from": old_val, "to": new_val}

    return {
        "fromVersion": from_ver,
        "toVersion": to_ver,
        "fromTime": v1.get("isoTime", ""),
        "toTime": v2.get("isoTime", ""),
        "fromReason": v1.get("reason", ""),
        "toReason": v2.get("reason", ""),
        "changedFields": list(diff.keys()),
        "diff": diff,
    }


def restore_version(task_id: str, version_num: int) -> dict | None:
    """
    Restore content to a historical version. Returns the restored snapshot data.
    The restored version data should be used to overwrite the current content.
    """
    target = get_version(task_id, version_num)
    if not target:
        logger.error(f"Version #{version_num} not found for {task_id}")
        return None

    restored_data = target.get("data", {})

    # Create a restore snapshot
    restore_snapshot = make_version_snapshot(
        task_id=task_id,
        title=restored_data.get("title", ""),
        body=restored_data.get("body", ""),
        tags=restored_data.get("tags", ""),
        x_text=restored_data.get("xText", ""),
        image_prompt=restored_data.get("imagePrompt", ""),
        quality_score=restored_data.get("qualityScore", 0),
        quality_level=restored_data.get("qualityLevel", ""),
        platform=restored_data.get("platform", ""),
        campaign=restored_data.get("campaign", ""),
        style_summary=restored_data.get("styleSummary", ""),
        reason=f"restored_from_v{version_num}",
    )

    # Save the restore as a new version
    save_version(task_id, restore_snapshot, sync_to_feishu=False)

    logger.info(f"Version #{version_num} restored for {task_id}")
    return restored_data


def get_latest_version(task_id: str) -> dict | None:
    """Get the most recent version for a task."""
    versions = list_versions(task_id)
    if not versions:
        return None
    return versions[-1]


def get_version_count(task_id: str) -> int:
    """Get the number of versions for a task."""
    return len(list_versions(task_id))


def load_from_feishu(record_id: str, feishu_driver) -> int:
    """
    Attempt to load version history from Feishu record's "版本历史" field.
    Returns the number of versions loaded, or 0 if none.
    """
    try:
        record = feishu_driver._get_record(record_id)
        version_text = record.get("fields", {}).get("版本历史", "")
        if not version_text:
            return 0

        # Handle list format
        if isinstance(version_text, list):
            version_text = version_text[0] if version_text else ""
        if isinstance(version_text, dict):
            version_text = version_text.get("text", "")

        if not version_text:
            return 0

        data = json.loads(str(version_text))
        task_id = data.get("taskId", "")
        if not task_id:
            return 0

        # Save locally
        file_path = _get_versions_file(task_id)
        file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

        return len(data.get("versions", []))
    except Exception as e:
        logger.warning(f"Failed to load versions from Feishu: {e}")
        return 0
