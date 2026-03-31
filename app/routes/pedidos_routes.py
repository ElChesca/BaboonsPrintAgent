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

        # ✨ NUEVA REGLA: Bloquear creación si no hay stock
        db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'bloquear_pedido_sin_stock'", (negocio_id,))
        config_bloqueo = db.fetchone()
        if config_bloqueo and config_bloqueo['valor'] == 'Si':
            faltantes = []
            for item in detalles:
                # ✨ NUEVO CÁLCULO: Stock Disponible = Stock Físico - Compromisos (pedidos sin cargar)
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
                    faltantes.append(f"Producto ID {item['producto_id']} no encontrado")
                    continue
                
                stock_fisico = float(prod['stock'])
                comprometido = float(prod['comprometido'] or 0)
                disponible = stock_fisico - comprometido
                solicitado = float(item['cantidad'])
                
                if solicitado > disponible:
                     faltantes.append(f"{prod['nombre']} (Solicitado: {solicitado}, Disponible Real: {disponible} [Stock: {stock_fisico}, Comprometido: {comprometido}])")
            
            if faltantes:
                return jsonify({
                    'error': 'Stock insuficiente (Considerando pedidos pendientes)',
                    'detalles': faltantes
                }), 409

        # current_user['vendedor_id'] viene del token (es el ID de la tabla 'vendedores')
        vendedor_id = current_user.get('vendedor_id')
        
        # 1. Crear cabecera del pedido
        db.execute(
            """
            INSERT INTO pedidos (negocio_id, cliente_id, vendedor_id, usuario_id, hoja_ruta_id, observaciones, total, fecha_estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, cliente_id, vendedor_id, current_user['id'], hoja_ruta_id, data.get('observaciones'), data.get('total', 0), datetime.datetime.now())
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
    estado = request.args.get('estado')
    limit = request.args.get('limit')
    offset = request.args.get('offset')
    
    db = get_db()
    
    # 1. Base query para contar TOTAL (sin limit/offset) para paginación
    count_query = """
        SELECT COUNT(*) as total
        FROM pedidos p
        WHERE p.negocio_id = %s
    """
    
    # Base query para DATOS
    query = """
        SELECT p.*, c.nombre as cliente_nombre, 
               COALESCE(v.nombre, u.nombre, 'Sistema') as vendedor_nombre,
               vent.metodo_pago, vent.caja_sesion_id,
               CASE WHEN p.venta_id IS NOT NULL THEN TRUE ELSE FALSE END as pagado,
               hr.estado as hoja_ruta_estado,
               COALESCE((SELECT SUM(cantidad) FROM pedidos_rebotes prb WHERE prb.pedido_id = p.id), 0) as rebotes_count
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN vendedores v ON p.vendedor_id = v.id
        LEFT JOIN usuarios u ON p.usuario_id = u.id
        LEFT JOIN ventas vent ON p.venta_id = vent.id
        LEFT JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
        WHERE p.negocio_id = %s
    """
    params = [negocio_id]
    
    # Filtros comunes para ambos queries
    filter_sql = ""
    filter_params = []

    # ✨ LÓGICA DE VISIBILIDAD DE VENDEDOR
    if current_user['rol'] == 'vendedor':
        if hoja_ruta_id:
            db.execute("SELECT vendedor_id FROM hoja_ruta WHERE id = %s AND negocio_id = %s", (hoja_ruta_id, negocio_id))
            hr = db.fetchone()
            if not hr or hr['vendedor_id'] != current_user.get('vendedor_id'):
                return jsonify({'error': 'No tiene permisos para ver pedidos de esta Hoja de Ruta'}), 403
        else:
            if current_user.get('vendedor_id'):
                filter_sql += " AND p.vendedor_id = %s"
                filter_params.append(current_user['vendedor_id'])
    
    if hoja_ruta_id:
        filter_sql += " AND p.hoja_ruta_id = %s"
        filter_params.append(hoja_ruta_id)
        
    if fecha:
        filter_sql += " AND DATE(p.fecha) = %s"
        filter_params.append(fecha)

    if cliente_id:
        filter_sql += " AND p.cliente_id = %s"
        filter_params.append(cliente_id)
        
    if estado:
        filter_sql += " AND p.estado = %s"
        filter_params.append(estado)

    # Ejecutar conteo total
    db.execute(count_query + filter_sql, tuple(params + filter_params))
    total_count = db.fetchone()['total']
        
    # Aplicar orden y paginación al query de datos
    query += filter_sql
    query += " ORDER BY p.fecha DESC"
    
    if limit and offset:
        query += " LIMIT %s OFFSET %s"
        filter_params.extend([int(limit), int(offset)])
    
    db.execute(query, tuple(params + filter_params))
    rows = db.fetchall()
    
    ahora = datetime.datetime.now()
    pedidos_lista = []
    for r in rows:
        d = dict(r)
        fecha_ref = d.get('fecha_estado') or d.get('fecha')
        if isinstance(fecha_ref, str):
            try:
                fecha_ref = datetime.datetime.fromisoformat(fecha_ref.replace('Z', '+00:00'))
            except Exception:
                fecha_ref = ahora
                
        if isinstance(fecha_ref, datetime.datetime):
            fecha_ref_naive = fecha_ref.replace(tzinfo=None)
            delta = ahora - fecha_ref_naive
            d['dias_en_estado'] = delta.days
        else:
            d['dias_en_estado'] = 0
            
        pedidos_lista.append(d)
        
    return jsonify({
        'pedidos': pedidos_lista,
        'total': total_count
    })

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
        db.execute("SELECT estado, negocio_id, hoja_ruta_id, observaciones, total FROM pedidos WHERE id = %s", (id,))
        pedido = db.fetchone()
        if not pedido: return jsonify({'error': 'Pedido no encontrado'}), 404
        
        # ✨ Solo permitir editar si NO está ENTREGADO ni ANULADO
        if pedido['estado'] in ['entregado', 'anulado']:
             return jsonify({'error': f'No se pueden editar pedidos en estado {pedido["estado"].upper()}'}), 409

        # ✨ VALIDACIÓN DE REGLA DE NEGOCIO: La Hoja de Ruta debe estar en BORRADOR o ACTIVA
        if pedido['hoja_ruta_id']:
            db.execute("SELECT estado FROM hoja_ruta WHERE id = %s", (pedido['hoja_ruta_id'],))
            hr = db.fetchone()
            if hr and hr['estado'] not in ['borrador', 'activa']:
                return jsonify({'error': f'No se puede editar pedidos de una Hoja de Ruta {hr["estado"].upper()}.'}), 409

        # 1.5. GUARDAR BITÁCORA (Snapshot del estado actual antes de editar)
        db.execute("""
            SELECT pd.*, pr.nombre as producto_nombre 
            FROM pedidos_detalle pd 
            JOIN productos pr ON pd.producto_id = pr.id 
            WHERE pd.pedido_id = %s
        """, (id,))
        detalles_anteriores = db.fetchall()
        
        import json, decimal
        datos_anteriores = {
            'observaciones': pedido['observaciones'],
            'total': float(pedido['total']) if pedido['total'] else 0,
            'detalles': []
        }
        
        for row in detalles_anteriores:
            d = dict(row)
            for k, v in d.items():
                if isinstance(v, decimal.Decimal):
                    d[k] = float(v)
            datos_anteriores['detalles'].append(d)

        db.execute("""
            INSERT INTO pedidos_historial (pedido_id, negocio_id, usuario_id, datos_anteriores, motivo)
            VALUES (%s, %s, %s, %s, %s)
        """, (id, pedido['negocio_id'], current_user['id'], json.dumps(datos_anteriores), data.get('motivo_edicion', 'Edición manual')))

        # ✨ NUEVA REGLA: Bloquear si no hay stock (Captura/Edición)
        db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'bloquear_pedido_sin_stock'", (pedido['negocio_id'],))
        config_bloqueo = db.fetchone()
        if config_bloqueo and config_bloqueo['valor'] == 'Si':
            detalles_nuevos = data.get('detalles', [])
            faltantes = []
            for item in detalles_nuevos:
                # ✨ NUEVO CÁLCULO: Disponible = Físico - Compromisos (Excepto este pedido que estamos editando)
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
                              AND p_inner.id != %s
                        ), 0) as comprometido
                    FROM productos pr
                    WHERE pr.id = %s
                """
                db.execute(query_stock, (pedido['negocio_id'], id, item['producto_id']))
                prod = db.fetchone()
                
                if not prod: continue
                
                stock_fisico = float(prod['stock'])
                comprometido = float(prod['comprometido'] or 0)
                disponible = stock_fisico - comprometido
                solicitado = float(item['cantidad'])
                
                if solicitado > disponible:
                     faltantes.append(f"{prod['nombre']} (Solicitado: {solicitado}, Disponible Real: {disponible})")
            
            if faltantes:
                return jsonify({
                    'error': 'Stock insuficiente (Considerando otros pedidos pendientes)',
                    'detalles': faltantes
                }), 409

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
            
            # ✨ Validar configuración de Stock Negativo específica para PEDIDOS
            db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'pedidos_stock_negativo'", (negocio_id,))
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

        # Caso B: Reversión de Stock (Si se anula o vuelve a pendiente)
        if nuevo_estado in ['anulado', 'pendiente'] and estado_anterior != nuevo_estado:
            # Caso 1: Si vuelve desde ENTREGADO, restauramos stock al depósito (se quitó del camión al entregar)
            if estado_anterior == 'entregado':
                db.execute("SELECT producto_id, cantidad FROM pedidos_detalle WHERE pedido_id = %s", (id,))
                detalles = db.fetchall()
                for item in detalles:
                    db.execute("UPDATE productos SET stock = stock + %s WHERE id = %s", (item['cantidad'], item['producto_id']))
            
            # Caso 2: Si vuelve desde PREPARADO/EN_CAMINO y ya estaba cargado en un camión (carga_confirmada),
            # debemos devolver el stock al depósito central y quitarlo del stock del camión.
            elif estado_anterior in ['preparado', 'en_camino']:
                db.execute("""
                    SELECT hr.vehiculo_id, hr.carga_confirmada 
                    FROM pedidos p 
                    JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id 
                    WHERE p.id = %s
                """, (id,))
                hr_data = db.fetchone()
                if hr_data and hr_data['carga_confirmada'] and hr_data['vehiculo_id']:
                    db.execute("SELECT producto_id, cantidad FROM pedidos_detalle WHERE pedido_id = %s", (id,))
                    items_cargados = db.fetchall()
                    for item in items_cargados:
                        # Devolver al depósito
                        db.execute("UPDATE productos SET stock = stock + %s WHERE id = %s", (item['cantidad'], item['producto_id']))
                        # Restar del camión
                        db.execute("UPDATE vehiculos_stock SET cantidad = cantidad - %s WHERE vehiculo_id = %s AND producto_id = %s", 
                                   (item['cantidad'], hr_data['vehiculo_id'], item['producto_id']))

        # 3. Lógica de Venta / Cuenta Corriente (Caso C: ENTREGADO)
        if nuevo_estado == 'entregado' and estado_anterior != 'entregado':
            # A. Obtener estado de la Hoja de Ruta
            db.execute("""
                SELECT hr.id, hr.estado, hr.vehiculo_id 
                FROM pedidos p 
                LEFT JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id 
                WHERE p.id = %s
            """, (id,))
            hr_info = db.fetchone()
            
            # --- VALIDACIÓN DE REGLA DE NEGOCIO ---
            # Si la hoja está ACTIVA, no permitimos la entrega manual administrativa. 
            # Deben usar la App del Chofer (Flujo Normal).
            if hr_info and hr_info['estado'] == 'activa':
                return jsonify({
                    'error': 'El pedido pertenece a una Hoja de Ruta ACTIVA. Debe ser entregado desde la App del Chofer siguiendo el flujo normal.'
                }), 400

            # ✨ REGLA CRÍTICA: La entrega manual desde el panel administrativo solo se permite para
            # pedidos "huérfanos" (HR Finalizada). En este caso NO tocamos nada de dinero ni stock.
            if hr_info and hr_info['estado'] == 'finalizada':
                pass # Solo saltamos el resto de la lógica de negocio y permitimos solo el cambio de estado (final de función)
            else:
                # Si llegamos aquí sin HR o con HR en borrador, por seguridad bloqueamos.
                # El usuario indicó que solo aplica para HRs Finalizadas.
                return jsonify({
                    'error': 'La entrega administrativa solo está permitida para pedidos de Hojas de Ruta ya FINALIZADAS (Limpieza de pedidos huérfanos).'
                }), 400

        # 4. Lógica de Reversión (Si sale de entregado)

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
        db.execute("UPDATE pedidos SET estado = %s, fecha_estado = %s WHERE id = %s", (nuevo_estado, datetime.datetime.now(), id))
        
        g.db_conn.commit()
        return jsonify({'message': f'Estado actualizado a {nuevo_estado} con éxito'})

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/pedidos/<int:id>/historial', methods=['GET'])
@token_required
def get_pedido_historial(current_user, id):
    db = get_db()
    db.execute("""
        SELECT h.id, h.pedido_id, h.negocio_id, h.usuario_id, h.fecha, h.datos_anteriores, h.motivo, u.nombre as usuario_nombre
        FROM pedidos_historial h
        JOIN usuarios u ON h.usuario_id = u.id
        WHERE h.pedido_id = %s
        ORDER BY h.fecha DESC
    """, (id,))
    historial = db.fetchall()
    
    # Formatear para JSON
    resultado = []
    for h in historial:
        item = dict(h)
        if item.get('fecha'):
            item['fecha'] = item['fecha'].isoformat()
        resultado.append(item)
        
    return jsonify(resultado)
