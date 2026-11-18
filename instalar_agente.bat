@echo off
title Instalador Agente de Impresion Baboons

:: Verificar permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ejecuta este archivo con clic derecho - "Ejecutar como administrador".
    pause
    exit /b 1
)

set "DIR_APP=C:\Baboons"
set "EXE_PATH=%DIR_APP%\Agente_Impresion_Baboons.exe"
set "CFG_PATH=%DIR_APP%\agent_config.json"
set "SERVICE_NAME=AgenteImpresionBaboons"
set "URL_EXE=https://github.com/ElChesca/BaboonsPrintAgent/releases/download/latest-agent/Agente_Impresion_Baboons.exe"

echo ==================================================
echo   INSTALADOR AGENTE DE IMPRESION - BABOONS ERP
echo ==================================================
echo.

if not exist "%DIR_APP%" mkdir "%DIR_APP%"

:: 1. Descargar ejecutable si no existe
if exist "%EXE_PATH%" goto CHECK_CONFIG
echo [1/5] Descargando Agente_Impresion_Baboons.exe...
curl.exe -L --fail -o "%EXE_PATH%" "%URL_EXE%"
if not exist "%EXE_PATH%" (
    echo [ERROR] No se pudo descargar el ejecutable. Descargalo manual en %EXE_PATH%
    pause
    exit /b 1
)

:CHECK_CONFIG
echo.
if not exist "%CFG_PATH%" goto PEDIR_DATOS
set "RECONFIG=N"
set /p "RECONFIG=Ya existe agent_config.json. Queres reconfigurarlo? (S/N, Enter=N): "
if /i "%RECONFIG%"=="S" goto PEDIR_DATOS
goto BUSCAR_NSSM

:PEDIR_DATOS
echo.
set /p "NEGOCIO_ID=Ingresa el ID del Negocio (ej: 13): "
set "CAJA_ID=1"
set /p "CAJA_ID=Ingresa el ID de la Caja (Enter para usar 1): "
set /p "API_KEY=Ingresa la API Key del negocio: "

if "%NEGOCIO_ID%"=="" (
    echo [ERROR] El ID del Negocio es obligatorio.
    pause
    exit /b 1
)
if "%API_KEY%"=="" (
    echo [ERROR] La API Key es obligatoria.
    pause
    exit /b 1
)

echo [2/5] Generando agent_config.json (UTF-8 sin BOM)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$nid=[int]'%NEGOCIO_ID%'.Trim(); $cid=[int]'%CAJA_ID%'.Trim(); $key='%API_KEY%'.Trim(); $obj=[ordered]@{negocio_id=$nid;caja_id=$cid;api_key=$key;url='https://multinegocio.baboons.com.ar'}; $json=$obj|ConvertTo-Json -Compress; [System.IO.File]::WriteAllText('%CFG_PATH%',$json,(New-Object System.Text.UTF8Encoding $false))"
if %errorlevel% neq 0 (
    echo [ERROR] No se pudo escribir %CFG_PATH%.
    pause
    exit /b 1
)

:BUSCAR_NSSM
echo [3/5] Verificando NSSM...
set "NSSM_EXE="
for /f "delims=" %%I in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
if not defined NSSM_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe" set "NSSM_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe"
if not defined NSSM_EXE if exist "%DIR_APP%\nssm.exe" set "NSSM_EXE=%DIR_APP%\nssm.exe"
if not defined NSSM_EXE (
    for /f "delims=" %%I in ('dir /b /s "%LOCALAPPDATA%\Microsoft\WinGet\Packages\nssm.exe" 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
)
if defined NSSM_EXE goto LIMPIAR_ANTERIOR

echo Instalando NSSM mediante winget...
winget install -e --id NSSM.NSSM --accept-source-agreements --accept-package-agreements
for /f "delims=" %%I in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
if not defined NSSM_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe" set "NSSM_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe"
if not defined NSSM_EXE (
    for /f "delims=" %%I in ('dir /b /s "%LOCALAPPDATA%\Microsoft\WinGet\Packages\nssm.exe" 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
)
if not defined NSSM_EXE (
    echo [ERROR] No se encontro NSSM despues de instalar. Cerra esta ventana y ejecuta el .bat de nuevo.
    pause
    exit /b 1
)

:LIMPIAR_ANTERIOR
echo [4/5] Limpiando tareas o servicios previos...
schtasks /End /TN "%SERVICE_NAME%" >nul 2>&1
schtasks /Delete /TN "%SERVICE_NAME%" /F >nul 2>&1
"%NSSM_EXE%" stop %SERVICE_NAME% >nul 2>&1
"%NSSM_EXE%" remove %SERVICE_NAME% confirm >nul 2>&1
sc delete %SERVICE_NAME% >nul 2>&1
taskkill /F /IM Agente_Impresion_Baboons.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [5/5] Instalando y arrancando servicio %SERVICE_NAME%...
"%NSSM_EXE%" install %SERVICE_NAME% "%EXE_PATH%"
"%NSSM_EXE%" set %SERVICE_NAME% AppDirectory "%DIR_APP%"
"%NSSM_EXE%" set %SERVICE_NAME% Description "Agente de impresion para Multinegocio Baboons"
"%NSSM_EXE%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM_EXE%" set %SERVICE_NAME% AppExit Default Restart
"%NSSM_EXE%" set %SERVICE_NAME% AppThrottle 1500
"%NSSM_EXE%" set %SERVICE_NAME% AppStdout "%DIR_APP%\nssm_out.log"
"%NSSM_EXE%" set %SERVICE_NAME% AppStderr "%DIR_APP%\nssm_err.log"
"%NSSM_EXE%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM_EXE%" set %SERVICE_NAME% AppRotateBytes 2097152

echo.
set "USAR_CUENTA=N"
set /p "USAR_CUENTA=Es impresora USB y queres asignarle tu usuario de Windows al servicio? (S/N, Enter=N): "
if /i not "%USAR_CUENTA%"=="S" goto INICIAR_SERVICIO
set "WIN_USER=%USERDOMAIN%\%USERNAME%"
set /p "WIN_USER=Usuario de Windows (Enter para %USERDOMAIN%\%USERNAME%): "
set /p "WIN_PASS=Contrasena de Windows: "
"%NSSM_EXE%" set %SERVICE_NAME% ObjectName "%WIN_USER%" "%WIN_PASS%"

:INICIAR_SERVICIO
"%NSSM_EXE%" start %SERVICE_NAME%
timeout /t 3 /nobreak >nul

echo.
echo === ESTADO DEL SERVICIO ===
"%NSSM_EXE%" status %SERVICE_NAME%
echo.
echo Listo! Entra a #resto_impresoras y apreta F5 para ver el badge en Verde.
pause
