"""
API Token Setup Wizard
Replaces the old Playwright-based login_manager.py.

Guides the user through obtaining API tokens for each platform.
No automation — just clear instructions + browser links + validation.

Usage:
    python scripts/setup_auth.py --platform fb     # Facebook + Instagram
    python scripts/setup_auth.py --platform x      # X (Twitter)
    python scripts/setup_auth.py --platform all    # All platforms
"""

import argparse
import os
import sys
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT_DIR / ".env"

# ==================================================================
# X (Twitter) Setup
# ==================================================================

X_INSTRUCTIONS = """

{'='*70}
  🐦 X (Twitter) API Token 获取指南
{'='*70}

  Free tier: 500 条推文/月, 每天 1-5 条完全够用。

  操作步骤:

  ① 打开 X 开发者门户
     https://developer.x.com/en/portal/projects
     （浏览器应该已自动打开）

  ② 注册/登录 → 创建 Project → 创建 App
     - Project name: 随便写 (如 "My Auto Poster")
     - App name: 随便写 (如 "AutoPost")

  ③ 在 App 设置中:
     - User authentication: OAuth 1.0a
     - App permissions: Read and Write

  ④ 在 "Keys and Tokens" 页面，你会看到:
     - API Key (Consumer Key)
     - API Key Secret (Consumer Secret)
     → 点 "Generate Access Token and Secret" 获取:
     - Access Token
     - Access Token Secret

  ─────────────────────────────────────────────────────
  现在请把 4 个值粘贴到下方:
"""

IG_FB_INTRO = """

{'='*70}
  📘 Facebook + Instagram API Token 获取指南
{'='*70}

  Facebook Page 发帖：完全免费，无限量。
  Instagram：需商业/创作者账户关联 FB Page。

  先确保你有:
    ✅ 一个 Facebook 账号
    ✅ 一个 Facebook Page（你的专页）
    ✅ [可选] Instagram 商业/创作者账户（已关联到 FB Page）

  操作步骤:
"""

FB_STEP1 = """
  ① 创建 Meta 应用
     https://developers.facebook.com/
     登录 → 我的应用 → 创建应用
     - 类型选 "其他" (Other)
     - 名称随便写 (如 "AutoPostApp")
"""

FB_STEP2 = """
  ② 获取短期 Page Access Token
     https://developers.facebook.com/tools/explorer/
     （浏览器应该已自动打开）

     在 Graph API Explorer 中:
     - Meta App: 选你刚创建的应用
     - User or Page: 选 "Get Page Access Token"
     - 权限勾选: ✅ pages_manage_posts  ✅ pages_read_engagement
                  ✅ instagram_basic    ✅ instagram_content_publish
     - 点击 "Generate Access Token" → 选择你的 Page
     - 复制下面的短期 Token
"""

FB_STEP3 = """
  ③ 换长期 Token（60 天有效）
     短期 Token 几小时就过期，需要换成长期 Token。

     用浏览器打开以下 URL (把 YOUR_TOKEN 换成你刚复制的 Token):

     https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id={}&client_secret={}&fb_exchange_token=YOUR_SHORT_TOKEN

     提示: 请直接告诉我你的 App ID 和 App Secret，
     我帮你拼好 URL。或者你可以在 .env.example 里找到这些信息的获取位置。
"""


def setup_x():
    """Guide user through X API token setup."""
    print(X_INSTRUCTIONS)

    webbrowser.open("https://developer.x.com/en/portal/projects")

    x_api_key = input("  API Key: ").strip()
    x_api_key_secret = input("  API Key Secret: ").strip()
    x_access_token = input("  Access Token: ").strip()
    x_access_token_secret = input("  Access Token Secret: ").strip()

    if not all([x_api_key, x_api_key_secret, x_access_token, x_access_token_secret]):
        print("\n  ❌ 所有字段都是必填的。请重新运行。\n")
        return False

    _write_env({
        "X_API_KEY": x_api_key,
        "X_API_KEY_SECRET": x_api_key_secret,
        "X_ACCESS_TOKEN": x_access_token,
        "X_ACCESS_TOKEN_SECRET": x_access_token_secret,
    })

    # Validate
    print("\n  ⏳ 验证 Token...")
    try:
        import tweepy
        client = tweepy.Client(
            consumer_key=x_api_key,
            consumer_secret=x_api_key_secret,
            access_token=x_access_token,
            access_token_secret=x_access_token_secret,
        )
        me = client.get_me()
        print(f"  ✅ Token 有效! 已认证为 @{me.data.username}")
        return True
    except Exception as e:
        print(f"  ⚠️  Token 验证失败: {e}")
        print(f"  Token 已保存到 .env，你可以稍后重试验证。")
        return False


def setup_fb():
    """Guide user through Facebook + Instagram API token setup."""
    print(IG_FB_INTRO)

    # Step 1
    print(FB_STEP1)
    webbrowser.open("https://developers.facebook.com/")
    input("\n  完成①后按 Enter 继续...")

    # Step 2
    print(FB_STEP2)
    webbrowser.open("https://developers.facebook.com/tools/explorer/")
    input("\n  完成②后按 Enter 继续...")

    fb_token = input("  粘贴 Page Access Token: ").strip()
    fb_page_id = input("  粘贴 Page ID (在 Explorer 中运行 GET /me/accounts 获取): ").strip()

    # Step 3 — offer to exchange for long-lived token
    if fb_token:
        print(FB_STEP3)
        app_id = input("  Meta App ID: ").strip()
        app_secret = input("  Meta App Secret: ").strip()
        if app_id and app_secret:
            import requests
            resp = requests.get(
                "https://graph.facebook.com/v22.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": fb_token,
                },
                timeout=30,
            )
            data = resp.json() if resp.text else {}
            long_token = data.get("access_token", "")
            if long_token:
                fb_token = long_token
                print(f"  ✅ 已换为长期 Token! (60 天有效)")
            else:
                print(f"  ⚠️  换取失败: {data}. 将使用短期 Token。")
                print(f"     提示：你的短期 Token 可能已过期。请在 Explorer 中重新生成。")

    # Instagram
    print("\n  ─────────────────────────────────────────────────────")
    print("  📸 Instagram 部分（可选，跳过直接按 Enter）")
    ig_user_id = input("  Instagram Business Account ID: ").strip()

    if not fb_token or not fb_page_id:
        print("\n  ❌ FB Token 和 Page ID 是必填的。\n")
        return False

    env_updates = {
        "FB_PAGE_ID": fb_page_id,
        "FB_ACCESS_TOKEN": fb_token,
    }
    if ig_user_id:
        env_updates["IG_USER_ID"] = ig_user_id

    _write_env(env_updates)

    # Validate
    print("\n  ⏳ 验证 Token...")
    try:
        import requests
        resp = requests.get(
            f"https://graph.facebook.com/v22.0/{fb_page_id}",
            params={
                "access_token": fb_token,
                "fields": "name",
            },
            timeout=30,
        )
        data = resp.json() if resp.text else {}
        if "name" in data:
            print(f"  ✅ Token 有效! Page: {data['name']}")
        else:
            print(f"  ⚠️  验证失败: {data}")
    except Exception as e:
        print(f"  ⚠️  无法验证: {e}")

    return True


def _write_env(updates: dict):
    """Write or update values in .env file."""
    env = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, _, val = line.partition("=")
                    env[key.strip()] = val.strip()

    env.update(updates)

    ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("# Social Auto-Poster API Tokens\n")
        f.write("# Generated by setup_auth.py\n\n")
        for k, v in env.items():
            f.write(f"{k}={v}\n")

    print(f"\n  📝 已写入: {ENV_FILE.resolve()}")


def main():
    parser = argparse.ArgumentParser(
        description="API token setup wizard for social-auto"
    )
    parser.add_argument(
        "--platform", "-p",
        required=True,
        choices=["fb", "x", "ig", "all"],
        help="Platform: fb (Facebook+Instagram), x (X/Twitter), ig, all",
    )
    args = parser.parse_args()

    print(f"\n{'='*70}")
    print(f"  🔑 Social Auto-Poster — API Token 设置向导")
    print(f"  (替代旧的浏览器登录方式，只需做一次)")
    print(f"{'='*70}\n")

    ok = True

    if args.platform in ("fb", "all"):
        ok = setup_fb() and ok

    if args.platform in ("x", "all"):
        ok = setup_x() and ok

    if args.platform == "ig":
        ig_user_id = input("  Instagram Business Account ID: ").strip()
        fb_page_id = input("  FB Page ID (IG 关联的 Page): ").strip()
        fb_token = input("  FB Page Access Token: ").strip()
        _write_env({
            "IG_USER_ID": ig_user_id,
            "FB_PAGE_ID": fb_page_id,
            "FB_ACCESS_TOKEN": fb_token,
        })

    print(f"\n{'='*70}")
    if ok:
        print(f"  ✅ 设置完成!")
        print(f"  验证 Token: python scripts/validate_tokens.py")
        print(f"  测试发帖: python post_now.py \"Hello\" --platform fb,x --dry-run")
    else:
        print(f"  ⚠️  部分设置可能未完成。请重新运行。")
    print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
