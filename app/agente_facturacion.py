"""
agente_facturacion.py
=====================
Agente de Facturación Masiva para Re Pancho (negocio_id=8).

Genera ~200 facturas C mensuales distribuyendo día a día según:
  - Horarios de atención: 11:00-16:00 (almuerzo) y 18:00-03:00 (cena/noche)
  - Mayor peso viernes y sábados
  - Ítems sintéticos: menú ejecutivo + bebidas + carta del negocio

No requiere ventas previas: genera los ítems aleatoriamente.
Guarda resultados en log_facturacion_agente.

Constantes configurables:
  NEGOCIO_ID      → ID del negocio en la DB
  TOTAL_FACTURAS  → Meta mensual
  MODO_EJECUCION  → "simulacion" (no llama ARCA) | "real" (emite facturas reales)
"""

import os
import random
import json
import calendar
import psycopg2
import psycopg2.extras
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from dotenv import load_dotenv
from afip import Afip

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN PRINCIPAL
# ─────────────────────────────────────────────────────────────────────────────
NEGOCIO_ID      = 8       # Re Pancho
TOTAL_FACTURAS  = 200     # Meta mensual
MODO_EJECUCION  = "simulacion"   # "simulacion" | "real"
MES_OBJETIVO    = None    # None = mes actual (datetime.date). Ej: date(2026, 3, 1)

CERT_PATH = os.path.join(os.path.dirname(__file__), '..', 'CertificadosARCA', 'certificado.crt')
KEY_PATH  = os.path.join(os.path.dirname(__file__), '..', 'CertificadosARCA', 'key.key')

# CUIT del negocio (Re Pancho — homologación)
CUIT_NEGOCIO    = 23255653059
PUNTO_DE_VENTA  = 1
TIPO_FACTURA    = 11  # 11 = Factura C (Monotributo)

# ─────────────────────────────────────────────────────────────────────────────
# CATÁLOGO SINTÉTICO (complementa los productos reales de la DB)
# ─────────────────────────────────────────────────────────────────────────────
MENU_SINTETICO = [
    {"nombre": "Menú Ejecutivo Completo", "precio": 3800.00, "peso": 25},
    {"nombre": "Menú Ejecutivo Simple",   "precio": 2600.00, "peso": 20},
    {"nombre": "Menú Cena Completo",      "precio": 4500.00, "peso": 15},
    {"nombre": "Almuerzo del Día",        "precio": 3200.00, "peso": 18},
    {"nombre": "Tabla de Picada",         "precio": 5800.00, "peso": 8},
    {"nombre": "Cerveza Artesanal 500cc", "precio": 1200.00, "peso": 30},
    {"nombre": "Cerveza Rubia 1L",        "precio": 2100.00, "peso": 20},
    {"nombre": "Gaseosa 500cc",           "precio": 850.00,  "peso": 25},
    {"nombre": "Agua Mineral 500cc",      "precio": 700.00,  "peso": 15},
    {"nombre": "Vino Copa",               "precio": 1400.00, "peso": 12},
    {"nombre": "Vino Media Botella",      "precio": 3500.00, "peso": 8},
    {"nombre": "Café con Leche",          "precio": 900.00,  "peso": 20},
    {"nombre": "Postre del Día",          "precio": 1600.00, "peso": 10},
    {"nombre": "Empanadas x4",            "precio": 2400.00, "peso": 14},
    {"nombre": "Milanesa Napolitana",     "precio": 4200.00, "peso": 12},
    {"nombre": "Combo Almuerzo + Bebida", "precio": 4100.00, "peso": 18},
    {"nombre": "Combo Cena + Bebida",     "precio": 5200.00, "peso": 14},
]

# ─────────────────────────────────────────────────────────────────────────────
# PESOS POR DÍA DE SEMANA (0=Lunes … 6=Domingo)
# ─────────────────────────────────────────────────────────────────────────────
PESO_DIA = {0: 1.0, 1: 1.0, 2: 1.0, 3: 1.1, 4: 1.5, 5: 1.6, 6: 0.9}

# ─────────────────────────────────────────────────────────────────────────────
# FRANJAS HORARIAS
# Negocio abre 11-16 y 18-03 (03 = día siguiente)
# ─────────────────────────────────────────────────────────────────────────────
def hora_aleatoria_dentro_de_franja():
    """
    Devuelve una hora HH:MM aleatoria ponderada:
      - 35% franja almuerzo (11:00 – 15:59)
      - 65% franja cena/noche (18:00 – 02:59)
    """
    franja = random.choices(["almuerzo", "noche"], weights=[35, 65])[0]
    if franja == "almuerzo":
        hora = random.randint(11, 15)
        minuto = random.randint(0, 59)
    else:
        # 18-03 → usamos 18-26 (>24 = día siguiente)
        hora_base = random.randint(18, 26)
        hora = hora_base % 24
        minuto = random.randint(0, 59)
    return hora, minuto


# ─────────────────────────────────────────────────────────────────────────────
# DISTRIBUCIÓN MENSUAL
# ─────────────────────────────────────────────────────────────────────────────
def calcular_distribucion_mensual(anio: int, mes: int, total: int) -> dict:
    """
    Devuelve dict {date: cantidad_facturas} distribuyendo `total`
    a lo largo del mes según pesos por día de semana.
    """
    _, dias_en_mes = calendar.monthrange(anio, mes)
    dias = [date(anio, mes, d) for d in range(1, dias_en_mes + 1)]

    pesos = [PESO_DIA[d.weekday()] for d in dias]
    suma_pesos = sum(pesos)

    distribucion = {}
    asignadas = 0
    for i, dia in enumerate(dias):
        if i == len(dias) - 1:
            # Último día: lo que falte
            cantidad = total - asignadas
        else:
            cantidad = round(total * pesos[i] / suma_pesos)
        distribucion[dia] = max(0, cantidad)
        asignadas += distribucion[dia]

    return distribucion


def obtener_slots_del_dia(dia: date, cantidad: int) -> list:
    """
    Genera `cantidad` timestamps para el día dado dentro de los horarios de atención.
    """
    slots = []
    for _ in range(cantidad):
        hora, minuto = hora_aleatoria_dentro_de_franja()
        # Si la hora es "nocturna" (0-3 AM), pertenece a la madrugada del mismo día
        ts = datetime(dia.year, dia.month, dia.day, hora, minuto,
                      random.randint(0, 59))
        slots.append(ts)
    slots.sort()
    return slots


# ─────────────────────────────────────────────────────────────────────────────
# GENERACIÓN DE ÍTEMS ALEATORIOS
# ─────────────────────────────────────────────────────────────────────────────
def elegir_items(productos_db: list) -> list:
    """
    Combina productos reales de la DB (si existen) con el menú sintético
    y devuelve 1–4 ítems aleatorios ponderados.
    """
    catalogo = list(MENU_SINTETICO)

    # Agregar productos reales de la DB al pool
    for p in productos_db:
        catalogo.append({
            "nombre": p["nombre"],
            "precio": float(p["precio_venta"]),
            "peso": 10
        })

    pesos = [item["peso"] for item in catalogo]
    num_items = random.randint(1, 4)
    elegidos = random.choices(catalogo, weights=pesos, k=num_items)

    items = []
    for item in elegidos:
        cantidad = random.randint(1, 3)
        items.append({
            "nombre": item["nombre"],
            "precio_unitario": round(item["precio"], 2),
            "cantidad": cantidad,
            "subtotal": round(item["precio"] * cantidad, 2)
        })
    return items


def calcular_totales_factura_c(items: list) -> dict:
    """
    Factura C (Monotributo): no discrimina IVA.
    ImpNeto = ImpTotal, ImpIVA = 0.
    """
    total = Decimal(str(sum(i["subtotal"] for i in items))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return {
        "ImpTotal": float(total),
        "ImpNeto": float(total),
        "ImpIVA": 0,
        "ImpTotConc": 0,
        "ImpOpEx": 0,
        "ImpTrib": 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# CONEXIÓN DIRECTA A DB (para uso fuera de contexto Flask)
# ─────────────────────────────────────────────────────────────────────────────
def get_direct_db_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise EnvironmentError("DATABASE_URL no configurada en el entorno.")
    conn = psycopg2.connect(db_url)
    conn.cursor().execute("SET TIME ZONE 'America/Argentina/Buenos_Aires';")
    return conn


def asegurar_tabla_log(conn):
    """Crea la tabla de log si no existe."""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS log_facturacion_agente (
                id                  SERIAL PRIMARY KEY,
                negocio_id          INTEGER NOT NULL,
                fecha_hora_emision  TIMESTAMP NOT NULL,
                numero_factura      VARCHAR(30),
                cae                 VARCHAR(40),
                vencimiento_cae     VARCHAR(20),
                importe_total       NUMERIC(12,2),
                items_json          TEXT,
                estado              VARCHAR(20) DEFAULT 'ok',
                detalle_error       TEXT,
                created_at          TIMESTAMP DEFAULT NOW()
            );
        """)
    conn.commit()


# ─────────────────────────────────────────────────────────────────────────────
# EMISIÓN DE UNA SOLA FACTURA
# ─────────────────────────────────────────────────────────────────────────────
def emitir_factura_c(afip_instance, timestamp: datetime, items: list,
                     punto_venta: int, tipo_factura: int) -> dict:
    """
    Llama al WS de ARCA y retorna dict con CAE y número de factura.
    """
    ultimo = afip_instance.ElectronicBilling.getLastVoucher(punto_venta, tipo_factura)
    numero = ultimo + 1
    fecha_int = int(timestamp.strftime("%Y%m%d"))

    totales = calcular_totales_factura_c(items)

    data = {
        "CantReg":              1,
        "PtoVta":               punto_venta,
        "CbteTipo":             tipo_factura,
        "Concepto":             1,
        "DocTipo":              99,
        "DocNro":               0,
        "CondicionIVAReceptorId": 5,
        "CbteDesde":            numero,
        "CbteHasta":            numero,
        "CbteFch":              fecha_int,
        "FchServDesde":         None,
        "FchServHasta":         None,
        "FchVtoPago":           None,
        "MonId":                "PES",
        "MonCotiz":             1,
        **totales,
    }

    res = afip_instance.ElectronicBilling.createVoucher(data)

    numero_str = f"{str(punto_venta).zfill(5)}-{str(numero).zfill(8)}"
    return {
        "numero_factura": numero_str,
        "cae":            res["CAE"],
        "vencimiento_cae": res["CAEFchVto"],
        "importe_total":  totales["ImpTotal"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# FUNCIÓN PRINCIPAL: procesar el día actual
# ─────────────────────────────────────────────────────────────────────────────
def ejecutar_dia(
    negocio_id: int = NEGOCIO_ID,
    total_mensual: int = TOTAL_FACTURAS,
    modo: str = MODO_EJECUCION,
    fecha_objetivo: date = None,
    punto_venta: int = PUNTO_DE_VENTA,
    tipo_factura: int = TIPO_FACTURA,
    cuit: int = CUIT_NEGOCIO,
) -> dict:
    """
    Ejecuta la facturación correspondiente AL DÍA indicado (default: hoy).
    Retorna un resumen con éxitos, errores y facturas.
    """
    hoy = fecha_objetivo or date.today()
    anio, mes = hoy.year, hoy.month

    conn = get_direct_db_conn()
    asegurar_tabla_log(conn)

    # Leer productos del negocio
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT nombre, precio_venta FROM productos WHERE negocio_id = %s AND activo = TRUE",
            (negocio_id,)
        )
        productos_db = cur.fetchall() or []

    # Calcular cuántas facturas corresponden hoy
    distribucion = calcular_distribucion_mensual(anio, mes, total_mensual)
    cantidad_hoy = distribucion.get(hoy, 0)

    if cantidad_hoy == 0:
        conn.close()
        return {"fecha": str(hoy), "cantidad": 0, "modo": modo, "facturas": [], "errores": []}

    slots = obtener_slots_del_dia(hoy, cantidad_hoy)

    # Instancia AFIP (solo en modo real)
    afip_instance = None
    if modo == "real":
        cert = open(os.path.abspath(CERT_PATH)).read()
        key  = open(os.path.abspath(KEY_PATH)).read()
        afip_instance = Afip({
            "CUIT":        cuit,
            "cert":        cert,
            "key":         key,
            "homologacion": True,
        })

    facturas_ok  = []
    facturas_err = []

    for ts in slots:
        items = elegir_items(list(productos_db))
        totales = calcular_totales_factura_c(items)

        if modo == "simulacion":
            # No llama a ARCA — simula datos
            factura_data = {
                "numero_factura": f"00001-SIM{random.randint(10000,99999)}",
                "cae":            f"SIM{random.randint(10000000000,99999999999)}",
                "vencimiento_cae": (hoy + timedelta(days=10)).strftime("%Y%m%d"),
                "importe_total":   totales["ImpTotal"],
            }
            estado = "simulacion"
            error  = None
        else:
            try:
                factura_data = emitir_factura_c(
                    afip_instance, ts, items, punto_venta, tipo_factura
                )
                estado = "ok"
                error  = None
            except Exception as e:
                factura_data = {
                    "numero_factura": None,
                    "cae":            None,
                    "vencimiento_cae": None,
                    "importe_total":   totales["ImpTotal"],
                }
                estado = "error"
                error  = str(e)

        # Guardar en log
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO log_facturacion_agente
                    (negocio_id, fecha_hora_emision, numero_factura, cae,
                     vencimiento_cae, importe_total, items_json, estado, detalle_error)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                negocio_id,
                ts,
                factura_data["numero_factura"],
                factura_data["cae"],
                factura_data["vencimiento_cae"],
                factura_data["importe_total"],
                json.dumps(items, ensure_ascii=False),
                estado,
                error,
            ))
        conn.commit()

        registro = {
            "hora": ts.strftime("%H:%M:%S"),
            "numero_factura": factura_data["numero_factura"],
            "cae":            factura_data["cae"],
            "importe_total":  factura_data["importe_total"],
            "items":          items,
            "estado":         estado,
        }
        if estado in ("ok", "simulacion"):
            facturas_ok.append(registro)
        else:
            registro["error"] = error
            facturas_err.append(registro)

    conn.close()

    return {
        "fecha":          str(hoy),
        "modo":           modo,
        "cantidad_total": cantidad_hoy,
        "ok":             len(facturas_ok),
        "errores":        len(facturas_err),
        "facturas":       facturas_ok,
        "facturas_error": facturas_err,
        "total_facturado": round(sum(f["importe_total"] for f in facturas_ok), 2),
    }


def obtener_reporte_dia(negocio_id: int = NEGOCIO_ID, fecha: date = None) -> dict:
    """
    Lee el log del día y retorna resumen para el panel web.
    """
    fecha = fecha or date.today()
    conn  = get_direct_db_conn()
    asegurar_tabla_log(conn)

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, fecha_hora_emision, numero_factura, cae,
                   vencimiento_cae, importe_total, items_json, estado, detalle_error
            FROM log_facturacion_agente
            WHERE negocio_id = %s
              AND DATE(fecha_hora_emision) = %s
            ORDER BY fecha_hora_emision ASC
        """, (negocio_id, fecha))
        filas = cur.fetchall()

    conn.close()

    registros = []
    for f in (filas or []):
        r = dict(f)
        r["fecha_hora_emision"] = r["fecha_hora_emision"].isoformat() if r["fecha_hora_emision"] else None
        r["importe_total"] = float(r["importe_total"]) if r["importe_total"] else 0
        try:
            r["items"] = json.loads(r["items_json"]) if r["items_json"] else []
        except Exception:
            r["items"] = []
        del r["items_json"]
        registros.append(r)

    total_ok  = sum(1 for r in registros if r["estado"] in ("ok", "simulacion"))
    total_err = sum(1 for r in registros if r["estado"] == "error")
    total_monto = sum(r["importe_total"] for r in registros if r["estado"] in ("ok", "simulacion"))

    return {
        "fecha":        str(fecha),
        "negocio_id":   negocio_id,
        "total_ok":     total_ok,
        "total_error":  total_err,
        "total_monto":  round(total_monto, 2),
        "facturas":     registros,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUNTO DE ENTRADA (ejecución manual)
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    modo = sys.argv[1] if len(sys.argv) > 1 else MODO_EJECUCION
    print(f"\n🤖 Agente Facturación Re Pancho — Modo: {modo.upper()}")
    print(f"📅 Fecha: {date.today()}\n")

    resultado = ejecutar_dia(modo=modo)

    print(f"✅ Facturas emitidas : {resultado['ok']}")
    print(f"❌ Errores           : {resultado['errores']}")
    print(f"💰 Total facturado   : ${resultado['total_facturado']:,.2f}")
    print("\n--- Detalle ---")
    for f in resultado["facturas"]:
        print(f"  {f['hora']} | {f['numero_factura']} | CAE:{f['cae']} | ${f['importe_total']:,.2f}")
    if resultado["facturas_error"]:
        print("\n--- Errores ---")
        for f in resultado["facturas_error"]:
            print(f"  {f['hora']} | ERROR: {f.get('error')}")
