# baboons_print_router.py
# Agente Local de Impresión - Versión 2.2 (Soporte Mejorado RED + USB + M2M)
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
    from escpos.printer import Network
except ImportError:
    print("CRÍTICO: No se encuentra la librería 'python-escpos'. Instálala con: pip install python-escpos")
    sys.exit(1)

try:
    from escpos.printer import Win32Raw
except:
    Win32Raw = None

# --- CONFIGURACIÓN DE RUTAS ABSOLUTAS ---
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# URL por defecto si el JSON falla (Sin /api)
API_URL = "https://multinegocio.baboons.com.ar"
CONFIG_FILE = os.path.join(BASE_DIR, 'agent_config.json')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(os.path.join(BASE_DIR, "agent_log.txt"), encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("BaboonsAgent")

def is_valid_ip(address):
    if not isinstance(address, str): return False
    try:
        socket.inet_aton(address)
        return True
    except socket.error:
        return False

def format_receipt(p, data):
    try:
        content = data.get('content')
        if not content:
            logger.warning("⚠️ Trabajo sin contenido, saltando.")
            return

        lines = content.split('\n')
        for line in lines:
            line = line.strip('\r')
            if line.startswith('[S2]'):
                p.set(align='center', width=2, height=2, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[S1]'):
                p.set(align='center', width=1, height=1, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[QR]'):
                qr_data = line[4:].strip()
                logger.info(f"📲 Imprimiendo QR: {qr_data[:30]}...")
                p.set(align='center')
                p.qr(qr_data, size=8, model=2)
                p.text('\n')
            elif line.startswith('[LOGOCENTER]'):
                try:
                    url = line[12:].strip()
                    logger.info(f"🖼️ Descargando logo: {url}")
                    resp = requests.get(url, timeout=10)
                    img = Image.open(io.BytesIO(resp.content))
                    if img.width > 350:
                        h = int((350 / img.width) * img.height)
                        img = img.resize((350, h))
                    p.image(img, center=True)
                    p.text('\n')
                except Exception as e_img:
                    logger.error(f"❌ Error cargando logo: {e_img}")
            elif line.startswith('[C]'):
                p.set(align='center', width=1, height=1, bold=False)
                p.text(line[3:] + '\n')
            else:
                p.set(align='left', width=1, height=1, bold=False)
                p.text(line + '\n')
        
        p.text('\n\n')
        p.cut()
    except Exception as e:
        logger.error(f"💥 Error en formateo: {e}")

def procesar_cola(negocio_id, api_key):
    headers = { "X-API-Key": api_key }
    try:
        # Nota: Usamos impresion-cola (con guion) para coincidir con rutas estándar
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresion-cola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200:
            return
            
        jobs = response.json()
        if not jobs or not isinstance(jobs, list): return
        
        logger.info(f"📂 {len(jobs)} trabajos pendientes encontrados.")
        
        for job in jobs:
            try:
                payload = job.get('payload', {})
                if isinstance(payload, str): payload = json.loads(payload)
                    
                target_ip = payload.get('ip_destino')
                usb_name = payload.get('impresora_usb')
                destino = target_ip if is_valid_ip(target_ip) else usb_name
                
                if not destino:
                    requests.post(f"{API_URL}/negocios/{negocio_id}/impresion-cola/{job['id']}/listo", headers=headers, timeout=5)
                    continue
                
                printer = None
                try:
                    if is_valid_ip(destino):
                        logger.info(f"📡 Conectando a RED: {destino}")
                        printer = Network(destino, timeout=5)
                    elif Win32Raw:
                        logger.info(f"🔌 Conectando a USB: {destino}")
                        printer = Win32Raw(destino)
                    
                    if printer:
                        format_receipt(printer, payload)
                        printer.close()
                        requests.post(f"{API_URL}/negocios/{negocio_id}/impresion-cola/{job['id']}/listo", headers=headers, timeout=5)
                        logger.info(f"✅ Trabajo {job['id']} OK.")
                        time.sleep(1)
                    
                except Exception as e_print:
                    logger.error(f"❌ ERROR FÍSICO: {e_print}")
            except Exception as e_job:
                logger.error(f"❌ Error Job: {e_job}")
    except Exception as e:
        logger.error(f"🌐 Error Comunicación: {e}")

def run_agent():
    global API_URL
    negocio_id, api_key, server_url = None, None, API_URL
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                cfg = json.load(f)
                negocio_id = cfg.get('negocio_id')
                api_key = cfg.get('api_key') or cfg.get('token')
                server_url = cfg.get('url', API_URL)
        except Exception as e:
            logger.error(f"Error config: {e}")
    
    if not negocio_id or not api_key:
        logger.error("❌ CONFIGURACIÓN INCOMPLETA.")
        return

    # IMPORTANTE: Ya no forzamos /api. Usamos lo que diga el JSON exactamente.
    API_URL = server_url.rstrip('/')
    
    logger.info(f"🚀 Baboons Agent 2.2 INICIADO")
    logger.info(f"📍 Negocio: {negocio_id} | 🌍 API: {API_URL}")

    while True:
        try:
            ahora = datetime.datetime.now().strftime("%H:%M:%S")
            print(f"[{ahora}] 💓 Enviando latido...", end="\r")
            
            # Heartbeat
            requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                         headers={"X-API-Key": api_key}, timeout=10)
            
            # Cola
            procesar_cola(negocio_id, api_key)
            
        except Exception as e:
            print(f"\n❌ Error en bucle: {e}")
            
        time.sleep(3)

if __name__ == "__main__":
    run_agent()