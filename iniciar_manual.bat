@echo off
echo ==========================================
echo 🚀 Iniciando Manual del ERP (MkDocs Pro) 🚀
echo ==========================================
echo.
echo Actualizando e indexando documentos nuevos...
call .venv\Scripts\python organizar_docs.py

echo.
echo Compilando sitio web y levantando servidor...
echo.
echo 🌐 Abre tu navegador en: http://127.0.0.1:8000
echo (Presiona Ctrl+C para detener el servidor)
echo.

call .venv\Scripts\python -m mkdocs serve
pause
