# shemei_skill — 多品牌社媒自动发布系统

位于 `D:\claude_code_projects\shemei_skill\`

## 项目说明

多品牌社交媒体自动发布系统。支持 FB/IG/X 三大平台，AI 生成英文文案 + 双重自检 + 统一发布 + 飞书写回。

### 品牌状态

| 品牌 | FB/IG | X | 状态 |
|------|-------|---|------|
| iENYRID | ✅ 已配置 | ✅ 已配置 | 全链路跑通 |
| Kukirin | ❌ 待配置 | ❌ 待配置 | 表已建，等凭据 |
| OXD(未来) | — | — | 未开始 |

## 端口分配（固定不变）

| 端口 | 项目 | 类型 |
|------|------|------|
| 5174 | shemei_skill | 前端 |
| 8000 | shemei_skill | 后端 API |
| IP | 192.168.77.99 | 固定IP |

> 新增项目必须使用新端口（5175, 5176…），不得占用已有端口。

## 启动方式

```bash
cd D:\claude_code_projects\shemei_skill

# 后端
python server.py

# 前端
cd web && npm run dev

# 守护进程
python scripts/daemon.py
```

## 环境

- OS: Windows 11
- Python: python3.exe（Windows Store）
- Node.js: 通过 npm 管理
- DeepSeek API + Feishu Bitable API + Facebook Graph API v22.0

## 防死循环规则

- **任何操作失败，最多重试 2 次**，第 3 次必须停止并问用户
- **不要用相同参数重复调用同一个工具**，先排查根因
- **输出结果简洁明了**，不要重复输出相同内容
- **任务完成后立即停止**，等待用户反馈，不自动开启下一轮

## 品牌数据来源

品牌数据分两层：

| 层级 | 来源 | 内容 |
|------|------|------|
| 元数据 | `scripts/studio_data.py` 硬编码 | 品牌定位、视觉DNA、国家市场、视觉参数池、多语言模板 |
| 产品型号 | 飞书产品表（Bitable）实讀 | 型号名称、电机功率、电池容量、续航、售价等 |
| 排期数据 | 飞书排期表 | 发布任务、审核状态、发布时间 |

**飞书表配置**（`scripts/brand_config.py`）：

| 品牌 | 排期表 | 产品表 | 配置表 |
|------|--------|--------|--------|
| iENYRID | `tblTZTeXWry93slq` | `tblHbkPBjJ3uQOf9` | `tblS9CatxxC9og5e` |
| Kukirin | `tblw90DsOkPcqp5T` | `tblLuzRzU99fBwqw` | `tblWu2mnf0637FX9` |

## 前端架构

- 框架: React 19 + TypeScript + Vite
- 路由: React Router HashRouter（`#/` `#/tasks` 等）
- 状态管理: Zustand（`useAppStore`, `useBriefStore`, `useCalendarStore`, `useStudioStore`）
- UI 库: TDesign React（表格、开关等）+ 自建 CSS
- 样式: 单文件 `App.css`（约 900 行），CSS 变量 + BEM-like class

### 页面路由

| 路由 | 组件 | 数据源 |
|------|------|--------|
| `#/` | `Workbench` → IdeaComposer → BriefPanel → StreamlinedParameterPanel → ContentResults | `useBriefStore` + DeepSeek API |
| `#/tasks` | `ContentTasks` | `/api/history` → `storage/history.json` |
| `#/calendar` | `Calendar` | `useCalendarStore` + `/api/events` |
| `#/products` | `Products` | `/api/bootstrap` → 飞书产品表 |
| `#/brand` | `BrandManagement` | `studio_data.py` |
| `#/visual-dna` | `VisualDNA` | `studio_data.py` |
| `#/publish-records` | `PublishRecords` | `/api/publish-records` → 飞书排期表 + history.json |
| `#/analytics` | `Analytics` | `/api/history` + `/api/publish-records` |
| `#/automation` | `Automation` | 飞书自动化配置表 |
| `#/settings` | `Settings` | ENV + 本地配置 |

### 状态流转（工作台 Workflow）

```
Stage 1: 输入创意 → Stage 2: AI 分析 Brief → 确认应用 → Stage 3: 生成内容 → Stage 4: 审核发布
```

右侧栏卡片：TaskStatusCard → BriefConfidenceCard → ContentQualityCard → ChecklistCard → CampaignCard → PublishCard

## 后端 API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bootstrap` | 前端初始化数据（品牌、产品、国家、服务状态） |
| GET | `/api/brands` | 品牌列表 |
| GET | `/api/models` | 产品型号列表（从飞书读取） |
| GET | `/api/history` | 生成历史（从 `storage/history.json`） |
| POST | `/api/history` | 写入生成历史 |
| GET | `/api/publish-records` | 发布记录（飞书排期表 + history 合并去重） |
| POST | `/api/publish/all` | 统一三平台发布 + 飞书写回 |
| POST | `/api/publish/fb` | 单独发布 Facebook |
| POST | `/api/publish/ig` | 单独发布 Instagram |
| POST | `/api/publish/x` | 单独发布 X |
| POST | `/api/feishu/writeback` | 飞书排期表写回 |
| GET | `/api/events` | 营销日历活动 |
| POST | `/api/quality/score` | 内容质量评分 |
| POST | `/api/creative-brief` | AI 分析创意生成 Brief |
| POST | `/api/creative-brief/apply` | 确认 Brief 并写入参数 |
| POST | `/api/content-job` | AI 生成社媒文案 |
| GET | `/api/visual/style-pool` | 视觉风格参数池 |

## 2026-07-25 前端优化记录

### CSS 布局修复（`App.css`）

1. **`.parameter-grid`**：`grid-template-columns: repeat(3, 1fr)` → `repeat(2, 1fr)`
   - 原因：3 列时每列仅 72px，input 111px 溢出 39px
2. **`.param-field--platforms`**：`grid-column: span 1` → `grid-column: 1 / -1`
   - 原因：平台 Chip 按钮 161px 溢出在 72px 列中
3. **`.param-field .field-control`**：移除 `justify-content: space-between`（无右侧图标但空留间距）
4. **`.commandbar-actions button`**：添加 `display: inline-flex; align-items: center; gap: 5px`
5. **`.select-wrap i`**：添加 `cursor: pointer`（下拉箭头光标反馈）
6. **`.side-nav-item i`**：添加 `display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0`（支持 SVG）

### 侧边栏 SVG 化（`Sidebar.tsx`）

- 10 个 Unicode 字符 `▦▤▣◫♙◇◉▥⚙⌘` → 10 个 Lucide 风格 SVG 图标
- 跨平台渲染一致，不依赖系统字体

### 发布记录页重写（`PublishRecords.tsx`）

- 之前：完全硬编码，永远显示"暂无发布记录"
- 之后：从 `/api/publish-records` API 实时读取，表格展示（标题/型号/平台/状态/结果/时间）
- 平台显示为彩色 tag（FB 蓝、IG 粉、X 灰）

### 数据分析页重写（`Analytics.tsx`）

- 之前：4 个统计卡全部硬编码 `value: '0'`
- 之后：从 `/api/history` + `/api/publish-records` 实时计算
- 显示：总生成量（12条）、总发布量（4次）、成功率（33%）、平均评分（85/100）

### 内容质量动态评分（`RightRail.tsx`）

- 之前：idle 状态固定 0，done 固定 85，三项子分固定 89/85/79
- 之后：根据实际内容动态计算：
  - 品牌一致性：检查品牌名提及次数
  - 产品准确性：检查规格参数是否被引用
  - 平台适配度：检查字符长度 + hashtag 质量

### 后端新增 `/api/publish-records`（`server.py`）

- 合并飞书排期表（schedule table）+ 本地 history.json
- 按 `record_id` 去重
- 支持 `brand` 和 `limit` 参数

### 前端组件新增 `_ts_to_ms`（`server.py`）

- 工具函数：ISO 时间戳 / int / float → 毫秒时间戳

## 关键文件路径

```
shemei_skill/
├── server.py                          # FastAPI 后端主入口
├── scripts/
│   ├── brand_config.py               # 品牌→飞书表映射
│   ├── feishu_driver.py              # 飞书 Bitable 驱动
│   ├── studio_data.py                # 硬编码品牌/产品/国家/视觉参数
│   ├── history_engine.py             # 生成历史 JSON 存储
│   ├── publish_engine.py             # 三平台统一发布引擎
│   ├── quality_engine.py             # 内容质量评分
│   ├── content_factory.py            # 内容生成工厂
│   └── daemon.py                     # 后台守护进程
├── storage/
│   └── history.json                  # 生成历史持久化
├── web/
│   └── src/
│       ├── App.tsx                   # 路由定义
│       ├── App.css                   # 全局样式（~920行）
│       ├── store/
│       │   ├── useAppStore.ts        # 应用全局状态
│       │   ├── useBriefStore.ts      # 工作台 4 阶段状态机
│       │   ├── useCalendarStore.ts   # 营销日历状态
│       │   └── useStudioStore.ts     # 旧版创作台状态
│       ├── pages/
│       │   ├── Workbench.tsx         # 工作台主页面
│       │   ├── ContentTasks.tsx      # 内容任务（/api/history）
│       │   ├── PublishRecords.tsx    # 发布记录（/api/publish-records）
│       │   ├── Analytics.tsx         # 数据分析
│       │   ├── Calendar.tsx          # 营销日历
│       │   ├── Products.tsx          # 产品库
│       │   ├── BrandManagement.tsx   # 品牌管理
│       │   ├── VisualDNA.tsx         # 视觉风格DNA
│       │   ├── Automation.tsx        # 自动化配置
│       │   ├── Settings.tsx          # 系统设置
│       │   └── workbench/
│       │       ├── WorkflowStepper.tsx
│       │       ├── IdeaComposer.tsx
│       │       ├── BriefPanel.tsx
│       │       ├── StreamlinedParameterPanel.tsx
│       │       ├── GenerationSkeleton.tsx
│       │       ├── ContentResults.tsx
│       │       └── RightRail.tsx     # 右侧栏（质量评分+审核+发布）
│       └── components/layout/
│           ├── Sidebar.tsx           # 侧边栏导航（SVG图标）
│           ├── Topbar.tsx
│           └── CommandBar.tsx
```
