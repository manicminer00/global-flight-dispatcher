@echo off
cd /d "%~dp0"
python scripts\vfd-verify.py %*
if errorlevel 1 pause
