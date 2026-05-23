@echo off
echo ====================================
echo  E-Telly Local Server (Offline Mode)
echo ====================================
echo.
echo Starting server... do not close this window.
echo.
cd /d "%~dp0..\server"
set LOCAL_MODE=true
set MONGO_URI=mongodb://localhost:27017/etelly_local
set LOCAL_MONGO_URI=mongodb://localhost:27017/etelly_local
set JWT_SECRET=etelly_5W8jOE9HQoUjLafC
set BARANGAY_NAME=Bagong Nayon
set CLOUD_SYNC_URL=https://e-telly-ca75b10e9536.herokuapp.com/api/sync/receive-batch
node index.js
pause
