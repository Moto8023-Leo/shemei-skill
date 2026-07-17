"""
Token Validator — verifies API tokens via lightweight test calls.
Replaces the old Playwright-based check_sessions.py.

Usage:
    python scripts/validate_tokens.py            # Check all platforms
    python scripts/validate_tokens.py --platform x  # Check X only
"""

import argparse
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv()


def check_facebook() -> tuple[bool, str]:
    """Validate Facebook Page access token."""
    page_id = os.getenv("FB_PAGE_ID", "")
    token = os.getenv("FB_ACCESS_TOKEN", "")

    if not page_id or not token:
        return False, "FB_PAGE_ID or FB_ACCESS_TOKEN not set in .env"

    try:
        import requests
        from scripts.config_loader import get_proxy_dict

        session = requests.Session()
        proxy = get_proxy_dict()
        if proxy:
            session.proxies.update(proxy)

        resp = session.get(
            f"https://graph.facebook.com/v22.0/{page_id}",
            params={
                "access_token": token,
                "fields": "name",
            },
            timeout=30,
        )
        data = resp.json() if resp.text else {}

        if resp.status_code == 200 and "name" in data:
            return True, f"Page: {data['name']}"
        else:
            error = data.get("error", {}).get("message", str(data))
            return False, error
    except Exception as e:
        return False, str(e)


def check_instagram() -> tuple[bool, str]:
    """Validate Instagram Business Account access."""
    ig_user_id = os.getenv("IG_USER_ID", "")
    token = os.getenv("FB_ACCESS_TOKEN", "")

    if not ig_user_id:
        return False, "IG_USER_ID not set in .env"
    if not token:
        return False, "FB_ACCESS_TOKEN not set (needed for IG API)"

    try:
        import requests
        from scripts.config_loader import get_proxy_dict

        session = requests.Session()
        proxy = get_proxy_dict()
        if proxy:
            session.proxies.update(proxy)

        resp = session.get(
            f"https://graph.facebook.com/v22.0/{ig_user_id}",
            params={
                "access_token": token,
                "fields": "username",
            },
            timeout=30,
        )
        data = resp.json() if resp.text else {}

        if resp.status_code == 200 and "username" in data:
            return True, f"IG: @{data['username']}"
        else:
            error = data.get("error", {}).get("message", str(data))
            return False, error
    except Exception as e:
        return False, str(e)


def check_x() -> tuple[bool, str]:
    """Validate X (Twitter) twikit cookie-based auth."""
    username = os.getenv("X_USERNAME", "")
    password = os.getenv("X_PASSWORD", "")
    cookies_exist = (Path(__file__).resolve().parent.parent / "x_cookies.json").exists()

    if cookies_exist:
        try:
            from twikit import Client
            client = Client(language="en-US")
            from scripts.config_loader import load_config
            cfg = load_config()
            proxy_url = cfg.get("proxy", {}).get("server", "")
            if proxy_url:
                client.proxy = proxy_url
            import asyncio
            cookies_path = str(Path(__file__).resolve().parent.parent / "x_cookies.json")
            client.load_cookies(cookies_path)  # sync — no await needed
            user = asyncio.run(client.user())
            return True, f"X: @{user.screen_name} (cookie)"
        except Exception as e:
            return False, f"Cookie invalid: {e}"
    elif username and password:
        return True, "X: credentials set (first login needed)"
    else:
        return False, "X_USERNAME and X_PASSWORD not set in .env"


def main():
    parser = argparse.ArgumentParser(description="Validate social media API tokens")
    parser.add_argument("--platform", "-p", choices=["fb", "ig", "x", "all"],
                        default="all", help="Platform to check (default: all)")
    args = parser.parse_args()

    checks = []
    if args.platform in ("fb", "all"):
        checks.append(("Facebook", check_facebook))
    if args.platform in ("ig", "all"):
        checks.append(("Instagram", check_instagram))
    if args.platform in ("x", "all"):
        checks.append(("X (Twitter)", check_x))

    print(f"\n{'='*60}")
    print(f"  [Token Validator] Verifying API Tokens")
    print(f"{'='*60}")

    all_ok = True
    for name, check_fn in checks:
        ok, detail = check_fn()
        icon = "[OK]" if ok else "[FAIL]"
        print(f"  {icon} {name}: {detail}")
        if not ok:
            all_ok = False

    print(f"{'='*60}")
    if all_ok:
        print(f"  [OK] All tokens valid! Ready to post.")
        print(f"\n  Post now:   python post_now.py \"Hello\" --platform fb,x")
        print(f"  Scheduler:  python scripts/scheduler.py --add --text \"...\" --platform fb --time \"...\"")
    else:
        print(f"  [FAIL] Some tokens invalid. Run setup_auth to fix:")
        print(f"     python scripts/setup_auth.py --platform {args.platform}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
