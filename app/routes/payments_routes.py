from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal
import traceback

bp = Blueprint('payments', __name__)

# --- RUTA 1: Obtener Facturas Pendientes ---
@bp.route('/negocios/<int:negocio_id>/proveedores/<int:proveedor_id>/facturas-pendientes', methods=['GET'])
@token_required
def get_facturas_pendientes_proveedor(current_user, negocio_id, proveedor_id):
    db = get_db()
    try:
        query = """
            SELECT
                im.id, im.fecha, im.referencia, im.factura_tipo, im.factura_prefijo, im.factura_numero,
                im.total_factura, im.estado_pago,
                COALESCE(im.total_factura, 0) - COALESCE((
                    SELECT SUM(ppi.monto_aplicado) FROM pagos_proveedores_ingresos ppi
                    WHERE ppi.ingreso_mercaderia_id = im.id
                ), 0) AS saldo_pendiente
            FROM ingresos_mercaderia im
            WHERE im.negocio_id = %s AND im.proveedor_id = %s
              AND im.estado_pago IN ('pendiente', 'parcial') AND im.total_factura IS NOT NULL
            ORDER BY im.fecha ASC;
        """
        db.execute(query, (negocio_id, proveedor_id))
        facturas = db.fetchall()
        facturas_list = []
        for row in facturas:
            row_dict = dict(row)
            row_dict['total_factura'] = float(row_dict.get('total_factura') or 0)
            row_dict['saldo_pendiente'] = float(row_dict.get('saldo_pendiente') or 0)
            if row_dict['saldo_pendiente'] > 0.005:
                 facturas_list.append(row_dict)
        return jsonify(facturas_list)
    except Exception as e:
        print(f"Error en get_facturas_pendientes_proveedor (Prov ID: {proveedor_id}):")
        traceback.print_exc()
        return jsonify({'error': f'Error al obtener facturas pendientes: {str(e)}'}), 500

# --- RUTA 2: Registrar Pago ---
@bp.route('/negocios/<int:negocio_id>/pagos-proveedores', methods=['POST'])
@token_required
def registrar_pago_proveedor(current_user, negocio_id):
    data = request.get_json()
    proveedor_id = data.get('proveedor_id')
    monto_total_str = data.get('monto_total')
    aplicaciones = data.get('aplicaciones')
    detalles = data.get('detalles', [])
    caja_sesion_id = data.get('caja_sesion_id')
    fecha_pago_str = data.get('fecha')

    # Backwards compatibility: si no hay detalles, usar campos de primer nivel
    if not detalles and data.get('metodo_pago'):
        detalles = [{
            'metodo_pago': data.get('metodo_pago'),
            'monto': monto_total_str,
            'referencia': data.get('referencia'),
            'banco': data.get('banco'),
            'cheque_id': data.get('cheque_id')
        }]

    if not proveedor_id or not monto_total_str or not detalles:
        return jsonify({'error': 'Faltan datos obligatorios'}), 400

    try:
        monto_total = Decimal(str(monto_total_str))
        if monto_total <= 0: return jsonify({'error': 'Monto total debe ser positivo'}), 400
    except Exception: return jsonify({'error': 'Monto total inválido'}), 400

    # Validar suma de aplicaciones (opcionales)
    suma_aplicaciones = Decimal('0')
    if aplicaciones and isinstance(aplicaciones, list):
        suma_aplicaciones = sum(Decimal(str(app.get('monto_aplicado', 0))) for app in aplicaciones if app.get('monto_aplicado'))
        if suma_aplicaciones > monto_total + Decimal('0.01'):
            return jsonify({'error': f'La suma de aplicaciones ({suma_aplicaciones:.2f}) no puede superar el total pagado ({monto_total:.2f})'}), 400

    # Validar suma de detalles de pago
    suma_detalles = sum(Decimal(str(det.get('monto', 0))) for det in detalles if det.get('monto'))
    if abs(monto_total - suma_detalles) > Decimal('0.01'):
        return jsonify({'error': f'Suma de métodos de pago ({suma_detalles:.2f}) no coincide con total ({monto_total:.2f})'}), 400

    fecha_pago = datetime.datetime.now()
    if fecha_pago_str:
        try:
            fecha_pago_dt = datetime.datetime.strptime(fecha_pago_str, '%Y-%m-%d')
            fecha_pago = datetime.datetime.combine(fecha_pago_dt.date(), datetime.datetime.now().time())
        except ValueError: return jsonify({'error': 'Formato de fecha inválido'}), 400

    db = get_db()
    try:
        # --- Insertar Pago Principal ---
        # Guardamos el primer método como "principal" para compatibilidad con reportes viejos
        metodo_pago_principal = detalles[0]['metodo_pago'] if len(detalles) == 1 else 'Mixto'
        referencia_principal = detalles[0].get('referencia') if len(detalles) == 1 else None

        db.execute(
            "INSERT INTO pagos_proveedores (negocio_id, proveedor_id, fecha, monto_total, metodo_pago, referencia, usuario_id, caja_sesion_id) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, proveedor_id, fecha_pago, monto_total, metodo_pago_principal, referencia_principal, current_user['id'], caja_sesion_id)
        )
        pago_id = db.fetchone()['id']

        # --- Procesar Detalles de Pago ---
        for det in detalles:
            m_pago = det.get('metodo_pago')
            m_monto = Decimal(str(det.get('monto', 0)))
            m_ref = det.get('referencia')
            m_banco = det.get('banco')
            m_cheque_id = det.get('cheque_id')

            # Validaciones por método
            if m_pago == 'Efectivo' and not caja_sesion_id:
                raise ValueError("Debe proporcionar un ID de sesión de caja para pagos en efectivo.")
            
            if m_pago == 'Cheque Tercero' and not m_cheque_id:
                raise ValueError("Falta ID de cheque para pago con cheque de terceros.")

            # Lógica de Cheques
            if m_pago == 'Cheque Tercero':
                # Marcar cheque como endosado
                db.execute(
                    "UPDATE cheques SET estado = 'endosado', proveedor_id = %s, destino = 'endoso_proveedor', fecha_actualizacion = NOW() WHERE id = %s AND negocio_id = %s AND estado = 'en_cartera'",
                    (proveedor_id, m_cheque_id, negocio_id)
                )
                if db.rowcount == 0:
                    raise ValueError(f"El cheque ID {m_cheque_id} no está disponible en cartera o no pertenece al negocio.")
                
                # Registrar movimiento de cheque
                db.execute(
                    "INSERT INTO cheques_movimientos (cheque_id, negocio_id, tipo_movimiento, estado_anterior, estado_nuevo, proveedor_id, usuario_id, observaciones) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (m_cheque_id, negocio_id, 'endoso_salida', 'en_cartera', 'endosado', proveedor_id, current_user['id'], f"Pago a proveedor ID {pago_id}")
                )

            elif m_pago == 'Cheque Propio':
                # Crear cheque propio directamente
                db.execute("""
                    INSERT INTO cheques (
                        negocio_id, tipo, modalidad, banco, numero_cheque, monto, 
                        fecha_emision, fecha_vencimiento, estado, origen, destino, proveedor_id, usuario_registro_id
                    ) VALUES (%s, 'propio', 'fisico', %s, %s, %s, %s, %s, 'aplicado', 'emision_propia', 'pago_compra', %s, %s)
                    RETURNING id
                """, (negocio_id, m_banco, m_ref, m_monto, fecha_pago.date(), det.get('fecha_vencimiento'), proveedor_id, current_user['id']))
                m_cheque_id = db.fetchone()['id']

                # Registrar movimiento de cheque
                db.execute(
                    "INSERT INTO cheques_movimientos (cheque_id, negocio_id, tipo_movimiento, estado_nuevo, proveedor_id, usuario_id) VALUES (%s, %s, %s, %s, %s, %s)",
                    (m_cheque_id, negocio_id, 'pago_proveedor', 'aplicado', proveedor_id, current_user['id'])
                )

            # Insertar en tabla de detalles
            db.execute("""
                INSERT INTO pagos_proveedores_detalles (pago_proveedor_id, metodo_pago, monto, banco, referencia, cheque_id)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (pago_id, m_pago, m_monto, m_banco, m_ref, m_cheque_id))

        # --- Insertar Aplicaciones ---
        ids_ingresos_afectados = []
        for app in aplicaciones:
            ingreso_id = app.get('ingreso_id')
            m_aplicado = Decimal(str(app.get('monto_aplicado')))
            db.execute(
                "INSERT INTO pagos_proveedores_ingresos (pago_proveedor_id, ingreso_mercaderia_id, monto_aplicado) VALUES (%s, %s, %s)",
                (pago_id, ingreso_id, m_aplicado)
            )
            ids_ingresos_afectados.append(ingreso_id)

        # --- Actualizar Saldo Proveedor ---
        db.execute("UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s", (monto_total, proveedor_id))

        # --- Actualizar Estados Facturas ---
        for ingreso_id in set(ids_ingresos_afectados):
             db.execute("""
                 SELECT im.total_factura, COALESCE(SUM(ppi.monto_aplicado), 0) as total_pagado 
                 FROM ingresos_mercaderia im 
                 LEFT JOIN pagos_proveedores_ingresos ppi ON im.id = ppi.ingreso_mercaderia_id 
                 WHERE im.id = %s GROUP BY im.id, im.total_factura
             """, (ingreso_id,))
             res = db.fetchone()
             if not res or res['total_factura'] is None: continue
             total_f = Decimal(res['total_factura'])
             total_p = Decimal(res['total_pagado'] or 0)
             nuevo_st = 'pagada' if total_p >= total_f - Decimal('0.01') else ('parcial' if total_p > Decimal('0.01') else 'pendiente')
             db.execute("UPDATE ingresos_mercaderia SET estado_pago = %s WHERE id = %s", (nuevo_st, ingreso_id))

        g.db_conn.commit()
        return jsonify({'message': 'Pago registrado con éxito.', 'pago_id': pago_id}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_pago_proveedor:")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400 if isinstance(e, (ValueError, Decimal.InvalidOperation)) else 500


# --- RUTA 3: Historial de Pagos ---
@bp.route('/negocios/<int:negocio_id>/pagos-proveedores/historial', methods=['GET'])
@token_required
def get_historial_pagos_proveedor(current_user, negocio_id):
    db = get_db()
    proveedor_id_filtro = request.args.get('proveedor_id')
    try:
        params = [negocio_id]
        query = """
            SELECT pp.id, pp.fecha, pp.monto_total, pp.metodo_pago, pp.referencia,
                   prov.nombre as proveedor_nombre, u.nombre as usuario_nombre
            FROM pagos_proveedores pp
            JOIN proveedores prov ON pp.proveedor_id = prov.id
            LEFT JOIN usuarios u ON pp.usuario_id = u.id
            WHERE pp.negocio_id = %s
        """
        if proveedor_id_filtro:
            query += " AND pp.proveedor_id = %s"
            params.append(proveedor_id_filtro)
        query += " ORDER BY pp.fecha DESC;"
        db.execute(query, tuple(params))
        pagos = db.fetchall()
        pagos_list = []
        for row in pagos:
            row_dict = dict(row)
            row_dict['monto_total'] = float(row_dict.get('monto_total') or 0)
            pagos_list.append(row_dict)
        return jsonify(pagos_list)
    except Exception as e:
        print(f"Error en get_historial_pagos_proveedor:")
        traceback.print_exc()
        return jsonify({'error': f'Error al obtener historial de pagos: {str(e)}'}), 500
    
    #Prueba final