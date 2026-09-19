' GIP Tracking Server - Silent Background Launcher
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Tracking"
WshShell.Run "cmd /c """"D:\Tracking\run-server.bat""""", 0, False
