@echo off
echo Starting SDPPS Desktop Agent...
cd /d E:\SDPPS
call C:\Users\%USERNAME%\anaconda3\envs\sdpps\python.exe -m desktop_agent.agent
pause
