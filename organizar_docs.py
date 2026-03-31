import os
import shutil
import re
from pathlib import Path
import unicodedata
import datetime

# --- CONFIGURACIÓN DE RUTAS ---
DIRECTORIO_RAIZ = Path('.')
DIRECTORIO_DESTINO = Path('docs')
RUTA_CEREBRO = Path(r"C:\Users\usuario\.gemini\antigravity\brain")

RUTA_ROADMAP = DIRECTORIO_DESTINO / "roadmap"
RUTA_MEDIA = RUTA_ROADMAP / "media"

CATEGORIAS_RAIZ = {
    'configuraciones': ['config', 'entorno', 'env', 'setup', 'agente', 'arquitectura'],
    'informes': ['informe', 'reporte', 'auditoria', 'semanal', 'metricas'],
    'pruebas': ['test', 'log', 'prueba', 'error', 'debug']
}

# --- FUNCIONES Nivel PRO ---

def limpiar_nombre_url(texto):
    """Convierte un título en un nombre de archivo seguro y limpio (SEO-friendly)."""
    # Quitar acentos y caracteres especiales
    texto = unicodedata.normalize('NFKD', texto).encode('ASCII', 'ignore').decode('utf-8')
    # Letras minúsculas, reemplazar espacios por guiones bajos, mantener solo alfanuméricos
    texto = re.sub(r'[^\w\s-]', '', texto).strip().lower()
    texto = re.sub(r'[-\s]+', '_', texto)
    return texto if texto else "documento_sin_titulo"

def obtener_titulo_md(ruta_archivo):
    """Abre un Markdown y busca el primer encabezado H1 (# Título)."""
    try:
        with open(ruta_archivo, 'r', encoding='utf-8') as f:
            for linea in f:
                match = re.search(r'^#\s+(.+)', linea)
                if match:
                    # Limpiar título de posibles tags o negritas molestas
                    titulo = match.group(1).replace('*', '').strip()
                    return titulo
    except Exception:
        pass
    return None

def limpiar_directorio_roadmap():
    """Elimina los archivos viejos para evitar duplicados estancados."""
    print("\n--- 🧹 Limpiando historial antiguo en Roadmap ---")
    if RUTA_ROADMAP.exists():
        borrados = 0
        for archivo in RUTA_ROADMAP.glob("*.md"):
            if archivo.name != "index.md":
                archivo.unlink()
                borrados += 1
        print(f"🗑️ Se eliminaron {borrados} archivos antiguos.")

def generar_indice_inteligente(ruta_carpeta, titulo_seccion):
    """Crea un index.md leyendo el contenido real de los archivos para mostrar títulos limpios y ordenados por fecha."""
    ruta_index = ruta_carpeta / "index.md"
    
    # Obtener archivos agrupados (ignorar el index)
    archivos = [f for f in ruta_carpeta.glob("*.md") if f.name.lower() != "index.md"]
    
    if not archivos:
        return # No crear índice si la carpeta está vacía

    archivos_info = []
    for archivo in archivos: # archivo es el archivo YA copiado a docs/
        # Extraer el título real del documento para mostrarlo bonito en la web
        titulo_real = obtener_titulo_md(archivo)
        
        # Si no tiene título dentro, intentamos "humanizar" el nombre del archivo
        if not titulo_real:
            # Eliminar la potencial fecha del inicio para humanizar
            nombre_limpio = re.sub(r'^\d{8}_\d{4}_', '', archivo.stem)
            titulo_real = nombre_limpio.replace("_", " ").capitalize()
        
        # Obtenemos la mtime del archivo (que se preservó en shutil.copy2)
        mtime = os.path.getmtime(archivo)
        fecha_str = datetime.datetime.fromtimestamp(mtime).strftime("%d/%m/%Y")
        
        # Mostraremos la fecha en el índice
        titulo_mostrar = f"{fecha_str} - {titulo_real}"
        
        archivos_info.append((titulo_mostrar, archivo.name, mtime))
    
    # Ordenar cronológicamente (más recientes primero)
    archivos_info.sort(key=lambda x: x[2], reverse=True)

    with open(ruta_index, "w", encoding="utf-8") as f:
        f.write(f"# {titulo_seccion}\n\n")
        f.write(f"Bienvenido a la sección de **{titulo_seccion}**. Aquí encontrarás el manual y los entregables ordenados por fecha (más recientes primero):\n\n")
        for titulo, nombre_archivo, mtime in archivos_info:
            f.write(f"- [{titulo}]({nombre_archivo})\n")
    
    print(f"📄 Índice Inteligente generado: {ruta_index}")

# --- FLUJO PRINCIPAL ---

def organizar_documentacion():
    for carpeta in list(CATEGORIAS_RAIZ.keys()) + ['otros', 'roadmap/media']:
        (DIRECTORIO_DESTINO / carpeta).mkdir(parents=True, exist_ok=True)

    print("--- 📂 Organizando archivos locales ---")
    for archivo in DIRECTORIO_RAIZ.glob('*.md'):
        if archivo.name.lower() in ['readme.md', 'index.md']:
            continue
        
        destino_final = 'otros'
        for carpeta, palabras_clave in CATEGORIAS_RAIZ.items():
            if any(palabra in archivo.name.lower() for palabra in palabras_clave):
                destino_final = carpeta
                break
        shutil.copy2(str(archivo), str(DIRECTORIO_DESTINO / destino_final / archivo.name))

    # Limpiar antes de extraer la nueva versión
    limpiar_directorio_roadmap()

    print("\n--- 🧠 Extrayendo Roadmap (Manual ERP) ---")
    # Diccionario para evitar nombres de archivo duplicados
    nombres_usados = {}
    archivos_procesados = 0

    for archivo in RUTA_CEREBRO.rglob('*.md'):
        if archivo.name in ['implementation_plan.md', 'task.md', 'walkthrough.md']:
            
            # 1. Intentar extraer título real
            titulo_real = obtener_titulo_md(archivo)
            
            # 2. Si no hay título, usar el hash como fallback
            if not titulo_real:
                hash_carpeta = archivo.parent.name[:8]
                titulo_real = f"Documento Sin Titulo {hash_carpeta}"

            # 3. Limpiar título para URL
            nombre_base_limpio = limpiar_nombre_url(titulo_real)
            
            # 4. Obtener fecha de modificación original para prefijar el nombre
            mtime = os.path.getmtime(archivo)
            fecha_prefijo = datetime.datetime.fromtimestamp(mtime).strftime("%Y%m%d_%H%M")
            
            # 5. Añadir sufijos según el tipo de documento
            mapeo_sufijos = {
                'implementation_plan.md': 'plan',
                'task.md': 'tareas',
                'walkthrough.md': 'resultado'
            }
            sufijo = mapeo_sufijos.get(archivo.name, 'doc')
            nuevo_nombre_limpio = f"{fecha_prefijo}_{nombre_base_limpio}_{sufijo}.md"

            # 6. Prevenir colisiones
            if nuevo_nombre_limpio in nombres_usados:
                nombres_usados[nuevo_nombre_limpio] += 1
                nuevo_nombre_limpio = f"{fecha_prefijo}_{nombre_base_limpio}_{nombres_usados[nuevo_nombre_limpio]}_{sufijo}.md"
            else:
                nombres_usados[nuevo_nombre_limpio] = 1

            destino = RUTA_ROADMAP / nuevo_nombre_limpio
            
            # Copiar archivo preservando metadatos (mtime)
            shutil.copy2(str(archivo), str(destino))
            archivos_procesados += 1

    print("\n--- 🖼️ Rescatando imágenes ---")
    for img in RUTA_CEREBRO.rglob('*'):
        if img.suffix.lower() in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
            destino_img = RUTA_MEDIA / img.name
            if not destino_img.exists():
                shutil.copy2(str(img), str(destino_img))

    print("\n--- 🔧 Corrigiendo Encoding (UTF-8) ---")
    for archivo_md in DIRECTORIO_DESTINO.rglob("*.md"):
        try:
            with open(archivo_md, "rb") as f:
                content = f.read()
            try:
                content.decode("utf-8")
            except UnicodeDecodeError:
                print(f"🔧 Arreglando: {archivo_md.name}")
                text = content.decode("latin-1")
                with open(archivo_md, "w", encoding="utf-8") as f:
                    f.write(text)
        except Exception:
            pass

    print("\n--- 📑 Generando Índices Inteligentes (Manuales) ---")
    generar_indice_inteligente(DIRECTORIO_DESTINO / "configuraciones", "Configuraciones del Proyecto")
    generar_indice_inteligente(DIRECTORIO_DESTINO / "informes", "Informes y Planes")
    generar_indice_inteligente(DIRECTORIO_DESTINO / "pruebas", "Pruebas y Logs")
    generar_indice_inteligente(DIRECTORIO_DESTINO / "roadmap", "Manual del ERP (Roadmap de Desarrollo)")
    generar_indice_inteligente(DIRECTORIO_DESTINO / "otros", "Otros Documentos")

    print(f"\n🚀 ¡Manual Pro Completado! {archivos_procesados} documentos extraídos.")

if __name__ == '__main__':
    organizar_documentacion()