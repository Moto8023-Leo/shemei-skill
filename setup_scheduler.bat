@echo off
chcp 65001 >nul
echo ============================================================
echo   Social Auto-Poster — Windows 定时调度器配置
echo ============================================================
echo.

:: 获取当前目录
set SCRIPT_DIR=%~dp0
set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

echo   项目目录: %SCRIPT_DIR%
echo.

:: 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ❌ 未检测到 Python！请先安装 Python 并添加到 PATH。
    echo      下载: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo   [1/2] 检查 Python 依赖...
python -c "import yaml; import tweepy; import requests" >nul 2>&1
if %errorlevel% neq 0 (
    echo   ⚠️  缺少依赖，正在安装...
    pip install -r requirements.txt
)

echo.

:: 创建 Windows 任务计划
echo   [2/2] 创建定时任务 "SocialAuto-Scheduler"...

:: 删除旧任务（如果存在）
schtasks /delete /tn "SocialAuto-Scheduler" /f >nul 2>&1

:: 创建新任务：每5分钟运行一次
schtasks /create ^
    /tn "SocialAuto-Scheduler" ^
    /tr "python \"%SCRIPT_DIR%\scripts\scheduler.py\" --run" ^
    /sc minute ^
    /mo 5 ^
    /f ^
    /rl limited

echo.
echo ============================================================
echo   ✅ 配置完成！
echo ============================================================
echo.
echo   任务名称: SocialAuto-Scheduler
echo   触发频率: 每 5 分钟
echo   执行命令: python scripts/scheduler.py --run
echo   工作目录: %SCRIPT_DIR%
echo.
echo   手动测试:
echo     python "%SCRIPT_DIR%\scripts\scheduler.py" --run
echo.
echo   查看队列:
echo     python "%SCRIPT_DIR%\scripts\scheduler.py" --list
echo.
echo   添加定时任务:
echo     python "%SCRIPT_DIR%\scripts\scheduler.py" --add --text "内容" --platform fb,x --time "2026-07-07 10:00"
echo.
pause
