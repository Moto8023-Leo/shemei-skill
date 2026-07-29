@echo off
chcp 65001 >nul
echo ============================================
echo  shemei_skill — 全栈启动脚本
echo ============================================
echo.
echo  1. 启动后端 (python server.py)
echo  2. 启动前端 (npm run dev)
echo  3. 启动 ngrok 隧道
echo.
echo  ngrok 地址: https://shelving-reborn-juniper.ngrok-free.dev
echo ============================================
echo.

echo [1/3] 启动后端 API (port 8000)...
start "shemei-backend" cmd /c "cd /d D:\claude_code_projects\shemei_skill && python server.py"

echo [2/3] 启动前端 Vite (port 5174)...
start "shemei-frontend" cmd /c "cd /d D:\claude_code_projects\shemei_skill\web && npm run dev"

echo [3/3] 等待服务就绪后启动 ngrok...
timeout /t 5 /nobreak >nul
start "shemei-ngrok" cmd /c "ngrok start --config=%USERPROFILE%\AppData\Local\ngrok\ngrok.yml shemei"

echo.
echo ============================================
echo  全栈启动完成!
echo.
echo  前端: http://localhost:5174
echo  API:  http://localhost:8000
echo  ngrok: https://shelving-reborn-juniper.ngrok-free.dev
echo ============================================
echo.
echo  按任意键退出...
pause >nul
