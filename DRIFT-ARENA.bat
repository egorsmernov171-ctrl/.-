@echo off
chcp 65001 >nul
title DRIFT ARENA - launcher
cd /d "%~dp0"
setlocal EnableDelayedExpansion

set "URL=http://localhost:3000"
set "HTML=%~dp0DRIFT-ARENA.html"

echo ============================================
echo   DRIFT ARENA - zapusk igry
echo ============================================
echo.

rem ---------- если сервер уже слушает порт 3000, просто открываем окно ----------
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul 2>nul
if %errorlevel%==0 goto open

where node >nul 2>nul
if %errorlevel%==0 (
  echo [1/2] Zapuskayu igrovoy server...
  start "" /min node server.js
  for /l %%i in (1,1,20) do (
    netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul 2>nul && goto open
    timeout /t 1 /nobreak >nul
  )
  echo Server ne otvetil - otkryvayu avtonomnuyu versiyu.
  start "" "%HTML%"
  goto done
)

echo Node.js ne nayden - otkryvayu avtonomnuyu versiyu DRIFT-ARENA.html
start "" "%HTML%"
goto done

:open
echo [1/2] Server rabotaet.
echo [2/2] Otkryvayu okno igry...
for %%B in (msedge chrome) do (
  where %%B >nul 2>nul && start "" %%B --app=%URL% --window-size=1600,900 && goto done
)
start "" %URL%

:done
echo.
echo Gotovo! Okno igry otkrylos.
echo.
echo  * Eto okno mozhno zakryt - server prodolzhit rabotat svernutym.
echo  * Chtoby polnostyu ostanovit igru - zakroyte okno "node" v paneli zadach
echo    ili vypolnite v komandnoy stroke:  taskkill /f /im node.exe
echo  * Ustanovka kak prilozhenie Windows: v menyu igry knopka
echo    "USTANOVIT KAK PRILOZHENIE WINDOWS" ili Edge -^> ... -^> Prilozheniya -^> Ustanovit.
echo.
timeout /t 8 /nobreak >nul
exit
