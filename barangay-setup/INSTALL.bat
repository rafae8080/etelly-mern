@echo off
title E-Telly Local Setup
color 0A

echo ============================================
echo   E-Telly Barangay Hall - One Time Setup
echo ============================================
echo.
echo This will install everything needed to run
echo E-Telly offline during a disaster.
echo.
echo Make sure the USB drive is still plugged in.
echo.
pause

:: ── Step 1: Node.js ──────────────────────────────────────────────
echo.
echo [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel%==0 (
    echo       Node.js already installed. Skipping.
) else (
    echo       Installing Node.js...
    if exist "%~dp0installers\node-installer.msi" (
        msiexec /i "%~dp0installers\node-installer.msi" /quiet /norestart
        echo       Node.js installed.
    ) else (
        echo.
        echo  ERROR: node-installer.msi not found in installers folder.
        echo  Please download Node.js LTS from https://nodejs.org and run this again.
        pause
        exit /b 1
    )
)

:: ── Step 2: MongoDB ──────────────────────────────────────────────
echo.
echo [2/5] Checking MongoDB...
sc query MongoDB >nul 2>&1
if %errorlevel%==0 (
    echo       MongoDB already installed. Skipping.
) else (
    echo       Installing MongoDB...
    if exist "%~dp0installers\mongodb-installer.msi" (
        msiexec /i "%~dp0installers\mongodb-installer.msi" /quiet /norestart ADDLOCAL="ServerService,Client,MonitoringTools,ImportExportTools,MiscellaneousTools"
        echo       MongoDB installed.
        echo       Starting MongoDB service...
        net start MongoDB >nul 2>&1
    ) else (
        echo.
        echo  ERROR: mongodb-installer.msi not found in installers folder.
        echo  Please download MongoDB Community from https://www.mongodb.com/try/download/community and run this again.
        pause
        exit /b 1
    )
)

:: ── Step 3: npm install ──────────────────────────────────────────
echo.
echo [3/5] Installing server dependencies...
cd /d "%~dp0..\server"
call npm install --silent
echo       Server dependencies installed.

echo.
echo [4/5] Installing dashboard dependencies...
cd /d "%~dp0..\client"
call npm install --silent
echo       Dashboard dependencies installed.

:: ── Step 4: Create local admin account ──────────────────────────
echo.
echo [5/5] Creating local admin account...
cd /d "%~dp0.."
set MONGO_URI=mongodb://localhost:27017/etelly_local
node server/scripts/createAdmin.js

:: ── Done ─────────────────────────────────────────────────────────
echo.
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo To start the system during a disaster:
echo   1. Double-click start-local.bat
echo   2. Double-click start-dashboard.bat
echo   3. Open browser: http://localhost:5173
echo   4. Login with your barangay credentials
echo.
echo Reports will auto-sync to CDRRMO when
echo internet is restored. No action needed.
echo.
pause
