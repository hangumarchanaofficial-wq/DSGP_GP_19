@echo off
setlocal

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "DEFAULT_VENV_DIR=%ROOT%\.venv"
set "FALLBACK_VENV_DIR=%ROOT%\.venv_launcher"
set "VENV_DIR="
set "PYTHON_EXE="
set "ACTIVATE_BAT="

echo ============================================================
echo  SDPPS - Smart Desktop Productivity and Protection System
echo ============================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python launcher "py" was not found in PATH.
    echo         Install Python 3.10+ and try again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm was not found in PATH.
    echo         Install Node.js and try again.
    pause
    exit /b 1
)

call :ensure_venv "%DEFAULT_VENV_DIR%"
if errorlevel 1 (
    echo [Setup] Existing .venv is missing or invalid. Using fallback environment .venv_launcher...
    call :ensure_venv "%FALLBACK_VENV_DIR%"
    if errorlevel 1 (
        echo [ERROR] Failed to prepare a working virtual environment.
        pause
        exit /b 1
    )
)

echo [Setup] Installing Python dependencies...
call "%ACTIVATE_BAT%"
python -m pip install --upgrade pip
python -m pip install -r "%ROOT%\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)
echo.

if not exist "%ROOT%\frontend\node_modules" (
    echo [Setup] Installing frontend dependencies...
    pushd "%ROOT%\frontend"
    npm install
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed in frontend.
        pause
        exit /b 1
    )
    popd
) else (
    echo [Setup] Frontend dependencies already present.
)
echo.

echo [1/3] Starting auth server on http://127.0.0.1:5001 ...
start "SDPPS Auth Server" cmd /k "cd /d \"%ROOT%\" && call \"%ACTIVATE_BAT%\" && python auth_server.py"
timeout /t 2 /nobreak >nul

echo [2/3] Starting desktop agent API on http://127.0.0.1:5000 ...
start "SDPPS Desktop Agent" cmd /k "cd /d \"%ROOT%\" && call \"%ACTIVATE_BAT%\" && python -m desktop_agent.agent"
timeout /t 2 /nobreak >nul

echo [3/3] Starting frontend on http://127.0.0.1:3000 ...
start "SDPPS Frontend" cmd /k "cd /d \"%ROOT%\frontend\" && npm run dev"

echo.
echo ============================================================
echo  Startup commands launched
echo  Auth Server  : http://127.0.0.1:5001/auth/health
echo  Agent API    : http://127.0.0.1:5000/api/status
echo  Frontend App : http://127.0.0.1:3000
echo ============================================================
echo.
pause
exit /b 0

:ensure_venv
set "VENV_DIR=%~1"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"
set "ACTIVATE_BAT=%VENV_DIR%\Scripts\activate.bat"

if not exist "%PYTHON_EXE%" (
    echo [Setup] Creating virtual environment in "%VENV_DIR%"...
    py -3 -m venv "%VENV_DIR%"
    if errorlevel 1 exit /b 1
)

"%PYTHON_EXE%" -c "import sys; print(sys.version)" >nul 2>nul
if errorlevel 1 exit /b 1

exit /b 0
