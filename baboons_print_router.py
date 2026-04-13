# baboons_print_router.py
# Agente Local de Impresión - Versión 2.1 (Diagnóstico visible + Avisos GUI)
import requests
import time
import json
import logging
import datetime
import os
import sys
import socket
import tkinter as tk
from tkinter import messagebox

# Intentar importar drivers de escpos
try:
    from escpos.printer import Network, Win32Raw
except ImportError:
    try:
        from escpos.printer import Network
        Win32Raw = None
    except:
        Network = None
        Win32Raw = None

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
        if not content: return
        lines = content.split('\n')
        for line in lines:
            if line.startswith('[S2]'):
                p.set(align='center', width=2, height=2, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[S1]'):
                p.set(align='center', width=1, height=1, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[QR]'):
                qr_data = line[4:].strip()
                p.set(align='center')
                p.qr(qr_data, size=8, model=2)
                p.text('\n')
            elif line.startswith('[C]'):
                p.set(align='center', width=1, height=1, bold=False)
                p.text(line[3:] + '\n')
            else:
                p.set(align='left', width=1, height=1, bold=False)
                p.text(line + '\n')
        p.text('\n\n')
        p.cut()
    except Exception as e:
        logger.error(f"Error en formateo: {e}")

def procesar_cola(negocio_id, token):
    headers = { "Authorization": f"Bearer {token}" }
    try:
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
                if not destino: continue
                
                printer = None
                if is_valid_ip(destino):
                    logger.info(f"🖨️ Conectando a RED: {destino}")
                    printer = Network(destino, timeout=5)
                elif Win32Raw:
                    logger.info(f"🖨️ Conectando a USB: {destino}")
                    printer = Win32Raw(destino)
                else:
                    logger.error("Driver Win32Raw no disponible.")
                    continue

                if printer:
                    format_receipt(printer, payload)
                    printer.close()
                    requests.post(f"{API_URL}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                    logger.info(f"✅ Trabajo {job['id']} finalizado.")
            except Exception as e_job:
                logger.error(f"Error en job {job.get('id')}: {e_job}")
    except Exception as e:
        logger.error(f"Error de red: {e}")

def run_agent():
    root = tk.Tk()
    root.withdraw() # Ocultar ventana principal de TK

    negocio_id, token = None, None
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                cfg = json.load(f)
                negocio_id, token = cfg.get('negocio_id'), cfg.get('token')
        except Exception as e:
            logger.error(f"Error leyendo config: {e}")
    
    if not negocio_id or not token:
        messagebox.showerror("Error de Configuración", 
            f"No se encontró el archivo '{CONFIG_FILE}' o faltan datos (ID de negocio o Token).\n\n"
            "Por favor, asegurate de tener el archivo de configuración en la misma carpeta que el ejecutable.")
        return

    logger.info(f"🚀 Baboons Print Router 2.1 activo - Negocio {negocio_id}")
    while True:
        try:
            requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                          headers={"Authorization": f"Bearer {token}"}, timeout=2)
            procesar_cola(negocio_id, token)
        except: pass
        time.sleep(3)

if __name__ == "__main__":
    run_agent()
