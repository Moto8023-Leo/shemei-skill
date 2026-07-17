"""
Feishu Bitable (多维表格) driver — read scheduled posts, write back results.

Auth: Uses FEISHU_APP_ID + FEISHU_APP_SECRET (tenant_access_token).
      Create app at open.feishu.cn with bitable:app permission, publish version.
      Then add the app to your Bitable document (top-right "..." -> Add Document App).

Table field design (create these in your Bitable):
  | 字段名        | 类型   | 说明                        |
  |--------------|--------|-----------------------------|
  | 文案          | 文本   | Post body text              |
  | 图片路径      | 文本   | Local image path            |
  | 平台          | 单选   | FB / IG / X / FB+X / FB+X+IG |
  | 发布时间      | 日期   | Scheduled publish time      |
  | 状态          | 单选   | 待发布 / 已发布 / 失败        |
  | 发布结果      | 文本   | Post URL or error message   |
  | 实际发布时间  | 日期   | Actual publish timestamp    |

Usage:
    from scripts.feishu_driver import FeishuDriver

    driver = FeishuDriver()
    posts = driver.get_pending_posts()
    for post in posts:
        result = await publish(post)
        driver.mark_published(post["record_id"], result["url"])
        # or:
        driver.mark_failed(post["record_id"], result["error"])
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

from scripts.utils import MIME_MAP

# ------------------------------------------------------------------
# Token management
# ------------------------------------------------------------------

# Simple in-memory cache: (token, expires_at_timestamp)
_token_cache: dict = {"token": "", "expires_at": 0}


def _get_feishu_proxy() -> dict | None:
    """Get proxy for Feishu API calls from config.yaml."""
    try:
        from scripts.config_loader import get_proxy_dict
        return get_proxy_dict()
    except Exception:
        return None


def _get_access_token() -> str:
    """
    Get a valid Feishu tenant access token.
    Uses PersonalBaseToken if set, otherwise falls back to app credentials.
    Cached in memory for 1.5 hours (actual expiry is 2h).
    """
    # Check cache
    if _token_cache["token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["token"]

    # Path 1: PersonalBaseToken (simplest — no app creation needed)
    # NOTE: Only use if no app credentials. App credentials are more reliable.
    _pt = os.getenv("FEISHU_PERSONAL_BASE_TOKEN", "")
    _app_id = os.getenv("FEISHU_APP_ID", "")
    if _pt and not _app_id:
        logger.info("Using PersonalBaseToken for Feishu auth")
        _token_cache["token"] = _pt
        _token_cache["expires_at"] = time.time() + 3600  # generous cache
        return _pt

    # Path 2: App credentials (for enterprise apps)
    app_id = os.getenv("FEISHU_APP_ID", "")
    app_secret = os.getenv("FEISHU_APP_SECRET", "")
    if app_id and app_secret:
        logger.info("Getting Feishu tenant_access_token via app credentials...")
        import requests
        resp = requests.post(
            "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret},
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=15,
        )
        data = resp.json()
        if data.get("code") == 0:
            token = data["tenant_access_token"]
            _token_cache["token"] = token
            _token_cache["expires_at"] = time.time() + 5400  # 1.5h
            return token
        else:
            raise RuntimeError(f"Feishu auth failed: {data}")

    raise RuntimeError(
        "Feishu credentials not set.\n"
        "Set FEISHU_PERSONAL_BASE_TOKEN in .env (simplest)\n"
        "Open your Bitable → top-right '...' → '获取授权码'\n"
        "Or set FEISHU_APP_ID + FEISHU_APP_SECRET for enterprise apps."
    )


# ------------------------------------------------------------------
# FeishuDriver
# ------------------------------------------------------------------

class FeishuDriver:
    """Read/write Feishu Bitable records for social media scheduling."""

    def __init__(
        self,
        app_token: Optional[str] = None,
        table_id: Optional[str] = None,
    ):
        self.app_token = app_token or os.getenv("FEISHU_APP_TOKEN", "")
        self.table_id = table_id or os.getenv("FEISHU_TABLE_ID", "")
        self._base_url = "https://open.feishu.cn/open-apis/bitable/v1"

        if not self.app_token or not self.table_id:
            raise RuntimeError(
                "FEISHU_APP_TOKEN and FEISHU_TABLE_ID must be set in .env\n"
                "Get them from your Bitable URL:\n"
                "  https://xxx.feishu.cn/base/{APP_TOKEN}?table={TABLE_ID}"
            )

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def _get_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {_get_access_token()}",
            "Content-Type": "application/json; charset=utf-8",
        }

    def get_pending_posts(self) -> list[dict]:
        """
        Fetch all records with status = '待发布' and 发布时间 <= now.
        Returns list of {record_id, fields: {文案, 图片路径, 平台, 发布时间, ...}}
        """
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records"
        headers = self._get_headers()
        all_records = []

        page_token = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token

            resp = requests.get(url, headers=headers, params=params, timeout=30)
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"Feishu read error: {data}")
                break

            items = data.get("data", {}).get("items", [])
            all_records.extend(items)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        # Filter: 状态=待发布 and 发布时间<=now
        now_ms = int(time.time() * 1000)
        pending = []
        for item in all_records:
            fields = item.get("fields", {})
            status = fields.get("状态", "")
            if status != "待发布":
                continue

            # 发布时间 is a 13-digit millisecond timestamp in Feishu
            schedule_time = fields.get("发布时间", 0)
            if isinstance(schedule_time, str):
                try:
                    schedule_time = int(schedule_time)
                except ValueError:
                    schedule_time = 0

            if schedule_time > 0 and schedule_time <= now_ms:
                pending.append({
                    "record_id": item.get("record_id", ""),
                    "fields": fields,
                })

        logger.info(f"Feishu: found {len(pending)} pending posts out of {len(all_records)} records")
        return pending

    # ------------------------------------------------------------------
    # Write back
    # ------------------------------------------------------------------

    def _update_record(self, record_id: str, fields: dict) -> bool:
        """Update fields on a single record."""
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records/{record_id}"
        headers = self._get_headers()
        # Use explicit UTF-8 encoding to avoid Windows encoding issues with Chinese field names
        body = json.dumps({"fields": fields}, ensure_ascii=False).encode("utf-8")

        try:
            proxies = _get_feishu_proxy()
            resp = requests.put(url, headers=headers, data=body, proxies=proxies if proxies else None, timeout=15)
            data = resp.json()
            if data.get("code") == 0:
                return True
            else:
                logger.error(f"Feishu update error for {record_id}: {data}")
                return False
        except Exception as e:
            logger.error(f"Feishu update exception for {record_id}: {e}")
            return False

    def _get_record(self, record_id: str) -> dict:
        """Get a single record by ID. Returns {record_id, fields} or {}."""
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records/{record_id}"
        headers = self._get_headers()
        try:
            proxies = _get_feishu_proxy()
            resp = requests.get(url, headers=headers, proxies=proxies if proxies else None, timeout=15)
            data = resp.json()
            if data.get("code") == 0:
                return data.get("data", {}).get("record", {})
            else:
                logger.error(f"Feishu get record error: {data}")
                return {}
        except Exception as e:
            logger.error(f"Feishu get record exception: {e}")
            return {}

    def _get_all_records(self) -> list[dict]:
        """Get all records from the current table. Returns list of {record_id, fields}."""
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records"
        headers = self._get_headers()
        all_records = []

        page_token = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token

            resp = requests.get(url, headers=headers, params=params, timeout=30)
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"Feishu read error: {data}")
                break

            items = data.get("data", {}).get("items", [])
            all_records.extend(items)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        return all_records

    def mark_published(self, record_id: str, url: str = "") -> bool:
        """Mark a record as successfully published."""
        fields = {
            "审核状态": "已发布",
            "发布结果": url or "OK",
        }
        logger.info(f"Marking {record_id} as published: {url}")
        return self._update_record(record_id, fields)

    def mark_failed(self, record_id: str, error: str = "") -> bool:
        """Mark a record as failed."""
        fields = {
            "审核状态": "失败",
            "发布结果": error[:500] if error else "Unknown error",
        }
        logger.info(f"Marking {record_id} as failed: {error[:80]}")
        return self._update_record(record_id, fields)

    # ------------------------------------------------------------------
    # Field parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def parse_platforms(fields: dict) -> list[str]:
        """
        Parse the '平台' field into a list of platform keys.
        Supports: 'FB', 'IG', 'X', 'FB+X', 'FB+X+IG', etc.
        """
        raw = fields.get("平台", "FB")
        if isinstance(raw, list):
            raw = raw[0] if raw else "FB"
        if isinstance(raw, dict):
            raw = raw.get("text", raw.get("value", "FB"))
        raw = str(raw).upper().strip()
        # Normalize
        mapping = {
            "FB": ["fb"],
            "IG": ["ig"],
            "X": ["x"],
            "FB+IG": ["fb", "ig"],
            "FB+X": ["fb", "x"],
            "FB+X+IG": ["fb", "x", "ig"],
            "X+IG": ["x", "ig"],
        }
        return mapping.get(raw, ["fb"])

    @staticmethod
    def get_text(fields: dict, key: str = "文本") -> str:
        """Extract text from a field, handling Feishu's various formats."""
        val = fields.get(key, "")
        if isinstance(val, list):
            val = val[0] if val else ""
        if isinstance(val, dict):
            val = val.get("text", val.get("value", ""))
        return str(val).strip()

    @staticmethod
    def get_image_path(fields: dict, key: str = "图片路径") -> str:
        """Extract image path string. May be empty if no image."""
        return FeishuDriver.get_text(fields, key)

    # ------------------------------------------------------------------
    # Attachment: upload & download
    # ------------------------------------------------------------------

    def upload_attachment(self, record_id: str, file_path: str, field_name: str = "图片") -> bool:
        """
        Upload a local image as a Feishu Bitable attachment field.
        Uses the Feishu Drive media upload API, then links to the record.
        Does NOT require drive:drive permission — bitable:app is enough.
        """
        import requests
        from pathlib import Path

        fp = Path(file_path)
        if not fp.exists():
            logger.error(f"upload_attachment: file not found: {file_path}")
            return False
        if not fp.is_absolute():
            fp = Path.cwd() / fp

        file_size = fp.stat().st_size
        file_name = fp.name

        headers_auth = {
            "Authorization": f"Bearer {_get_access_token()}",
        }

        # Step 1: Upload media to Feishu Drive
        try:
            proxies = _get_feishu_proxy()
            with open(fp, "rb") as f:
                resp = requests.post(
                    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
                    headers=headers_auth,
                    files={"file": (file_name, f, MIME_MAP.get(fp.suffix.lower(), "application/octet-stream"))},
                    data={
                        "file_name": file_name,
                        "parent_type": "bitable_file",
                        "parent_node": self.app_token,
                        "size": str(file_size),
                    },
                    proxies=proxies if proxies else None,
                    timeout=60,
                )
            data = resp.json()
            if data.get("code") != 0:
                logger.error(f"Feishu media upload error: {data}")
                return False

            file_token = data.get("data", {}).get("file_token", "")
            if not file_token:
                logger.error(f"No file_token in upload response: {data}")
                return False

            logger.info(f"Media uploaded: {file_name} -> file_token={file_token}")

        except Exception as e:
            logger.error(f"Feishu media upload exception: {e}")
            return False

        # Step 2: Attach to the record
        # Read existing attachments first
        record = self._get_record(record_id)
        existing = record.get("fields", {}).get(field_name, [])
        if not isinstance(existing, list):
            existing = []

        new_attachments = existing + [{"file_token": file_token}]

        return self._update_record(record_id, {field_name: new_attachments})

    def download_attachment(self, file_token: str, output_path: str) -> bool:
        """
        Download a Feishu attachment to a local file.
        Uses the URL from the attachment field which includes auth params.
        output_path should include the filename.
        """
        import requests

        # The file_token may already include the full URL with extra params.
        # If it looks like a URL, use it directly.
        if file_token.startswith("http"):
            download_url = file_token
        else:
            download_url = f"https://open.feishu.cn/open-apis/drive/v1/medias/{file_token}/download"

        headers_auth = {
            "Authorization": f"Bearer {_get_access_token()}",
        }

        try:
            proxies = _get_feishu_proxy()
            resp = requests.get(download_url, headers=headers_auth, proxies=proxies if proxies else None, timeout=60, stream=True)
            if resp.status_code == 200 and len(resp.content) > 0:
                with open(output_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                logger.info(f"Attachment downloaded: {file_token[:40]}... -> {output_path} ({len(resp.content)} bytes)")
                return True
            else:
                logger.error(f"Attachment download failed: status={resp.status_code}, len={len(resp.content)}")
                return False
        except Exception as e:
            logger.error(f"Attachment download exception: {e}")
            return False

    def get_first_attachment_url(self, fields: dict, field_name: str = "图片") -> str:
        """Get the download URL of the first attachment in a field. Returns '' if none."""
        val = fields.get(field_name, [])
        if isinstance(val, list) and len(val) > 0:
            first = val[0]
            if isinstance(first, dict):
                # Prefer the full URL with extra params, then tmp_url, then file_token
                return first.get("url", "") or first.get("tmp_url", "") or first.get("file_token", "")
        return ""

    # ------------------------------------------------------------------
    # Content factory: get drafts
    # ------------------------------------------------------------------

    def get_draft_posts(self) -> list[dict]:
        """
        Fetch all records with 审核状态 = '草稿'.
        Returns list of {record_id, fields: {...}}
        """
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records"
        headers = self._get_headers()
        all_records = []

        page_token = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token

            resp = requests.get(url, headers=headers, params=params, timeout=30)
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"Feishu read error: {data}")
                break

            items = data.get("data", {}).get("items", [])
            all_records.extend(items)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        drafts = []
        for item in all_records:
            fields = item.get("fields", {})
            review_status = self.get_text(fields, "审核状态") or fields.get("审核状态", "")
            if review_status == "草稿":
                drafts.append({
                    "record_id": item.get("record_id", ""),
                    "fields": fields,
                })

        logger.info(f"Feishu: found {len(drafts)} draft posts out of {len(all_records)} records")
        return drafts

    def get_confirmed_posts(self) -> list[dict]:
        """
        Fetch records with 审核状态 = '已确认' AND 发布时间 <= now.
        These are ready to be published.
        """
        import requests

        url = f"{self._base_url}/apps/{self.app_token}/tables/{self.table_id}/records"
        headers = self._get_headers()
        all_records = []

        page_token = None
        while True:
            params = {"page_size": 100}
            if page_token:
                params["page_token"] = page_token

            resp = requests.get(url, headers=headers, params=params, timeout=30)
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"Feishu read error: {data}")
                break

            items = data.get("data", {}).get("items", [])
            all_records.extend(items)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        now_ms = int(time.time() * 1000)
        confirmed = []
        for item in all_records:
            fields = item.get("fields", {})
            review_status = self.get_text(fields, "审核状态") or fields.get("审核状态", "")

            # Must be 已确认
            if review_status != "已确认":
                continue

            # 发布时间 <= now
            schedule_time = fields.get("发布时间", 0)
            if isinstance(schedule_time, str):
                try:
                    schedule_time = int(schedule_time)
                except ValueError:
                    schedule_time = 0

            if schedule_time > 0 and schedule_time <= now_ms:
                confirmed.append({
                    "record_id": item.get("record_id", ""),
                    "fields": fields,
                })

        logger.info(f"Feishu: found {len(confirmed)} confirmed-and-due posts")
        return confirmed

    # ------------------------------------------------------------------
    # Content factory helpers
    # ------------------------------------------------------------------

    def mark_generated(self, record_id: str, title: str, body: str,
                       tags: str, prompt: str, match_code: str,
                       x_text: str = "") -> bool:
        """Mark a draft record as generated by AI."""
        # Note: '文本' is the old field name for the post body
        fields = {
            "大标题": title,
            "文本": body,
            "标签": tags,
            "生图提示词": prompt,
            "匹配码": match_code,
            "审核状态": "已生成",
            "x_text": x_text,
        }
        logger.info(f"Marking {record_id} as 已生成: {title[:30]}")
        return self._update_record(record_id, fields)

    def get_model_name(self, fields: dict) -> str:
        """Get product model name from fields. Falls back to iENYRID ES1."""
        return self.get_text(fields, "产品型号") or "iENYRID ES1"

    def mark_confirmed(self, record_id: str) -> bool:
        """Mark a record as confirmed (ready to publish)."""
        fields = {"审核状态": "已确认"}
        return self._update_record(record_id, fields)

    def mark_image_uploaded(self, record_id: str) -> bool:
        """Mark that image has been uploaded (审核状态 stays 已生成, or advance to 已确认)."""
        fields = {"审核状态": "已确认"}
        return self._update_record(record_id, fields)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

