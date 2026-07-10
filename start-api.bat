@echo off
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Starting API on http://localhost:8080
node api\server.js
pause
