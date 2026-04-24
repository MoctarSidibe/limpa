@echo off
title Limpa — Baker Dashboard  (port 5173)
color 0E
echo.
echo  ==========================================
echo   LIMPA  ^|  Baker Dashboard (PWA)
echo   http://localhost:5173
echo  ==========================================
echo.
cd /d "%~dp0dashboard"
call npm run dev
pause
