# app/routes/sales_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
import pytz

bp = Blueprint('sales', __name__)

@bp.route('/negocios/<int:negocio_id>/ventas', methods=['POST'])
@token_required
def registrar_venta(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles')
    db = get_db()

    # Valida que la caja esté abierta
    db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
    sesion_abierta = db.fetchone()
    if not sesion_abierta:
        return jsonify({'error': 'La caja está cerrada. No se pueden registrar ventas.'}), 409

    # Valida stock si es necesario
    db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'vender_stock_negativo'", (negocio_id,))
    config_row = db.fetchone()
    permitir_negativo = config_row and config_row['valor'] == 'Si'

    if not permitir_negativo:
        for item in detalles:
            db.execute('SELECT stock, nombre FROM productos WHERE id = %s', (item['producto_id'],))
            producto = db.fetchone()
            if not producto or producto['stock'] < item['cantidad']:
                return jsonify({'error': f"Stock insuficiente para '{producto['nombre'] if producto else 'ID desconocido'}'"}), 409

    try:
        # Cálculo del total base de los items
        total_items = sum((item['cantidad'] * item['precio_unitario']) - float(item.get('bonificacion', 0)) for item in detalles)
        
        # Nuevos campos globales
        bonificacion_global = float(data.get('bonificacion_global', 0))
        descuento_global = float(data.get('descuento', 0)) # Mantenemos 'descuento' como nombre de campo en el JSON
        gastos_envio = float(data.get('gastos_envio', 0))
        
        # Total final con bonificación (%), descuento ($) y envío ($)
        # La bonificación global es un porcentaje que se aplica sobre el total de los items
        total_con_bonif = total_items * (1 - (bonificacion_global / 100))
        total_venta = total_con_bonif - descuento_global + gastos_envio

        # Obtener hora actual en Argentina con offset para que el JSON sea unívoco
        tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
        fecha_actual = datetime.datetime.now(tz_ar)

        db.execute(
            '''INSERT INTO ventas 
               (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, 
                mp_payment_intent_id, mp_status, descuento, bonificacion_global, gastos_envio) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (negocio_id, data.get('cliente_id'), current_user['id'], total_venta, data.get('metodo_pago'), 
             fecha_actual, sesion_abierta['id'], data.get('mp_payment_intent_id'), 
             data.get('mp_status'), descuento_global, bonificacion_global, gastos_envio)
        )
        venta_id = db.fetchone()['id']

        pago_detalle = data.get('pago_detalle')
        if pago_detalle:
            db.execute(
                'INSERT INTO ventas_pago_detalle (venta_id, nro_cupon, cliente_dni, tarjeta_numero, banco) VALUES (%s, %s, %s, %s, %s)',
                (venta_id, pago_detalle.get('nro_cupon'), pago_detalle.get('cliente_dni'), pago_detalle.get('tarjeta_numero'), pago_detalle.get('banco'))
            )

        notificaciones = []
        for item in detalles:
            db.execute('SELECT nombre, stock, stock_minimo FROM productos WHERE id = %s', (item['producto_id'],))
            producto_antes = db.fetchone()
            stock_anterior = producto_antes['stock']
            
            bonificacion = float(item.get('bonificacion', 0))
            subtotal = (item['cantidad'] - bonificacion) * item['precio_unitario']

            db.execute('INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion) VALUES (%s, %s, %s, %s, %s, %s)',
                       (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], subtotal, bonificacion))

            nuevo_stock = stock_anterior - item['cantidad']
            db.execute('UPDATE productos SET stock = %s WHERE id = %s', (nuevo_stock, item['producto_id']))

            stock_minimo = producto_antes['stock_minimo']
            if stock_anterior > stock_minimo and nuevo_stock <= stock_minimo:
                notificaciones.append({
                    'tipo': 'warning',
                    'mensaje': f"¡Bajo stock! A '{producto_antes['nombre']}' solo le quedan {nuevo_stock} unidades."
                })

        g.db_conn.commit()
        return jsonify({
            'message': 'Venta registrada con éxito',
            'venta_id': venta_id,
            'notificaciones': notificaciones
        }), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/ventas', methods=['GET'],endpoint='get_historial_por_negocio') # Asegúrate que la ruta coincida con tu API
@token_required
def get_historial_ventas(current_user, negocio_id):
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    cliente_id = request.args.get('cliente_id')
    
    query = """
        SELECT
            v.id,
            v.fecha,
            v.total,
            v.metodo_pago,
            c.nombre AS cliente_nombre,
            v.estado,
            v.tipo_factura,
            v.numero_factura
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = %s
    """
    params = [negocio_id]

    if cliente_id:
        query += " AND v.cliente_id = %s"
        params.append(cliente_id)

    # Añadir filtros de fecha si se proporcionan
    if fecha_desde:
        query += " AND v.fecha >= %s"
        params.append(fecha_desde)
    if fecha_hasta:
        # Añadimos un día para incluir todo el día de la fecha 'hasta'
        fecha_hasta_dt = datetime.datetime.strptime(fecha_hasta, '%Y-%m-%d') + datetime.timedelta(days=1)
        query += " AND v.fecha < %s"
        params.append(fecha_hasta_dt.strftime('%Y-%m-%d'))
        
    query += " ORDER BY v.id DESC LIMIT 50" # Ordenar por ID descendente es más común para historiales

    db.execute(query, tuple(params))
    ventas = db.fetchall()

    # Convertimos los resultados a un formato JSON friendly e ISO 8601 para fechas
    resultado_json = []
    for venta in ventas:
        v_dict = dict(venta)
        if isinstance(v_dict.get('fecha'), datetime.datetime):
            # Asegurar que tenga offset de Argentina si no tiene (asumiendo que se guardó en hora local)
            fecha = v_dict['fecha']
            if fecha.tzinfo is None:
                tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
                fecha = tz_ar.localize(fecha)
            v_dict['fecha'] = fecha.isoformat()
        resultado_json.append(v_dict)
    
    return jsonify(resultado_json)

# --- RUTA PARA OBTENER DETALLES (Ya la tenías) ---
@bp.route('/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_venta_detalles(current_user, venta_id):
    db = get_db()
    db.execute("""
        SELECT vd.*, p.nombre
        FROM ventas_detalle vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = %s
    """, (venta_id,))
    detalles = db.fetchall()
    return jsonify([dict(d) for d in detalles])


# --- ✨ NUEVA RUTA: OBTENER TODOS LOS DETALLES DE UNA VENTA ESPECÍFICA ---
@bp.route('/ventas/<int:venta_id>', methods=['GET'])
@token_required
def get_venta_completa(current_user, venta_id):
    db = get_db()
    try:
        # 1. Obtenemos la cabecera de la venta
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404

        # 2. Obtenemos los detalles (productos) de la venta
        db.execute(
            """
            SELECT vd.*, p.nombre as producto_nombre
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = %s
            """,
            (venta_id,)
        )
        detalles = db.fetchall()

        # 3. Obtenemos los datos del cliente (si existe)
        cliente = None
        if venta['cliente_id']:
            db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
            cliente = db.fetchone()

        # 4. Devolvemos todo en un solo paquete JSON con fechas formateadas
        venta_dict = dict(venta)
        if isinstance(venta_dict.get('fecha'), datetime.datetime):
            fecha = venta_dict['fecha']
            if fecha.tzinfo is None:
                tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
                fecha = tz_ar.localize(fecha)
            venta_dict['fecha'] = fecha.isoformat()

        return jsonify({
            'cabecera': venta_dict,
            'detalles': [dict(d) for d in detalles],
            'cliente': dict(cliente) if cliente else None
        })

    except Exception as e:
        print(f"Error en get_venta_completa: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


# --- ✨ NUEVA RUTA: ANULAR VENTA DIRECTA (Nota de Crédito Interna) ---
@bp.route('/ventas/<int:venta_id>/anular', methods=['POST'])
@token_required
def anular_venta(current_user, venta_id):
    """
    Anula una venta directa que NO ha sido facturada via ARCA.
    Revierte:
      - El estado de la venta a 'Anulada'.
      - La caja (si el método de pago no es Cuenta Corriente).
      - La cuenta corriente del cliente (si el método de pago es Cuenta Corriente).
      - El stock de cada ítem de la venta.
    Registra una Nota de Crédito interna en la tabla notas_credito.
    """
    data = request.get_json() or {}
    motivo = data.get('motivo', 'Sin motivo indicado')

    db = get_db()
    try:
        # 1. Obtener la venta completa
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404

        # 2. Validaciones de negocio
        if venta['estado'] == 'Anulada':
            return jsonify({'error': 'Esta venta ya fue anulada anteriormente'}), 409
        if venta['estado'] == 'Facturada':
            return jsonify({'error': 'No se puede anular una venta ya facturada via ARCA. Se requiere un proceso fiscal separado.'}), 409

        negocio_id = venta['negocio_id']
        metodo_pago = venta['metodo_pago'] or ''
        total_venta = float(venta['total'])
        cliente_id = venta['cliente_id']
        caja_sesion_id = venta['caja_sesion_id']

        tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
        fecha_actual = datetime.datetime.now(tz_ar)

        # 3. Marcar la venta como Anulada
        db.execute("UPDATE ventas SET estado = 'Anulada' WHERE id = %s", (venta_id,))

        # 4. Revertir efecto financiero según forma de pago
        concepto_nc = f'Nota de Crédito — Anulación Venta #{venta_id}'

        if metodo_pago == 'Cuenta Corriente':
            # Registrar crédito en la cuenta corriente del cliente (reduce la deuda)
            if cliente_id:
                db.execute(
                    """
                    INSERT INTO clientes_cuenta_corriente
                        (cliente_id, fecha, concepto, debe, haber, venta_id)
                    VALUES (%s, %s, %s, 0, %s, %s)
                    """,
                    (cliente_id, fecha_actual, concepto_nc, total_venta, venta_id)
                )
        else:
            # Registrar egreso en la sesión de caja original (o la sesión activa si la original está cerrada)
            sesion_id_para_ajuste = caja_sesion_id
            if not sesion_id_para_ajuste:
                # Fallback: usar la sesión activa del negocio
                db.execute(
                    "SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL",
                    (negocio_id,)
                )
                sesion_activa = db.fetchone()
                sesion_id_para_ajuste = sesion_activa['id'] if sesion_activa else None

            if sesion_id_para_ajuste:
                db.execute(
                    """
                    INSERT INTO caja_ajustes
                        (negocio_id, usuario_id, caja_sesion_id, fecha, tipo, monto, concepto, observaciones)
                    VALUES (%s, %s, %s, %s, 'Egreso', %s, %s, %s)
                    """,
                    (
                        negocio_id, current_user['id'], sesion_id_para_ajuste,
                        fecha_actual, total_venta, concepto_nc,
                        f'Motivo: {motivo} | Método original: {metodo_pago}'
                    )
                )

        # 5. Devolver el stock de cada ítem
        db.execute(
            """
            SELECT vd.producto_id, vd.cantidad, p.stock
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = %s
            """,
            (venta_id,)
        )
        items = db.fetchall()

        for item in items:
            producto_id = item['producto_id']
            cantidad_devuelta = item['cantidad']
            stock_anterior = item['stock']
            stock_nuevo = stock_anterior + cantidad_devuelta

            # Actualizar stock
            db.execute("UPDATE productos SET stock = %s WHERE id = %s", (stock_nuevo, producto_id))

            # Registrar en historial de inventario
            db.execute(
                """
                INSERT INTO inventario_ajustes
                    (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia, motivo)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    producto_id, current_user['id'], negocio_id,
                    stock_anterior, stock_nuevo, cantidad_devuelta,
                    f'Nota de Crédito — Anulación Venta #{venta_id}: {motivo}'
                )
            )

        # 6. Registrar la Nota de Crédito interna
        db.execute(
            """
            INSERT INTO notas_credito
                (venta_id, negocio_id, usuario_id, fecha, motivo, total)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (venta_id, negocio_id, current_user['id'], fecha_actual, motivo, total_venta)
        )
        nc_id = db.fetchone()['id']

        g.db_conn.commit()
        return jsonify({
            'message': f'Venta #{venta_id} anulada correctamente. Nota de Crédito #{nc_id} generada.',
            'nota_credito_id': nc_id
        }), 200

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en anular_venta: {e}")
        return jsonify({'error': f'Error al anular la venta: {str(e)}'}), 500


# --- ✨ NUEVA RUTA: LISTAR NOTAS DE CRÉDITO DEL NEGOCIO ---
@bp.route('/negocios/<int:negocio_id>/notas_credito', methods=['GET'])
@token_required
def get_notas_credito(current_user, negocio_id):
    db = get_db()
    try:
        db.execute(
            """
            SELECT nc.id, nc.fecha, nc.motivo, nc.total,
                   v.metodo_pago,
                   c.nombre AS cliente_nombre,
                   u.nombre AS usuario_nombre
            FROM notas_credito nc
            JOIN ventas v ON nc.venta_id = v.id
            LEFT JOIN clientes c ON v.cliente_id = c.id
            JOIN usuarios u ON nc.usuario_id = u.id
            WHERE nc.negocio_id = %s
            ORDER BY nc.id DESC
            LIMIT 100
            """,
            (negocio_id,)
        )
        notas = db.fetchall()
        resultado = []
        for n in notas:
            n_dict = dict(n)
            if isinstance(n_dict.get('fecha'), datetime.datetime):
                fecha = n_dict['fecha']
                if fecha.tzinfo is None:
                    tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
                    fecha = tz_ar.localize(fecha)
                n_dict['fecha'] = fecha.isoformat()
            resultado.append(n_dict)
        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
