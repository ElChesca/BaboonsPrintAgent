# baboons_print_router.py
# Agente Local de Impresión - Versión 2.0 (Soporte USB + QR Fiscal)
import requests
import time
import json
import logging
import datetime
import os
import sys
import socket
import io
from PIL import Image

# Intentar importar drivers de escpos
try:
    from escpos.printer import Network, Win32Raw
except ImportError:
    from escpos.printer import Network
    Win32Raw = None

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

def is_valid_ip(address):
    try:
        socket.inet_aton(address)
        return True
    except socket.error:
        return False

def format_receipt(p, data):
    try:
        content = data.get('content')
        if not content:
            logger.warning("Trabajo sin contenido, saltando.")
            return

        lines = content.split('\n')
        for line in lines:
            # Interpretar etiquetas de comando
            if line.startswith('[S2]'): # Grande centrado
                p.set(align='center', width=2, height=2, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[S1]'): # Negrita centrado
                p.set(align='center', width=1, height=1, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[QR]'): # Código QR
                qr_data = line[4:].strip()
                logger.info(f"Imprimiendo QR: {qr_data[:30]}...")
                p.set(align='center')
                p.qr(qr_data, size=8, model=2)
                p.text('\n')
            elif line.startswith('[LOGOCENTER]'): # Logo desde URL
                try:
                    url = line[12:].strip()
                    logger.info(f"Descargando logo: {url}")
                    resp = requests.get(url, timeout=10)
                    img = Image.open(io.BytesIO(resp.content))
                    # Redimensionar si es muy grande (máx 350px de ancho para 80mm)
                    if img.width > 350:
                        h = int((350 / img.width) * img.height)
                        img = img.resize((350, h))
                    p.image(img, center=True)
                    p.text('\n')
                except Exception as e_img:
                    logger.error(f"Error cargando logo: {e_img}")
            elif line.startswith('[C]'): # Centrado normal
                p.set(align='center', width=1, height=1, bold=False)
                p.text(line[3:] + '\n')
            else: # Texto normal
                p.set(align='left', width=1, height=1, bold=False)
                p.text(line + '\n')
        
        p.text('\n\n')
        p.cut()
    except Exception as e:
        logger.error(f"Error en formateo: {e}")

def procesar_cola(negocio_id, token):
    headers = { "Authorization": f"Bearer {token}" }
    try:
        # Nota: El backend usa 'impresioncola' sin el guion según las rutas detectadas
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresioncola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200: return
            
        jobs = response.json()
        if not jobs or not isinstance(jobs, list): return
        
        logger.info(f"📋 Encontrados {len(jobs)} trabajos.")
        
        for job in jobs:
            try:
                payload = job.get('payload', {})
                if isinstance(payload, str): payload = json.loads(payload)
                    
                destino = payload.get('ip_destino') or payload.get('impresora_usb')
                if not destino:
                    logger.warning(f"Trabajo {job['id']} sin destino configurado.")
                    continue
                
                printer = None
                try:
                    if is_valid_ip(destino):
                        logger.info(f"🖨️ Conectando a Impresora RED: {destino}")
                        printer = Network(destino, timeout=5)
                    elif Win32Raw:
                        logger.info(f"🖨️ Conectando a Impresora USB (Win32): {destino}")
                        printer = Win32Raw(destino)
                    else:
                        logger.error("Driver Win32Raw no disponible en este SO.")
                        continue

                    format_receipt(printer, payload)
                    printer.close()
                    
                    # Confirmar listo
                    requests.post(f"{API_URL}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                    logger.info(f"✅ Trabajo {job['id']} finalizado.")
                    
                except Exception as e_print:
                    logger.error(f"❌ Error físico en {destino}: {e_print}")
            except Exception as e_job:
                logger.error(f"Error en job {job.get('id')}: {e_job}")
    except Exception as e:
        logger.error(f"Error de red: {e}")

def run_agent():
    global API_URL
    negocio_id, token, server_url = None, None, API_URL
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                cfg = json.load(f)
                negocio_id, token = cfg.get('negocio_id'), cfg.get('token')
                server_url = cfg.get('url', API_URL)
        except: pass
    
    if not negocio_id or not token:
        # ... (GUI para configurar omitida por brevedad en este script, asumo que ya tiene el archivo cfg)
        logger.error("Falta configuración inicial.")
        return

    API_URL = server_url if server_url.endswith('/api') else f"{server_url}/api"
    logger.info(f"🚀 Baboons Print Router 2.0 activo - Negocio {negocio_id}")

    while True:
        try:
            # Enviar heartbeat (opcional según backend)
            requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                          headers={"Authorization": f"Bearer {token}"}, timeout=2)
            procesar_cola(negocio_id, token)
        except: pass
        time.sleep(3)

if __name__ == "__main__":
    run_agent()
