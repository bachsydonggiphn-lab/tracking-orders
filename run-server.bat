@echo off
cd /d "D:\Tracking"
"C:\Program Files\nodejs\node.exe" dist\server.cjs >> "D:\Tracking\logs\server.log" 2>&1
