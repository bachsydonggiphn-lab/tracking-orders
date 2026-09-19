@echo off
echo Dang go bo tu dong khoi dong cung Windows...
if exist "C:\Users\DELL AIO 5260\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\TrackingServerAutoStart.vbs" (
  del /f /q "C:\Users\DELL AIO 5260\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\TrackingServerAutoStart.vbs"
  echo Da go bo thanh cong khoi Startup!
) else (
  echo Khong tim thay file trong Startup!
)
pause
