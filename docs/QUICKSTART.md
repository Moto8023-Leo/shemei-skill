# Quick Start Guide — Social Auto-Poster

Get running in 5 minutes.

---

## Prerequisites

- Python 3.11+ ([python.org](https://www.python.org/))
- A Facebook Page (for FB + Instagram posting)
- A X/Twitter account (optional)

---

## Step 1: Install Dependencies

```bash
cd social-auto
pip install -r requirements.txt
```

## Step 2: Configure Tokens

Copy the template and fill in your credentials:

```bash
copy .env.example .env
```

### Which tokens do I need?

| If you want to... | Tokens needed |
|---|---|
| Post to Facebook | `FB_PAGE_ID` + `FB_ACCESS_TOKEN` |
| Post to Instagram | Above + `IG_USER_ID` (Instagram must be a Business account connected to FB Page) |
| Post to X (Twitter) | Browser cookies (see below) |
| Use Feishu Bitable scheduling | `FEISHU_PERSONAL_BASE_TOKEN` + `FEISHU_APP_TOKEN` + `FEISHU_TABLE_ID` |

## Step 3: Get Facebook Tokens

👉 **Follow the detailed guide: [docs/FB_SETUP_GUIDE.md](docs/FB_SETUP_GUIDE.md)**

Quick summary:
1. Go to [developers.facebook.com](https://developers.facebook.com/) → Create App (type: Other)
2. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/) → Get Page Access Token
3. Permissions: `pages_manage_posts` + `pages_read_engagement`
4. Exchange for long-lived token (60 days)
5. Get Page ID + IG Business Account ID (optional)

Or use the setup wizard:
```bash
python scripts/setup_auth.py --platform fb
```

## Step 4: Set Up X (Twitter) — Optional

X uses browser cookies for free posting (no API key needed):

```bash
python scripts/x_api.py --set-cookies
```

It will prompt you to paste `auth_token` and `ct0` from Chrome DevTools.

## Step 5: Validate

```bash
python scripts/validate_tokens.py
```

Should show `[OK]` for all platforms.

## Step 6: Test Post

```bash
# Dry run (preview only):
python post_now.py "Hello World!" --platform fb --dry-run

# Real post:
python post_now.py "Hello World!" --platform fb

# With image:
python post_now.py "Check this out!" --platform fb,ig --image "data/images/photo.jpg"
```

---

## Scheduling (Optional)

### Option A: Local JSON queue

```bash
python scripts/scheduler.py --add --text "Scheduled post" --platform fb --time "2026-07-10 09:00"
```

Run `setup_scheduler.bat` to create a Windows scheduled task that auto-publishes.

### Option B: Feishu Bitable (Recommended)

👉 **See: [docs/FEISHU_SETUP.md](docs/FEISHU_SETUP.md)**

```bash
python scripts/scheduler.py --run --from-feishu
```

Edit posts in your Feishu spreadsheet, they auto-publish when the time arrives.

---

## Platform Support

| Platform | Method | Cost | Status |
|---|---|---|---|
| Facebook Page | Graph API | Free | ✅ |
| Instagram | Graph API (via FB) | Free | ✅ |
| X (Twitter) | twikit cookie | Free | ✅ |

---

## Troubleshooting

**FB post fails:** Run `python scripts/validate_tokens.py` — token may have expired.

**X post fails:** Delete `x_cookies.json` and re-run `python scripts/x_api.py --set-cookies`.

**Instagram fails:** Ensure IG account is a Business/Creator account connected to your FB Page.

**Need proxy:** Edit `config.yaml` → `proxy.server`.
