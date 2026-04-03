@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo  SDPPS - Smart Desktop Productivity & Protection System
echo ============================================================
echo.

REM ── Step 1: Activate conda environment ───────────────────────
echo [Setup] Activating conda environment: sdpps
call conda activate sdpps 2>nul
if "%CONDA_DEFAULT_ENV%" NEQ "sdpps" (
    echo [Setup] Environment 'sdpps' not found. Creating it now...
    call conda create -n sdpps python=3.10 -y
    call conda activate sdpps
)
echo [Setup] Using environment: %CONDA_DEFAULT_ENV%
echo.

REM ── Step 2: Install Python dependencies ──────────────────────
echo [Setup] Installing Python dependencies from requirements.txt...
pip install -r "%~dp0requirements.txt" --quiet
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install Python packages. Check requirements.txt
    pause
    exit /b 1
)
echo [Setup] Python dependencies OK
echo.

REM ── Step 3: Install Node dependencies (if needed) ─────────────
if not exist "%~dp0frontend\node_modules" (
    echo [Setup] node_modules not found. Running npm install...
    cd /d "%~dp0frontend"
    npm install --silent
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo [Setup] Node dependencies installed.
) else (
    echo [Setup] Node modules already present. Skipping npm install.
)
echo.

REM ── Step 4: Start all services ────────────────────────────────
echo [1/3] Starting Auth Server (port 5001)...
start "SDPPS Auth Server" cmd /k "call conda activate sdpps && cd /d %~dp0 && python auth_server.py"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Desktop Agent (port 5000)...
start "SDPPS Agent" cmd /k "call conda activate sdpps && cd /d %~dp0 && python -m desktop_agent.agent"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Dev Server (port 3000)...
start "SDPPS Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ============================================================
echo  All services started!
echo.
echo   Auth Server  :  http://localhost:5001/auth/health
echo   Agent API    :  http://localhost:5000/api/status
echo   Frontend App :  http://localhost:3000
echo ============================================================
echo.
echo  Press any key to close this window (services keep running)
pause >nul
