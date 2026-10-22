// ============ Генераторы лаунчеров Windows для DRIFT ARENA ============
// Один источник правды для корневых DRIFT-ARENA.bat / .vbs и для лаунчеров
// внутри устанавливаемой папки app/ (их пишет build.js).
// offlineHtml — какой файл открывать, если Node.js не установлен.

// --- BAT: видимая консоль (удобно для диагностики) ---
function startBat(offlineHtml) {
  return String.raw`@echo off
chcp 65001 >nul
title DRIFT ARENA - launcher
cd /d "%~dp0"
setlocal EnableDelayedExpansion

set "URL=http://localhost:3000"
set "HTML=%~dp0${offlineHtml}"
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
`;
}

// --- VBS: тихий запуск без окна консоли ---
function startVbs(offlineHtml) {
  return String.raw`' ============================================================
'  DRIFT ARENA - zapusk kak prilozhenie Windows (bez konsoli)
'  Dvoynoy klik = igra otkryvaetsya v okne bez adresnoy stroki,
'  kak obychnaya programma. Edge, Chrome i Yandeks.Brauzer.
' ============================================================
Dim fso, sh, here, url, html, i, running
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = here
url  = "http://localhost:3000"
html = here & "\${offlineHtml}"

running = PortBusy(3000)

If Not running Then
  ' probuem podnyat server skryto
  On Error Resume Next
  sh.Run "node server.js", 0, False
  On Error GoTo 0
  For i = 1 To 24
    WScript.Sleep 500
    running = PortBusy(3000)
    If running Then Exit For
  Next
End If

If running Then
  OpenApp url
Else
  ' Node.js ne ustanovlen - igraem iz avtonomnogo faila
  sh.Run """" & html & """", 1, False
End If

' ------------------------------------------------------------
Function PortBusy(port)
  Dim exec, out
  Set exec = sh.Exec("cmd /c netstat -ano | findstr /r /c:\": \" & port & \" .*LISTENING\"\"")
  out = exec.StdOut.ReadAll
  PortBusy = (Len(Trim(out)) > 0)
End Function

Function HaveTool(name)
  HaveTool = (sh.Run("cmd /c where " & name, 0, True) = 0)
End Function

' Brauzer po umolchaniyu iz reestra: Yandex.HTML / ChromeHTML / MSEdgeHTM
Function DefaultProgid()
  Dim p
  On Error Resume Next
  p = sh.RegRead("HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice\Progid")
  On Error GoTo 0
  DefaultProgid = LCase(p)
End Function

Sub OpenApp(u)
  Dim prog, cand, i, b, ya
  ya = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Yandex\YandexBrowser\Application\browser.exe"
  prog = DefaultProgid()
  If InStr(prog, "yandex") > 0 Then
    If fso.FileExists(ya) Then cand = Array(ya, "msedge", "chrome") Else cand = Array("browser", "msedge", "chrome")
  ElseIf InStr(prog, "chrome") > 0 Then
    cand = Array("chrome", "msedge", "browser")
  Else
    cand = Array("msedge", "chrome", "browser")
  End If
  For i = 0 To UBound(cand)
    b = cand(i)
    If InStr(b, "\") > 0 Then
      If fso.FileExists(b) Then
        sh.Run """" & b & """ --app=" & u & " --window-size=1600,900", 1, False
        Exit Sub
      End If
    Else
      If HaveTool(b) Then
        sh.Run """" & b & """ --app=" & u & " --window-size=1600,900", 1, False
        Exit Sub
      End If
    End If
  Next
  ' inache - brauzer po umolchaniyu
  sh.Run u, 1, False
End Sub
`;
}

// --- Деинсталлятор (кладут внутрь app/) ---
function uninstallBat() {
  return String.raw`@echo off
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
`;
}

// --- Помощник создания ярлыков (кладут внутрь app/), только ASCII ---
// INSTALL.bat: cscript //nologo SHORTCUTS.vbs <dir> <icon> <target> <args>
//              <lnk_start> <lnk_desktop> <lnk_uninstall> <un_target> <un_icon>
function shortcutsVbs() {
  return String.raw`' Sozdanie yarlykov DRIFT ARENA. Vyzyvaetsya iz INSTALL.bat.
Dim w, dir, ico, tgt, arg, s
Set w = CreateObject("WScript.Shell")
dir = WScript.Arguments(0)
ico = WScript.Arguments(1)
tgt = WScript.Arguments(2)
arg = WScript.Arguments(3)

Set s = w.CreateShortcut(WScript.Arguments(4))
s.TargetPath = tgt
s.Arguments = arg
s.IconLocation = ico
s.WorkingDirectory = dir
s.Description = "DRIFT ARENA - 3D drift simulator"
s.Save()

Set s = w.CreateShortcut(WScript.Arguments(5))
s.TargetPath = tgt
s.Arguments = arg
s.IconLocation = ico
s.WorkingDirectory = dir
s.Description = "DRIFT ARENA - 3D drift simulator"
s.Save()

Set s = w.CreateShortcut(WScript.Arguments(6))
s.TargetPath = WScript.Arguments(7)
s.IconLocation = WScript.Arguments(8)
s.WorkingDirectory = dir
s.Description = "Uninstall DRIFT ARENA"
s.Save()

WScript.Quit 0
`;
}

module.exports = { startBat, startVbs, uninstallBat, shortcutsVbs };
