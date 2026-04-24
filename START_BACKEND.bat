@echo off
title Limpa — Backend API  (port 3000)
color 0A
echo.
echo  ==========================================
echo   LIMPA  ^|  Backend API
echo   http://localhost:3000
echo  ==========================================
echo.
cd /d "%~dp0backend"
call npm run dev
pause
