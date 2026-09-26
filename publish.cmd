@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   dsh-learning-pages  --^>  GitHub
echo  ============================================

where powershell >nul 2>nul
if errorlevel 1 (
  echo  [X] powershell.exe not found
  echo  Press any key to close...
  pause >nul
  exit /b 1
)

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish.ps1" %*
set RC=%ERRORLEVEL%

echo.
echo  ============================================
if "%RC%"=="0" (
  echo   OK
) else (
  echo   FAILED  ^(exit code %RC%^)
)
echo  ============================================
echo.
echo  Press any key to close this window...
pause >nul
exit /b %RC%
