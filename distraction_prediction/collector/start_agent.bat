@echo off
REM SDPPS LocalAgent - Silent Background Launcher
REM Double-click this file OR add it to Task Scheduler to auto-start on login

REM Find pythonw.exe from your current Python installation
for /f "delims=" %%i in ('where pythonw') do set PYTHONW=%%i

if "%PYTHONW%"=="" (
    echo ERROR: pythonw.exe not found. Make sure Python is installed.
    pause
    exit /b 1
)

start "" "%PYTHONW%" "e:\SDPPS\distraction_prediction\collector\LocalAgent.py"
echo LocalAgent started silently in background.
