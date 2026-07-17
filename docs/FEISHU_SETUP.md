# 飞书多维表格配置指南

用飞书多维表格管理社媒发布计划，自动定时发帖，结果回写。

⏱️ **一劳永逸**：10 分钟配置，永久使用
💰 **完全免费**：PersonalBaseToken 个人授权，无需企业应用

---

## 第一步：创建多维表格

1. 打开 https://www.feishu.cn/ → 登录
2. 左侧菜单 → **"多维表格"** → **"新建多维表格"**
3. 命名：如 `社媒发布计划`

### 创建以下字段

| 字段名 | 类型 | 配置 | 说明 |
|---|---|---|---|
| **文案** | 文本 | — | 帖子正文 |
| **图片路径** | 文本 | — | 本地图片相对路径，如 `data/images/product.jpg`，留空则纯文字 |
| **平台** | 单选 | 选项：FB, IG, X, FB+IG, FB+X, FB+X+IG | 发布到哪些平台 |
| **发布时间** | 日期 | 含时间 | 计划何时发布 |
| **状态** | 单选 | 选项：待发布, 已发布, 失败 | ⚡ 自动更新，不要手动改 |
| **发布结果** | 文本 | — | ⚡ 自动填写：帖子链接或错误信息 |
| **实际发布时间** | 日期 | 含时间 | ⚡ 自动填写 |

### 📸 字段创建示例

1. 进入表格 → 点击列头的 **"+"** 按钮
2. 选择字段类型 → 按上表配置
3. 重复，直到所有字段创建完成
4. **保存标题行**，不要删

---

## 第二步：获取授权码（PersonalBaseToken）

⚠️ **关键步骤** — 不需要创建飞书应用！

1. 在多维表格页面右上角，点击 **"..."**（更多）
2. 选择 **"获取授权码"**
3. 点击 **"启用授权码"**（首次需要）
4. 复制生成的 token

> 📌 这串 token 就是 `FEISHU_PERSONAL_BASE_TOKEN`

---

## 第三步：获取表格 ID

从浏览器地址栏获取两个值：

```
https://xxxxx.feishu.cn/base/APPTokenABC123?table=tblXXXXXXXX
                                ^^^^^^^^^^^        ^^^^^^^^^^^
                                FEISHU_APP_TOKEN    FEISHU_TABLE_ID
```

- `FEISHU_APP_TOKEN` = `/base/` 后面的字符串（不含 `?table=` 部分）
- `FEISHU_TABLE_ID` = `?table=` 后面的字符串（通常是 `tbl` 开头）

---

## 第四步：填入 .env

编辑 `social-auto/.env`：

```env
FEISHU_PERSONAL_BASE_TOKEN=xxx-your-token-from-step-2-xxx
FEISHU_APP_TOKEN=APPTokenABC123
FEISHU_TABLE_ID=tblXXXXXXXX
```

---

## 第五步：添加测试数据

在飞书表格中添加一行：

| 文案 | 图片路径 | 平台 | 发布时间 | 状态 |
|---|---|---|---|---|
| Hello from Feishu! #AutoTest | | FB | 选一个**已经过去的时间** | 待发布 |

---

## 第六步：运行

```bash
cd social-auto
python scripts/scheduler.py --run --from-feishu
```

输出应该类似：
```
============================================================
  Feishu Bitable Mode — checking pending posts...
============================================================
  Found 1 pending post(s)

  [1/1] [recXXXXXXXX] Hello from Feishu! #AutoTest...
       Platforms: ['fb'] | Image: none
       -> Posting to FB...
       [OK] FB
============================================================
  Done: 1 OK, 0 failed
============================================================
```

刷新飞书表格 — **"状态"** 应该已经从 **"待发布"** 变为 **"已发布"**，"发布结果" 显示帖子链接！

---

## 定时自动运行

### Windows 任务计划

编辑 `setup_scheduler.bat`，把最后一行改成：

```batch
schtasks /create ^
    /tn "SocialAuto-Feishu" ^
    /tr "python \"%SCRIPT_DIR%\scripts\scheduler.py\" --run --from-feishu" ^
    /sc minute ^
    /mo 5 ^
    /f ^
    /rl limited
```

这样每 5 分钟自动检查飞书表格，有到期任务就发帖。

### 手动触发

```bash
python scripts/scheduler.py --run --from-feishu
```

---

## 多人协作

1. 在飞书表格右上角 **"分享"** → 添加同事
2. 同事设置权限为 **"可编辑"**
3. 同事在表格中新增行 → 写文案 → 设时间 → 状态选"待发布"
4. 你的电脑跑 `scheduler.py --run --from-feishu` → 自动发帖 → 结果回写表格
5. 同事在飞书中直接看到发布结果

---

## 常见问题

### 获取授权码后失败？
授权码绑定了一个具体表格。如果换了新表格，需要重新获取。

### "待发布"状态的行不自动发布？
检查发布时间是否已经是**过去时间**。飞书表格中时间格式为：点击日期单元格 → 选择日期+时间 → 确认已过当前时间。

### Token 过期？
PersonalBaseToken 有效期很长（数月），过期后重新获取即可。
