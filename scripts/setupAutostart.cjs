const fs = require('fs');
const path = require('path');

const trackingDir = 'D:\\Tracking';
const nodeExe = process.execPath; // e.g. C:\Program Files\nodejs\node.exe
const startupFolder = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const logsDir = path.join(trackingDir, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 1. Batch file to start manually (visible window)
const startBatContent = `@echo off
title GIP Tracking Server (Port 5000)
cd /d "${trackingDir}"
echo ========================================================
echo   GIP TRACKING SERVER - DONG BO VA TRA CUU VAN DON
echo   Dia chi truy cap: http://localhost:5000
echo   Mang LAN:         http://192.168.1.18:5000
echo ========================================================
"${nodeExe}" dist\\server.cjs
pause
`;
fs.writeFileSync(path.join(trackingDir, 'start-server.bat'), startBatContent, 'utf8');

// 2. Batch file to stop server cleanly
const stopBatContent = `@echo off
title Dung GIP Tracking Server
echo Dang tim va tat tien trinh dang chay tren cong 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
  echo Dang tat PID %%a...
  taskkill /F /PID %%a
)
echo Hoan tat tat server!
pause
`;
fs.writeFileSync(path.join(trackingDir, 'stop-server.bat'), stopBatContent, 'utf8');

// 3. Background batch file and VBS script to run silently (no black command prompt popup)
const runBatContent = `@echo off
cd /d "${trackingDir}"
"${nodeExe}" dist\\server.cjs >> "${path.join(logsDir, 'server.log')}" 2>&1
`;
fs.writeFileSync(path.join(trackingDir, 'run-server.bat'), runBatContent, 'utf8');

const vbsContent = `' GIP Tracking Server - Silent Background Launcher
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${trackingDir}"
WshShell.Run "cmd /c """"${path.join(trackingDir, 'run-server.bat')}""""", 0, False
`;
fs.writeFileSync(path.join(trackingDir, 'start-hidden.vbs'), vbsContent, 'utf8');

// 4. Place the launcher directly into Windows Startup folder
const startupVbsPath = path.join(startupFolder, 'TrackingServerAutoStart.vbs');
fs.writeFileSync(startupVbsPath, vbsContent, 'utf8');

// 5. Batch file to uninstall autostart if ever needed
const uninstallBatContent = `@echo off
echo Dang go bo tu dong khoi dong cung Windows...
if exist "${startupVbsPath}" (
  del /f /q "${startupVbsPath}"
  echo Da go bo thanh cong khoi Startup!
) else (
  echo Khong tim thay file trong Startup!
)
pause
`;
fs.writeFileSync(path.join(trackingDir, 'uninstall-autostart.bat'), uninstallBatContent, 'utf8');

console.log('=== KET QUA CAI DAT AUTO-START ===');
console.log('1. Da tao file start-server.bat (chay thu cong co cua so cmd)');
console.log('2. Da tao file stop-server.bat (tat server tren cong 5000)');
console.log('3. Da tao file start-hidden.vbs (chay ngam hoan toan khong hien cua so)');
console.log('4. Da copy vao thu muc khoi dong Windows Startup:');
console.log('   Path:', startupVbsPath);
console.log('   Ton tai:', fs.existsSync(startupVbsPath));
console.log('5. Da tao file uninstall-autostart.bat neu sau nay khong muon tu bat');
