@echo off
title RAG Notebook Server
cd /d "%~dp0"

echo ========================================
echo  RAG Notebook - Start
echo ========================================
echo.

echo [1/4] Starting PostgreSQL...
docker compose up -d

echo [2/4] Waiting for PostgreSQL...
:wait_db
docker inspect --format="{{.State.Health.Status}}" rag_notebook_db 2>nul | findstr /c:"healthy" >nul
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    goto wait_db
)
echo OK - PostgreSQL is ready.

echo [3/4] Generating Prisma client...
call npx prisma generate

echo [4/4] Starting Next.js dev server (webpack mode)...
echo.
echo  Open http://localhost:3000
echo ========================================
call npm run dev

pause
