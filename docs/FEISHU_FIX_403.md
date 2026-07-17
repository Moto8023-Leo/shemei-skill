# 飞书多维表格 — 完整权限配置教程

当你看到 `91403 Forbidden` 错误时，说明你的飞书应用对多维表格**只能读，不能写**。

这不是 Bug，而是飞书的两层权限体系：App 权限（开放平台）+ 文档权限（表格内）。

---

## 你需要完成 3 件事：

### ① 开放平台：给 App 添加权限并发布版本

1. 打开 **https://open.feishu.cn/app/cli_aaaa555c9979dbb3/auth**
2. 搜索并勾选以下权限：
   - ✅ 多维表格（`bitable:app`）— 读写
   - ✅ 云文档（`drive:drive`）— 读写
3. **关键步骤**：点击右上角 **"创建版本"** → 输入版本号（如 `1.0.1`）→ **"发布"**
   - ⚠️ 只勾选权限不发布 = 不生效！

---

### ② 多维表格内：添加你的应用为协作者

1. 打开你的多维表格：**https://jcna9vhsmnbe.feishu.cn/wiki/QFrowVpL3iIMAYkCE2PcaZCEnJe?table=tblTZTeXWry93slq**
2. 右上角点 **"⋯"**（更多）
3. 点击 **"更多"** → **"添加文档应用"**
4. 搜索你的应用名称 → 选中 → 权限选 **"可编辑"**
5. 确认

> 如果搜索不到你的应用，说明第 ① 步没有做或者版本没发布。回去确认 ① 完成后重试。

---

### ③ 验证

回到 VS Code，运行：
```bash
cd social-auto
python scripts/scheduler.py --run --from-feishu
```

如果看到类似输出：
```
CREATE: 0 | success
UPDATE: 0 | success
```
就表示飞书读写全通了。

---

## 你的配置信息（供参考）

| 项目 | 值 |
|---|---|
| App ID | `cli_aaaa555c9979dbb3` |
| App Secret | 已配置在 .env |
| 表格 App Token | `KsRwb5TioaCCmms7iJEcoGWSnXc` |
| 表格 ID | `tblTZTeXWry93slq` |
| 表格 URL | https://jcna9vhsmnbe.feishu.cn/wiki/QFrowVpL3iIMAYkCE2PcaZCEnJe?table=tblTZTeXWry93slq |
