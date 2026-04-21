@echo off
:: 1. Descarga NSSM usando winget (como hiciste vos)
winget install -e --id NSSM.NSSM --accept-source-agreements --accept-package-agreements

:: 2. Definir rutas (Ajustá esto a la carpeta de tu cliente)
set AGENTE_PATH=C:\Baboons\agente_impresion.exe
set SERVICE_NAME=AgenteImpresionBaboons

:: 3. Instalar el servicio de forma silenciosa
nssm install %SERVICE_NAME% "%AGENTE_PATH%"
nssm set %SERVICE_NAME% AppDirectory "C:\Baboons"
nssm set %SERVICE_NAME% Description "Agente de impresion para Multinegocio Baboons"

:: 4. Configurar el autoreinicio si falla
nssm set %SERVICE_NAME% AppExit Default Restart
nssm set %SERVICE_NAME% AppThrottle 1500

:: 5. Arrancar
nssm start %SERVICE_NAME%

echo ¡Servicio instalado y corriendo en la maquina del cliente!
pause