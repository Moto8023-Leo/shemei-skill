@echo off
title iENYRID Social Auto-Poster
echo ============================================
echo   iENYRID Social Auto-Poster
echo ============================================
echo.
echo Starting backend server...
start "iENYRID API" cmd /c "cd /d %~dp0 && python server.py"
echo Backend: http://localhost:8000
echo.
echo Installing frontend dependencies...
cd /d %~dp0web
call npm install --silent 2>nul
echo.
echo Starting frontend dev server...
echo Frontend: http://localhost:5174
echo.
echo Open http://localhost:5174 in your browser
echo ============================================
npm run dev
pause
