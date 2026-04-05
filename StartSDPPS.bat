@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "VENV_DIR=%ROOT%\.venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "ACTIVATE_BAT=%VENV_DIR%\Scripts\activate.bat"

set "MODE=real"
if /I "%1"=="--sim"  set "MODE=sim"
if /I "%1"=="--help" goto :show_help

:: ============================================================
echo.
echo  ============================================================
echo   SDPPS - Smart Student Distraction Prediction ^& Prevention
echo  ============================================================
echo   Mode: %MODE%
echo  ============================================================
echo.

:: ── 1. Check Python ─────────────────────────────────────────
where py >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python launcher "py" not found in PATH.
    echo         Install Python 3.10+ from https://python.org
    pause & exit /b 1
)
echo [OK] Python launcher found.

:: ── 2. Check Node / npm ──────────────────────────────────────
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found in PATH.
    echo         Install Node.js from https://nodejs.org
    pause & exit /b 1
)
echo [OK] npm found.

:: ── 3. Virtual Environment ───────────────────────────────────
if not exist "%PYTHON_EXE%" (
    echo [Setup] Creating virtual environment in .venv ...
    py -3 -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause & exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Virtual environment found.
)

:: ── 4. Activate venv ─────────────────────────────────────────
call "%ACTIVATE_BAT%"
if errorlevel 1 (
    echo [ERROR] Failed to activate virtual environment.
    pause & exit /b 1
)
echo [OK] Virtual environment activated.

:: ── 5. Install Python dependencies ───────────────────────────
echo [Setup] Installing / verifying Python dependencies...
python -m pip install --upgrade pip --quiet
python -m pip install -r "%ROOT%\requirements.txt" --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause & exit /b 1
)
echo [OK] Python dependencies ready.

:: ── 6. Frontend node_modules ─────────────────────────────────
if not exist "%ROOT%\frontend\node_modules" (
    echo [Setup] Installing frontend npm dependencies...
    pushd "%ROOT%\frontend"
    npm install
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed.
        pause & exit /b 1
    )
    popd
    echo [OK] Frontend dependencies installed.
) else (
    echo [OK] Frontend dependencies already present.
)
echo.

:: ── 7. Kill any leftover processes on our ports ───────────────
echo [Cleanup] Releasing ports 5000 5001 3000 if occupied...
for %%P in (5000 5001 3000) do (
    for /f "tokens=5" %%i in ('netstat -aon ^| findstr ":%%P " 2^>nul') do (
        taskkill /PID %%i /F >nul 2>nul
    )
)
echo [OK] Ports cleared.
echo.

:: ── 8. Start services ────────────────────────────────────────
echo [1/3] Starting Auth Server on http://127.0.0.1:5001 ...
start "SDPPS Auth Server" cmd /k "cd /d "%ROOT%" && call "%ACTIVATE_BAT%" && python auth_server.py"
timeout /t 3 /nobreak >nul

if /I "%MODE%"=="sim" (
    echo [2/3] Starting SIMULATION Server on http://127.0.0.1:5000 ...
    start "SDPPS Simulation Server" cmd /k "cd /d "%ROOT%" && call "%ACTIVATE_BAT%" && python simulation_server.py"
) else (
    echo [2/3] Starting Desktop Agent API on http://127.0.0.1:5000 ...
    start "SDPPS Desktop Agent" cmd /k "cd /d "%ROOT%" && call "%ACTIVATE_BAT%" && python -m desktop_agent.agent"
)
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend on http://127.0.0.1:3000 ...
start "SDPPS Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"
timeout /t 3 /nobreak >nul

:: ── 9. Summary ───────────────────────────────────────────────
echo.
echo  ============================================================
echo   SDPPS is running!
echo  ============================================================
echo   Auth Server  : http://127.0.0.1:5001/auth/health
if /I "%MODE%"=="sim" (
echo   Agent API    : http://127.0.0.1:5000/api/status  [SIMULATION]
) else (
echo   Agent API    : http://127.0.0.1:5000/api/status  [REAL]
)
echo   Frontend App : http://127.0.0.1:3000
echo  ============================================================
echo.
echo   To stop all services, close the opened terminal windows
echo   or press Ctrl+C in each one.
echo.
pause
exit /b 0

:: ── Help ─────────────────────────────────────────────────────
:show_help
echo.
echo  Usage:
echo    StartSDPPS.bat           - Start with real desktop agent
echo    StartSDPPS.bat --sim     - Start with simulation server
echo    StartSDPPS.bat --help    - Show this help
echo.
pause
exit /b 0
