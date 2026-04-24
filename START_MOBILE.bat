@echo off
title Limpa — Mobile App  (Expo)
color 0D
echo.
echo  ==========================================
echo   LIMPA  ^|  Mobile App (Expo)
echo   Scan the QR code with Expo Go
echo  ==========================================
echo.
cd /d "%~dp0mobile"
call npx expo start
pause
