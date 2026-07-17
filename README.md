# 🚀 Social Auto-Poster

**零成本、官方 API、社媒自动发布**

使用 Facebook Graph API + X API v2 + Instagram Graph API，纯 HTTP 请求发帖。不再依赖浏览器自动化，100% 稳定。

---

## 原理

```
你手动准备图文（或 AI 生成）
         │
         ▼
┌──────────────────────────┐
│  post_now.py (手动)       │  ← 命令行一键发布
│  scheduler.py (定时)      │  ← Windows 任务计划每 5 分钟检查队列
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│   REST API (HTTP 请求)    │  ← 官方 API，不再操控浏览器
│   fb_api.py               │  ← Facebook Graph API 发帖
│   x_api.py                │  ← X API v2 + tweepy 发推
│   ig_api.py               │  ← Instagram Graph API 发帖
└──────────────────────────┘
```

---

## 安装

### 1. Python 环境

需要 Python 3.11+。从 [python.org](https://www.python.org/downloads/) 下载安装。
**安装时必须勾选 ✅ "Add Python to PATH"**。

### 2. 安装依赖

```bash
cd D:\claude_code_projects\shemei_skill
pip install -r requirements.txt
```

---

## 首次使用：获取 API Token

**只需做一次**，不再需要打开浏览器手动登录。

```bash
# 设置 X (Twitter) API Token
python scripts/setup_auth.py --platform x

# 设置 Facebook + Instagram API Token
python scripts/setup_auth.py --platform fb

# 或一次全部设置
python scripts/setup_auth.py --platform all
```

会打印分步引导，并自动打开对应的开发者页面。按要求复制粘贴 Token 即可。

完成后验证 Token：

```bash
python scripts/validate_tokens.py
```

---

## 日常使用

### 模式一：命令行即时发布

```bash
# X 发纯文字
python post_now.py "今天天气真好！" --platform x

# FB 发图文
python post_now.py "新品上架" --image "data/images/product.jpg" --platform fb

# FB + X 同步发布
python post_now.py "跨平台发布测试" --image "content/test.png" --platform fb,x

# Instagram 图文
python post_now.py "美好时光" --image "data/images/photo.jpg" --platform ig

# 预览模式（不实际发布）
python post_now.py "测试内容" --platform x --dry-run

# FB 单发（不尝试同步 IG）
python post_now.py "仅 Facebook" --platform fb --no-cross-post
```

### 模式二：定时队列发布

```bash
# 添加定时任务
python scripts/scheduler.py --add --text "定时帖子内容" --platform fb,x --time "2026-07-07 10:00"

# 添加带图的定时任务
python scripts/scheduler.py --add --text "图文定时帖" --image "content/pic.png" --platform fb --time "2026-07-08 08:30"

# 查看队列
python scripts/scheduler.py --list

# 删除某个任务
python scripts/scheduler.py --delete <任务ID>

# 清理已完成记录
python scripts/scheduler.py --clean
```

### 模式三：AI 内容生成 + 发布

```bash
# 从 product CSV 生成 3 条 AI 文案并发布到 IG
python scripts/ig_pipeline.py --limit 3

# 只生成文案不发
python scripts/ig_pipeline.py --limit 3 --only-generate
```

---

## Windows 定时任务

### 自动配置（推荐）

双击运行 `setup_scheduler.bat`，自动创建每 5 分钟执行一次的任务计划。

---

## 目录结构

```
social-auto/
├── config.yaml              # 配置文件（代理、API 设置）
├── .env.example             # Token 模板（复制为 .env 填入真实值）
├── content_queue.json       # 定时发布队列
├── posted_log.json          # 发布记录
├── post_now.py              # 🚀 手动发布入口
├── requirements.txt         # Python 依赖
├── setup_scheduler.bat      # Windows 调度器配置脚本
├── scripts/
│   ├── fb_api.py            # Facebook Graph API 海报（新）
│   ├── x_api.py             # X API v2 海报（新）
│   ├── ig_api.py            # Instagram Graph API 海报（新）
│   ├── scheduler.py         # 队列调度器
│   ├── content_generator.py # Claude AI 文案生成
│   ├── ig_pipeline.py       # IG 内容生成 + 发布流水线
│   ├── config_loader.py     # 配置加载
│   ├── setup_auth.py        # 🔑 Token 设置向导（新）
│   └── validate_tokens.py   # Token 验证（新）
├── content/                 # 帖子图片存放处
├── data/                    # 产品 CSV、提示词模板、图片
└── README.md
```

---

## API 费用

| 平台 | 费用 | 限额 |
|---|---|---|
| **Facebook** | 免费 | 无限制（Page 发帖） |
| **Instagram** | 免费 | 无限制（需商业账户，关联 FB Page） |
| **X (Twitter)** | 免费 | 500 条/月（~16 条/天） |

---

## 常见问题

### Q: 发帖失败？
先运行 `python scripts/validate_tokens.py` 检查 Token 是否有效。

### Q: Token 过期怎么办？
- FB 长期 Token 60 天有效，过期后重新运行 `python scripts/setup_auth.py --platform fb`
- X Token 不会过期（除非手动撤销）

### Q: X 返回 403？
检查 App 权限是否为 "Read and Write"（在 developer.x.com 的应用设置中）。

### Q: Instagram 发帖失败？
确认：
1. IG 账户是商业/创作者账户
2. 已关联到 FB Page
3. FB Token 有 `instagram_basic` 和 `instagram_content_publish` 权限

### Q: 需要代理？
编辑 `config.yaml` 中 `proxy.server`。所有 API 请求会自动使用。

### Q: 图片尺寸不对？
Instagram 要求图片在 320x320 到 1440x1440 之间，宽高比 4:5 到 1.91:1。脚本会自动检测并提示。

### Q: 支持其他平台吗？
目前 FB + X + IG。加新平台只需写新的 `xxx_api.py`，签名保持一致即可。

---

## 从旧版（浏览器自动化）升级

旧版使用 Playwright 操控真实浏览器发帖。新版用 API，完全稳定。

升级步骤：
1. 删除 `browser_data/` 目录
2. `pip install -r requirements.txt`（会自动安装新依赖，playwright 不再需要）
3. 运行 `python scripts/setup_auth.py --platform all` 获取 Token
4. 测试：`python post_now.py "Hello" --platform x --dry-run`
