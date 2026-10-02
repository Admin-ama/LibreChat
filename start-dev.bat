@echo off
setlocal

cd /d "%~dp0"

echo Verificando Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Docker Desktop no esta iniciado o todavia no esta listo.
    echo Inicia Docker Desktop y volve a ejecutar este archivo.
    pause
    exit /b 1
)

echo Iniciando LibreChat en modo desarrollo...
docker compose up -d --build --remove-orphans
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo iniciar LibreChat.
    echo Revisa el error de Docker mostrado arriba.
    pause
    exit /b 1
)

echo.
docker compose ps
echo.
echo Esperando que LibreChat termine de iniciar...

for /l %%I in (1,1,60) do (
    curl.exe -fsS http://localhost:3080/health >nul 2>&1
    if not errorlevel 1 goto ready
    ping -n 3 127.0.0.1 >nul 2>&1
)

echo.
echo ERROR: LibreChat no respondio despues de 120 segundos.
docker compose logs --tail 80 api
pause
exit /b 1

:ready
echo.
echo LibreChat esta disponible en http://localhost:3080

endlocal
