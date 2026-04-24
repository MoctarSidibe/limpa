@echo off
title Limpa — Admin Dashboard  (port 5174)
color 0B
echo.
echo  ==========================================
echo   LIMPA  ^|  Admin Dashboard (PWA)
echo   http://localhost:5174
echo  ==========================================
echo.
cd /d "%~dp0admin-dashboard"
call npm run dev
pause
