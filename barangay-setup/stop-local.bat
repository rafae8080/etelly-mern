@echo off
echo ====================================
echo  E-Telly — Stopping Local Mode
echo ====================================
echo.
echo Re-enabling firewall...
netsh advfirewall set publicprofile state on >nul 2>&1
echo Firewall re-enabled.
echo.
echo You can now close this window.
pause
