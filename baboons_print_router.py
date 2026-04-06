# baboons_print_router.py
# Agente Local de Impresión - Versión Estable Original
import requests
import time
import json
import logging
import datetime
import os
import sys
from escpos.printer import Network
import tkinter as tk
from tkinter import simpledialog, messagebox

# --- CONFIGURACIÓN ---
API_URL = "https://multinegocio.baboons.com.ar/api"
CONFIG_FILE = 'agent_config.json'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler("agent_log.txt"), logging.StreamHandler()]
)
logger = logging.getLogger("BaboonsAgent")

def get_config_via_gui(current_url):
    root = tk.Tk()
    root.withdraw() 
    url = simpledialog.askstring("Configuración Baboons", "URL del Servidor (ej: https://multinegocio.baboons.com.ar):", initialvalue=current_url)
    if not url: return None, None, None
    negocio_id = simpledialog.askstring("Configuración Baboons", "Ingrese el ID de su Negocio (ej: 13):")
    if not negocio_id: return None, None, None
    token = simpledialog.askstring("Configuración Baboons", "Pegue su Token de Acceso:")
    if not token: return None, None, None
    return url.strip().rstrip('/'), negocio_id, token

def format_receipt(p, data):
    try:
        # Prioridad 1: Contenido pre-formateado (Modern Flow)
        content = data.get('content')
        if content:
            logger.info("Enviando contenido pre-formateado a la impresora.")
            lines = content.split('\n')
            for line in lines:
                # Interpretar etiquetas de tamaño
                if line.startswith('[S2]'):
                    p.set(align='center', width=2, height=2, bold=True)
                    p.text(line[4:] + '\n')
                elif line.startswith('[S1]'):
                    p.set(align='center', width=1, height=1, bold=True)
                    p.text(line[4:] + '\n')
                else:
                    p.set(align='left', width=1, height=1, bold=False)
                    p.text(line + '\n')
            p.cut()
            return

        # Prioridad 2: Legacy Items Flow (Fallback)
        p.set(align='center', font='a', width=2, height=2, bold=True)
        p.text("COMANDA DE COCINA\n")
        if data.get('reprint'):
            p.set(align='center', font='a', width=2, height=1, bold=True)
            p.text("*** REIMPRESION ***\n")

        p.set(align='center', font='a', width=1, height=1, bold=False)
        p.text(f"Orden: #{data.get('id_orden', 'N/A')}\n")
        p.text(f"Fecha: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}\n")
        p.text("------------------------------------------\n")
        
        p.set(align='left', bold=True)
        p.text(f"MESA: {data.get('mesa', 'S/N')}\n")
        p.text(f"MOZO: {data.get('mozo', 'S/N')}\n")
        if data.get('pax'):
            p.text(f"PAX: {data.get('pax', '0')}\n")
        p.text("------------------------------------------\n")
        
        p.set(align='left', bold=False)
        for item in data.get('items', []):
            try:
                cantidad = item.get('cantidad', 1)
                nombre = item.get('nombre', 'Producto')
                notas = item.get('notas', '')
                p.text(f"[{int(cantidad)}] {nombre.upper()}\n")
                if notas: p.text(f"  > {notas}\n")
            except Exception as e_item:
                logger.error(f"Error en item legacy: {e_item}")

        p.text("------------------------------------------\n")
        p.text(f"{data.get('negocio_nombre', 'Baboons Resto')} - Baboons POS\n\n\n")
        p.cut()
    except Exception as e_glob:
        logger.error(f"Error crítico en formateo de ticket: {e_glob}")

def send_heartbeat(negocio_id, token):
    headers = { "Authorization": f"Bearer {token}" }
    try:
        requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", headers=headers, timeout=5)
    except:
        pass

def procesar_cola(negocio_id, token):
    headers = { "Authorization": f"Bearer {token}" }
    try:
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresion-cola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200:
            logger.warning(f"Cola respondió {response.status_code}: {response.text[:100]}")
            return
            
        jobs = response.json()
        if not isinstance(jobs, list):
            logger.error(f"Respuesta inesperada del servidor: {jobs}")
            return
            
        if jobs:
            logger.info(f"📋 {len(jobs)} trabajos pendientes encontrados.")
        
        for job in jobs:
            try:
                payload = job.get('payload', {})
                if isinstance(payload, str):
                    payload = json.loads(payload)
                    
                ip_printer = payload.get('ip_destino')
                if not ip_printer:
                    logger.warning(f"Trabajo {job['id']} sin IP de impresora, saltando.")
                    continue
                    
                logger.info(f"🖨️ Imprimiendo trabajo {job['id']} en {ip_printer}...")
                try:
                    printer = Network(ip_printer, timeout=5)
                    format_receipt(printer, payload)
                    printer.close()
                    time.sleep(0.5)  # Pausa para que la impresora procese
                    
                    # Confirmar al servidor
                    url_listo = f"{API_URL}/impresion-cola/{job['id']}/listo"
                    r_confirm = requests.post(url_listo, headers=headers, timeout=5)
                    if r_confirm.status_code == 200:
                        logger.info(f"✅ Trabajo {job['id']} confirmado.")
                    else:
                        logger.warning(f"⚠️ Confirmación trabajo {job['id']} respondió: {r_confirm.status_code}")
                except Exception as e_print:
                    logger.error(f"❌ Error físico de impresión en {ip_printer}: {type(e_print).__name__}: {e_print}")
            except Exception as e_job:
                logger.error(f"Error procesando trabajo {job.get('id', '?')}: {e_job}")
    except Exception as e:
        logger.error(f"Error consultando cola: {type(e).__name__}: {e}")

def run_agent():
    global API_URL
    negocio_id, token, server_url = None, None, API_URL
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                cfg = json.load(f)
                negocio_id = cfg.get('negocio_id')
                token = cfg.get('token')
                server_url = cfg.get('url', API_URL)
                logger.info(f"Config cargada: negocio={negocio_id}, url={server_url}")
        except Exception as e:
            logger.error(f"Error cargando config: {e}")
    
    # Pedir GUI solo si falta algún parámetro esencial
    needs_config = not negocio_id or not token or not server_url
    if needs_config:
        logger.warning("Config incompleta, abriendo GUI...")
        server_url, negocio_id, token = get_config_via_gui(server_url or API_URL)
        if server_url and negocio_id and token:
            # Guardar sin el /api al final para que sea la URL base
            save_url = server_url.rstrip('/api').rstrip('/')
            with open(CONFIG_FILE, 'w') as f:
                json.dump({'url': save_url, 'negocio_id': negocio_id, 'token': token}, f)
            logger.info(f"Config guardada: negocio={negocio_id}, url={save_url}")

    if not negocio_id or not token or not server_url: 
        logger.error("No se pudo iniciar el agente: falta configuración.")
        return

    # Asegurar que termina en /api
    base_api = server_url if server_url.endswith('/api') else f"{server_url}/api"
    
    # Actualizamos la constante global para que procesar_cola la use (o mejor la pasamos)
    API_URL = base_api

    logger.info(f"🚀 Agente activo para Negocio {negocio_id} en {API_URL}")
    while True:
        try:
            send_heartbeat(negocio_id, token)
            procesar_cola(negocio_id, token)
        except Exception as loop_err:
            logger.error(f"Error en el loop principal: {loop_err}")
            
        time.sleep(3)

if __name__ == "__main__":
    run_agent()
