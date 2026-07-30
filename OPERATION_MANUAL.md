markdown

# Shemei Skill - 操作手册（完整版）

**目标**：将本地已跑通的 3 个社媒发布功能（FB / INS / X），完整迁移到 Vercel 线上网站 https://shemei-skill.vercel.app/，实现：
- DeepSeek 生成文案
- 一键发布到 FB + Instagram（官方 API）
- 一键发布到 X（浏览器自动化 Playwright，使用本地已登录状态）
- 全部发布结果回写飞书表格

---

## 1. 项目现状
- 前端已部署在 Vercel（https://shemei-skill.vercel.app/）
- 本地已跑通 3 个社媒发布逻辑
- 需要把后端逻辑迁移到 Vercel + 保留 X 的浏览器自动化能力

---

## 2. 技术栈
- **框架**：Next.js 14/15 App Router + TypeScript + Tailwind
- **AI**：DeepSeek API
- **FB/INS**：Meta Graph API（System User Token）
- **X**：Playwright 浏览器自动化
- **数据库/日志**：飞书电子表格（Sheets）
- **部署**：Vercel（前端 + Serverless API）

---

## 3. 所需密钥清单（请提前准备好）

```env
# DeepSeek
DEEPSEEK_API_KEY=sk-...

# 飞书
FEISHU_APP_ID=cli_...
FEISHU_APP_SECRET=...
FEISHU_SPREADSHEET_TOKEN=...   # 你的发布日志表格 token

# Meta (FB/INS)
META_ACCESS_TOKEN=EAAG...      # System User 长效 Token
FB_PAGE_ID=...
IG_USER_ID=...

# X（浏览器自动化）
X_USERNAME=你的X账号

4. 项目目录结构（目标）

shemei-poster/
├── app/
│   ├── api/
│   │   ├── generate/route.ts          # DeepSeek 生成文案
│   │   ├── post-meta/route.ts         # FB + INS 发布
│   │   └── post-x/route.ts            # X 浏览器自动化发布
│   ├── page.tsx                       # 主前端页面
│   └── layout.tsx
├── lib/
│   ├── deepseek.ts
│   ├── meta-api.ts
│   └── playwright-x.ts
├── .env.local
├── OPERATION_MANUAL.md
└── package.json

5. 详细实施步骤步骤 1：准备环境bash

cd shemei-poster
npm install axios openai playwright @playwright/test lucide-react
npx playwright install chromium  # 安装浏览器

步骤 2：创建 .env.local（按上面清单填写）步骤 3：实现核心模块（让 VS Code AI 按下面文件名生成）文件1：lib/deepseek.ts —— DeepSeek 调用
文件2：lib/meta-api.ts —— FB/INS 发布函数
文件3：lib/playwright-x.ts —— X 自动化发布（重点）
文件4：app/api/generate/route.ts
文件5：app/api/post-meta/route.ts
文件6：app/api/post-x/route.ts
文件7：app/page.tsx —— 美观前端（表单 + 预览 + 多平台选择 + 发布按钮 + 历史记录）提示词示例（发给 AI 时使用）：“根据 OPERATION_MANUAL.md 的要求，实现文件 [文件名]，要求代码健壮、有错误处理、返回统一格式 {success, data, error}”
步骤 4：飞手表格结构表头建议（从 A1 开始）：时间戳 | 主题 | 平台 | 文案标题 | 正文预览 | FB链接 | INS链接 | X链接 | 状态 | 错误信息

6. X 浏览器自动化特别说明（重点）因为没有 X API，我们使用 Playwright：优先使用已登录的浏览器上下文（Cookie）
备用方案：自动填写账号密码
强烈建议在本地开发环境先测试 X 发布
Vercel 上运行 Playwright 需要特殊配置（推荐先在本地跑通，再考虑上云）

7. 测试流程本地运行 npm run dev
访问 http://localhost:3000
测试生成文案
分别测试 FB/INS 和 X 发布
检查飞书表格是否有记录

8. 部署到 Vercelgit push 到 GitHub
Vercel 重新部署
在 Vercel Dashboard 添加所有 Environment Variables
注意：X 的 Playwright 在 Vercel Serverless 上可能受限，可暂时只开放 FB/INS，X 保留本地脚本

9. 常见问题与解决方案Meta Token 失效：重新生成 System User Token
X 登录失败：确保本地 Chrome 已登录 X，并使用持久化 Context
飞书写入失败：检查权限和 spreadsheet_token
速率限制：添加延迟和重试机制

10. 下一步（可选功能）批量生成多条文案
定时自动发布（Vercel Cron）
图片自动生成 + 上传
发布历史管理页面