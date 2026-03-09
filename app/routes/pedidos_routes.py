from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('pedidos', __name__)

@bp.route('/negocios/<int:negocio_id>/pedidos', methods=['GET', 'POST'])
@token_required
def manejar_pedidos(current_user, negocio_id):
    if request.method == 'POST':
        return create_pedido(current_user, negocio_id)
    else:
        return get_pedidos(current_user, negocio_id)

def create_pedido(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles')
    cliente_id = data.get('cliente_id')
    hoja_ruta_id = data.get('hoja_ruta_id')

    if not cliente_id or not detalles:
        return jsonify({'error': 'Faltan datos del cliente o productos'}), 400

    db = get_db()
    try:
    # ✨ VALIDACIÓN DE REGLA DE NEGOCIO: La Hoja de Ruta debe estar en BORRADOR
        if hoja_ruta_id:
            db.execute("SELECT estado FROM hoja_ruta WHERE id = %s", (hoja_ruta_id,))
            hr = db.fetchone()
            if not hr:
                return jsonify({'error': 'Hoja de ruta no encontrada'}), 404
            if hr['estado'] not in ['borrador', 'activa']:
                return jsonify({'error': f'No se pueden agregar pedidos a una Hoja de Ruta {hr["estado"].upper()}. Solo en BORRADOR o ACTIVA.'}), 409

        # current_user['vendedor_id'] viene del token (es el ID de la tabla 'vendedores')
        vendedor_id = current_user.get('vendedor_id')
        
        # 1. Crear cabecera del pedido
        db.execute(
            """
            INSERT INTO pedidos (negocio_id, cliente_id, vendedor_id, usuario_id, hoja_ruta_id, observaciones, total)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, cliente_id, vendedor_id, current_user['id'], hoja_ruta_id, data.get('observaciones'), data.get('total', 0))
        )
        pedido_id = db.fetchone()['id']

        # 2. Guardar detalles
        total_real = 0
        for item in detalles:
            cantidad = float(item['cantidad'])
            precio_unitario = float(item['precio_unitario'])
            bonificacion = float(item.get('bonificacion', 0))
            # El subtotal se calcula sobre la cantidad cobrada (cantidad - bonif)
            cant_cobrada = max(0, cantidad - bonificacion)
            subtotal = cant_cobrada * precio_unitario
            total_real += subtotal
            db.execute(
                """
                INSERT INTO pedidos_detalle (pedido_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (pedido_id, item['producto_id'], cantidad, precio_unitario, subtotal, bonificacion)
            )

        # 3. Actualizar total si no se envió o para asegurar consistencia
        db.execute("UPDATE pedidos SET total = %s WHERE id = %s", (total_real, pedido_id))

        # 4. ✨ Solo marcar visitado si la ruta está activa (pero como bloqueamos arriba, esto quizás ya no aplique igual, 
        # sin embargo, si se agrega en borrador, no se marca visitado aun. El visitado es para cuando SE ENTREGA).
        # RETIRO la auto-visita al CREAR, porque si es borrador, el vendedor aun no fue.
        
        g.db_conn.commit()
        return jsonify({'message': 'Pedido creado con éxito', 'id': pedido_id}), 201

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

def get_pedidos(current_user, negocio_id):
    hoja_ruta_id = request.args.get('hoja_ruta_id')
    fecha = request.args.get('fecha')
    cliente_id = request.args.get('cliente_id')
    
    db = get_db()
    
    query = """
        SELECT p.*, c.nombre as cliente_nombre, 
               COALESCE(v.nombre, u.nombre, 'Sistema') as vendedor_nombre,
               vent.metodo_pago, vent.caja_sesion_id,
               CASE WHEN p.venta_id IS NOT NULL THEN TRUE ELSE FALSE END as pagado,
               hr.estado as hoja_ruta_estado
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN vendedores v ON p.vendedor_id = v.id
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN ventas vent ON p.venta_id = vent.id
        LEFT JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
        WHERE p.negocio_id = %s
    """
    params = [negocio_id]
    
    # ✨ LÓGICA DE VISIBILIDAD DE VENDEDOR
    if current_user['rol'] == 'vendedor':
        if hoja_ruta_id:
            # Si pide pedidos de una ruta, verificamos que la ruta sea suya
            db.execute("SELECT vendedor_id FROM hoja_ruta WHERE id = %s AND negocio_id = %s", (hoja_ruta_id, negocio_id))
            hr = db.fetchone()
            if not hr or hr['vendedor_id'] != current_user.get('vendedor_id'):
                return jsonify({'error': 'No tiene permisos para ver pedidos de esta Hoja de Ruta'}), 403
            # Si la ruta es suya, NO filtramos los pedidos por vendedor_id para que vea los cargados por Admin
        else:
            # Si no hay ruta específica, solo ve sus propios pedidos
            if current_user.get('vendedor_id'):
                query += " AND p.vendedor_id = %s"
                params.append(current_user['vendedor_id'])
    
    if hoja_ruta_id:
        query += " AND p.hoja_ruta_id = %s"
        params.append(hoja_ruta_id)
        
    if fecha:
        query += " AND DATE(p.fecha) = %s"
        params.append(fecha)

    if cliente_id:
        query += " AND p.cliente_id = %s"
        params.append(cliente_id)
        
    query += " ORDER BY p.fecha DESC"
    
    db.execute(query, tuple(params))
    rows = db.fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/pedidos/<int:id>', methods=['GET'])
@token_required
def get_pedido_detail(current_user, id):
    db = get_db()
    db.execute("""
        SELECT p.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.telefono,
               COALESCE(v.nombre, u.nombre, 'Sistema') as vendedor_nombre,
               hr.estado as hoja_ruta_estado,
               vent.metodo_pago, vent.descuento as descuento_pago_contado, vent.id as venta_id
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN vendedores v ON p.vendedor_id = v.id
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
        LEFT JOIN ventas vent ON p.venta_id = vent.id
        WHERE p.id = %s
    """, (id,))
    pedido = db.fetchone()
    
    if not pedido: return jsonify({'error': 'No encontrado'}), 404
    
    db.execute("""
        SELECT pd.*, pr.nombre as producto_nombre
        FROM pedidos_detalle pd
        JOIN productos pr ON pd.producto_id = pr.id
        WHERE pd.pedido_id = %s
    """, (id,))
    detalles = db.fetchall()
    
    db.execute("""
        SELECT prb.*, pr.nombre as producto_nombre, mr.descripcion as motivo
        FROM pedidos_rebotes prb
        JOIN productos pr ON prb.producto_id = pr.id
        LEFT JOIN motivos_rebote mr ON prb.motivo_rebote_id = mr.id
        WHERE prb.pedido_id = %s
    """, (id,))
    rebotes = db.fetchall()
    
    res = dict(pedido)
    res['detalles'] = [dict(d) for d in detalles]
    res['rebotes'] = [dict(r) for r in rebotes]
    return jsonify(res)

@bp.route('/pedidos/<int:id>', methods=['PUT'])
@token_required
def update_pedido_content(current_user, id):
    data = request.get_json()
    db = get_db()
    
    try:
        # 1. Verificar estado actual y obtener Hoja de Ruta vinculada
        db.execute("SELECT estado, negocio_id, hoja_ruta_id FROM pedidos WHERE id = %s", (id,))
        pedido = db.fetchone()
        if not pedido: return jsonify({'error': 'Pedido no encontrado'}), 404
        
        # ✨ Solo permitir editar si está PENDIENTE
        if pedido['estado'] != 'pendiente':
             return jsonify({'error': 'Solo se pueden editar pedidos en estado Pendiente'}), 409

        # ✨ VALIDACIÓN DE REGLA DE NEGOCIO: La Hoja de Ruta debe estar en BORRADOR
        if pedido['hoja_ruta_id']:
            db.execute("SELECT estado FROM hoja_ruta WHERE id = %s", (pedido['hoja_ruta_id'],))
            hr = db.fetchone()
            if hr and hr['estado'] not in ['borrador', 'activa']:
                return jsonify({'error': f'No se puede editar pedidos de una Hoja de Ruta {hr["estado"].upper()}.'}), 409

        # 2. Actualizar Cabecera (Observaciones y Total)
        total_nuevo = data.get('total', 0)
        observaciones = data.get('observaciones', '')
        
        db.execute(
            "UPDATE pedidos SET observaciones = %s, total = %s WHERE id = %s",
            (observaciones, total_nuevo, id)
        )

        # 3. Reemplazar Detalles (Borrar e Insertar)
        db.execute("DELETE FROM pedidos_detalle WHERE pedido_id = %s", (id,))
        
        detalles = data.get('detalles', [])
        total_real = 0
        for item in detalles:
            cantidad = float(item['cantidad'])
            precio_unitario = float(item['precio_unitario'])
            bonificacion = float(item.get('bonificacion', 0))
            cant_cobrada = max(0, cantidad - bonificacion)
            subtotal = cant_cobrada * precio_unitario
            total_real += subtotal
            db.execute(
                """
                INSERT INTO pedidos_detalle (pedido_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (id, item['producto_id'], cantidad, precio_unitario, subtotal, bonificacion)
            )
            
        # Actualizar total real calculado
        db.execute("UPDATE pedidos SET total = %s WHERE id = %s", (total_real, id))

        # 4. ✨ AUTO-VISITA: Asegurar que esté visitado (por si se editó un pedido viejo no marcado)
        if pedido['hoja_ruta_id']:
            # Necesitamos el cliente_id, lo buscamos
            db.execute("SELECT cliente_id FROM pedidos WHERE id = %s", (id,))
            pid_data = db.fetchone()
            if pid_data:
                db.execute(
                    "UPDATE hoja_ruta_items SET visitado = TRUE WHERE hoja_ruta_id = %s AND cliente_id = %s",
                    (pedido['hoja_ruta_id'], pid_data['cliente_id'])
                )

        g.db_conn.commit()
        return jsonify({'message': 'Pedido actualizado con éxito'})

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/pedidos/<int:id>/estado', methods=['PUT'])
@token_required
def update_pedido_estado(current_user, id):
    data = request.get_json()
    nuevo_estado = data.get('estado')
    db = get_db()
    
    try:
        # 1. Obtener estado actual y detalles del pedido
        db.execute("SELECT estado, negocio_id FROM pedidos WHERE id = %s", (id,))
        pedido = db.fetchone()
        if not pedido: return jsonify({'error': 'Pedido no encontrado'}), 404
        
        estado_anterior = pedido['estado']
        negocio_id = pedido['negocio_id']

        if estado_anterior == nuevo_estado:
            return jsonify({'message': 'El pedido ya está en ese estado'})

        # ✨ NUEVA REGLA DE NEGOCIO: "En Camino" exige vehículo
        if nuevo_estado == 'en_camino':
            db.execute("""
                SELECT hr.vehiculo_id 
                FROM pedidos p
                JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
                WHERE p.id = %s
            """, (id,))
            hr_resp = db.fetchone()
            if not hr_resp:
                return jsonify({'error': 'El pedido no está asignado a ninguna Hoja de Ruta.'}), 409
            if not hr_resp['vehiculo_id']:
                return jsonify({'error': 'La Hoja de Ruta asignada no tiene un vehículo asignado. Debe asignar un vehículo antes de despachar.'}), 409

        # 2. Lógica de Stock
        # Caso A: Reservar Stock (Al pasar a PREPARADO)
        if nuevo_estado == 'preparado' and estado_anterior == 'pendiente':
            db.execute("SELECT producto_id, cantidad FROM pedidos_detalle WHERE pedido_id = %s", (id,))
            detalles = db.fetchall()
            
            # ✨ Validar configuración de Stock Negativo
            db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'vender_stock_negativo'", (negocio_id,))
            config_row = db.fetchone()
            permitir_negativo = config_row and config_row['valor'] == 'Si'

            # Validar stock solo si NO se permite negativo
            if not permitir_negativo:
                for item in detalles:
                    db.execute("SELECT stock, nombre FROM productos WHERE id = %s", (item['producto_id'],))
                    prod = db.fetchone()
                    if not prod or prod['stock'] < item['cantidad']:
                        return jsonify({'error': f"Stock insuficiente para {prod['nombre'] if prod else 'ID ' + str(item['producto_id'])}"}), 409
            
            # ✨ NOTA: Ya no descontamos stock aquí. 
            # El descuento físico ocurre al "Confirmar Carga" en el camión.

        # Caso B: Restaurar Stock (Si se anula o vuelve a pendiente desde ENTREGADO)
        # OJO: Si vuelve desde PREPARADO, ya no hace falta restaurar porque no descontamos.
        elif nuevo_estado in ['anulado', 'pendiente'] and estado_anterior == 'entregado':
            db.execute("SELECT producto_id, cantidad FROM pedidos_detalle WHERE pedido_id = %s", (id,))
            detalles = db.fetchall()
            for item in detalles:
                db.execute("UPDATE productos SET stock = stock + %s WHERE id = %s", (item['cantidad'], item['producto_id']))

        # 3. Lógica de Venta / Cuenta Corriente (Caso C: ENTREGADO)
        if nuevo_estado == 'entregado' and estado_anterior != 'entregado':
            # A. Validar Caja Abierta
            db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
            sesion = db.fetchone()
            if not sesion:
                return jsonify({'error': 'La caja está cerrada. Debe abrir la caja para poder entregar pedidos y registrar la deuda.'}), 409
            
            # B. Obtener datos completos del pedido
            db.execute("SELECT cliente_id, total, vendedor_id FROM pedidos WHERE id = %s", (id,))
            pedido_data = db.fetchone()
            
            # C. Crear la Venta (Metodo: Cuenta Corriente)
            db.execute(
                """
                INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, estado, vendedor_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
                """,
                (negocio_id, pedido_data['cliente_id'], current_user['id'], pedido_data['total'], 'Cuenta Corriente', 
                 datetime.datetime.now(), sesion['id'], 'Completado', pedido_data['vendedor_id'])
            )
            venta_id = db.fetchone()['id']
            
            # D. Copiar Detalles a ventas_detalle
            db.execute("SELECT producto_id, cantidad, precio_unitario, subtotal, bonificacion FROM pedidos_detalle WHERE pedido_id = %s", (id,))
            detalles = db.fetchall()
            for item in detalles:
                db.execute(
                    """
                    INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['subtotal'], item['bonificacion'])
                )
            
            # E. Generar Movimiento en Cuenta Corriente (Deuda)
            db.execute(
                """
                INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, venta_id, fecha)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (pedido_data['cliente_id'], f"Venta Automática - Pedido #{id}", pedido_data['total'], 0, venta_id, datetime.datetime.now())
            )
            
            # F. Vincular el pedido con la venta
            db.execute("UPDATE pedidos SET venta_id = %s WHERE id = %s", (venta_id, id))

        # 4. Lógica de Reversión (Si sale de entregado)
        if estado_anterior == 'entregado' and nuevo_estado != 'entregado':
            db.execute("SELECT venta_id FROM pedidos WHERE id = %s", (id,))
            p_ref = db.fetchone()
            if p_ref and p_ref['venta_id']:
                # Borrar cuenta corriente vinculada
                db.execute("DELETE FROM clientes_cuenta_corriente WHERE venta_id = %s", (p_ref['venta_id'],))
                # Borrar detalles de venta
                db.execute("DELETE FROM ventas_detalle WHERE venta_id = %s", (p_ref['venta_id'],))
                # Borrar cabecera de venta
                db.execute("DELETE FROM ventas WHERE id = %s", (p_ref['venta_id'],))
                # Limpiar link
                db.execute("UPDATE pedidos SET venta_id = NULL WHERE id = %s", (id,))

        # 5. Actualizar estado final
        db.execute("UPDATE pedidos SET estado = %s WHERE id = %s", (nuevo_estado, id))
        
        g.db_conn.commit()
        return jsonify({'message': f'Estado actualizado a {nuevo_estado} con éxito'})

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
