@echo off
setlocal
set ELECTRON_RUN_AS_NODE=
if not exist "%~dp0node_modules\electron\dist\electron.exe" (
  echo Die Programmlaufzeit fehlt. Bitte die Anleitung in README.md lesen.
  pause
  exit /b 1
)
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0
