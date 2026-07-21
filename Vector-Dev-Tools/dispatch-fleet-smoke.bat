@echo off
setlocal
cd /d "%~dp0"
set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE (
    echo Node.js is not on PATH. Install from https://nodejs.org/ then run:
    echo   node ..\dev\scripts\dispatch-fleet-smoke.mjs %*
    exit /b 1
)
"%NODE_EXE%" ..\dev\scripts\dispatch-fleet-smoke.mjs %*
exit /b %ERRORLEVEL%
