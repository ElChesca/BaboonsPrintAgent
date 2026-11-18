@echo off
title Desinstalador Agente de Impresion Baboons

:: Verificar permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ejecuta este archivo con clic derecho - "Ejecutar como administrador".
    pause
    exit /b 1
)

set "DIR_APP=C:\Baboons"
set "SERVICE_NAME=AgenteImpresionBaboons"

echo ==================================================
echo   DESINSTALADOR AGENTE DE IMPRESION - BABOONS
echo ==================================================
echo.

:: 1. Eliminar tarea programada (si existe)
echo [1/4] Eliminando tarea programada (schtasks)...
schtasks /End /TN "%SERVICE_NAME%" >nul 2>&1
schtasks /Delete /TN "%SERVICE_NAME%" /F >nul 2>&1

:: 2. Buscar NSSM y eliminar servicio
echo [2/4] Deteniendo y eliminando servicio Windows...
set "NSSM_EXE="
for /f "delims=" %%I in ('where nssm 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
if not defined NSSM_EXE if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe" set "NSSM_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Links\nssm.exe"
if not defined NSSM_EXE if exist "%DIR_APP%\nssm.exe" set "NSSM_EXE=%DIR_APP%\nssm.exe"
if not defined NSSM_EXE (
    for /f "delims=" %%I in ('dir /b /s "%LOCALAPPDATA%\Microsoft\WinGet\Packages\nssm.exe" 2^>nul') do if not defined NSSM_EXE set "NSSM_EXE=%%I"
)

if defined NSSM_EXE (
    "%NSSM_EXE%" stop %SERVICE_NAME% >nul 2>&1
    "%NSSM_EXE%" remove %SERVICE_NAME% confirm >nul 2>&1
)
sc stop %SERVICE_NAME% >nul 2>&1
sc delete %SERVICE_NAME% >nul 2>&1

:: 3. Cerrar procesos en memoria y accesos directos de inicio
echo [3/4] Cerrando procesos activos y limpiando Startup...
taskkill /F /IM Agente_Impresion_Baboons.exe >nul 2>&1
taskkill /F /IM agente_impresion.exe >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\*Baboons*.lnk" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\*Agente*.lnk" >nul 2>&1

:: 4. Preguntar si borra tambien la carpeta C:\Baboons
echo.
set "BORRAR_DIR=N"
set /p "BORRAR_DIR=[4/4] Queres borrar tambien toda la carpeta C:\Baboons? (S/N, Enter=N): "
if /i not "%BORRAR_DIR%"=="S" goto CONSERVAR_DIR
timeout /t 2 /nobreak >nul
rmdir /s /q "%DIR_APP%"
echo Carpeta C:\Baboons eliminada.
goto FIN

:CONSERVAR_DIR
echo Carpeta C:\Baboons conservada.

:FIN
echo.
echo Desinstalacion completa! La PC quedo limpia de tareas y servicios del Agente.
pause
