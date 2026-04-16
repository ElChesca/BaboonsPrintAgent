# Agente Local de Impresión - Versión 2.5 (Self-Hiding Console + Single Instance)
import requests
import time
import json
import logging
import datetime
import os
import sys
import socket
import io
import tempfile
from PIL import Image

# --- BLOQUEO DE INSTANCIA ÚNICA ---
# --- OCULTAR CONSOLA (WINDOWS) ---
if os.name == 'nt':
    try:
        import ctypes
        # SW_HIDE = 0
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
    except:
        pass

# --- BLOQUEO DE INSTANCIA ÚNICA ---
def lock_instance():
    """Evita que dos instancias del agente corran al mismo tiempo."""
    try:
        # Usamos un socket en un puerto específico para el bloqueo
        # Esto es más limpio que un archivo temporal porque el SO lo libera al cerrar el proceso
        instance_lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        instance_lock.bind(("127.0.0.1", 45999)) # Puerto arbitrario para Baboons Agent
        return instance_lock
    except socket.error:
        print("❌ ERROR: El Agente ya está en ejecución (Instancia Duplicada Detectada).")
        sys.exit(0)

# Mantener la referencia viva mientras corra el programa
_lock_socket = lock_instance()

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
            if not line:
                p.text('\n')
                continue

            # Detectar NEGRITA por tag [B] en cualquier parte de la línea
            force_bold = '[B]' in line
            line = line.replace('[B]', '')

            # Interpretar etiquetas de comando
            if line.startswith('[S3]'): # Extra Grande (Ideal para ítems en cocina)
                p.set(align='left', width=3, height=3, bold=True)
                p.text(line[4:] + '\n')
            elif line.startswith('[S2]'): # Grande centrado (Ideal para Mesa)
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
                p.set(align='center', width=1, height=1, bold=force_bold)
                p.text(line[3:] + '\n')
            else: # Texto normal
                p.set(align='left', width=1, height=1, bold=force_bold)
                p.text(line + '\n')
        
        p.text('\n\n')
        p.cut()
    except Exception as e:
        logger.error(f"💥 Error en formateo: {e}")

def procesar_cola(negocio_id, api_key):
    headers = { "X-API-Key": api_key }
    try:
        # 1. Armamos la URL (Ojo con el guion en impresion-cola)
        # Probá cambiar 'impresioncola' por 'impresion-cola' si sigue dando error
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresioncola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        # 2. Si no es 200, imprimimos el código y salimos sin romper nada
        if response.status_code != 200:
            if response.status_code == 404:
                logger.error(f"❌ Error 404: La ruta de la cola no existe en {url_pendientes}")
            elif response.status_code == 401:
                logger.error("❌ API Key inválida en la cola.")
            else:
                logger.error(f"⚠️ Servidor respondió con código {response.status_code}")
            return
            
        # 3. Intentamos parsear el JSON con cuidado
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' not in content_type.lower():
            logger.error(f"❌ Respuesta NO es JSON (Recibido: {content_type}).")
            logger.error(f"📑 Contenido inicial: {response.text[:200]}...")
            return

        try:
            jobs = response.json()
        except Exception as e_json:
            logger.error(f"❌ Error parseando JSON: {e_json}")
            logger.error(f"📑 Cuerpo de respuesta: {response.text[:200]}...")
            return

        if not jobs or not isinstance(jobs, list): 
            return
        
        logger.info(f"📂 {len(jobs)} trabajos pendientes encontrados.")
        
        for job in jobs:
            try:
                payload = job.get('payload', {})
                if isinstance(payload, str): 
                    payload = json.loads(payload)
                    
                target_ip = payload.get('ip_destino')
                usb_name = payload.get('impresora_usb')
                destino = target_ip if is_valid_ip(target_ip) else usb_name
                
                if not destino:
                    logger.warning(f"⚠️ Trabajo {job['id']} sin destino.")
                    requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                    continue
                
                printer = None
                try:
                    if is_valid_ip(destino):
                        logger.info(f"📡 RED: {destino}")
                        printer = Network(destino, timeout=5)
                    elif Win32Raw:
                        logger.info(f"🔌 USB: {destino}")
                        printer = Win32Raw(destino)
                    else:
                        continue

                    if printer:
                        logger.info(f"🖨️ Imprimiendo {job['id']}...")
                        format_receipt(printer, payload)
                        printer.close()
                        
                        # Confirmar éxito
                        requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                        logger.info(f"✅ Éxito {job['id']}")
                        time.sleep(1)
                    
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
    logger.info(f"🚀 Baboons Print Agent INICIADO")
    logger.info(f"📍 Negocio ID: {negocio_id} | 🌍 API: {API_URL}")

    retry_delay = 3
    while True:
        try:
            # 1. Heartbeat
            try:
                hb = requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                                 headers={"X-API-Key": api_key}, timeout=5)
                if hb.status_code == 200:
                    retry_delay = 3 # Reset delay on success
                else:
                    logger.warning(f"⚠️ Heartbeat respondió con status {hb.status_code}")
            except Exception as e:
                logger.debug(f"💔 Error de red en Heartbeat (Posible Deploy): {e}")
                
            # 2. Procesar Cola
            procesar_cola(negocio_id, api_key)
            
            time.sleep(retry_delay)
            
        except KeyboardInterrupt:
            logger.info("🛑 Agente detenido por el usuario.")
            break
        except Exception as e:
            logger.error(f"🔥 Error crítico en loop principal: {e}")
            logger.info(f"⏳ Reintentando en {retry_delay*2}s...")
            time.sleep(retry_delay * 2)
            # No salimos del loop, seguimos intentando

if __name__ == "__main__":
    run_agent()

