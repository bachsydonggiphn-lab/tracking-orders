@echo off
title GIP Tracking Server (Port 5000)
cd /d "D:\Tracking"
echo ========================================================
echo   GIP TRACKING SERVER - DONG BO VA TRA CUU VAN DON
echo   Dia chi truy cap: http://localhost:5000
echo   Mang LAN:         http://192.168.1.18:5000
echo ========================================================
"C:\Program Files\nodejs\node.exe" dist\server.cjs
pause
