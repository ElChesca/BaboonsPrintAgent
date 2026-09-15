# Agente Local de Impresión - Versión 2.5 (Self-Hiding Console + Single Instance)
# CON LOGICA ORIGINAL INTACTA - SOLO AJUSTE DE HEXA
import requests
import time
import json
import logging
import datetime
from logging.handlers import RotatingFileHandler
import os
import sys
import socket
import io
import tempfile
import hashlib
from PIL import Image

# Importaciones Fiscales Epson
try:
    from fiscal_epson import emitir_job, FiscalError
except ImportError:
    print("No se encontraron los módulos fiscales (fiscal_epson/fiscal_frame).")
    sys.exit(1)

# --- CACHÉ DE IMÁGENES LOCAL ---
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logo_cache')
os.makedirs(CACHE_DIR, exist_ok=True)

# --- OCULTAR CONSOLA (WINDOWS) ---
if os.name == 'nt':
    try:
        import ctypes
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)
    except:
        pass

# --- BLOQUEO DE INSTANCIA ÚNICA ---
def lock_instance():
    """Evita que dos instancias del agente corran al mismo tiempo."""
    try:
        instance_lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        instance_lock.bind(("127.0.0.1", 45999)) 
        return instance_lock
    except socket.error:
        print("❌ ERROR: El Agente ya está en ejecución (Instancia Duplicada Detectada).")
        sys.exit(0)

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
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

API_URL = "https://multinegocio.baboons.com.ar/api"
CONFIG_FILE = os.path.join(BASE_DIR, 'agent_config.json')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        RotatingFileHandler(os.path.join(BASE_DIR, "agent_log.txt"), maxBytes=5*1024*1024, backupCount=3, encoding='utf-8'),
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
            line = line.strip() 
            if not line:
                p.text('\n')
                continue

            force_bold = '[B]' in line
            line = line.replace('[B]', '')

            # --- NUEVA LÓGICA DE TAMAÑOS CRUDA (HEXADECIMAL ESC/POS) ---
            
            if line.startswith('[S6]') or line.startswith('[S5]'):
                # GIGANTE: \x1b\x21\x38 = Doble Alto + Doble Ancho + Negrita
                p._raw(b'\x1b\x21\x38')
                p.text(line[4:] + '\n')
                p._raw(b'\x1b\x21\x00')
                
            elif line.startswith('[S4]'): 
                # CATEGORÍAS: \x1b\x21\x18 = Doble Alto + Negrita (Para que sea proporcional)
                p._raw(b'\x1b\x21\x18')
                p.text(line[4:] + '\n')
                p._raw(b'\x1b\x21\x00')

            elif line.startswith('[S3]'): 
                # GRANDE: \x1b\x21\x18 = Doble Alto + Negrita
                p._raw(b'\x1b\x21\x18')
                p.text(line[4:] + '\n')
                p._raw(b'\x1b\x21\x00')

            elif line.startswith('[S2.5]'): 
                # 🚀 PLATOS ALTOS: Doble Alto + Negrita
                # Código Hexa: \x1b\x21\x18 (Este es el que se ve bien en la DPOS)
                p._raw(b'\x1b\x21\x18')
                p.text(line[6:] + '\n') 
                p._raw(b'\x1b\x21\x00')
                
            elif line.startswith('[S2]'): 
                p.set(align='center')
                p._raw(b'\x1b\x21\x38')
                p.text(line[4:] + '\n')
                p._raw(b'\x1b\x21\x00')
                p.set(align='left')
                
            elif line.startswith('[S1]'): 
                p.set(align='center')
                p._raw(b'\x1b\x21\x08') 
                p.text(line[4:] + '\n')
                p._raw(b'\x1b\x21\x00')
                p.set(align='left')
                
            # --- FIN DE LÓGICA DE TAMAÑOS ---
            
            elif line.startswith('[QR]'): # Código QR
                qr_data = line[4:].strip()
                logger.info(f"📲 Imprimiendo QR: {qr_data[:30]}...")
                p.set(align='center')
                p.qr(qr_data, size=8, model=2)
                p.text('\n')
                p.set(align='left')
                
            elif line.startswith('[LOGOCENTER]'): 
                try:
                    url = line[12:].strip()
                    url_hash = hashlib.md5(url.encode()).hexdigest()
                    ext = url.split('.')[-1]
                    if len(ext) > 4 or not ext.isalnum(): ext = "png"
                    cached_path = os.path.join(CACHE_DIR, f"{url_hash}.{ext}")

                    if not os.path.exists(cached_path):
                        logger.info(f"⬇️ Descargando logo al caché: {url}")
                        resp = requests.get(url, timeout=10)
                        if resp.status_code == 200:
                            with open(cached_path, 'wb') as f:
                                f.write(resp.content)
                        else:
                            raise Exception(f"HTTP {resp.status_code}")
                    
                    img = Image.open(cached_path)
                    if img.width > 350:
                        h = int((350 / img.width) * img.height)
                        img = img.resize((350, h))
                    p.image(img, center=True)
                    p.text('\n')
                except Exception as e_img:
                    logger.error(f"❌ Error procesando logo: {e_img}")
                    
            elif line.startswith('[C]'): 
                p.set(align='center', width=1, height=1, bold=force_bold)
                p.text(line[3:] + '\n')
                p.set(align='left') 
                
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
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/impresioncola/pendientes"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200:
            if response.status_code == 404:
                logger.error(f"❌ Error 404: La ruta de la cola no existe en {url_pendientes}")
            elif response.status_code == 401:
                logger.error("❌ API Key inválida en la cola.")
            else:
                logger.error(f"⚠️ Servidor respondió con código {response.status_code}")
            return
            
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' not in content_type.lower():
            logger.error(f"❌ Respuesta NO es JSON (Recibido: {content_type}).")
            return

        try:
            jobs = response.json()
        except Exception as e_json:
            logger.error(f"❌ Error parseando JSON: {e_json}")
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
                        requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/listo", headers=headers, timeout=5)
                        logger.info(f"✅ Éxito {job['id']}")
                        time.sleep(1)
                    
                except Exception as e_print:
                    logger.error(f"❌ ERROR FÍSICO en {destino}: {e_print}")
                    try:
                        requests.post(f"{API_URL}/negocios/{negocio_id}/impresioncola/{job['id']}/error", headers=headers, timeout=5)
                    except:
                        pass
            except Exception as e_job:
                logger.error(f"❌ Error procesando job térmico {job.get('id')}: {e_job}")
    except Exception as e:
        logger.error(f"🌐 Error de comunicación en cola térmica: {e}")

def procesar_cola_fiscal(negocio_id, caja_id, api_key):
    headers = { "X-API-Key": api_key, "Content-Type": "application/json" }
    try:
        url_pendientes = f"{API_URL}/negocios/{negocio_id}/fiscal-cola/pendientes?caja_id={caja_id}"
        response = requests.get(url_pendientes, headers=headers, timeout=10)
        
        if response.status_code != 200:
            if response.status_code not in (404, 401):
                logger.error(f"⚠️ Servidor respondió {response.status_code} en cola FISCAL")
            return
            
        jobs = response.json()
        if not jobs or not isinstance(jobs, list): return
        
        logger.info(f"🧾 {len(jobs)} trabajos FISCALES pendientes.")
        
        for job in jobs:
            jid = job['id']
            try:
                cfg_job = {'conexion': 'usb', 'dispositivo': 'USB'}
                
                logger.info(f"🖨️ [FISCAL] Emitiendo comprobante {jid}...")
                nro = emitir_job(cfg_job, job)
                
                requests.post(f"{API_URL}/negocios/{negocio_id}/fiscal-cola/{jid}/listo", 
                              headers=headers, json={'nro_comprobante': nro}, timeout=5)
                logger.info(f"✅ [FISCAL] Éxito {jid} -> {nro}")
                time.sleep(1)
            except Exception as e_print:
                logger.error(f"❌ [FISCAL] ERROR en {jid}: {e_print}")
                try:
                    requests.post(f"{API_URL}/negocios/{negocio_id}/fiscal-cola/{jid}/error", 
                                  headers=headers, json={'error': str(e_print)}, timeout=5)
                except:
                    pass
    except Exception as e:
        logger.error(f"🌐 Error de comunicación en cola FISCAL: {e}")

def run_agent():
    global API_URL
    negocio_id, api_key, server_url, caja_id = None, None, API_URL, None
    
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                cfg = json.load(f)
                negocio_id = cfg.get('negocio_id')
                caja_id = cfg.get('caja_id')
                api_key = cfg.get('api_key') or cfg.get('token')
                server_url = cfg.get('url', API_URL)
        except Exception as e:
            logger.error(f"Error leyendo config: {e}")
    
    if not negocio_id or not api_key or not caja_id:
        logger.error("❌ CONFIGURACIÓN INCOMPLETA. Revisa 'agent_config.json'.")
        print("\nFormato esperado en agent_config.json:\n" + 
              json.dumps({"negocio_id": 13, "caja_id": 13, "api_key": "LA_CLAVE", "url": "https://..."}, indent=2))
        return

    API_URL = server_url if server_url.endswith('/api') else f"{server_url}/api"
    logger.info(f"🚀 Baboons SÚPER Agent INICIADO")
    logger.info(f"📍 Negocio ID: {negocio_id} | 📦 Caja: {caja_id} | 🌍 API: {API_URL}")

    retry_delay = 3
    while True:
        try:
            # 1. Heartbeat
            try:
                hb = requests.post(f"{API_URL}/negocios/{negocio_id}/agente/heartbeat", 
                                 headers={"X-API-Key": api_key}, timeout=5)
            except Exception as e:
                logger.debug(f"💔 Error de red en Heartbeat: {e}")
                
            # 2. Procesar Colas
            procesar_cola(negocio_id, api_key) # Térmica
            procesar_cola_fiscal(negocio_id, caja_id, api_key) # Fiscal
            
            time.sleep(retry_delay)
            
        except KeyboardInterrupt:
            logger.info("🛑 Agente detenido por el usuario.")
            break
        except Exception as e:
            logger.error(f"🔥 Error crítico en loop principal: {e}")
            time.sleep(retry_delay * 2)

if __name__ == "__main__":
    run_agent()
