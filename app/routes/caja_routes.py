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
    db.execute('SELECT * FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
    sesion_abierta = db.fetchone()
    if sesion_abierta:
        return jsonify({'estado': 'abierta', 'sesion': dict(sesion_abierta)})
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

    data = request.get_json()
    monto_final_contado = data.get('monto_final_contado')
    if monto_final_contado is None:
        return jsonify({'error': 'El monto final contado es obligatorio'}), 400

    try:
        db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_abierta['id'],))
        desglose_pagos_rows = db.fetchall()
        desglose_pagos = {row['metodo_pago']: float(row['total_por_metodo']) for row in desglose_pagos_rows}
        
        total_efectivo = desglose_pagos.get('Efectivo', 0.0)
        monto_inicial = float(sesion_abierta['monto_inicial'])
        monto_final_esperado = monto_inicial + total_efectivo
        diferencia = float(monto_final_contado) - monto_final_esperado

        db.execute(
            "UPDATE caja_sesiones SET fecha_cierre = %s, monto_final_contado = %s, monto_final_esperado = %s, diferencia = %s WHERE id = %s",
            (datetime.datetime.now(), monto_final_contado, monto_final_esperado, diferencia, sesion_abierta['id'])
        )
        
        # ✨ MEJORA: Transacción completada exitosamente
        g.db_conn.commit()

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
    except Exception as e:
        # ✨ MEJORA: Si algo falla, revertimos los cambios.
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/reportes/caja', methods=['GET'])
@token_required
def get_reporte_caja(current_user, negocio_id):
    db = get_db()
    # ... (lógica de filtros)
    params = [negocio_id]
    query = "SELECT cs.id, cs.fecha_apertura, ..., u.nombre as usuario_nombre FROM caja_sesiones cs JOIN usuarios u ON cs.usuario_id = u.id WHERE cs.negocio_id = %s AND cs.fecha_cierre IS NOT NULL"
    # ... (añadir filtros al query y params)
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