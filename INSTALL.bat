@echo off
chcp 65001 >nul
title DRIFT ARENA - ustanovka igry
cd /d "%~dp0"
setlocal EnableDelayedExpansion

set "SRC=%~dp0app"
set "DST=%LOCALAPPDATA%\Programs\DRIFT ARENA"
set "SMDIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\DRIFT ARENA"
set "SMLNK=%SMDIR%\DRIFT ARENA.lnk"
set "DESKLNK=%USERPROFILE%\Desktop\DRIFT ARENA.lnk"
set "UNLNK=%SMDIR%\Uninstall DRIFT ARENA.lnk"
set "UNICO=%SystemRoot%\System32\shell32.dll,131"

echo ============================================
echo   DRIFT ARENA - ustanovka igry na Windows
echo ============================================
echo.

if not exist "%SRC%\index.html" (
  echo [ОШИБКА] Не найдена готовая папка app.
  echo          Соберите её одной командой:  npm run build:app
  echo          и запустите этот файл снова.
  echo.
  pause
  exit /b 1
)

echo [0/4] Останавливаю предыдущую копию игры, если она запущена...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do taskkill /f /pid %%P >nul 2>&1
echo.

echo [1/4] Копирую файлы игры...
if exist "%DST%" rmdir /s /q "%DST%"
mkdir "%DST%" >nul 2>nul
xcopy /e /i /q /y "%SRC%\*" "%DST%\" >nul
if not exist "%DST%\index.html" (
  echo [ОШИБКА] Не удалось скопировать файлы. Запустите этот файл
  echo          повторно ^(можно от имени администратора^).
  echo.
  pause
  exit /b 1
)
echo       папка: %DST%
echo.

echo [3/4] Создаю ярлыки: меню "Пуск" и рабочий стол...
if not exist "%SMDIR%" mkdir "%SMDIR%" >nul 2>nul
cscript //nologo "%DST%\SHORTCUTS.vbs" "%DST%" "%DST%\icon-512.png" "%SystemRoot%\System32\wscript.exe" "%DST%\START.vbs" "%SMLNK%" "%DESKLNK%" "%UNLNK%" "%DST%\UNINSTALL.bat" "%UNICO%" >nul
if not exist "%SMLNK%" echo       [предупреждение] ярлык в меню "Пуск" создать не удалось.
if not exist "%DESKLNK%" echo       [предупреждение] ярлык на рабочем столе создать не удалось.

echo [4/4] Добавляю игру в список установленных программ...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v DisplayName /t REG_SZ /d "DRIFT ARENA" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v DisplayIcon /t REG_SZ /d "%DST%\icon-512.png" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v DisplayVersion /t REG_SZ /d "1.0" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v Publisher /t REG_SZ /d "DRIFT ARENA" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v InstallLocation /t REG_SZ /d "%DST%" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v UninstallString /t REG_SZ /d "%DST%\UNINSTALL.bat" /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v NoModify /t REG_DWORD /d 1 /f >nul
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\DRIFT ARENA" /v NoRepair /t REG_DWORD /d 1 /f >nul

echo.
echo ============================================
echo   ИГРА УСТАНОВЛЕНА!
echo ============================================
echo.
echo   Запуск:   меню "Пуск" -^> DRIFT ARENA
echo             или ярлык "DRIFT ARENA" на рабочем столе
echo.
echo   Удаление: меню "Пуск" -^> DRIFT ARENA -^> Uninstall DRIFT ARENA
echo             или Параметры -^> Приложения -^> DRIFT ARENA -^> Удалить
echo.
echo   Игра запустится в окне без адресной строки.
echo   Node.js не обязателен: без него игра откроется в автономном режиме.
echo.
echo Сейчас откроется окно игры...
timeout /t 5 /nobreak >nul
start "" "%DST%\START.vbs"
exit
