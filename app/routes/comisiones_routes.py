import os
from flask import Blueprint, jsonify, request, g, render_template
from psycopg2.extras import RealDictCursor
from app.auth_decorator import token_required
from app.database import get_db

comisiones_bp = Blueprint('comisiones', __name__)

@comisiones_bp.route('/api/negocios/<int:negocio_id>/comisiones/reglas', methods=['GET'])
@token_required
def get_comisiones_reglas(current_user, negocio_id):
    """Obtiene las reglas de comisiones configuradas para un negocio."""
    try:
        db = get_db()
        
        # Obtener la regla global del negocio (vendedor_id IS NULL)
        db.execute('''
            SELECT * FROM comisiones_reglas
            WHERE negocio_id = %s AND vendedor_id IS NULL
        ''', (negocio_id,))
        regla_global = dict(db.fetchone() or {})
        
        # Obtener reglas específicas por vendedor
        db.execute('''
            SELECT cr.*, v.nombre as vendedor_nombre
            FROM comisiones_reglas cr
            JOIN vendedores v ON cr.vendedor_id = v.id
            WHERE cr.negocio_id = %s AND cr.vendedor_id IS NOT NULL
        ''', (negocio_id,))
        reglas_vendedores = [dict(row) for row in db.fetchall()]
        
        return jsonify({
            'status': 'success',
            'global': regla_global,
            'vendedores': reglas_vendedores
        }), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@comisiones_bp.route('/api/negocios/<int:negocio_id>/comisiones/reglas', methods=['POST'])
@token_required
def upsert_comision_regla(current_user, negocio_id):
    """Crea o actualiza una regla de comisión (global o por vendedor)."""
    try:
        data = request.get_json()
        vendedor_id = data.get('vendedor_id') # None si es regla global
        porcentaje = data.get('porcentaje', 0)
        monto_fijo = data.get('monto_fijo', 0)
        comisiona_cc = data.get('comisiona_cuenta_corriente', False)
        
        db = get_db()
        db_conn = g.db_conn
        
        if vendedor_id:
            # Upsert para regla específica de vendedor
            db.execute('''
                INSERT INTO comisiones_reglas (negocio_id, vendedor_id, porcentaje, monto_fijo, comisiona_cuenta_corriente)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (negocio_id, vendedor_id)
                DO UPDATE SET 
                    porcentaje = EXCLUDED.porcentaje,
                    monto_fijo = EXCLUDED.monto_fijo,
                    comisiona_cuenta_corriente = EXCLUDED.comisiona_cuenta_corriente,
                    fecha_actualizacion = CURRENT_TIMESTAMP
            ''', (negocio_id, vendedor_id, porcentaje, monto_fijo, comisiona_cc))
        else:
            # Upsert para regla global (vendedor_id IS NULL). En SQLite/Postgres ON CONFLICT con NULL a veces es tricky, manejamos con un IF.
            db.execute('SELECT id FROM comisiones_reglas WHERE negocio_id = %s AND vendedor_id IS NULL', (negocio_id,))
            exists = db.fetchone()
            
            if exists:
                db.execute('''
                    UPDATE comisiones_reglas 
                    SET porcentaje = %s, monto_fijo = %s, comisiona_cuenta_corriente = %s, fecha_actualizacion = CURRENT_TIMESTAMP
                    WHERE negocio_id = %s AND vendedor_id IS NULL
                ''', (porcentaje, monto_fijo, comisiona_cc, negocio_id))
            else:
                db.execute('''
                    INSERT INTO comisiones_reglas (negocio_id, vendedor_id, porcentaje, monto_fijo, comisiona_cuenta_corriente)
                    VALUES (%s, NULL, %s, %s, %s)
                ''', (negocio_id, porcentaje, monto_fijo, comisiona_cc))
        
        db_conn.commit()
        return jsonify({'status': 'success', 'message': 'Regla actualizada correctamente.'}), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        if 'db_conn' in locals(): db_conn.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@comisiones_bp.route('/api/negocios/<int:negocio_id>/comisiones/previsualizar', methods=['GET'])
@token_required
def previsualizar_comisiones(current_user, negocio_id):
    """Calcula las ventas liquidables para un vendedor en un rango de fechas."""
    vendedor_id = request.args.get('vendedor_id')
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    if not vendedor_id or not fecha_desde or not fecha_hasta:
        return jsonify({'status': 'error', 'message': 'Faltan parámetros requeridos.'}), 400
        
    try:
        db = get_db()
        
        # 1. Obtener regla específica del vendedor o la global
        db.execute('SELECT * FROM comisiones_reglas WHERE negocio_id = %s AND vendedor_id = %s', (negocio_id, vendedor_id))
        regla = dict(db.fetchone() or {})
        
        if not regla:
            db.execute('SELECT * FROM comisiones_reglas WHERE negocio_id = %s AND vendedor_id IS NULL', (negocio_id,))
            regla = dict(db.fetchone() or {})
            
        if not regla:
            return jsonify({'status': 'error', 'message': 'No hay reglas de comisión configuradas para este negocio o vendedor.'}), 400

        porcentaje = float(regla.get('porcentaje', 0))
        monto_fijo = float(regla.get('monto_fijo', 0))
        incluye_cc = regla.get('comisiona_cuenta_corriente', False)

        # 2. Buscar ventas aplicables y no liquidadas en el rango
        # Solo tomamos Ventas completadas o Pedidos entregados/pagados que ya sean 'venta'
        # mp_status 'approved' o metodo_pago 'Contado'/'Transferencia', etc.
        query = '''
            SELECT id, total, fecha, metodo_pago, tipo_factura, descuento, vendedor_id
            FROM ventas 
            WHERE negocio_id = %s 
              AND vendedor_id = %s
              AND fecha >= %s AND fecha <= %s 
              AND liquidacion_id IS NULL
              AND estado != 'Anulado'
        '''
        
        if not incluye_cc:
            # Si NO incluye cuenta corriente, excluimos esos métodos de pago
            query += " AND metodo_pago != 'Cuenta Corriente'"
            
        db.execute(query, (negocio_id, vendedor_id, fecha_desde + ' 00:00:00', fecha_hasta + ' 23:59:59'))
        ventas = [dict(row) for row in db.fetchall()]
        
        # 3. Calcular montos
        monto_total_comision = 0
        ventas_detalle = []
        
        for v in ventas:
            total_venta = float(v.get('total', 0))
            comision_calculada = 0
            
            if porcentaje > 0:
                comision_calculada = total_venta * (porcentaje / 100)
            elif monto_fijo > 0:
                comision_calculada = monto_fijo
                
            monto_total_comision += comision_calculada
            
            v['comision_calculada'] = comision_calculada
            ventas_detalle.append(v)
            
        return jsonify({
            'status': 'success',
            'resumen': {
                'cantidad_operaciones': len(ventas_detalle),
                'monto_total_comision': monto_total_comision,
                'regla_aplicada': 'Específica' if regla.get('vendedor_id') else 'Global',
                'porcentaje': porcentaje,
                'monto_fijo': monto_fijo,
                'incluye_cc': incluye_cc
            },
            'ventas': ventas_detalle
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@comisiones_bp.route('/api/negocios/<int:negocio_id>/comisiones/liquidar', methods=['POST'])
@token_required
def asentar_liquidacion(current_user, negocio_id):
    """Crea el registro de liquidación y marca las ventas correspondientes."""
    try:
        data = request.get_json()
        vendedor_id = data.get('vendedor_id')
        fecha_desde = data.get('fecha_desde')
        fecha_hasta = data.get('fecha_hasta')
        monto_total = data.get('monto_total', 0)
        cantidad_operaciones = data.get('cantidad_operaciones', 0)
        ventas_ids = data.get('ventas_ids', []) # Lista de IDs de las ventas a marcar
        observaciones = data.get('observaciones', '')
        
        if not vendedor_id or not ventas_ids:
            return jsonify({'status': 'error', 'message': 'Vendedor o ventas faltantes.'}), 400

        db = get_db()
        db_conn = g.db_conn
        
        # 1. Crear el registro maestro de liquidación (Retorna el ID)
        db.execute('''
            INSERT INTO comisiones_liquidaciones (negocio_id, vendedor_id, fecha_desde, fecha_hasta, monto_total, cantidad_operaciones, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (negocio_id, vendedor_id, fecha_desde, fecha_hasta, monto_total, cantidad_operaciones, observaciones))
        
        liquidacion_id = dict(db.fetchone())['id']
        
        # 2. Marcar todas las ventas con este ID
        # Hacemos el UPDATE donde el ID esté en la lista enviada, asegurando que no estaban liquidadas antes
        format_strings = ','.join(['%s'] * len(ventas_ids))
        update_query = f'''
            UPDATE ventas 
            SET liquidacion_id = %s 
            WHERE id IN ({format_strings}) AND liquidacion_id IS NULL AND negocio_id = %s
        '''
        params = [liquidacion_id] + ventas_ids + [negocio_id]
        db.execute(update_query, tuple(params))
        
        filas_actualizadas = db.rowcount
        
        if filas_actualizadas != len(ventas_ids):
            # Posible concurrencia o ventas ya liquidadas por otro lado
            db_conn.rollback()
            return jsonify({'status': 'error', 'message': f'Discrepancia de datos: Se intentaron liquidar {len(ventas_ids)} ventas pero solo {filas_actualizadas} estaban aptas. Abortando operación.'}), 409

        db_conn.commit()
        
        return jsonify({
            'status': 'success', 
            'message': 'Liquidación asentada correctamente.',
            'liquidacion_id': liquidacion_id
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        if 'db_conn' in locals(): db_conn.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@comisiones_bp.route('/api/negocios/<int:negocio_id>/comisiones/historial', methods=['GET'])
@token_required
def historial_liquidaciones(current_user, negocio_id):
    """Obtiene el histórico de comprobantes de liquidación."""
    try:
        db = get_db()
        db.execute('''
            SELECT cl.*, v.nombre as vendedor_nombre
            FROM comisiones_liquidaciones cl
            JOIN vendedores v ON cl.vendedor_id = v.id
            WHERE cl.negocio_id = %s
            ORDER BY cl.fecha_liquidacion DESC
        ''', (negocio_id,))
        
        historial = [dict(row) for row in db.fetchall()]
        return jsonify({'status': 'success', 'historial': historial}), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': str(e)}), 500
