@echo off
setlocal

cd /d "%~dp0"

echo Deteniendo los contenedores de desarrollo de LibreChat...
docker compose down --remove-orphans
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo detener LibreChat.
    pause
    exit /b 1
)

echo.
echo LibreChat fue detenido. Los volumenes persistentes se conservaron.

endlocal
