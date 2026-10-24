@echo off
setlocal
cd /d "%~dp0"
echo ==========================================================
echo  SUPER AUDIO CONTROL 1.0.0 - WINDOWS BUILD
echo ==========================================================
echo Launching PowerShell build script...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
set "BUILD_EXIT=%ERRORLEVEL%"
if not "%BUILD_EXIT%"=="0" (
    echo.
    echo Build failed with exit code %BUILD_EXIT%.
    pause
    exit /b %BUILD_EXIT%
)
echo.
echo Build succeeded. Check the release folder for the installer or portable package.
pause
exit /b 0
