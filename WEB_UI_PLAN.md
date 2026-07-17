# iENYRID 社媒广告系统 — Web 界面方案

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  浏览器 http://localhost:5173                           │
│  ┌──────────────┐  ┌──────────────────────────────────┐ │
│  │ 左侧参数面板   │  │ 右侧预览面板                      │ │
│  │              │  │                                  │ │
│  │ 产品型号 ────┤  │ 🤖 AI 生成的广告文案               │ │
│  │ 用户痛点      │  │ 📸 生图提示词                     │ │
│  │ 广告类型      │  │ # 标签                          │ │
│  │ 场景风格      │  │ 🐦 X 精简版(≤280字符)            │ │
│  │ 折扣活动      │  │                                  │ │
│  │ 促销信息      │  │ [复制文案] [复制提示词] [发布]     │ │
│  │ CTA          │  │                                  │ │
│  │ 文案语气      │  │ FB ✅ | IG ✅ | X ✅               │ │
│  │ 平台 ────────┘  │                                  │ │
│  └──────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
          │                          ▲
          │ POST /api/generate       │ JSON
          ▼                          │
┌─────────────────────────────────────────────────────────┐
│  FastAPI 后端 (port 8000)                               │
│                                                         │
│  /api/models          → 从飞书数据表2 获取型号列表+参数   │
│  /api/generate        → 调 DeepSeek 生成英文文案         │
│  /api/publish/fb      → 发布到 FB                       │
│  /api/publish/ig      → 发布到 IG                       │
│  /api/publish/x       → 发布到 X (Chrome 浏览器)         │
│  /api/publish/all     → 一键发布全部                     │
│  /api/feishu/writeback → 回写飞书数据表                  │
└─────────────────────────────────────────────────────────┘
          │                          │
          ▼                          ▼
   ┌──────────────┐    ┌──────────────────────┐
   │ DeepSeek API  │    │ 飞书 Bitable API     │
   │ (文案生成)     │    │ (产品参数 + 结果回写)  │
   └──────────────┘    └──────────────────────┘
          │                          │
          ▼                          ▼
   ┌──────────────────────────────────────────────────────┐
   │  FB Graph API  │  IG Graph API  │  X Chrome Browser  │
   └──────────────────────────────────────────────────────┘
```

## 技术栈

| 层 | 技术 | 理由 |
|-----|------|------|
| 前端 | React 19 + Vite + TDesign (复用 XOD 项目的框架) | XOD 项目已验证，组件丰富 |
| 后端 | FastAPI (Python) | 直接复用现有 Python 代码 |
| 状态管理 | Zustand (同 XOD) | 轻量，XOD 已验证 |
| 数据源 | 飞书 Bitable API | 产品参数从数据表2 实时加载 |

## 后端 API 设计

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/models` | GET | 从数据表2 获取所有型号 + 参数 |
| `/api/generate` | POST | 接收表单参数 → DeepSeek 生成 → 返回 JSON |
| `/api/publish/fb` | POST | 发 FB (文案+图片) |
| `/api/publish/ig` | POST | 发 IG (文案+图片) |
| `/api/publish/x` | POST | 发 X (≤280字符文案+图片, Chromium) |
| `/api/publish/all` | POST | 一键发 FB+IG+X |
| `/api/feishu/writeback` | POST | 回写到飞书数据表 |

## 前端设计 (三栏布局)

```
┌── Header ──────────────────────────────────────────────┐
│  iENYRID Social Auto-Poster v1.0                        │
├──────────────┬──────────────────────────────────────────┤
│ 参数面板      │ 预览面板                                  │
│ (FormPanel)  │ (PreviewPanel)                           │
│              │                                          │
│ 产品型号 [▼]  │  🤖 AI 文案                               │
│ 用户痛点 [▼]  │  ┌─────────────────────────────────┐    │
│ 广告类型 [▼]  │  │ 🚀 60km Range, 2400W Power...    │    │
│ 场景风格 [▼]  │  │                                  │    │
│ 折扣活动 [▼]  │  │ Tired of range anxiety...        │    │
│ 促销信息 [▼]  │  └─────────────────────────────────┘    │
│ CTA      [▼]  │                                          │
│ 文案语气 [▼]  │  # 标签                                  │
│ 平台     [▼]  │  #iENYRID #iENYRIDES1 #ElectricScooter  │
│              │                                          │
│ [生成文案]    │  🐦 X 精简版 (167 chars)                  │
│ [一键发布]    │  No more range anxiety! 🛴...            │
│              │                                          │
│              │  📸 生图提示词                             │
│              │  A sleek iENYRID ES1 electric scooter... │
│              │                                          │
│              │  [复制文案] [复制提示词] [发布FB] [发布全部] │
│              │  ✅ FB: posted | ✅ IG: posted | ✅ X: posted│
└──────────────┴──────────────────────────────────────────┘
```

## 实施计划

| 步骤 | 内容 | 工作量 |
|------|------|--------|
| 1 | 创建 FastAPI 后端 (`server.py`) — 封装现有 Python 函数 | ~200行 |
| 2 | 创建 React 前端 — 复用 XOD 框架 (Vite + TDesign + Zustand) | ~400行 |
| 3 | 飞书数据表2 动态加载型号列表 | ~50行 |
| 4 | 前后端联调 + 发布按钮 | ~100行 |
| 5 | 局域网部署 (Vite dev host 0.0.0.0) | 1行配置 |

## 目录结构

```
social-auto/
├── server.py              ← 🆕 FastAPI 后端
├── web/                   ← 🆕 React 前端 (同 XOD 结构)
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── App.css
│       ├── main.tsx
│       ├── store/useFormStore.ts
│       └── components/
│           ├── FormPanel/
│           └── PreviewPanel/
├── scripts/               ← 已有 Python 脚本
│   ├── content_factory.py
│   ├── fb_api.py
│   ├── ig_api.py
│   ├── x_chrome.py
│   ├── feishu_driver.py
│   └── product_engine.py
```

## 启动方式

```bash
# 终端 1: 后端
cd social-auto
python server.py              # http://localhost:8000

# 终端 2: 前端
cd social-auto/web
npm install
npm run dev -- --host 0.0.0.0  # http://localhost:5173 (局域网可访问)
```

同事在浏览器打开 `http://你的IP:5173` 即可使用。

---

## 关键差异 (vs XOD 系统)

| XOD 系统 | iENYRID 系统 |
|----------|-------------|
| 参数硬编码在 `ruleEngine.ts` | 参数从飞书数据表2 动态加载 |
| 只生成提示词，不实际发布 | 生成 + 一键发布到 FB/IG/X |
| 中文文案 + 英文提示词 | 全部英文文案 (FB/IG 长 + X 精简) |
| 三种车型 (刹车配件) | 多种车型 (整车) |
| 电动滑板车作为载体 | 电动滑板车是主角 |
