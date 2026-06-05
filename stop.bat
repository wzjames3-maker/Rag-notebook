@echo off
title RAG Notebook - Stopping
cd /d "%~dp0"

echo ========================================
echo  Stopping RAG Notebook Server
echo ========================================
echo.

echo Stopping Next.js dev server (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    call taskkill /f /pid %%a 2>nul && echo [OK] Process %%a terminated
)

echo.
echo ========================================
echo  Next.js server stopped.
echo.
echo  PostgreSQL is still running.
echo  To stop it too, run: docker compose down
echo ========================================
pause
