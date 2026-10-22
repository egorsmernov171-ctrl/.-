@echo off
chcp 65001 >nul
title DRIFT ARENA - udalenie
setlocal EnableDelayedExpansion
set "DST=%~dp0"
if "%DST:~-1%"=="\" set "DST=%DST:~0,-1%"

echo ============================================
echo   DRIFT ARENA - udalenie
echo ============================================
echo.

rem ---- ostanavlivaem igrovoy server, esli on zapushchen (port 3000) ----
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do taskkill /f /pid %%P >nul 2>&1

echo [1/3] Udalayu yarlyki...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\DRIFT ARENA" rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\DRIFT ARENA"
if exist "%USERPROFILE%\Desktop\DRIFT ARENA.lnk" del /q "%USERPROFILE%\Desktop\DRIFT ARENA.lnk"

echo [2/3] Udalayu zapis iz spiska ustanovlennyh programm...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /f >nul 2>nul

echo [3/3] Udalayu faily igry...
where powershell >nul 2>nul && powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 2; Remove-Item -LiteralPath '%DST%' -Recurse -Force" >nul 2>nul
if exist "%DST%\UNINSTALL.bat" rmdir /s /q "%DST%" >nul 2>nul

echo.
echo Gotovo! DRIFT ARENA udalena s kompyutera.
echo.
timeout /t 4 /nobreak >nul
exit
