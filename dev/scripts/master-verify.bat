@echo off
setlocal
cd /d "%~dp0..\.."
node "%~dp0master-verify.mjs"
exit /b %ERRORLEVEL%
