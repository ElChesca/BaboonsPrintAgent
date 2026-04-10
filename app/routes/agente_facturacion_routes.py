# app/routes/agente_facturacion_routes.py
"""
API del Agente de Facturación para Re Pancho.

Endpoints:
  GET  /api/agente/facturacion/reporte          → reporte del día (o fecha específica)
  POST /api/agente/facturacion/ejecutar-hoy     → trigger manual del agente para hoy
  GET  /api/agente/facturacion/distribucion-mes → vista previa del calendario mensual
"""

from flask import Blueprint, jsonify, request, current_app, g
from app.auth_decorator import token_required
from datetime import date
import os
import io
from google.cloud import documentai_v1 as documentai
from app.database import get_db

bp = Blueprint('agente_facturacion', __name__)


def _get_agente():
    """Import controlado para evitar ciclos."""
    from app.agente_facturacion import (
        ejecutar_dia, obtener_reporte_dia, calcular_distribucion_mensual,
        NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION,
        PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO
    )
    return ejecutar_dia, obtener_reporte_dia, calcular_distribucion_mensual, \
           NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION, PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO


# ────────────────────────────────────────────────────────────────────────────
# GET /api/agente/facturacion/reporte
# Query params: fecha=YYYY-MM-DD (default: hoy), negocio_id (default: 8)
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/reporte', methods=['GET'])
@token_required
def reporte_dia(current_user):
    _, obtener_reporte_dia, _, NEGOCIO_ID, *_ = _get_agente()

    fecha_str = request.args.get('fecha')
    negocio_id = int(request.args.get('negocio_id', NEGOCIO_ID))

    try:
        if fecha_str:
            from datetime import datetime
            fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
        else:
            fecha = date.today()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Usar YYYY-MM-DD.'}), 400

    try:
        reporte = obtener_reporte_dia(negocio_id=negocio_id, fecha=fecha)
        return jsonify(reporte), 200
    except Exception as e:
        current_app.logger.error(f"[Agente Facturación] Error reporte: {e}")
        return jsonify({'error': str(e)}), 500


# ────────────────────────────────────────────────────────────────────────────
# POST /api/agente/facturacion/ejecutar-hoy
# Body JSON opcional: { "modo": "simulacion"|"real", "negocio_id": 8 }
# Solo superadmin puede disparar manualmente
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/ejecutar-hoy', methods=['POST'])
@token_required
def ejecutar_hoy(current_user):
    # Permitir a superadmin y admin
    if current_user.get('rol') not in ['superadmin', 'admin']:
        return jsonify({'error': 'No autorizado.'}), 403

    ejecutar_dia, _, _, NEGOCIO_ID, TOTAL_FACTURAS, MODO_EJECUCION, \
        PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO = _get_agente()

    data = request.get_json() or {}
    modo = data.get('modo', MODO_EJECUCION)
    negocio_id = int(data.get('negocio_id', NEGOCIO_ID))

    if modo not in ('simulacion', 'real'):
        return jsonify({'error': 'Modo inválido. Usar "simulacion" o "real".'}), 400

    try:
        resultado = ejecutar_dia(
            negocio_id=negocio_id,
            total_mensual=TOTAL_FACTURAS,
            modo=modo,
            punto_venta=PUNTO_DE_VENTA,
            tipo_factura=TIPO_FACTURA,
            cuit=CUIT_NEGOCIO,
        )
        current_app.logger.info(
            f"[Agente Facturación] Ejecución manual — fecha={resultado['fecha']} "
            f"ok={resultado['ok']} errores={resultado['errores']} modo={modo}"
        )
        return jsonify(resultado), 200
    except Exception as e:
        current_app.logger.error(f"[Agente Facturación] Error ejecución: {e}")
        return jsonify({'error': str(e)}), 500


# ────────────────────────────────────────────────────────────────────────────
# GET /api/agente/facturacion/distribucion-mes
# Query params: anio=2026&mes=3 (default: mes actual)
# Vista previa del calendario: cuántas facturas se disparan cada día
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/distribucion-mes', methods=['GET'])
@token_required
def distribucion_mes(current_user):
    _, _, calcular_distribucion_mensual, _, TOTAL_FACTURAS, *_ = _get_agente()

    hoy = date.today()
    try:
        anio = int(request.args.get('anio', hoy.year))
        mes  = int(request.args.get('mes',  hoy.month))
        total = int(request.args.get('total', TOTAL_FACTURAS))
    except ValueError:
        return jsonify({'error': 'Parámetros inválidos.'}), 400

    dist = calcular_distribucion_mensual(anio, mes, total)

    resultado = [
        {
            "fecha": str(d),
            "dia_semana": d.strftime("%A"),
            "cantidad": c
        }
        for d, c in sorted(dist.items())
    ]
    return jsonify({
        "anio": anio, "mes": mes, "total": total,
        "distribucion": resultado
    }), 200


# ────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN DEL AGENTE
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/agente/facturacion/config', methods=['GET'])
@token_required
def get_config(current_user):
    try:
        negocio_id = request.args.get('negocio_id', 8)
        db = get_db()
        
        # ASEGURAR TABLA (Por si falló el script inicial en PROD)
        db.execute("""
            CREATE TABLE IF NOT EXISTS agente_facturacion_config (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER UNIQUE NOT NULL,
                meta_mensual INTEGER DEFAULT 200,
                modo_ejecucion VARCHAR(20) DEFAULT 'simulacion',
                auto_pilot BOOLEAN DEFAULT FALSE,
                variabilidad_porcentaje INTEGER DEFAULT 15,
                cuit_negocio BIGINT,
                punto_venta INTEGER DEFAULT 1,
                tipo_factura INTEGER DEFAULT 11,
                updated_at TIMESTAMP DEFAULT NOW()
            );
        """)
        if hasattr(g, 'db_conn'): g.db_conn.commit()

        db.execute("""
            SELECT meta_mensual, modo_ejecucion, auto_pilot, variabilidad_porcentaje, 
                   cuit_negocio, punto_venta, tipo_factura 
            FROM agente_facturacion_config 
            WHERE negocio_id = %s
        """, (negocio_id,))
        
        row = db.fetchone()
        
        if not row:
            return jsonify({
                'meta_mensual': 200, 
                'modo_ejecucion': 'simulacion',
                'auto_pilot': False,
                'variabilidad_porcentaje': 15,
                'cuit_negocio': 23255653059,
                'punto_venta': 1,
                'tipo_factura': 11
            }), 200
        
        # Intentamos convertir a dict de forma segura
        try:
            res = dict(row)
        except:
            # Si falla dict() (por ser tupla), mapeamos a mano
            res = {
                'meta_mensual': row[0],
                'modo_ejecucion': row[1],
                'auto_pilot': row[2],
                'variabilidad_porcentaje': row[3],
                'cuit_negocio': row[4],
                'punto_venta': row[5],
                'tipo_factura': row[6]
            }
        
        return jsonify(res), 200
        
    except Exception as e:
        import traceback
        error_info = traceback.format_exc()
        print(f"DEBUG ERROR AGENTE: {error_info}")
        return jsonify({
            'error_debug': str(e),
            'meta_mensual': 200,
            'modo_ejecucion': 'simulacion_fallback'
        }), 200

@bp.route('/agente/facturacion/config', methods=['POST'])
@token_required
def save_config(current_user):
    if current_user.get('rol') not in ['superadmin', 'admin']:
        return jsonify({'error': 'No autorizado.'}), 403

    data = request.get_json()
    negocio_id = data.get('negocio_id', 8)
    
    db = get_db()
    db.execute("""
        INSERT INTO agente_facturacion_config 
        (negocio_id, meta_mensual, modo_ejecucion, auto_pilot, variabilidad_porcentaje, cuit_negocio, punto_venta, tipo_factura, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (negocio_id) DO UPDATE SET
            meta_mensual = EXCLUDED.meta_mensual,
            modo_ejecucion = EXCLUDED.modo_ejecucion,
            auto_pilot = EXCLUDED.auto_pilot,
            variabilidad_porcentaje = EXCLUDED.variabilidad_porcentaje,
            cuit_negocio = EXCLUDED.cuit_negocio,
            punto_venta = EXCLUDED.punto_venta,
            tipo_factura = EXCLUDED.tipo_factura,
            updated_at = NOW()
    """, (
        negocio_id, data.get('meta_mensual', 200), data.get('modo_ejecucion', 'simulacion'), 
        data.get('auto_pilot', False), data.get('variabilidad_porcentaje', 15),
        data.get('cuit_negocio'), data.get('punto_venta', 1), data.get('tipo_factura', 11)
    ))
    
    if hasattr(g, 'db_conn'):
        g.db_conn.commit()
        
    return jsonify({'success': True, 'message': 'Configuración guardada.'}), 200


# ────────────────────────────────────────────────────────────────────────────
# POST /api/scan-factura
# OCR de facturas usando Google Cloud Document AI y almacenamiento en Neon
# ────────────────────────────────────────────────────────────────────────────
@bp.route('/scan-factura', methods=['POST'])
@token_required
def scan_factura(current_user):
    if 'file' not in request.files:
        return jsonify({'error': 'No se subió ningún archivo.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacío.'}), 400

    try:
        content = file.read()
        document = _process_document_ocr(content, file.content_type)
        data = _parse_document_entities(document)
        
        # Validar y guardar en Neon
        db = get_db()
        negocio_id = request.form.get('negocio_id', current_user.get('negocio_id'))
        
        if not negocio_id:
            return jsonify({'error': 'No se especificó negocio_id.'}), 400

        # Validar duplicados (CUIT + PV + Número)
        db.execute("""
            SELECT id FROM compras_facturas 
            WHERE cuit_emisor = %s AND punto_venta = %s AND numero_comprobante = %s
        """, (data['cuit_emisor'], data['punto_venta'], data['numero_comprobante']))
        
        if db.fetchone():
             return jsonify({
                 'error': 'Factura duplicada',
                 'message': f"Ya existe la factura {data['punto_venta']}-{data['numero_comprobante']} del emisor {data['cuit_emisor']}",
                 'data': data
             }), 409

        # Insertar en Neon
        db.execute("""
            INSERT INTO compras_facturas (
                negocio_id, cuit_emisor, punto_venta, numero_comprobante, 
                fecha_emision, monto_total, data_json
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            negocio_id, data['cuit_emisor'], data['punto_venta'], data['numero_comprobante'],
            data['fecha_emision'], data['monto_total'], document.json
        ))
        
        if hasattr(g, 'db_conn'):
            g.db_conn.commit()

        return jsonify({
            'success': True,
            'message': 'Factura procesada y guardada correctamente.',
            'data': data
        }), 201

    except Exception as e:
        current_app.logger.error(f"[OCR] Error: {e}")
        return jsonify({'error': str(e)}), 500


def _process_document_ocr(file_content, mime_type):
    project_id = os.environ.get("GCP_PROJECT_ID")
    location = os.environ.get("GCP_LOCATION", "us")
    processor_id = os.environ.get("GCP_PROCESSOR_ID")
    
    if not (project_id and processor_id):
        raise ValueError("Configuración Document AI incompleta (GCP_PROJECT_ID, GCP_PROCESSOR_ID).")

    client = documentai.DocumentProcessorServiceClient()
    name = client.processor_path(project_id, location, processor_id)
    
    raw_document = documentai.RawDocument(content=file_content, mime_type=mime_type)
    request = documentai.ProcessRequest(name=name, raw_document=raw_document)
    
    result = client.process_document(request=request)
    return result.document


def _parse_document_entities(document):
    """
    Mapea las entidades de Document AI a los campos requeridos.
    Se asume el uso de un procesador de facturas genérico o especializado.
    """
    entities = {e.type_: e.mention_text for e in document.entities}
    
    # Mapeo manual basado en labels estándar de Google API
    raw_number = entities.get('invoice_id', '0000-00000000')
    pv = '0000'
    num = raw_number
    
    if '-' in raw_number:
        parts = raw_number.split('-')
        pv = parts[0].zfill(4)
        num = parts[1]

    # Limpieza de montos y fechas
    monto_total = 0.0
    try:
        # Algunos procesadores devuelven entity.normalized_value.total_value (float)
        # Por ahora usamos el texto crudo y limpiamos caracteres no numéricos
        monto_str = entities.get('total_amount', '0').replace('$', '').replace(',', '').strip()
        monto_total = float(monto_str)
    except: pass

    fecha = str(date.today())
    try:
        # Google suele devolver YYYY-MM-DD en mention_text si está normalizado
        fecha_raw = entities.get('invoice_date', fecha)
        # Intentar limpieza básica si viene con texto
        fecha = fecha_raw[:10] 
    except: pass

    return {
        'cuit_emisor': entities.get('supplier_tax_id', '00-00000000-0').replace('-', ''),
        'proveedor': entities.get('supplier_name', ''),
        'punto_venta': pv,
        'numero_comprobante': num,
        'fecha_emision': fecha,
        'monto_total': monto_total
    }

