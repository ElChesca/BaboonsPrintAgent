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
    # Si está corriendo como un .exe compilado
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # Si está corriendo como un script .py
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

API_URL = "https://multinegocio.baboons.com.ar/api"
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
            # Interpretar etiquetas de comando
            if line.startswith('[S2]'): # Grande centrado
                p.set(align='center', width=2, height=2, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[S1]'): # Negrita centrado
                p.set(align='center', width=1, height=1, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[QR]'): # Código QR
                qr_data = line[4:].strip()
                logger.info(f"📲 Imprimiendo QR: {qr_data[:30]}...")
                p.set(align='center')
                p.qr(qr_data, size=8, model=2)
                p.text('\n')
            elif line.startswith('[LOGOCENTER]'): # Logo desde URL
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
            elif line.startswith('[C]'): # Centrado normal
                p.set(align='center', width=1, height=1, bold=False)
                p.text(line[3:] + '\n')
            else: # Texto normal
                p.set(align='left', width=1, height=1, bold=False)
                p.text(line + '\n')
        
        p.text('\n\n')
        p.cut()
    except Exception as e:
        logger.error(f"💥 Error en formateo: {e}")

def procesar_cola(negocio_id, api_key):
    headers = { "X-API-Key": api_key }
    try:
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresioncola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200:
            if response.status_code == 401: logger.error("API Key inválida o expirada.")
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
                
                # Prioridad IP si está disponible y es válida
                destino = target_ip if is_valid_ip(target_ip) else usb_name
                
                if not destino:
                    logger.warning(f"⚠️ Trabajo {job['id']} sin destino válido. Payload: {payload.keys()}")
                    # Marcar como listo para que no trabe la cola si no tiene destino
                    requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                    continue
                
                printer = None
                try:
                    if is_valid_ip(destino):
                        logger.info(f"📡 Intentando conectar a IMPRESORA RED: {destino}")
                        printer = Network(destino, timeout=5)
                    elif Win32Raw:
                        logger.info(f"🔌 Intentando conectar a IMPRESORA USB: {destino}")
                        printer = Win32Raw(destino)
                    else:
                        logger.error(f"❌ No se puede procesar '{destino}' (Causa: Driver Win32Raw no disp.)")
                        continue

                    if printer:
                        logger.info(f"🖨️ Imprimiendo trabajo {job['id']}...")
                        format_receipt(printer, payload)
                        printer.close()
                        
                        # Confirmar éxito
                        requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                        logger.info(f"✅ Trabajo {job['id']} completado exitosamente.")
                        time.sleep(1) # Pequeña pausa entre trabajos
                    
                except Exception as e_print:
                    logger.error(f"❌ ERROR FÍSICO en {destino}: {e_print}")
            except Exception as e_job:
                logger.error(f"❌ Error procesando job {job.get('id')}: {e_job}")
    except Exception as e:
        logger.error(f"🌐 Error de comunicación: {e}")

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
            logger.error(f"Error leyendo config: {e}")
    
    if not negocio_id or not api_key:
        logger.error("❌ CONFIGURACIÓN INCOMPLETA. Revisa 'agent_config.json'.")
        print("\nFormato esperado en agent_config.json:\n" + 
              json.dumps({"negocio_id": 13, "api_key": "LA_CLAVE_QUE_Pusiste_EN_FLY_IO", "url": "https://multinegocio.baboons.com.ar"}, indent=2))
        return

    API_URL = server_url if server_url.endswith('/api') else f"{server_url}/api"
    logger.info(f"🚀 Baboons Print Agent 2.2 INICIADO (M2M Mode & Modo Silencioso)")
    logger.info(f"📍 Negocio ID: {negocio_id}")
    logger.info(f"🌍 API: {API_URL}")
    logger.info(f"📁 Directorio Base: {BASE_DIR}")

    while True:
        # 1. Bloque EXCLUSIVO para el Heartbeat
        try:
            requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                         headers={"X-API-Key": api_key}, timeout=3)
        except Exception as e:
            logger.debug(f"Latido fallido (Ignorado): {e}")
            
        # 2. Bloque EXCLUSIVO para procesar la cola
        try:
            procesar_cola(negocio_id, api_key)
        except KeyboardInterrupt:
            logger.info("🛑 Agente detenido por el usuario.")
            break
        except Exception as e:
            logger.error(f"Error crítico en cola: {e}")
            
        time.sleep(3)

if __name__ == "__main__":
    run_agent()

#Prueba
