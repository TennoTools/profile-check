@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed - it is required to run TennoTools Profile Check.
  echo.
  echo   1. Download the LTS version from https://nodejs.org
  echo   2. Install it ^(the default options are fine^)
  echo   3. Double-click this file again
  echo.
  if not defined TENNOTOOLS_NO_BROWSER start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

node "%~dp0scripts\launch.mjs"
if errorlevel 1 (
  echo.
  echo Something went wrong - see the message above.
  pause
  exit /b 1
)

endlocal
