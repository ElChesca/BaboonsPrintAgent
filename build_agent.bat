@echo off
echo ====================================================
echo 🚀 COMPILADOR DEL AGENTE BABOONS (MODO ONE-FILE) 🚀
echo ====================================================
echo.

:: 1. Probar comandos uno por uno
set PY_CMD=none

echo [*] Buscando Python...

python --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY_CMD=python
    goto :found
)

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY_CMD=py
    goto :found
)

python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    set PY_CMD=python3
    goto :found
)

:notfound
echo [ERROR] No se encontro ninguna instalacion de Python.
echo.
echo Ve a https://www.python.org/downloads/ e instala la ultima version.
echo RECUERDA MARCAR: "Add Python to PATH"
echo.
pause
exit /b

:found
echo [+] Se usara el comando: %PY_CMD%
%PY_CMD% --version
echo.

:: 2. Crear entorno virtual
if not exist "venv_build" (
    echo [*] Creando venv_build...
    %PY_CMD% -m venv venv_build
)

:: 3. Instalar
echo [*] Instalando PyInstaller y librerias...
call venv_build\Scripts\activate
python -m pip install --upgrade pip
python -m pip install requests python-escpos tk pyinstaller

:: 4. Compilar
echo.
echo [*] Iniciando compilacion final (PyInstaller)...
echo.

pyinstaller --noconsole --onefile --clean ^
    --name "Agente_Impresion_Baboons" ^
    --hidden-import "escpos.printer" ^
    --hidden-import "tkinter" ^
    baboons_print_router.py

if %errorlevel% equ 0 (
    echo.
    echo ====================================================
    echo ✅ COMPLETO! El .exe esta en: dist\Agente_Impresion_Baboons.exe
    echo ====================================================
) else (
    echo.
    echo ❌ ERROR durante la compilacion. Revisa los mensajes de arriba.
)

pause
