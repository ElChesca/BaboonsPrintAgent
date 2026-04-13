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

    # 0. Asegurar columnas de migración
    try:
        db.execute("ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS producto_nombre TEXT")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS comanda_id INTEGER")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS mesa_id INTEGER")
        db.execute("""
            CREATE TABLE IF NOT EXISTS ventas_bitacora (
                id SERIAL PRIMARY KEY,
                venta_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                usuario_nombre TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                campo TEXT,
                valor_anterior TEXT,
                valor_nuevo TEXT,
                motivo TEXT
            )
        """)
        g.db_conn.commit()
    except Exception as e:
        print(f"Error migración ventas: {e}")
        pass

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
            # ✨ NUEVO CÁLCULO: Disponible = Físico - Compromisos (pedidos pendientes de carga)
            query_stock = """
                SELECT 
                    pr.stock, 
                    pr.nombre,
                    COALESCE((
                        SELECT SUM(pd_inner.cantidad)
                        FROM pedidos p_inner
                        JOIN pedidos_detalle pd_inner ON p_inner.id = pd_inner.pedido_id
                        LEFT JOIN hoja_ruta hr ON p_inner.hoja_ruta_id = hr.id
                        WHERE pd_inner.producto_id = pr.id
                          AND p_inner.estado IN ('pendiente', 'preparado')
                          AND (hr.id IS NULL OR hr.carga_confirmada IS FALSE)
                          AND p_inner.negocio_id = %s
                    ), 0) as comprometido
                FROM productos pr
                WHERE pr.id = %s
            """
            db.execute(query_stock, (negocio_id, item['producto_id']))
            prod = db.fetchone()
            
            if not prod:
                return jsonify({'error': f"Producto ID {item['producto_id']} no encontrado"}), 404
            
            stock_fisico = float(prod['stock'])
            comprometido = float(prod['comprometido'] or 0)
            disponible = stock_fisico - comprometido
            solicitado = float(item['cantidad'])
            
            if solicitado > disponible:
                return jsonify({
                    'error': f"Stock insuficiente para '{prod['nombre']}'",
                    'detalle': f"Solicitado: {solicitado}, Disponible: {disponible} (Físico: {stock_fisico}, Comprometido en Pedidos: {comprometido})"
                }), 409

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

        metodo_pago = data.get('metodo_pago')
        if metodo_pago == 'Mixto':
            montos_mixtos = data.get('montos_mixtos', {})
            monto_ef = float(montos_mixtos.get('Efectivo', 0))
            monto_mp = float(montos_mixtos.get('MercadoPago', 0))
            monto_tarjeta = float(montos_mixtos.get('Tarjeta', 0))
            monto_debito = float(montos_mixtos.get('Debito', 0))
            monto_transf = float(montos_mixtos.get('Transferencia', 0))
            monto_cta_cte = float(montos_mixtos.get('CuentaCorriente', 0))

            # Determinar método y monto principal para la venta base
            # Buscamos el primer método con monto > 0 (priorizando Efectivo, luego MP, etc)
            opciones = [
                ('Efectivo', monto_ef),
                ('Mercado Pago', monto_mp),
                ('Tarjeta', monto_tarjeta),
                ('Débito', monto_debito),
                ('Transferencia', monto_transf),
                ('Cuenta Corriente', monto_cta_cte)
            ]
            
            metodo_principal = 'Efectivo'
            monto_principal = 0
            for m, cant in opciones:
                if cant > 0:
                    metodo_principal = m
                    monto_principal = cant
                    break

            # ✨ NUEVO: Calcular próximo número interno para este negocio
            def get_next_nro_interno(db_conn, n_id):
                db_conn.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 as next_nro FROM ventas WHERE negocio_id = %s", (n_id,))
                return db_conn.fetchone()['next_nro']

            nro_principal = get_next_nro_interno(db, negocio_id)

            # 1. Venta Principal (lleva los detalles para descontar stock y las notificaciones)
            db.execute(
                '''INSERT INTO ventas 
                   (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, 
                    mp_payment_intent_id, mp_status, descuento, bonificacion_global, gastos_envio, numero_interno) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
                (negocio_id, data.get('cliente_id'), current_user['id'], monto_principal, metodo_principal, 
                 fecha_actual, sesion_abierta['id'], data.get('mp_payment_intent_id'), 
                 data.get('mp_status'), descuento_global, bonificacion_global, gastos_envio, nro_principal)
            )
            venta_id = db.fetchone()['id']

            # 2. Registrar Ventas Secundarias (sin detalles para no duplicar stock)
            if metodo_principal != 'Efectivo' and monto_ef > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_ef, 'Efectivo', fecha_actual, sesion_abierta['id'], nro_sec)
                )
            if metodo_principal != 'Mercado Pago' and monto_mp > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_mp, 'Mercado Pago', fecha_actual, sesion_abierta['id'], nro_sec)
                )
            if metodo_principal != 'Tarjeta' and monto_tarjeta > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_tarjeta, 'Tarjeta', fecha_actual, sesion_abierta['id'], nro_sec)
                )
            if metodo_principal != 'Débito' and monto_debito > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_debito, 'Débito', fecha_actual, sesion_abierta['id'], nro_sec)
                )
            if metodo_principal != 'Transferencia' and monto_transf > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_transf, 'Transferencia', fecha_actual, sesion_abierta['id'], nro_sec)
                )
            if metodo_principal != 'Cuenta Corriente' and monto_cta_cte > 0:
                nro_sec = get_next_nro_interno(db, negocio_id)
                db.execute(
                    '''INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, bonificacion_global, gastos_envio, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, 0, 0, 0, %s)''',
                    (negocio_id, data.get('cliente_id'), current_user['id'], monto_cta_cte, 'Cuenta Corriente', fecha_actual, sesion_abierta['id'], nro_sec)
                )

            
            # 3. Y para la deuda, insertar en clientes_cuenta_corriente
            if monto_cta_cte > 0:
                db.execute("INSERT INTO clientes_cuenta_corriente (cliente_id, fecha, concepto, debe, haber, venta_id) VALUES (%s, %s, %s, %s, 0, %s)",
                           (data.get('cliente_id'), fecha_actual, f"Venta en Mostrador #{venta_id}", monto_cta_cte, venta_id))
        else:
            db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 as next_nro FROM ventas WHERE negocio_id = %s", (negocio_id,))
            nro_interno = db.fetchone()['next_nro']
            
            db.execute(
                '''INSERT INTO ventas 
                   (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, 
                    mp_payment_intent_id, mp_status, descuento, bonificacion_global, gastos_envio, numero_interno) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
                (negocio_id, data.get('cliente_id'), current_user['id'], total_venta, metodo_pago, 
                 fecha_actual, sesion_abierta['id'], data.get('mp_payment_intent_id'), 
                 data.get('mp_status'), descuento_global, bonificacion_global, gastos_envio, nro_interno)
            )
            venta_id = db.fetchone()['id']
            
            if metodo_pago == 'Cuenta Corriente':
                db.execute("INSERT INTO clientes_cuenta_corriente (cliente_id, fecha, concepto, debe, haber, venta_id) VALUES (%s, %s, %s, %s, 0, %s)",
                           (data.get('cliente_id'), fecha_actual, f"Venta en Mostrador #{venta_id}", total_venta, venta_id))

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

            # Persistir nombre para historial (resiliencia)
            db.execute('SELECT nombre FROM productos WHERE id = %s', (item['producto_id'],))
            p_res = db.fetchone()
            p_nom = p_res['nombre'] if p_res else "Producto"

            db.execute('INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                       (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], subtotal, bonificacion, p_nom))

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
    # Asegurar columnas (por si aún no se corrió el POST)
    try:
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS comanda_id INTEGER")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS mesa_id INTEGER")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_ef NUMERIC DEFAULT 0")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_mp NUMERIC DEFAULT 0")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_cta_cte NUMERIC DEFAULT 0")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_transferencia NUMERIC DEFAULT 0")
        db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_tarjeta NUMERIC DEFAULT 0")
        g.db_conn.commit()
    except: pass

    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    cliente_id = request.args.get('cliente_id')
    
    query = """
        SELECT
            v.id,
            v.numero_interno,
            v.fecha,
            v.total,
            v.metodo_pago,
            c.nombre AS cliente_nombre,
            v.estado,
            v.tipo_factura,
            v.numero_factura,
            p.id as pedido_id,
            p.hoja_ruta_id,
            v.comanda_id,
            m.numero as mesa_numero
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        LEFT JOIN pedidos p ON p.venta_id = v.id
        LEFT JOIN mesas m ON v.mesa_id = m.id
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
        
    # Si hay filtro de fechas enviamos todo el mes (con un límite sano alto). Si no hay filtro fecha, mandamos últimos 50.
    if fecha_desde or fecha_hasta:
        query += " ORDER BY v.id DESC LIMIT 1000"
    else:
        query += " ORDER BY v.id DESC LIMIT 50"

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
        
        # Fallback para numero_interno
        if v_dict.get('numero_interno') is None:
            v_dict['numero_interno'] = f"ID:{v_dict['id']}"
            
        resultado_json.append(v_dict)
    
    return jsonify(resultado_json)

# --- RUTA PARA OBTENER DETALLES (Ya la tenías) ---
@bp.route('/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_venta_detalles(current_user, venta_id):
    db = get_db()
    # 0. Asegurar columnas de migración
    try:
        db.execute("ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS producto_nombre TEXT")
        g.db_conn.commit()
    except: pass

    db.execute("""
        SELECT vd.*, COALESCE(vd.producto_nombre, p.nombre) as nombre
        FROM ventas_detalle vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = %s
    """, (venta_id,))
    detalles = db.fetchall()
    return jsonify([dict(d) for d in detalles])


# --- ✨ NUEVA RUTA: OBTENER TODOS LOS DETALLES DE UNA VENTA ESPECÍFICA ---
@bp.route('/ventas/<int:venta_id>', methods=['GET'])
@token_required
def get_venta_completa(current_user, venta_id):
    db = get_db()
    # 0. Asegurar columnas de migración
    try:
        db.execute("ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS producto_nombre TEXT")
        g.db_conn.commit()
    except: pass

    try:
        # 1. Obtenemos la cabecera de la venta
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404

        # 2. Obtenemos los detalles (productos) de la venta
        db.execute(
            """
            SELECT vd.*, COALESCE(vd.producto_nombre, p.nombre) as producto_nombre
            FROM ventas_detalle vd
            LEFT JOIN productos p ON vd.producto_id = p.id
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

        # Fallback para numero_interno
        if venta_dict.get('numero_interno') is None:
            venta_dict['numero_interno'] = f"ID:{venta_dict['id']}"

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

        # --- 2.7 Desvincular pedido si existe ---
        # Si la venta está atada a un pedido, lo liberamos para que pueda ser re-cobrado
        db.execute("UPDATE pedidos SET venta_id = NULL, estado = 'en_camino' WHERE venta_id = %s", (venta_id,))

        negocio_id = venta['negocio_id']
        metodo_pago = venta['metodo_pago'] or ''
        total_venta = float(venta['total'])
        cliente_id = venta['cliente_id']
        caja_sesion_id = venta['caja_sesion_id']

        # 2.5 Validación estricta de Caja para devoluciones
        sesion_id_para_ajuste = None
        if metodo_pago != 'Cuenta Corriente':
            # Verificar si la sesión original AÚN está abierta
            if caja_sesion_id:
                db.execute("SELECT id FROM caja_sesiones WHERE id = %s AND fecha_cierre IS NULL", (caja_sesion_id,))
                if db.fetchone():
                    sesion_id_para_ajuste = caja_sesion_id
            
            # Si la original está cerrada (o no tenía), buscar la sesión activa de HOY
            if not sesion_id_para_ajuste:
                db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
                sesion_activa = db.fetchone()
                if sesion_activa:
                    sesion_id_para_ajuste = sesion_activa['id']
                    
            # Si no hay NINGUNA caja abierta, impedir la anulación
            if not sesion_id_para_ajuste:
                return jsonify({
                    'error': 'Para anular esta venta y registrar la devolución de dinero física, primero debes Abrir la Caja.'
                }), 400

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
            # Registrar egreso en la sesión abierta identificada
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


@bp.route('/ventas/<int:venta_id>/corregir_pago', methods=['POST'])
@token_required
def corregir_pago_venta(current_user, venta_id):
    data = request.get_json()
    nuevo_metodo = data.get('nuevo_metodo_pago')
    motivo = data.get('motivo', '').strip()
    
    if not nuevo_metodo:
        return jsonify({'error': 'El nuevo método de pago es requerido'}), 400
    if not motivo:
        return jsonify({'error': 'El motivo de la corrección es obligatorio'}), 400

    db = get_db()
    try:
        # 1. Obtener venta original
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404

        metodo_actual = venta['metodo_pago']
        negocio_id = venta['negocio_id']

        if metodo_actual == nuevo_metodo and nuevo_metodo != 'Mixto':
            return jsonify({'error': 'La venta ya tiene ese método de pago registrado'}), 400

        # Validación de Caja (si aplica financiera real)
        db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
        sesion_activa = db.fetchone()
        if not sesion_activa:
            return jsonify({'error': 'Para realizar esta corrección financiera debes tener la Caja Abierta.'}), 400

        # 3. Revertir efectos previos
        if metodo_actual == 'Cuenta Corriente':
            db.execute("DELETE FROM clientes_cuenta_corriente WHERE venta_id = %s AND debe > 0", (venta_id,))

        # 4. Aplicar nuevos efectos
        if nuevo_metodo == 'Mixto':
            # Extraer montos del payload
            m_ef = float(data.get('monto_efectivo', 0))
            m_mp = float(data.get('monto_mp', 0))
            m_cc = float(data.get('monto_cta_cte', 0))
            m_tarjeta = float(data.get('monto_tarjeta', 0))
            m_debito = float(data.get('monto_debito', 0))
            m_transf = float(data.get('monto_transferencia', 0))

            # Determinar método principal (el que actualizará la venta original)
            opciones = [
                ('Efectivo', m_ef),
                ('Mercado Pago', m_mp),
                ('Tarjeta', m_tarjeta),
                ('Débito', m_debito),
                ('Transferencia', m_transf),
                ('Cuenta Corriente', m_cc)
            ]
            
            metodo_prin = 'Efectivo'
            monto_prin = 0
            for m, cant in opciones:
                if cant > 0:
                    metodo_prin = m
                    monto_prin = cant
                    break

            # Actualizamos venta principal con el primer método encontrado
            db.execute("UPDATE ventas SET metodo_pago = %s, total = %s WHERE id = %s", (metodo_prin, monto_prin, venta_id))

            # Helper para insertar ventas secundarias (sin duplicar stock/detalles)
            def insertar_secundaria(db_conn, n_id, c_id, u_id, total, metodo, ses_id):
                db_conn.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 as next_nro FROM ventas WHERE negocio_id = %s", (n_id,))
                n_sec = db_conn.fetchone()['next_nro']
                db_conn.execute(
                    """INSERT INTO ventas 
                       (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, 
                        descuento, bonificacion_global, gastos_envio, numero_interno, estado) 
                       VALUES (%s,%s,%s,%s,%s,%s,%s, 0, 0, 0, %s, 'Pendiente') RETURNING id""",
                    (n_id, c_id, u_id, total, metodo, datetime.datetime.now(), ses_id, n_sec)
                )
                return db_conn.fetchone()['id']

            # Insertar el resto como ventas secundarias
            v_cc_id = None
            if metodo_prin == 'Cuenta Corriente': v_cc_id = venta_id

            for m, cant in opciones:
                # Si es el método principal, ya lo actualizamos en la venta original
                if m == metodo_prin:
                    continue
                
                if cant > 0:
                    new_id = insertar_secundaria(db, negocio_id, venta['cliente_id'], current_user['id'], cant, m, sesion_activa['id'])
                    if m == 'Cuenta Corriente':
                        v_cc_id = new_id

            # Si hubo parte en Cuenta Corriente, registrar en su historial
            if m_cc > 0 and v_cc_id:
                db.execute(
                    "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                    (venta['cliente_id'], f"Corrección a Mixto (Cta Cte) - Venta #{venta_id}", m_cc, 0, datetime.datetime.now(), v_cc_id)
                )

        elif nuevo_metodo == 'Cuenta Corriente':
            db.execute(
                "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                (venta['cliente_id'], f"Corrección Pago - Venta #{venta_id}", venta['total'], 0, datetime.datetime.now(), venta_id)
            )
            db.execute("UPDATE ventas SET metodo_pago = %s WHERE id = %s", (nuevo_metodo, venta_id))
        else:
            db.execute("UPDATE ventas SET metodo_pago = %s WHERE id = %s", (nuevo_metodo, venta_id))

        # 5. AUDITORÍA (BITÁCORA) - Estilo SKU
        db.execute(
            """
            INSERT INTO ventas_bitacora (venta_id, usuario_id, usuario_nombre, campo, valor_anterior, valor_nuevo, motivo)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (venta_id, current_user['id'], current_user.get('nombre', 'Sistema'), 'metodo_pago', metodo_actual, nuevo_metodo, motivo)
        )

        g.db_conn.commit()
        return jsonify({'message': f'Pago de Venta #{venta_id} corregido exitosamente.'}), 200

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

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
