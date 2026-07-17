---
name: shemei_skill
description: |
  Manage the shemei_skill social media auto-poster project. Start/stop backend & frontend servers,
  check service status, post to social media (FB/IG/X), run the content daemon, and debug issues.
  Use this skill whenever the user mentions: shemei_skill, shemei, social auto poster, 社媒, iENYRID,
  Kukirin, 发帖, Facebook publishing, Instagram publishing, X/Twitter publishing, 后端启动, 前端启动,
  检查服务状态, or any social media auto-posting task.
---

# shemei_skill — 多品牌社媒自动发布系统

Project directory: `D:\claude_code_projects\shemei_skill`

## Quick Reference

| Service | Command | Port |
|---------|---------|------|
| Backend API | `python server.py` | 8000 |
| Frontend | `cd web && npm run dev -- --host 0.0.0.0` | 5174 |
| Manual post | `python post_now.py "<text>" --platform fb,x` | — |
| Daemon | `python scripts/daemon.py` | — |
| Content factory | `python scripts/content_factory.py` | — |
| Token validator | `python scripts/validate_tokens.py` | — |
| IP | 192.168.77.99 | — |

## Architecture

```
Browser (localhost:5174) → Vite proxy → FastAPI (localhost:8000)
                                            ↓
                    ┌───────────────────────┼───────────────────────┐
                    ↓                       ↓                       ↓
              DeepSeek API           FB/IG Graph API        X twikit API
              (AI copy gen)      (HTTP posting + IG bridge) (cookie auth)
                    ↓                       ↓                       ↓
                    └───────────────────────┼───────────────────────┘
                                            ↓
                                    飞书 Bitable API
                           (product catalog + schedule + writeback)
```

### Key architecture details

- **AI Copy Generation**: DeepSeek-chat with English copywriting system prompt (benefit-first, show-don't-tell, 35-55 word body, MAX 280 char X text). 2-pass AI self-review for quality.
- **FB/IG Posting**: Graph API v22.0. IG uses FB Page as image bridge (unpublished photo → container → publish).
- **X Posting**: twikit API (cookie-based, fast). Automatic fallback to Playwright Chromium if Cloudflare blocks.
- **Image Resolution**: API auto-fetches product image from Feishu product table (`iENYRID数据表2`) if no explicit `image_url` provided. Uses fuzzy model-name matching ("iENYRID ES1" matches "ES1").
- **Feishu Writeback**: All 19 fields written to schedule table (`iENYRID数据表`): product model, title, body, tags, x_text, image prompt, pain point, ad type, scene, discount, promotion, CTA, tone, platform, match code, review status, publish result, publish time, and image attachment.

## Supported Platforms

| Platform | Brand | Method | Status |
|----------|-------|--------|--------|
| Facebook | iENYRID | Graph API v22.0 | ✅ Live |
| Instagram | iENYRID | Graph API (via FB bridge) | ✅ Live |
| X/Twitter | iENYRID | twikit + Playwright fallback | ✅ Live |
| Kukirin | — | — | ❌ Pending credentials |
| OXD | — | — | ❌ Not started |

## Feishu Bitable Structure

All brand data lives in one Bitable document (`FEISHU_APP_TOKEN`).

### iENYRID数据表 (schedule — `tblTZTeXWry93slq`)
19 fields: 产品型号, 大标题, 文本, 标签, x_text, 生图提示词, 用户痛点, 广告类型, 场景风格, 折扣活动, 促销信息, CTA, 文案语气, 平台, 匹配码, 审核状态, 发布结果, 发布时间, 图片

### iENYRID数据表2 (product catalog — `tblHbkPBjJ3uQOf9`)
2 products: ES1 (2400W, 60km, €669), M4 Pro S+ Max (800W, 40-65KM, €579, with seat)

### iENYRID自动化 (auto config — `tblS9CatxxC9og5e`)
开关: 自动任务开关, 每日生成时间, 每日发布时间

## Commands

### /shemei_skill start

Start both backend and frontend servers.

1. Check if port 8000 or 5174 is already in use (`netstat -ano | findstr :8000` and `:5174`)
2. If occupied by old processes, kill them: `powershell -Command "Stop-Process -Id <PID> -Force"`
3. Start backend: `cd D:\claude_code_projects\shemei_skill && python server.py` (runs in background)
4. Start frontend: `cd D:\claude_code_projects\shemei_skill\web && npm run dev -- --host 0.0.0.0` (runs in background)
5. Wait 3s, verify: `curl -s http://localhost:8000/api/brands` → JSON, `curl -s -o NUL -w "%{http_code}" http://localhost:5174` → 200
6. Report: "✅ Backend: http://localhost:8000 | Frontend: http://localhost:5174 (LAN: http://192.168.77.99:5174)"

### /shemei_skill stop

Stop all running servers.

1. Find processes: `netstat -ano | findstr :8000` and `:5174`
2. Kill: `powershell -Command "Stop-Process -Id <PID> -Force"`
3. Verify ports are free

### /shemei_skill status

Check if servers are running.

1. Backend: `curl -s --max-time 3 http://localhost:8000/api/brands` → show brand list
2. Frontend: `curl -s -o NUL -w "%{http_code}" --max-time 3 http://localhost:5174` → expect 200
3. Daemon: `tasklist | findstr python` → look for `daemon.py`
4. Report each with ✅/❌

### /shemei_skill post "<text>" [--platform fb,x,ig] [--image <path>]

Post content to social media (CLI).

1. Build: `cd D:\claude_code_projects\shemei_skill && python post_now.py "<text>" --platform <platforms>`
2. With image: add `--image "<path>"`
3. FB and IG free unlimited; X free 500/month

### /shemei_skill publish (Web UI)

Test publish via API endpoint (great for debugging).

```bash
curl -s -X POST "http://localhost:8000/api/publish/all" \
  -H "Content-Type: application/json" \
  -d '{"text":"<body>","x_text":"<tweet>","image_url":"","brand":"iENYRID",
       "model_name":"iENYRID ES1","title":"<title>","tags":"<4 tags>",
       "body":"<short body>","image_prompt":"<AI prompt>",
       "pain_point":"续航焦虑","ad_type":"单品推广","scene_style":"城市通勤",
       "discount":"夏季促销","promotion":"10%折扣","cta":"立即购买",
       "tone":"亲和有趣","platform":"FB+X+IG"}'
```

Individual platform endpoints: `/api/publish/fb`, `/api/publish/ig`, `/api/publish/x`

### /shemei_skill daemon

Start the background daemon.

1. `cd D:\claude_code_projects\shemei_skill && python scripts/daemon.py`
2. Content factory at configured hour daily, publish engine at configured hour, image watcher every 60s
3. Config read live from Feishu `iENYRID自动化` table (enable/disable + hours)

### /shemei_skill generate [--dry-run] [--test <model>]

Run content factory to generate AI ad copy.

1. `cd D:\claude_code_projects\shemei_skill && python scripts/content_factory.py`
2. `--dry-run` for preview without Feishu writeback
3. `--test "iENYRID ES1"` to test generation for a specific model
4. The generation pipeline: product specs loaded from Feishu → DeepSeek with English copywriting prompt → 2-pass AI self-review → writeback to Feishu

### /shemei_skill test-generate [--model <name>]

Quick test of AI copy generation without any Feishu side effects.

```bash
python scripts/content_factory.py --test "iENYRID ES1"
python scripts/content_factory.py --test "iENYRID M4 Pro S+ Max"
```

Shows: title, body, tags, x_text (tweet), image_prompt. No Feishu reads/writes — pure prompt test.

### /shemei_skill test-publish

End-to-end publish test with auto image fetch from product table.

```bash
curl -s -X POST "http://localhost:8000/api/publish/all" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test body...","x_text":"Test tweet...","image_url":"",
       "brand":"iENYRID","model_name":"iENYRID ES1",
       "title":"Test Title","tags":"#tag1 #tag2 #tag3 #tag4",
       "body":"Body text.","image_prompt":"AI prompt",
       "pain_point":"续航焦虑","ad_type":"单品推广","scene_style":"城市通勤",
       "discount":"夏季促销","promotion":"10%折扣","cta":"立即购买",
       "tone":"亲和有趣","platform":"FB+X+IG"}'
```

### /shemei_skill restart

Quick restart of backend (applies code changes without restarting frontend):

```bash
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force"
sleep 1
cd D:\claude_code_projects\shemei_skill && python server.py &
```

## Debugging

### Token validation
```bash
python scripts/validate_tokens.py                  # all platforms
python scripts/validate_tokens.py --platform fb    # FB only
python scripts/validate_tokens.py --platform x     # X only
```

### Common failure modes & fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| X post returns 403 Cloudflare | twikit blocked by CF (China IP) | twikit auto-falls back to Playwright Chromium |
| IG "Permission denied" on image | `image_path=""` treated as directory | Fixed: `_resolve_image()` + `p.is_file()` guard |
| M4 specs in copy don't match Feishu | exact name match failed ("iENYRID M4..." ≠ "M4 Pro...") | Fixed: fuzzy matching in `product_engine.py` |
| Feishu writeback missing fields | only 3 of 19 fields written | Fixed: full 19-field writeback in `publish_all` |
| Daemon triggers at wrong time | `beijing_now()` double-offset +8h | Fixed: `datetime.now(tz=BEIJING_TZ)` |
| `check_x()` always returns False | sync function passed to `run_until_complete` | Fixed: direct sync call + `asyncio.run()` |
| Hashtag #iENYRIDM4ProS+Max broken | `+` cuts hashtag on all platforms | Fixed: `replace("+", "Plus")` → `#iENYRIDM4ProSPlusMax` |
| `list_models()` only returns ES1 | duplicate definition shadowed Feishu path | Fixed: removed duplicate |

### Quick checks
```bash
# Feishu connection
python -c "from scripts.feishu_driver import FeishuDriver; d=FeishuDriver(); print('OK')"

# FB token
curl -s "https://graph.facebook.com/v22.0/me?access_token=<token>"

# Product image availability
curl -s "http://localhost:8000/api/product-image/iENYRID%20ES1?brand=iENYRID"

# Content generation test
python scripts/content_factory.py --test "iENYRID ES1"
```

### Project file map

| File | Role |
|------|------|
| `server.py` | FastAPI backend — all API endpoints + publish logic + Feishu writeback |
| `scripts/content_factory.py` | AI copy generation — DeepSeek prompt builder + 2-pass review |
| `scripts/publish_engine.py` | Multi-platform publish orchestrator (FB→IG→X) + CLI |
| `scripts/feishu_driver.py` | Feishu Bitable CRUD — records, attachments, auth |
| `scripts/fb_api.py` | Facebook Graph API v22.0 poster |
| `scripts/ig_api.py` | Instagram poster — FB bridge upload → container → publish |
| `scripts/x_api.py` | X/Twitter twikit API poster (primary, fast) |
| `scripts/x_chrome.py` | X/Twitter Playwright fallback (anti-Cloudflare) |
| `scripts/daemon.py` | Background scheduler — content factory + publish engine + image watcher |
| `scripts/product_engine.py` | Product spec database — Feishu-first, local fallback |
| `scripts/brand_config.py` | Multi-brand config — table IDs, credentials per brand |
| `scripts/auto_config.py` | Live config from Feishu `iENYRID自动化` table |
| `scripts/image_watcher.py` | Monitors `images/incoming/`, matches to Feishu by match code |
| `scripts/utils.py` | Shared helpers — `guess_mime()`, `MIME_MAP` |
| `scripts/validate_tokens.py` | API token/credential validator |
| `post_now.py` | CLI one-click post entry point |
| `config.yaml` | Proxy, posting intervals, platform settings |
| `web/src/store/useFormStore.ts` | Frontend Zustand store — all form state + API calls |
| `web/src/components/` | React components — FormPanel, PreviewPanel, BrandSelector, ImageUpload |

## Key Design Decisions

1. **AI model**: DeepSeek-chat (Chinese API, $0.14/M tokens) — not Claude. System prompt in English. Temperature 0.85.
2. **X posting**: twikit API first (fast, no browser). Falls back to Playwright Chromium (headless=False, visible for debugging).
3. **Image handling**: `_resolve_image()` → explicit URL first → auto-fetch from Feishu product table → None. Downloaded to temp file, cleaned up after publish.
4. **Feishu writeback**: `publish_all` endpoint creates new record with all 19 fields + uploads image as attachment. Individual `publish_fb/ig/x` endpoints publish only (no writeback).
5. **Match code**: `MMDD-N` format, persisted in `.match_counter` file. Separate counter for content_factory and web publish.
6. **Brand config**: `scripts/brand_config.py` maps brand names → table IDs + credentials. Currently only iENYRID has credentials.
7. **Cross-platform**: All Facebook posting uses `cross_post_instagram=False` in publish_engine (IG posted separately via its own API path).
