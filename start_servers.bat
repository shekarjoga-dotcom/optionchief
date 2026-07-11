@echo off
title OptionsOracle Reborn Launcher
echo ===================================================
echo   Starting OptionsOracle Reborn Services...
echo ===================================================

:: Set parent working directory to the batch file folder (handles spaces and drive letters)
cd /d "%~dp0"

:: Terminate any zombie processes on ports 8000 and 5173 to prevent address conflicts
echo Freeing ports 8000 and 5173 from previous runs...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: Launch Backend Server
echo 1. Launching FastAPI Backend Server (Port 8000)...
start "OptionsOracle Backend" cmd /k "cd backend && venv\Scripts\python run.py"

:: Launch Frontend Dev Server
echo 2. Launching Vite Frontend Server (Port 5173)...
start "OptionsOracle Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   All services launched!
echo   - Backend: http://127.0.0.1:8000
echo   - Frontend: http://localhost:5173
echo   (Keep the backend and frontend command windows open)
echo ===================================================
echo.
pause
