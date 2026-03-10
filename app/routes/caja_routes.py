# app/routes/caja_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal 

# (Helper de Seguridad - Omitido por brevedad, pero debe estar aquí)
def check_user_negocio_permission(current_user, negocio_id):
    if not current_user or 'rol' not in current_user or 'id' not in current_user: return False
    if current_user['rol'] == 'superadmin': return True
    db = get_db()
    db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
    return db.fetchone() is not None

bp = Blueprint('caja', __name__)
@bp.route('/negocios/<int:negocio_id>/caja/estado', methods=['GET'])
@token_required
def get_estado_caja(current_user, negocio_id):
    db = get_db()
    
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403

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
        sesion_id = sesion_abierta['id']
        
        # 1. Ventas por método de pago
        db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_id,))
        desglose_pagos_rows = db.fetchall()
        desglose_pagos = {row['metodo_pago']: float(row['total_por_metodo']) for row in desglose_pagos_rows}

        # 2. Total Gastos en Efectivo
        db.execute(
            "SELECT COALESCE(SUM(monto), 0) as total FROM gastos_operativos WHERE caja_sesion_id = %s AND metodo_pago = 'Efectivo' AND estado = 'Pagado'",
            (sesion_id,)
        )
        total_gastos_efectivo = float(db.fetchone()['total'])
        
        # ==========================================================
        # ✨ 3. (NUEVO) Total Pagos a Proveedores en Efectivo
        # ==========================================================
        db.execute(
            "SELECT COALESCE(SUM(monto_total), 0) as total FROM pagos_proveedores WHERE caja_sesion_id = %s AND metodo_pago = 'Efectivo'",
            (sesion_id,)
        )
        total_pagos_prov_efectivo = float(db.fetchone()['total'])

        # 4. Totales Ajustes de Caja
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Ingreso'", (sesion_id,))
        total_ingresos_ajuste = float(db.fetchone()['total'])
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Egreso'", (sesion_id,))
        total_egresos_ajuste = float(db.fetchone()['total'])

        # 5. Calcular Efectivo Actual Esperado
        monto_inicial = float(sesion_abierta['monto_inicial'])
        ventas_efectivo = desglose_pagos.get('Efectivo', 0.0)
        
        monto_efectivo_actual = (monto_inicial + ventas_efectivo + total_ingresos_ajuste) - (total_egresos_ajuste + total_gastos_efectivo + total_pagos_prov_efectivo)

        totales = {
            'efectivo': monto_efectivo_actual,
            'mp': desglose_pagos.get('Mercado Pago', 0.0), # Asumo que se llama 'Mercado Pago'
            'tarjeta': desglose_pagos.get('Tarjeta', 0.0),
            'transferencia': desglose_pagos.get('Transferencia', 0.0),
            'total_gastos': total_gastos_efectivo,
            'total_pagos_proveedores': total_pagos_prov_efectivo, # ✨ Se envía el nuevo dato
            'total_ingresos_ajuste': total_ingresos_ajuste,
            'total_egresos_ajuste': total_egresos_ajuste
        }
        
        return jsonify({
            'estado': 'abierta',
            'sesion': dict(sesion_abierta),
            'totales': totales # Enviamos los nuevos totales
        })
    else:
        return jsonify({'estado': 'cerrada'})
    
# ✨ Helper de Seguridad (de la respuesta anterior, necesario para que el código funcione)
def check_user_negocio_permission(current_user, negocio_id):
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return False
    if current_user['rol'] == 'superadmin':
        return True
    db = get_db()
    db.execute(
        "SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
        (current_user['id'], negocio_id)
    )
    return db.fetchone() is not None

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

    sesion_id = sesion_abierta['id']
    data = request.get_json()
    monto_final_contado = data.get('monto_final_contado')
    if monto_final_contado is None:
        return jsonify({'error': 'El monto final contado es obligatorio'}), 400

    try:
        # ... (1. Ventas y 2. Ajustes de Caja... igual que antes)
        db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_id,))
        desglose_pagos_rows = db.fetchall()
        desglose_pagos = {row['metodo_pago']: float(row['total_por_metodo']) for row in desglose_pagos_rows}
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Ingreso'", (sesion_id,))
        total_ingresos_ajuste = db.fetchone()['total']
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM caja_ajustes WHERE caja_sesion_id = %s AND tipo = 'Egreso'", (sesion_id,))
        total_egresos_ajuste = db.fetchone()['total']

        # 3. Gastos Operativos (Efectivo)
        db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM gastos_operativos WHERE caja_sesion_id = %s AND metodo_pago = 'Efectivo' AND estado = 'Pagado'", (sesion_id,))
        total_gastos_efectivo = db.fetchone()['total']

        # ==========================================================
        # ✨ 4. (NUEVO) Pagos a Proveedores (Efectivo)
        # ==========================================================
        db.execute("SELECT COALESCE(SUM(monto_total), 0) as total FROM pagos_proveedores WHERE caja_sesion_id = %s AND metodo_pago = 'Efectivo'", (sesion_id,))
        total_pagos_prov_efectivo = db.fetchone()['total']


        # --- REALIZAMOS LOS CÁLCULOS ---
        monto_inicial = float(sesion_abierta['monto_inicial'])
        total_efectivo_ventas = desglose_pagos.get('Efectivo', 0.0)
        
        total_ingresos_efectivo = monto_inicial + total_efectivo_ventas + float(total_ingresos_ajuste)
        # ✨ Se restan ambos egresos
        total_egresos_efectivo = float(total_egresos_ajuste) + float(total_gastos_efectivo) + float(total_pagos_prov_efectivo)
        
        monto_final_esperado = total_ingresos_efectivo - total_egresos_efectivo
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
            'total_ingresos_ajuste': float(total_ingresos_ajuste),
            'total_egresos_ajuste': float(total_egresos_ajuste),
            'total_gastos_efectivo': float(total_gastos_efectivo),
            'total_pagos_prov_efectivo': float(total_pagos_prov_efectivo), # ✨ Se envía el dato
            'monto_final_esperado': monto_final_esperado,
            'monto_final_contado': float(monto_final_contado),
            'diferencia': diferencia
        }

        return jsonify({'message': 'Caja cerrada con éxito', 'resumen': resumen})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
    
    