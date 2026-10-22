@echo off
chcp 65001 >nul
title DRIFT ARENA - launcher
cd /d "%~dp0"
setlocal EnableDelayedExpansion

set "URL=http://localhost:3000"
set "HTML=%~dp0index.html"
set "YA=%LOCALAPPDATA%\Yandex\YandexBrowser\Application\browser.exe"

echo ============================================
echo   DRIFT ARENA - zapusk igry
echo ============================================
echo.

rem ---------- esli server uzhe slushaet port 3000, prosto otkryvaem okno ----------
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

echo Node.js ne nayden - otkryvayu avtonomnuyu versiyu.
start "" "%HTML%"
goto done

:open
echo [1/2] Server rabotaet.
echo [2/2] Otkryvayu okno igry...

rem ---------- okno bez adresnoy stroki: Edge, Chrome ili Yandeks.Brauzer ----------
rem  Berem brauzer po umolchaniyu iz reestra (UserChoice\Progid):
rem  Yandex.HTML = Yandeks.Brauzer, ChromeHTML = Chrome, MSEdgeHTM = Edge.
set "PROGID="
set "BROWSER="
for /f "tokens=3" %%A in ('reg query "HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice" /v Progid 2^>nul ^| findstr /i "Progid"') do set "PROGID=%%A"
if defined PROGID (
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:Yandex=%" set "BROWSER=browser"
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:yandex=%" set "BROWSER=browser"
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:Chrome=%" set "BROWSER=chrome"
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:chrome=%" set "BROWSER=chrome"
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:MSEdge=%" set "BROWSER=msedge"
  if not defined BROWSER if /i "%PROGID%" neq "%PROGID:msedge=%" set "BROWSER=msedge"
)
rem Yandeks.Brauzer ne vsegda v PATH - togda berem tipovoy put ustanovki
if "!BROWSER!"=="browser" (
  where browser >nul 2>nul
  if errorlevel 1 if exist "%YA%" set "BROWSER=%YA%"
)
rem zapasnoy poryadok: Edge, Chrome, Yandeks
if not defined BROWSER for %%B in (msedge chrome browser) do if not defined BROWSER where %%B >nul 2>nul && set "BROWSER=%%B"
rem sovereshenno nichego ne nashli - probuem tipovoy put Yandeks.Brauzera
if not defined BROWSER if exist "%YA%" set "BROWSER=%YA%"

if defined BROWSER (
  echo Browser: !BROWSER!
  start "" "!BROWSER!" --app=%URL% --window-size=1600,900
) else (
  echo Zapuskayu brauzerom po umolchaniyu...
  start "" %URL%
)

:done
echo.
echo Gotovo! Okno igry otkrylos.
echo.
echo  * Eto okno mozhno zakryt - server prodolzhit rabotat svernutym.
echo  * Chtoby polnostyu ostanovit igru - zakroyte okno "node" v paneli zadach
echo    ili vypolnite v komandnoy stroke:  taskkill /f /im node.exe
echo  * Ustanovka kak prilozhenie Windows: v menyu igry knopka
echo    "USTANOVIT KAK PRILOZHENIE WINDOWS" libo menyu brauzera -^>
echo    Prilozheniya -^> Ustanovit etot sayt kak prilozhenie.
echo.
timeout /t 8 /nobreak >nul
exit
