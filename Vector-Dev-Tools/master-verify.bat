@echo off
setlocal
cd /d "%~dp0"
node "..\dev\scripts\master-verify.mjs"
exit /b %ERRORLEVEL%
