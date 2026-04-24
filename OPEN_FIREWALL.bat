@echo off
echo ====================================================
echo  Opening Windows Firewall for Expo (Port 8081)
echo ====================================================
echo.
netsh advfirewall firewall add rule name="Expo Port 8081" dir=in action=allow protocol=TCP localport=8081
echo.
echo Complete! You can close this window now.
pause
