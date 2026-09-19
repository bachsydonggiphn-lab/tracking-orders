@echo off
title Dung GIP Tracking Server
echo Dang tim va tat tien trinh dang chay tren cong 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
  echo Dang tat PID %%a...
  taskkill /F /PID %%a
)
echo Hoan tat tat server!
pause
