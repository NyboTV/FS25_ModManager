@echo off
title FastDL Webserver
echo ==============================================
echo  FastDL Webserver Start-Skript
echo ==============================================
echo Pruefe Node.js Installation...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [FEHLER] Node.js ist nicht installiert oder nicht im PATH.
    echo Bitte installiere Node.js von https://nodejs.org/
    pause
    exit /b
)

echo Starte Server...
node fastdl-server.js

echo.
echo Der Server wurde beendet.
pause
