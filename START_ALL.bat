@echo off
setlocal
set ROOT=%~dp0

echo.
echo  ==========================================
echo   LIMPA  ^|  Lancement de tous les services
echo  ==========================================
echo   [1] Backend API        http://localhost:3000
echo   [2] Baker Dashboard    http://localhost:5173
echo   [3] Admin Dashboard    http://localhost:5174
echo   [4] Mobile App         Expo (QR code)
echo  ==========================================
echo.

:: ── Tenter Windows Terminal (wt) en premier ──────────────────────
where wt >nul 2>&1
if %errorlevel% == 0 (
    echo  Ouverture dans Windows Terminal...
    echo.
    wt ^
        new-tab --title "Backend :3000" --tabColor "#16a34a" /d "%ROOT%backend" cmd /k "color 0A && npm run dev" ^; ^
        new-tab --title "Baker :5173"   --tabColor "#ca8a04" /d "%ROOT%dashboard" cmd /k "color 0E && npm run dev" ^; ^
        new-tab --title "Admin :5174"   --tabColor "#0891b2" /d "%ROOT%admin-dashboard" cmd /k "color 0B && npm run dev" ^; ^
        new-tab --title "Mobile Expo"   --tabColor "#9333ea" /d "%ROOT%mobile" cmd /k "color 0D && npx expo start"
    goto done
)

:: ── Fallback : quatre fenêtres cmd séparées ─────────────────────
echo  Windows Terminal introuvable — ouverture en fenetres separees...
echo.

start "Limpa — Backend :3000"      /d "%ROOT%backend"          cmd /k "color 0A && title Limpa — Backend :3000 && npm run dev"
echo  [OK] Backend...

timeout /t 5 /nobreak > nul
echo  Backend demarre (5s), lancement des interfaces...

start "Limpa — Baker :5173"        /d "%ROOT%dashboard"        cmd /k "color 0E && title Limpa — Baker Dashboard :5173 && npm run dev"
start "Limpa — Admin :5174"        /d "%ROOT%admin-dashboard"  cmd /k "color 0B && title Limpa — Admin Dashboard :5174 && npm run dev"
start "Limpa — Mobile Expo"        /d "%ROOT%mobile"           cmd /k "color 0D && title Limpa — Mobile Expo && npx expo start"

echo  [OK] Baker Dashboard...
echo  [OK] Admin Dashboard...
echo  [OK] Mobile...

:done
echo.
echo  Tous les services sont lances.
echo  Fermez cette fenetre ou appuyez sur une touche.
pause > nul
endlocal
