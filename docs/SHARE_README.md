# 社媒自动发布 — 一页纸说明（给你同事的）

---

## 这是什么？

一个 Python 脚本，自动把你的**文案+图片**发布到 **Facebook / X / Instagram**。

你可以通过**飞书多维表格**或**本地文件**来管理发布内容，无需每天手动登录各个平台。

---

## 快速开始（5分钟）

### 1. 安装 Python 3.11+

https://www.python.org/downloads/

安装时勾选 ✅ **Add Python to PATH**

### 2. 解压文件夹

把整个 `social-auto/` 文件夹复制到你的电脑。

### 3. 安装依赖

打开终端（Win+R → `cmd` → 回车）：

```bash
cd social-auto 的路径
pip install -r requirements.txt
```

### 4. 配置 Token

```bash
copy .env.example .env
```

然后编辑 `.env` 文件，填入你的 Token。

👉 **不知道怎么填？** 看 `docs/QUICKSTART.md`
👉 **FB Token 怎么拿？** 看 `docs/FB_SETUP_GUIDE.md`

### 5. 测试

```bash
python post_now.py "Hello!" --platform fb --dry-run
```

---

## 常用命令

```bash
# 手动发帖
python post_now.py "文案内容" --platform fb
python post_now.py "文案内容" --platform fb --image "图片路径.jpg"
python post_now.py "文案内容" --platform fb,x,ig  # 多平台

# 预览（不真的发）
python post_now.py "文案内容" --platform fb --dry-run

# 查看 Token 是否有效
python scripts/validate_tokens.py

# 从飞书表格自动发帖
python scripts/scheduler.py --run --from-feishu
```

---

## 如果不用飞书

你也可以直接用本地队列：

```bash
# 添加定时任务
python scripts/scheduler.py --add --text "定时帖子" --platform fb --time "2026-07-10 14:00"

# 查看队列
python scripts/scheduler.py --list

# 运行到期任务
python scripts/scheduler.py --run
```

用 `setup_scheduler.bat` 创建 Windows 自动定时任务。

---

## 费用

| 平台 | 费用 |
|---|---|
| Facebook | 免费，不限量 |
| Instagram | 免费，不限量 |
| X (Twitter) | 免费（Cookie 方式） |

---

## 出问题了？

1. `python scripts/validate_tokens.py` — 检查 Token 是否有效
2. 看 `docs/QUICKSTART.md` 的 Troubleshooting 部分
3. 看 `posted_log.json` — 里面有每次发布的结果记录

---

## 需要帮助？

联系：___________（填你的联系方式）
