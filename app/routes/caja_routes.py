# app/routes/caja_routes.py
from flask import Blueprint, jsonify, request
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('caja', __name__)

# --- Rutas para Apertura y Cierre de Caja ---

@bp.route('/negocios/<int:negocio_id>/caja/estado', methods=['GET'])
@token_required
def get_estado_caja(current_user, negocio_id):
    """ Devuelve el estado actual de la caja para un negocio. """
    db = get_db()
    sesion_abierta = db.execute(
        'SELECT * FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL', (negocio_id,)
    ).fetchone()

    if sesion_abierta:
        return jsonify({'estado': 'abierta', 'sesion': dict(sesion_abierta)})
    else:
        return jsonify({'estado': 'cerrada'})

@bp.route('/negocios/<int:negocio_id>/caja/apertura', methods=['POST'])
@token_required
def abrir_caja(current_user, negocio_id):
    """ Abre una nueva sesión de caja. """
    db = get_db()
    sesion_abierta = db.execute(
        'SELECT id FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL', (negocio_id,)
    ).fetchone()

    if sesion_abierta:
        return jsonify({'error': 'Ya hay una caja abierta para este negocio'}), 409

    data = request.get_json()
    monto_inicial = data.get('monto_inicial')
    if monto_inicial is None:
        return jsonify({'error': 'El monto inicial es obligatorio'}), 400

    cursor = db.cursor()
    cursor.execute(
        'INSERT INTO caja_sesiones (negocio_id, usuario_id, fecha_apertura, monto_inicial) VALUES (?, ?, ?, ?)',
        (negocio_id, current_user['id'], datetime.datetime.now(), monto_inicial)
    )
    db.commit()
    return jsonify({'message': 'Caja abierta con éxito'}), 201

@bp.route('/negocios/<int:negocio_id>/caja/cierre', methods=['PUT'])
@token_required
def cerrar_caja(current_user, negocio_id):
    """ Cierra la sesión de caja actual. """
    db = get_db()
    sesion_abierta = db.execute(
        'SELECT * FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL', (negocio_id,)
    ).fetchone()

    if not sesion_abierta:
        return jsonify({'error': 'No hay ninguna caja abierta para cerrar'}), 404

    data = request.get_json()
    monto_final_contado = data.get('monto_final_contado')
    if monto_final_contado is None:
        return jsonify({'error': 'El monto final contado es obligatorio'}), 400

    # Calculamos el total de ventas en efectivo para esta sesión
    ventas_efectivo = db.execute(
        'SELECT SUM(total) as total_efectivo FROM ventas WHERE caja_sesion_id = ? AND metodo_pago = "Efectivo"',
        (sesion_abierta['id'],)
    ).fetchone()
    
     # ✨ Calculamos el desglose de ventas por método de pago
    desglose_pagos_rows = db.execute(
        'SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = ? GROUP BY metodo_pago',
        (sesion_abierta['id'],)
    ).fetchall()

    desglose_pagos = {row['metodo_pago']: row['total_por_metodo'] for row in desglose_pagos_rows}

    total_efectivo = desglose_pagos.get('Efectivo', 0) # Obtenemos solo el efectivo
    monto_inicial = sesion_abierta['monto_inicial']
    monto_final_esperado = monto_inicial + total_efectivo
    diferencia = float(monto_final_contado) - monto_final_esperado

    db.execute(
        """
        UPDATE caja_sesiones 
        SET fecha_cierre = ?, monto_final_contado = ?, monto_final_esperado = ?, diferencia = ?
        WHERE id = ?
        """,
        (datetime.datetime.now(), monto_final_contado, monto_final_esperado, diferencia, sesion_abierta['id'])
    )
    db.commit()

    return jsonify({
        'message': 'Caja cerrada con éxito',
        'resumen': {
            'monto_inicial': monto_inicial,
            'desglose_pagos': desglose_pagos,            
            'monto_final_esperado': monto_final_esperado,
            'monto_final_contado': float(monto_final_contado),
            'diferencia': diferencia
        }
    })

# ... (tus otras funciones de caja van aquí arriba) ...

@bp.route('/negocios/<int:negocio_id>/reportes/caja', methods=['GET'])
@token_required
def get_reporte_caja(current_user, negocio_id):
    """
    Devuelve el historial de sesiones de caja cerradas.
    Filtra por 'fecha_desde', 'fecha_hasta' y/o 'usuario_id'.
    """
    db = get_db()
    
    # Parámetros de filtro opcionales
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    usuario_id = request.args.get('usuario_id')

    query = """
        SELECT
            cs.id,
            cs.fecha_apertura,
            cs.fecha_cierre,
            cs.monto_inicial,
            cs.monto_final_esperado,
            cs.monto_final_contado,
            cs.diferencia,
            u.nombre as usuario_nombre
        FROM
            caja_sesiones cs
        JOIN
            usuarios u ON cs.usuario_id = u.id
        WHERE
            cs.negocio_id = ? AND cs.fecha_cierre IS NOT NULL
    """
    params = [negocio_id]

    if fecha_desde:
        query += " AND date(cs.fecha_apertura) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND date(cs.fecha_cierre) <= ?"
        params.append(fecha_hasta)
    if usuario_id:
        query += " AND cs.usuario_id = ?"
        params.append(usuario_id)
        
    query += " ORDER BY cs.fecha_apertura DESC"
    
    sesiones = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in sesiones])


@bp.route('/reportes/caja/<int:sesion_id>/detalles', methods=['GET'])
@token_required
def get_detalles_cierre_caja(current_user, sesion_id):
    """ Devuelve el desglose de métodos de pago para una única sesión de caja cerrada. """
    db = get_db()
    
    # Verificamos que la sesión exista y pertenezca al negocio del usuario (por seguridad)
    sesion = db.execute('SELECT negocio_id FROM caja_sesiones WHERE id = ?', (sesion_id,)).fetchone()
    if not sesion:
        return jsonify({'error': 'Sesión no encontrada'}), 404

    # Calculamos el desglose de ventas por método de pago para esa sesión
    desglose_pagos_rows = db.execute(
        """
        SELECT metodo_pago, SUM(total) as total_por_metodo 
        FROM ventas 
        WHERE caja_sesion_id = ? 
        GROUP BY metodo_pago
        """,
        (sesion_id,)
    ).fetchall()
    
    desglose_pagos = {row['metodo_pago']: row['total_por_metodo'] for row in desglose_pagos_rows}
    
    return jsonify(desglose_pagos)