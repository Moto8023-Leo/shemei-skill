# shemei_skill — ngrok 隧道配置

## 隧道地址

| 服务 | 地址 |
|------|------|
| 前端 Web UI | https://shelving-reborn-juniper.ngrok-free.dev |
| 后端 API | https://shelving-reborn-juniper.ngrok-free.dev/api/ |

> 地址固定不变，不管重启电脑还是重开 tunnel，都是这个域名。

## 启动隧道

```cmd
ngrok start shemei
```

前提：前端 (`localhost:5174`) 和后端 (`localhost:8000`) 已在运行。

## 停止隧道

关闭运行 ngrok 的命令行窗口，或 Ctrl+C。

## 检查隧道状态

浏览器打开 http://localhost:4040 可以看到 ngrok 的实时管理面板。

## 温馨提示

- 免费版 ngrok 每月 **1GB 流量**，轻量使用足够
- 你的电脑需要保持开机，tunnel 才能访问
- 如果重启电脑，需要重新运行：
  1. `start.bat` 或手动启动前后端
  2. `ngrok start shemei`
