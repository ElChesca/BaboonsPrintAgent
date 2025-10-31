# app/routes/caja_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('caja', __name__)

@bp.route('/negocios/<int:negocio_id>/caja/estado', methods=['GET'])
@token_required
def get_estado_caja(current_user, negocio_id):
    db = get_db()
    query = """
        SELECT 
            cs.*, 
            u.nombre as usuario_nombre 
        FROM 
            caja_sesiones cs
        JOIN 
            usuarios u ON cs.usuario_id = u.id
        WHERE 
            cs.negocio_id = %s AND cs.fecha_cierre IS NULL
    """
    db.execute(query, (negocio_id,))
    sesion_abierta = db.fetchone()

    if sesion_abierta:
        return jsonify({
            'estado': 'abierta',
            'sesion': dict(sesion_abierta)
        })
    else:
        return jsonify({'estado': 'cerrada'})
    

@bp.route('/negocios/<int:negocio_id>/caja/apertura', methods=['POST'])
@token_required
def abrir_caja(current_user, negocio_id):
    db = get_db()
    db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
    sesion_abierta = db.fetchone()
    if sesion_abierta:
        return jsonify({'error': 'Ya hay una caja abierta para este negocio'}), 409

    data = request.get_json()
    monto_inicial = data.get('monto_inicial')
    if monto_inicial is None:
        return jsonify({'error': 'El monto inicial es obligatorio'}), 400

    db.execute(
        'INSERT INTO caja_sesiones (negocio_id, usuario_id, fecha_apertura, monto_inicial) VALUES (%s, %s, %s, %s)',
        (negocio_id, current_user['id'], datetime.datetime.now(), monto_inicial)
    )
    g.db_conn.commit()
    return jsonify({'message': 'Caja abierta con éxito'}), 201

@bp.route('/negocios/<int:negocio_id>/caja/cierre', methods=['PUT'])
@token_required
def cerrar_caja(current_user, negocio_id):
    db = get_db()
    db.execute('SELECT * FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
    sesion_abierta = db.fetchone()
    if not sesion_abierta:
        return jsonify({'error': 'No hay ninguna caja abierta para cerrar'}), 404

    # ✨ CORRECCIÓN 1: Definimos la variable 'sesion_id' a partir de la sesión que ya encontramos.
    sesion_id = sesion_abierta['id']

    data = request.get_json()
    monto_final_contado = data.get('monto_final_contado')
    if monto_final_contado is None:
        return jsonify({'error': 'El monto final contado es obligatorio'}), 400

    try:
        # --- OBTENEMOS TODOS LOS DATOS PARA EL CÁLCULO ---

        # 1. Ventas de la sesión
        db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_id,))
        desglose_pagos_rows = db.fetchall()
        desglose_pagos = {row['metodo_pago']: float(row['total_por_metodo']) for row in desglose_pagos_rows}
        
        # 2. Ajustes de Ingreso/Egreso de la sesión
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Ingreso'", (sesion_id,))
        total_ingresos_ajuste = db.fetchone()['total']

        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Egreso'", (sesion_id,))
        total_egresos_ajuste = db.fetchone()['total']

        # --- REALIZAMOS LOS CÁLCULOS ---
        monto_inicial = float(sesion_abierta['monto_inicial'])
        # ✨ CORRECCIÓN 2: Usamos la variable correcta 'total_efectivo' que ya habías definido.
        total_efectivo = desglose_pagos.get('Efectivo', 0.0)
        
        monto_final_esperado = (monto_inicial + total_efectivo + total_ingresos_ajuste) - total_egresos_ajuste
        diferencia = float(monto_final_contado) - monto_final_esperado

        # --- ACTUALIZAMOS LA BASE DE DATOS ---
        db.execute(
            "UPDATE caja_sesiones SET fecha_cierre = %s, monto_final_contado = %s, monto_final_esperado = %s, diferencia = %s WHERE id = %s",
            (datetime.datetime.now(), monto_final_contado, monto_final_esperado, diferencia, sesion_id)
        )
        
        g.db_conn.commit()

        # --- PREPARAMOS LA RESPUESTA ---
        resumen = {
            'monto_inicial': monto_inicial,
            'desglose_pagos': desglose_pagos,
            'total_ingresos_ajuste': total_ingresos_ajuste,
            'total_egresos_ajuste': total_egresos_ajuste,
            'monto_final_esperado': monto_final_esperado,
            'monto_final_contado': float(monto_final_contado),
            'diferencia': diferencia
        }

        # ✨ CORRECCIÓN 3: La sintaxis para devolver el JSON del resumen es con ':'
        return jsonify({
            'message': 'Caja cerrada con éxito',
            'resumen': resumen
        })
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/reportes/caja', methods=['GET'])
@token_required
def get_reporte_caja(current_user, negocio_id):
    db = get_db()

    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')

    params = [negocio_id]
    query = "SELECT cs.*, u.nombre as usuario_nombre FROM caja_sesiones cs JOIN usuarios u ON cs.usuario_id = u.id WHERE cs.negocio_id = %s AND cs.fecha_cierre IS NOT NULL"

    # Adaptar la función de fecha según la base de datos
    if g.db_type == 'sqlite':
        date_filter_desde = " AND DATE(cs.fecha_apertura) >= %s"
        date_filter_hasta = " AND DATE(cs.fecha_apertura) <= %s"
    else: # PostgreSQL
        date_filter_desde = " AND cs.fecha_apertura::date >= %s"
        date_filter_hasta = " AND cs.fecha_apertura::date <= %s"

    if fecha_desde:
        query += date_filter_desde
        params.append(fecha_desde)
    if fecha_hasta:
        query += date_filter_hasta
        params.append(fecha_hasta)

    query += " ORDER BY cs.fecha_apertura DESC"

    db.execute(query, tuple(params))
    sesiones = db.fetchall()
    return jsonify([dict(row) for row in sesiones])

@bp.route('/reportes/caja/<int:sesion_id>/detalles', methods=['GET'])
@token_required
def get_detalles_cierre_caja(current_user, sesion_id):
    db = get_db()
    db.execute('SELECT negocio_id FROM caja_sesiones WHERE id = %s', (sesion_id,))
    sesion = db.fetchone()
    if not sesion:
        return jsonify({'error': 'Sesión no encontrada'}), 404

    db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_id,))
    desglose_pagos_rows = db.fetchall()
    desglose_pagos = {row['metodo_pago']: row['total_por_metodo'] for row in desglose_pagos_rows}
    return jsonify(desglose_pagos)


# --- ✨ NUEVA RUTA PARA EL HISTORIAL DE AJUSTES ---
@bp.route('/negocios/<int:negocio_id>/caja/ajustes', methods=['GET'])
@token_required
def get_historial_ajustes(current_user, negocio_id):
    db = get_db()    
    # Parámetros para el filtro de fechas (opcional pero útil)
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    # La consulta SQL es la clave:
    # 1. Unimos 'caja_ajustes' con 'usuarios' para obtener el nombre.
    # 2. Unimos con 'caja_sesiones' para obtener la 'fecha_cierre'.
    #    Si 'fecha_cierre' no es NULL, el ajuste está "Rendido".
    query = """
        SELECT 
            ca.fecha,
            ca.tipo,
            ca.monto,
            ca.concepto,
            u.nombre as usuario_nombre,
            cs.fecha_cierre 
        FROM 
            caja_ajustes ca
        JOIN 
            usuarios u ON ca.usuario_id = u.id
        JOIN 
            caja_sesiones cs ON ca.caja_sesion_id = cs.id
        WHERE 
            ca.negocio_id = %s
    """
    params = [negocio_id]

    # Adaptar la función de fecha según la base de datos
    if g.db_type == 'sqlite':
        date_filter_desde = " AND DATE(ca.fecha) >= %s"
        date_filter_hasta = " AND DATE(ca.fecha) <= %s"
    else: # PostgreSQL
        date_filter_desde = " AND ca.fecha::date >= %s"
        date_filter_hasta = " AND ca.fecha::date <= %s"

    if fecha_desde:
        query += date_filter_desde
        params.append(fecha_desde)
    if fecha_hasta:
        query += date_filter_hasta
        params.append(fecha_hasta)

    query += " ORDER BY ca.fecha DESC"
    
    try:
        db.execute(query, tuple(params))
        ajustes = db.fetchall()
        return jsonify([dict(row) for row in ajustes])
    except Exception as e:
        print(f"Error en get_historial_ajustes: {e}")
        return jsonify({'error': 'Ocurrió un error al obtener el historial de ajustes.'}), 500
    