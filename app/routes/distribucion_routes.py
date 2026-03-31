from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('distribucion', __name__)

# --- VENDEDORES ---

@bp.route('/negocios/<int:negocio_id>/vendedores', methods=['GET'])
@token_required
def get_vendedores(current_user, negocio_id):
    db = get_db()
    db.execute(
        """
        SELECT v.*, e.nombre as nombre_empleado, e.apellido as apellido_empleado 
        FROM vendedores v
        LEFT JOIN empleados e ON v.empleado_id = e.id
        WHERE v.negocio_id = %s 
        ORDER BY v.nombre
        """,
        (negocio_id,)
    )
    vendedores = db.fetchall()
    return jsonify([dict(row) for row in vendedores])


# --- ZONAS ---

@bp.route('/negocios/<int:negocio_id>/zonas', methods=['GET'])
@token_required
def get_zonas(current_user, negocio_id):
    db = get_db()
    db.execute("""
        SELECT z.*, COUNT(c.id) AS total_clientes
        FROM zonas z
        LEFT JOIN clientes c ON c.zona_id = z.id
        WHERE z.negocio_id = %s
        GROUP BY z.id
        ORDER BY z.nombre
    """, (negocio_id,))
    return jsonify([dict(row) for row in db.fetchall()])


@bp.route('/negocios/<int:negocio_id>/zonas', methods=['POST'])
@token_required
def create_zona(current_user, negocio_id):
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    if not nombre:
        return jsonify({'error': 'El nombre es requerido'}), 400
    db = get_db()
    try:
        db.execute(
            "INSERT INTO zonas (negocio_id, nombre, color, poligono_geografico, descripcion) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, nombre, data.get('color', '#3388ff'),
             data.get('poligono_geografico'), data.get('descripcion'))
        )
        zona_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': zona_id, 'message': 'Zona creada con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/zonas/<int:zona_id>', methods=['PUT'])
@token_required
def update_zona(current_user, zona_id):
    data = request.get_json()
    db = get_db()
    try:
        db.execute("""
            UPDATE zonas
            SET nombre = %s, color = %s, poligono_geografico = %s, descripcion = %s
            WHERE id = %s
        """, (data.get('nombre'), data.get('color', '#3388ff'),
               data.get('poligono_geografico'), data.get('descripcion'), zona_id))
        g.db_conn.commit()
        return jsonify({'message': 'Zona actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/zonas/<int:zona_id>', methods=['DELETE'])
@token_required
def delete_zona(current_user, zona_id):
    db = get_db()
    try:
        # Desasociar clientes antes de borrar
        db.execute("UPDATE clientes SET zona_id = NULL WHERE zona_id = %s", (zona_id,))
        db.execute("UPDATE vendedores SET zona_id = NULL WHERE zona_id = %s", (zona_id,))
        db.execute("DELETE FROM zonas WHERE id = %s", (zona_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Zona eliminada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/zonas/<int:zona_id>/clientes', methods=['GET'])
@token_required
def get_clientes_por_zona(current_user, negocio_id, zona_id):
    db = get_db()
    db.execute("""
        SELECT id, nombre, direccion, dni FROM clientes
        WHERE negocio_id = %s AND zona_id = %s
        ORDER BY nombre
    """, (negocio_id, zona_id))
    return jsonify([dict(row) for row in db.fetchall()])


@bp.route('/negocios/<int:negocio_id>/vendedores', methods=['POST'])
@token_required
def create_vendedor(current_user, negocio_id):
    from app.extensions import bcrypt
    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')
    password = data.get('password')
    
    if not nombre:
        return jsonify({'error': 'Nombre es requerido'}), 400
        
    db = get_db()
    try:
        # 1. Crear Vendedor
        db.execute(
            "INSERT INTO vendedores (negocio_id, nombre, telefono, email, activo, zona_geografica, color, especialidad_resto) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, nombre, data.get('telefono'), email, data.get('activo', True), data.get('zona_geografica'), data.get('color'), data.get('especialidad_resto', 'mozo'))
        )
        vendedor_id = db.fetchone()['id']

        # 2. Crear Acceso (Usuario) si hay password y email
        if password and email:
            # Verificar si ya existe usuario con ese email
            db.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            user_existente = db.fetchone()

            if not user_existente:
                hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
                db.execute(
                    "INSERT INTO usuarios (nombre, email, password, rol, activo) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (nombre, email, hashed_pw, 'vendedor', data.get('activo', True))
                )
                nuevo_user_id = db.fetchone()['id']
                
                # Vincular usuario al negocio
                db.execute(
                    "INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)",
                    (nuevo_user_id, negocio_id)
                )

        g.db_conn.commit()
        return jsonify({'id': vendedor_id, 'message': 'Vendedor creado con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/vendedores/<int:id>', methods=['PUT'])
@token_required
def update_vendedor(current_user, id):
    from app.extensions import bcrypt
    data = request.get_json()
    db = get_db()
    
    nuevo_nombre = data['nombre']
    nuevo_email = data.get('email')
    nueva_password = data.get('password')
    activo = data.get('activo', True)

    try:
        # 1. Obtener email anterior para rastrear al usuario
        db.execute("SELECT email, negocio_id FROM vendedores WHERE id = %s", (id,))
        vendedor_actual = db.fetchone()
        if not vendedor_actual:
            return jsonify({'error': 'Vendedor no encontrado'}), 404
            
        old_email = vendedor_actual['email']
        negocio_id = vendedor_actual['negocio_id']

        # 2. Actualizar Vendedor
        db.execute(
            """UPDATE vendedores SET nombre=%s, telefono=%s, email=%s, activo=%s, zona_geografica=%s, color=%s, especialidad_resto=%s WHERE id=%s""",
            (nuevo_nombre, data.get('telefono'), nuevo_email, activo, data.get('zona_geografica'), data.get('color'), data.get('especialidad_resto'), id)
        )

        # 3. Sincronizar con Usuarios
        # Buscamos al usuario por el email (el que tenía antes o el nuevo)
        email_to_search = old_email or nuevo_email
        if email_to_search:
            db.execute("SELECT id FROM usuarios WHERE email = %s", (email_to_search,))
            user_row = db.fetchone()

            if user_row:
                user_id = user_row['id']
                # Actualizar datos básicos
                db.execute(
                    "UPDATE usuarios SET nombre=%s, email=%s, activo=%s WHERE id=%s",
                    (nuevo_nombre, nuevo_email, activo, user_id)
                )
                # Actualizar password si se envió una nueva
                if nueva_password:
                    hashed_pw = bcrypt.generate_password_hash(nueva_password).decode('utf-8')
                    db.execute("UPDATE usuarios SET password=%s WHERE id=%s", (hashed_pw, user_id))
            
            elif nueva_password and nuevo_email:
                # Si no existía pero ahora se provee password, crearlo
                hashed_pw = bcrypt.generate_password_hash(nueva_password).decode('utf-8')
                db.execute(
                    "INSERT INTO usuarios (nombre, email, password, rol, activo) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (nuevo_nombre, nuevo_email, hashed_pw, 'vendedor', activo)
                )
                nuevo_user_id = db.fetchone()['id']
                db.execute(
                    "INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)",
                    (nuevo_user_id, negocio_id)
                )

        g.db_conn.commit()
        return jsonify({'message': 'Vendedor y acceso actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- HOJA DE RUTA ---

@bp.route('/negocios/<int:negocio_id>/hoja_ruta', methods=['GET'])
@token_required
def get_hojas_ruta(current_user, negocio_id):
    # Filtros opcionales: fecha, vendedor, limit, offset
    fecha = request.args.get('fecha')
    vendedor_id = request.args.get('vendedor_id')
    limit = request.args.get('limit', type=int)
    offset = request.args.get('offset', type=int, default=0)
    
    # ✨ LOGICA DE PERMISOS DE VENDEDOR
    if current_user['rol'] == 'vendedor':
        # El vendedor SOLO puede ver sus propias rutas
        if not current_user.get('vendedor_id'):
            return jsonify({'error': 'Usuario vendedor sin ID de vendedor asignado'}), 403
        vendedor_id = current_user['vendedor_id']
    
    query = """
        SELECT 
            hr.id, 
            TO_CHAR(hr.fecha, 'YYYY-MM-DD') as fecha, 
            hr.estado, 
            hr.vendedor_id, 
            v.nombre as vendedor_nombre,
            hr.chofer_id,
            hr.vehiculo_id,
            vh.patente as vehiculo_patente,
            (SELECT nombre || ' ' || apellido FROM empleados WHERE id = hr.chofer_id) as chofer_nombre,
            (SELECT COUNT(*) FROM hoja_ruta_items WHERE hoja_ruta_id = hr.id) as cant_clientes,
            (SELECT COUNT(*) FROM pedidos WHERE hoja_ruta_id = hr.id AND estado != 'anulado') as cant_pedidos,
            (SELECT COALESCE(SUM(total), 0) FROM pedidos WHERE hoja_ruta_id = hr.id AND estado != 'anulado') as total_pedidos,
            (SELECT COUNT(*) FROM pedidos WHERE hoja_ruta_id = hr.id AND estado = 'entregado') as cant_entregados
        FROM hoja_ruta hr
        JOIN vendedores v ON hr.vendedor_id = v.id
        LEFT JOIN vehiculos vh ON hr.vehiculo_id = vh.id
        WHERE hr.negocio_id = %s
    """
    params = [negocio_id]
    
    if fecha:
        query += " AND hr.fecha = %s"
        params.append(fecha)
    if vendedor_id:
        query += " AND hr.vendedor_id = %s"
        params.append(vendedor_id)
        
    query += " ORDER BY hr.fecha DESC, hr.id DESC"
    
    if limit:
        query += " LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset)
    elif not fecha:
        # Si no hay fecha, limitamos a 50 por defecto para velocidad
        query += " LIMIT 50 OFFSET %s"
        params.append(offset)
        
    db = get_db()
    db.execute(query, tuple(params))
    rows = db.fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/negocios/<int:negocio_id>/hoja_ruta', methods=['POST'])
@token_required
def create_hoja_ruta(current_user, negocio_id):
    # ✨ RESTRICCIÓN: Solo Admin o Superadmin pueden crear rutas
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'error': 'No tiene permisos para crear Hojas de Ruta'}), 403

    data = request.get_json()
    vendedor_id = data.get('vendedor_id')
    fecha = data.get('fecha')
    items = data.get('items', []) # Lista de cliente_ids
    
    # if not vendedor_id or not fecha:
    #     return jsonify({'error': 'Faltan datos'}), 400
        
    db = get_db()
    try:
        # 1. Crear Cabecera
        db.execute(
            "INSERT INTO hoja_ruta (negocio_id, vendedor_id, vehiculo_id, chofer_id, fecha, estado, observaciones) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, vendedor_id, data.get('vehiculo_id'), data.get('chofer_id'), fecha, 'borrador', data.get('observaciones', ''))
        )
        hoja_id = db.fetchone()['id']
        
        # 2. Insertar Items
        for idx, item in enumerate(items):
            # item puede ser un ID o un objeto {cliente_id: 1, ...}
            cliente_id = item['cliente_id'] if isinstance(item, dict) else item
            
            db.execute(
                "INSERT INTO hoja_ruta_items (hoja_ruta_id, cliente_id, orden, visitado) VALUES (%s, %s, %s, %s)",
                (hoja_id, cliente_id, idx, False)
            )
            
        g.db_conn.commit()
        return jsonify({'id': hoja_id, 'message': 'Hoja de ruta creada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>', methods=['GET'])
@token_required
def get_hoja_ruta_detail(current_user, id):
    db = get_db()
    
    # Cabecera
    db.execute("""
        SELECT hr.id, hr.negocio_id, hr.vendedor_id, hr.vehiculo_id, hr.chofer_id,
               TO_CHAR(hr.fecha, 'YYYY-MM-DD') as fecha, hr.estado, hr.observaciones, 
               v.nombre as vendedor_nombre,
               vh.patente as vehiculo_patente, vh.modelo as vehiculo_modelo,
               vh.capacidad_kg, vh.capacidad_volumen_m3,
               (SELECT nombre || ' ' || apellido FROM empleados WHERE id = hr.chofer_id) as chofer_nombre,
                vh.latitud as vehiculo_lat, vh.longitud as vehiculo_lng, vh.ultima_actualizacion as vehiculo_gps_ts
        FROM hoja_ruta hr
        JOIN vendedores v ON hr.vendedor_id = v.id
        LEFT JOIN vehiculos vh ON hr.vehiculo_id = vh.id
        WHERE hr.id = %s
    """, (id,))
    cabecera = db.fetchone()
    
    if not cabecera:
        return jsonify({'error': 'No encontrado'}), 404

    # ✨ VERIFICACIÓN DE SEGURIDAD
    if current_user['rol'] == 'vendedor':
        if cabecera['vendedor_id'] != current_user.get('vendedor_id'):
            return jsonify({'error': 'No tiene permisos para ver esta hoja de ruta'}), 403

    # Cálculo de carga actual
    db.execute("""
        SELECT 
            COALESCE(SUM(pd.cantidad * pr.peso_kg), 0) as peso_actual,
            COALESCE(SUM(pd.cantidad * pr.volumen_m3), 0) as volumen_actual
        FROM pedidos p
        JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        JOIN productos pr ON pd.producto_id = pr.id
        WHERE p.hoja_ruta_id = %s AND p.estado != 'anulado'
    """, (id,))
    carga = db.fetchone()
        
    # Items con detección de ventas y pedidos
    db.execute("""
        SELECT hri.*, c.nombre as cliente_nombre, c.direccion as cliente_direccion, c.latitud, c.longitud,
               EXISTS (
                   SELECT 1 FROM pedidos ped
                   WHERE ped.cliente_id = hri.cliente_id 
                   AND ped.hoja_ruta_id = hri.hoja_ruta_id
                   AND ped.venta_id IS NOT NULL
               ) OR EXISTS (
                   SELECT 1 FROM presupuestos p 
                   WHERE p.cliente_id = hri.cliente_id 
                   AND DATE(p.fecha) = %s
                   AND p.anulado = FALSE
               ) as tiene_venta,
               EXISTS (
                   SELECT 1 FROM pedidos ped
                   WHERE ped.cliente_id = hri.cliente_id 
                   AND ped.hoja_ruta_id = hri.hoja_ruta_id
                   AND ped.estado != 'anulado'
                   AND ped.venta_id IS NULL
                               ) as tiene_pedido,
                (SELECT COUNT(*) FROM pedidos p 
                 WHERE p.cliente_id = hri.cliente_id 
                 AND p.hoja_ruta_id = hri.hoja_ruta_id 
                 AND p.estado != 'anulado'
                ) as total_pedidos_cliente
        FROM hoja_ruta_items hri
        JOIN clientes c ON hri.cliente_id = c.id
        WHERE hri.hoja_ruta_id = %s
        ORDER BY hri.orden ASC
    """, (cabecera['fecha'], id))
    items = db.fetchall()
    
    result = dict(cabecera)
    result['items'] = [dict(i) for i in items]
    result['carga_actual'] = {
        'peso_kg': float(carga['peso_actual']),
        'volumen_m3': float(carga['volumen_actual'])
    }
    
    return jsonify(result)

@bp.route('/hoja_ruta/<int:id>/duplicar', methods=['POST'])
@token_required
def duplicar_hoja_ruta(current_user, id):
    """Clona una hoja de ruta existente (cabecera + items) en estado borrador con fecha de hoy."""
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'error': 'No tiene permisos para duplicar Hojas de Ruta'}), 403

    db = get_db()
    try:
        # 1. Obtener la HR original
        db.execute("""
            SELECT negocio_id, vendedor_id, vehiculo_id, observaciones
            FROM hoja_ruta WHERE id = %s
        """, (id,))
        original = db.fetchone()
        if not original:
            return jsonify({'error': 'Hoja de ruta no encontrada'}), 404

        # 2. Crear nueva HR con fecha de hoy y estado borrador
        # ✨ REGLA: No duplicamos el vehiculo_id para obligar a asignarlo en la carga física
        from datetime import date
        hoy = date.today().isoformat()
        db.execute(
            "INSERT INTO hoja_ruta (negocio_id, vendedor_id, vehiculo_id, fecha, estado, observaciones) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (original['negocio_id'], original['vendedor_id'], None, hoy, 'borrador', original['observaciones'] or '')
        )
        nueva_id = db.fetchone()['id']

        # 3. Copiar items (solo cliente_id y orden, sin visitas ni pedidos)
        db.execute("""
            SELECT cliente_id, orden FROM hoja_ruta_items
            WHERE hoja_ruta_id = %s ORDER BY orden ASC
        """, (id,))
        items = db.fetchall()
        for item in items:
            db.execute(
                "INSERT INTO hoja_ruta_items (hoja_ruta_id, cliente_id, orden, visitado) VALUES (%s, %s, %s, FALSE)",
                (nueva_id, item['cliente_id'], item['orden'])
            )

        g.db_conn.commit()
        return jsonify({'id': nueva_id, 'message': 'Hoja de ruta duplicada correctamente'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/hoja_ruta/<int:id>', methods=['PUT'])
@token_required
def update_hoja_ruta(current_user, id):
    # ✨ RESTRICCIÓN: Solo Admin o Superadmin pueden editar la configuración de la ruta
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'error': 'No tiene permisos para modificar la Hoja de Ruta'}), 403

    data = request.get_json()
    vendedor_id = data.get('vendedor_id')
    fecha = data.get('fecha')
    items = data.get('items', []) # Lista de cliente_ids
    
    # if not vendedor_id or not fecha:
    #     return jsonify({'error': 'Faltan datos'}), 400
        
    db = get_db()
    try:
        # 1. Verificar estado
        db.execute("SELECT estado, vendedor_id, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha, observaciones FROM hoja_ruta WHERE id = %s", (id,))
        hr = db.fetchone()
        if not hr:
            return jsonify({'error': 'No encontrado'}), 404
        if hr['estado'] not in ['borrador', 'activa']:
            return jsonify({'error': 'Solo se pueden editar hojas en estado borrador o activa'}), 400
            
        # Tomar los valores nuevos o mantener los anteriores
        v_id = data.get('vendedor_id', hr['vendedor_id'])
        fec = data.get('fecha', hr['fecha'])
        obs = data.get('observaciones', hr['observaciones'])
        veh_id = data.get('vehiculo_id') if 'vehiculo_id' in data else None
        # Si vehiculo_id no viene en data, mantenemos el que estaba. Pero si viene como null/None, lo actualizamos.
        # En el caso de picking siempre vendrá.
        
        # 2. Actualizar Cabecera
        # The instruction provided a malformed block. Reconstructing based on intent to include chofer_id.
        # Assuming the intent is to update all fields if provided, otherwise keep existing.
        # The original code had an 'if vehiculo_id in data' block, which is now simplified.
        # ✨ Solo actualizamos vehiculo_id/chofer_id si vienen explícitamente en el payload.
        # Evitamos pisar con NULL si no fue enviado (lo que causaría inconsistencia con carga_confirmada).
        import psycopg2.extras
        fields = {
            'vendedor_id': data.get('vendedor_id', hr['vendedor_id']),
            'fecha': data.get('fecha', hr['fecha']),
            'observaciones': data.get('observaciones', hr['observaciones']),
        }
        if 'vehiculo_id' in data:
            fields['vehiculo_id'] = data['vehiculo_id']
        if 'chofer_id' in data:
            fields['chofer_id'] = data['chofer_id']

        set_clause = ', '.join(f'{k} = %s' for k in fields)
        db.execute(
            f"UPDATE hoja_ruta SET {set_clause} WHERE id = %s",
            list(fields.values()) + [id]
        )
        
        # 3. Reemplazar Items (SOLO si se proporcionan en la petición)
        if 'items' in data:
            db.execute("DELETE FROM hoja_ruta_items WHERE hoja_ruta_id = %s", (id,))
            for idx, item in enumerate(items):
                cliente_id = item['cliente_id'] if isinstance(item, dict) else item
                db.execute(
                    "INSERT INTO hoja_ruta_items (hoja_ruta_id, cliente_id, orden, visitado) VALUES (%s, %s, %s, %s)",
                    (id, cliente_id, idx, False)
                )
        
        g.db_conn.commit()
        return jsonify({'message': 'Hoja de ruta actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>/chofer', methods=['PUT'])
@token_required
def update_hoja_ruta_chofer(current_user, id):
    # ✨ Permisos: Admin/Superadmin
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'error': 'No tiene permisos para asignar chofer'}), 403

    data = request.get_json()
    chofer_id = data.get('chofer_id')
    
    db = get_db()
    try:
        # Se permite actualizar el chofer sin importar el estado de la hoja de ruta
        db.execute(
            "UPDATE hoja_ruta SET chofer_id = %s WHERE id = %s",
            (chofer_id, id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Chofer asignado correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>', methods=['DELETE'])
@token_required
def delete_hoja_ruta(current_user, id):
    db = get_db()
    
    # 1. Verificar si tiene pedidos asociados
    db.execute("SELECT COUNT(*) as cant FROM pedidos WHERE hoja_ruta_id = %s", (id,))
    if db.fetchone()['cant'] > 0:
        return jsonify({'error': 'No se puede eliminar una hoja de ruta que tiene pedidos asociados.'}), 400
        
    try:
        # 2. Borrar items de la hoja de ruta
        db.execute("DELETE FROM hoja_ruta_items WHERE hoja_ruta_id = %s", (id,))
        # 3. Borrar la cabecera
        db.execute("DELETE FROM hoja_ruta WHERE id = %s", (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Hoja de ruta eliminada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/hoja_ruta/<int:id>/estado', methods=['PUT'])
@token_required
def update_hoja_ruta_estado(current_user, id):
    data = request.get_json()
    nuevo_estado = data.get('estado')
    
    if nuevo_estado not in ['borrador', 'activa', 'finalizada']:
        return jsonify({'error': 'Estado inválido'}), 400
        
    db = get_db()
    try:
        # Update HR state
        db.execute("UPDATE hoja_ruta SET estado=%s WHERE id=%s", (nuevo_estado, id))
        
        # If transitioning to 'activa', update pedidos from 'preparado' to 'en_camino'
        if nuevo_estado == 'activa':
            db.execute("""
                UPDATE pedidos 
                SET estado = 'en_camino' 
                WHERE hoja_ruta_id = %s 
                AND estado = 'preparado'
            """, (id,))
        
        # If transitioning to 'finalizada', return remaining vehicle stock to warehouse
        if nuevo_estado == 'finalizada':
            db.execute("SELECT vehiculo_id, negocio_id FROM hoja_ruta WHERE id = %s", (id,))
            hr_info = db.fetchone()
            v_id = hr_info['vehiculo_id'] if hr_info else None

            if v_id:
                # ✨ EVITAR DEVOLUCIÓN DE STOCK SI HAY OTRAS RUTAS ACTIVAS O EN BORRADOR PARA ESTE VEHÍCULO
                # Esto soluciona el problema de "carga de inventario móvil" cuando un camión tiene varias rutas.
                db.execute("""
                    SELECT COUNT(*) as restantes 
                    FROM hoja_ruta 
                    WHERE vehiculo_id = %s 
                    AND estado IN ('borrador', 'activa') 
                    AND id != %s
                """, (v_id, id))
                cant_restantes = db.fetchone()['restantes']

                if cant_restantes > 0:
                    # No devolvemos nada aún, el stock sigue en el camión para las otras rutas
                    pass
                else:
                    # 1. Obtener todo el stock actual del camión
                    db.execute("SELECT producto_id, cantidad FROM vehiculos_stock WHERE vehiculo_id = %s", (v_id,))
                    stock_restante = db.fetchall()

                    for item in stock_restante:
                        p_id = item['producto_id']
                        cant = float(item['cantidad'])

                        if cant != 0:
                            # Obtener stock actual antes de actualizar para el log
                            db.execute("SELECT stock FROM productos WHERE id = %s", (p_id,))
                            stock_anterior = float(db.fetchone()['stock'])
                            stock_nuevo = stock_anterior + cant

                            # A. Devolver al Depósito Central (cant puede ser negativa si hubo sobreventa móvil)
                            db.execute("UPDATE productos SET stock = %s WHERE id = %s", (stock_nuevo, p_id))
                            
                            # Guardar en log de ajustes de inventario
                            db.execute("""
                                INSERT INTO inventario_ajustes (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia, motivo)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """, (p_id, current_user['id'], hr_info['negocio_id'], stock_anterior, stock_nuevo, cant, f"Retorno stock camión (Liquidación HR {id})"))
                        
                        # B. Limpiar el stock del camión para este producto
                        db.execute("DELETE FROM vehiculos_stock WHERE vehiculo_id = %s AND producto_id = %s", (v_id, p_id))

        g.db_conn.commit()
        return jsonify({'message': f'Estado actualizado a {nuevo_estado}'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>/resumen_liquidacion', methods=['GET'])
@token_required
def get_resumen_liquidacion(current_user, id):
    db = get_db()
    try:
        # 1. Obtener información de la Hoja de Ruta y validar seguridad
        db.execute("SELECT id, estado, TO_CHAR(fecha, 'YYYY-MM-DD') as fecha FROM hoja_ruta WHERE id = %s", (id,))
        hr = db.fetchone()
        if not hr:
            return jsonify({'error': 'Hoja de ruta no encontrada'}), 404
        
        # Filtro estricto: No permitir liquidar hojas en borrador
        if hr['estado'] == 'borrador':
            return jsonify({'error': 'La hoja de ruta está en estado borrador y no puede liquidarse.'}), 400

        # PILLAR 1 & 3: Total Vendido (Efectivo) y Diferencia por Precios
        # Implementamos la lógica de la "Fuente de Verdad" validada en SQL.
        # Cruzamos pedidos reales del día para los clientes de la ruta.
        sql_pilares_1_3 = """
            SELECT
                p.id as producto_id,
                p.nombre as descripcion_producto,
                SUM(pd.cantidad) as cantidad_vendida,
                pd.precio_unitario as precio_cargado_hr,
                p.precio_venta as precio_actual_sistema,
                (p.precio_venta - pd.precio_unitario) as diferencia_unitaria,
                SUM(pd.cantidad * (p.precio_venta - pd.precio_unitario)) as diferencia_total_item,
                SUM(pd.cantidad * pd.precio_unitario) as total_vendido_item
            FROM
                pedidos ped
            INNER JOIN
                pedidos_detalle pd ON ped.id = pd.pedido_id
            INNER JOIN
                productos p ON pd.producto_id = p.id
            WHERE
                ped.hoja_ruta_id = %s
                AND ped.estado = 'entregado'
            GROUP BY
                p.id, p.nombre, pd.precio_unitario, p.precio_venta
            ORDER BY
                p.nombre
        """
        db.execute(sql_pilares_1_3, (id,))
        detalles_venta = db.fetchall()

        # Pilar 1: Total Vendido (Rendición neta de caja/cuenta corriente)
        # Ajuste Crítico: Usar pedidos.total en lugar de suma de items para capturar descuentos manuales (Ej: 11x10)
        db.execute("""
            SELECT COALESCE(SUM(total), 0) as total_rendicion
            FROM pedidos 
            WHERE hoja_ruta_id = %s AND estado = 'entregado'
        """, (id,))
        total_vendido = float(db.fetchone()['total_rendicion'])
        
        total_diferencia_precios = sum(float(d['diferencia_total_item']) for d in detalles_venta)

        # PILLAR 2: Mercadería a Devolver (Stock físico)
        # Calculamos la sumatoria de Rebotes Parciales + Pedidos No Entregados
        sql_pillar_2 = """
            WITH rebotes AS (
                SELECT producto_id, SUM(cantidad) as cant
                FROM pedidos_rebotes
                WHERE hoja_ruta_id = %s
                GROUP BY producto_id
            ),
            no_entregados AS (
                SELECT pd.producto_id, SUM(pd.cantidad) as cant
                FROM pedidos p
                JOIN pedidos_detalle pd ON p.id = pd.pedido_id
                WHERE p.hoja_ruta_id = %s AND p.estado NOT IN ('entregado', 'anulado')
                GROUP BY pd.producto_id
            ),
            totales AS (
                SELECT producto_id, cant FROM rebotes
                UNION ALL
                SELECT producto_id, cant FROM no_entregados
            )
            SELECT 
                p.nombre as producto,
                SUM(t.cant) as cantidad_a_devolver
            FROM totales t
            JOIN productos p ON t.producto_id = p.id
            GROUP BY p.nombre
            HAVING SUM(t.cant) > 0
            ORDER BY p.nombre
        """
        db.execute(sql_pillar_2, (id, id))
        stock_devolver = db.fetchall()

        # Estadísticas de visitas y PEDIDOS (discriminados)
        db.execute("""
            SELECT 
                COUNT(*) as total_clientes,
                COUNT(*) FILTER (WHERE visitado = TRUE) as visitados
            FROM hoja_ruta_items 
            WHERE hoja_ruta_id = %s
        """, (id,))
        stats_visitas = db.fetchone()

        db.execute("""
            SELECT 
                COUNT(*) as total_pedidos,
                COUNT(*) FILTER (WHERE estado = 'entregado') as pedidos_entregados,
                COUNT(*) FILTER (WHERE estado NOT IN ('entregado', 'anulado')) as pedidos_pendientes
            FROM pedidos 
            WHERE hoja_ruta_id = %s AND estado != 'anulado'
        """, (id,))
        stats_pedidos = db.fetchone()

        # TOTAL ORIGINAL DE LA HOJA (Todos los pedidos asociados inicialmente)
        # BUGFIX: Sumamos los totales actuales + los rebotes, porque 'pedidos.total' se reduce al rebosar.
        db.execute("""
            SELECT (
                COALESCE(SUM(total), 0) + 
                COALESCE((SELECT SUM(prb.cantidad * pd.precio_unitario) 
                          FROM pedidos_rebotes prb
                          JOIN pedidos_detalle pd ON prb.pedido_id = pd.pedido_id AND prb.producto_id = pd.producto_id
                          WHERE prb.hoja_ruta_id = %s), 0)
            ) as total_original 
            FROM pedidos 
            WHERE hoja_ruta_id = %s AND estado != 'anulado'
        """, (id, id))
        total_original_hr = float(db.fetchone()['total_original'])

        # TOTAL PEDIDOS NO ENTREGADOS (Clientes no encontrados, rechazados totalmente, etc.)
        db.execute("""
            SELECT COALESCE(SUM(total), 0) as total_no_entregados 
            FROM pedidos 
            WHERE hoja_ruta_id = %s AND estado NOT IN ('entregado', 'anulado')
        """, (id,))
        total_no_entregados = float(db.fetchone()['total_no_entregados'])

        # TOTAL REBOTES (Rechazos parciales en pedidos que sí se entregaron)
        db.execute("""
            SELECT COALESCE(SUM(pr_reb.cantidad * pd.precio_unitario), 0) as total_rebotes
            FROM pedidos_rebotes pr_reb
            JOIN pedidos_detalle pd ON pr_reb.pedido_id = pd.pedido_id AND pr_reb.producto_id = pd.producto_id
            WHERE pr_reb.hoja_ruta_id = %s
        """, (id,))
        total_rebotes = float(db.fetchone()['total_rebotes'])

        # Restaurar 'productos' y 'rebotes' para compatibilidad con JS actual
        # 'productos' debe ser lo efectivamente entregado (usado en la tabla de liquidación)
        res_productos = []
        for d in detalles_venta:
            res_productos.append({
                'producto': d['descripcion_producto'],
                'cantidad_total': float(d['cantidad_vendida'])
            })

        # 'rebotes' para la tabla de rebotes
        db.execute("""
            SELECT 
                pr.nombre as producto,
                mr.descripcion as motivo,
                SUM(pr_reb.cantidad) as cantidad_total
            FROM pedidos_rebotes pr_reb
            JOIN productos pr ON pr_reb.producto_id = pr.id
            JOIN motivos_rebote mr ON pr_reb.motivo_rebote_id = mr.id
            WHERE pr_reb.hoja_ruta_id = %s
            GROUP BY pr.nombre, mr.descripcion
            ORDER BY pr.nombre ASC
        """, (id,))
        res_rebotes = [dict(r) for r in db.fetchall()]

        # DETALLE DE PEDIDOS NO ENTREGADOS (Para advertencia en UI)
        db.execute("""
            SELECT p.id, c.nombre as cliente, p.total, p.estado
            FROM pedidos p
            JOIN clientes c ON p.cliente_id = c.id
            WHERE p.hoja_ruta_id = %s AND p.estado NOT IN ('entregado', 'anulado')
        """, (id,))
        pedidos_no_entregados_detalle = [dict(p) for p in db.fetchall()]

        # ✨ NUEVO: Resumen de Cobros (Cómo se cobró, quién lo hizo y cuándo)
        # BUGFIX: Usamos hoja_ruta_id directamente en ventas para capturar pagos mixtos (Efectivo + MP)
        db.execute("""
            SELECT
                v.metodo_pago,
                COALESCE(SUM(v.total), 0) as total_metodo,
                COUNT(v.id) as cantidad_pedidos,
                u.nombre as cobrado_por,
                MAX(v.fecha) as ultima_fecha_cobro
            FROM ventas v
            JOIN usuarios u ON v.usuario_id = u.id
            WHERE v.hoja_ruta_id = %s AND v.estado != 'Anulada'
            GROUP BY v.metodo_pago, u.nombre
            ORDER BY total_metodo DESC
        """, (id,))
        resumen_cobros_rows = db.fetchall()
        resumen_cobros = [dict(r) for r in resumen_cobros_rows]

        # Fecha del primer y último cobro de la HR
        db.execute("""
            SELECT
                MIN(v.fecha) as primer_cobro,
                MAX(v.fecha) as ultimo_cobro,
                u.nombre as cobrado_por
            FROM pedidos p
            JOIN ventas v ON p.venta_id = v.id
            JOIN usuarios u ON v.usuario_id = u.id
            WHERE p.hoja_ruta_id = %s AND p.estado = 'entregado'
            GROUP BY u.nombre
            ORDER BY primer_cobro ASC
            LIMIT 1
        """, (id,))
        info_cobro = db.fetchone()
        

        return jsonify({
            'visitas': dict(stats_visitas),
            'pedidos_stats': dict(stats_pedidos),
            'pilares': {
                'total_vendido': total_vendido,
                'mercaderia_a_devolver': [dict(i) for i in stock_devolver],
                'diferencia_por_precios': total_diferencia_precios,
                'total_original': total_original_hr,
                'total_no_entregados': total_no_entregados,
                'total_rebotes': total_rebotes,
                'pedidos_pendientes': pedidos_no_entregados_detalle
            },
            'detalles_venta': [dict(d) for d in detalles_venta],
            'productos': res_productos,
            'rebotes': res_rebotes,
            'ventas': {
                'cantidad': len(detalles_venta),
                'total_moneda': total_vendido
            },
            'resumen_cobros': resumen_cobros,
            'info_cobro': dict(info_cobro) if info_cobro else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>/picking_list', methods=['GET'])
@token_required
def get_picking_list(current_user, id):
    db = get_db()
    try:
        # Get vehicle and driver info for this HR
        db.execute("""
            SELECT 
                hr.id,
                v.patente,
                v.modelo,
                v.capacidad_kg,
                v.capacidad_volumen_m3,
                vend.nombre as vendedor_nombre,
                (SELECT nombre || ' ' || apellido FROM empleados WHERE id = COALESCE(hr.chofer_id, v.chofer_default_id)) as chofer_nombre
            FROM hoja_ruta hr
            LEFT JOIN vehiculos v ON hr.vehiculo_id = v.id
            LEFT JOIN vendedores vend ON hr.vendedor_id = vend.id
            WHERE hr.id = %s
        """, (id,))
        vehicle_row = db.fetchone()
        vehicle_info = dict(vehicle_row) if vehicle_row else {}
        
        # Get products TOTALS (for picking from warehouse)
        db.execute("""
            SELECT 
                pr.nombre as producto,
                SUM(pd.cantidad) as cantidad_total
            FROM pedidos p
            JOIN pedidos_detalle pd ON p.id = pd.pedido_id
            JOIN productos pr ON pd.producto_id = pr.id
            WHERE p.hoja_ruta_id = %s AND p.estado IN ('pendiente', 'preparado', 'en_camino', 'entregado', 'visita_efectiva')
            GROUP BY pr.nombre
            ORDER BY pr.nombre ASC
        """, (id,))
        items = db.fetchall()
        
        # Get products BY CLIENT (for delivery)
        db.execute("""
            SELECT 
                c.nombre as cliente_nombre,
                c.direccion as cliente_direccion,
                p.id as pedido_id,
                hri.orden as orden_parada,
                pr.nombre as producto,
                pd.cantidad
            FROM pedidos p
            JOIN clientes c ON p.cliente_id = c.id
            JOIN pedidos_detalle pd ON p.id = pd.pedido_id
            JOIN productos pr ON pd.producto_id = pr.id
            LEFT JOIN hoja_ruta_items hri ON hri.hoja_ruta_id = p.hoja_ruta_id AND hri.cliente_id = p.cliente_id
            WHERE p.hoja_ruta_id = %s AND p.estado IN ('pendiente', 'preparado', 'en_camino', 'entregado', 'visita_efectiva')
            ORDER BY hri.orden ASC, c.nombre ASC, pr.nombre ASC
        """, (id,))
        items_by_client = db.fetchall()
        
        # Group by client and then BY ORDER
        clientes = {}
        for row in items_by_client:
            r = dict(row)
            cliente_key = r['cliente_nombre']
            pedido_id = r['pedido_id']
            
            if cliente_key not in clientes:
                clientes[cliente_key] = {
                    'nombre': r['cliente_nombre'],
                    'direccion': r['cliente_direccion'] or 'Sin dirección',
                    'orden': r['orden_parada'] if r['orden_parada'] is not None else 999,
                    'pedidos_dict': {} # Multi-order support
                }
            
            if pedido_id not in clientes[cliente_key]['pedidos_dict']:
                clientes[cliente_key]['pedidos_dict'][pedido_id] = []
            
            clientes[cliente_key]['pedidos_dict'][pedido_id].append({
                'producto': r['producto'],
                'cantidad': float(r['cantidad'])
            })
        
        # Convert to list and sort by orden
        clientes_list = []
        for c_key, c_data in clientes.items():
            # Convert dict of orders to a structured list for the PDF
            pedidos_list = []
            for p_id, p_items in c_data['pedidos_dict'].items():
                pedidos_list.append({
                    'id': p_id,
                    'productos': p_items
                })
            
            # Keep a flat "productos" list for backwards compatibility if needed
            flat_productos = []
            prod_sums = {}
            for p_id, p_items in c_data['pedidos_dict'].items():
                for item in p_items:
                    p_name = item['producto']
                    prod_sums[p_name] = prod_sums.get(p_name, 0) + item['cantidad']
            
            for p_name, p_cant in prod_sums.items():
                flat_productos.append({'producto': p_name, 'cantidad': p_cant})

            clientes_list.append({
                'nombre': c_data['nombre'],
                'direccion': c_data['direccion'],
                'orden': c_data['orden'],
                'productos': flat_productos, # Consolidado (BC)
                'pedidos': pedidos_list      # Discriminado (New)
            })
            
        clientes_list.sort(key=lambda x: x['orden'])
        
        return jsonify({
            'productos': [dict(i) for i in items],
            'vehiculo': vehicle_info,
            'clientes': clientes_list
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/hoja_ruta/<int:id>/item/<int:item_id>', methods=['PUT'])
@token_required
def update_hoja_ruta_item(current_user, id, item_id):
    data = request.get_json()
    visitado = data.get('visitado')
    obs = data.get('observaciones')
    
    db = get_db()
    try:
        # Si visitado es True, guardamos la fecha actual. Si es False, la limpiamos.
        # Si visitado es null (solo se actualizan observaciones), no tocamos la fecha.
        if visitado is True:
            db.execute(
                "UPDATE hoja_ruta_items SET visitado=%s, observaciones=%s, fecha_visita=CURRENT_TIMESTAMP WHERE id=%s",
                (visitado, obs, item_id)
            )
        elif visitado is False:
            # ✨ Lógica de reversión de entregas:
            db.execute("SELECT cliente_id, hoja_ruta_id FROM hoja_ruta_items WHERE id = %s", (item_id,))
            hr_item = db.fetchone()
            if hr_item:
                cliente_id = hr_item['cliente_id']
                hr_id = hr_item['hoja_ruta_id']
                
                # Buscar pedidos entregados en esta parada
                db.execute("SELECT id, venta_id FROM pedidos WHERE hoja_ruta_id = %s AND cliente_id = %s AND estado = 'entregado'", (hr_id, cliente_id))
                pedidos = db.fetchall()
                for p in pedidos:
                    if p['venta_id']:
                         # Ya fue cobrado, no podemos deshacer
                         return jsonify({'error': 'No se puede deshacer la visita porque el pedido ya fue cobrado por el administrador.'}), 400
                         
                    p_id = p['id']
                    
                    # 1. Recuperar cantidad entregada (para devolver stock al camión)
                    db.execute("SELECT producto_id, cantidad FROM pedidos_detalle WHERE pedido_id = %s", (p_id,))
                    detalles_entregados = db.fetchall()
                    
                    db.execute("SELECT vehiculo_id FROM hoja_ruta WHERE id = %s", (hr_id,))
                    hr_info = db.fetchone()
                    v_id = hr_info['vehiculo_id'] if hr_info else None
                    if v_id:
                         for d in detalles_entregados:
                              if float(d['cantidad']) > 0:
                                   db.execute("""
                                       UPDATE vehiculos_stock SET cantidad = cantidad + %s WHERE vehiculo_id = %s AND producto_id = %s
                                   """, (d['cantidad'], v_id, d['producto_id']))
                                   
                    # 2. Restaurar cantidades originales en pedidos_detalle sumando los rebotes
                    db.execute("SELECT producto_id, cantidad FROM pedidos_rebotes WHERE pedido_id = %s", (p_id,))
                    rebotes = db.fetchall()
                    for r in rebotes:
                        db.execute("""
                            UPDATE pedidos_detalle SET cantidad = cantidad + %s WHERE pedido_id = %s AND producto_id = %s
                        """, (r['cantidad'], p_id, r['producto_id']))
                        # Restaurar subtotal (cantidad * precio_unitario - bonificacion)
                        # Nota: En rebotes se perdió la nocion de bonif, pero asumimos precios estándar y sin bonif para simplificar
                        db.execute("""
                            UPDATE pedidos_detalle SET subtotal = GREATEST(0, (cantidad - bonificacion) * precio_unitario) WHERE pedido_id = %s AND producto_id = %s
                        """, (p_id, r['producto_id']))
                    
                    # 3. Borrar rebotes
                    db.execute("DELETE FROM pedidos_rebotes WHERE pedido_id = %s", (p_id,))
                    
                    # 4. Volver a en_camino y recalcular total
                    db.execute("""
                        UPDATE pedidos SET estado = 'en_camino', total = (SELECT COALESCE(sum(subtotal), 0) FROM pedidos_detalle WHERE pedido_id = %s) WHERE id = %s
                    """, (p_id, p_id))

            db.execute(
                "UPDATE hoja_ruta_items SET visitado=%s, observaciones=%s, fecha_visita=NULL WHERE id=%s",
                (visitado, obs, item_id)
            )
        else: # Solo observaciones
            db.execute(
                "UPDATE hoja_ruta_items SET observaciones=%s WHERE id=%s",
                (obs, item_id)
            )
        g.db_conn.commit()
        return jsonify({'message': 'Item actualizado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos/carga/asignar', methods=['POST'])
@token_required
def asignar_carga_vehiculo(current_user):
    data = request.get_json()
    vehiculo_id = data.get('vehiculo_id')
    hoja_ruta_ids = data.get('hoja_ruta_ids', [])
    
    if not vehiculo_id or not hoja_ruta_ids:
        return jsonify({'error': 'Falta vehiculo_id o ids de hojas de ruta'}), 400
        
    db = get_db()
    try:
        # 1. Obtener Capacidad del Vehículo y Estado de las Rutas
        db.execute("SELECT capacidad_kg, capacidad_volumen_m3, modelo, patente FROM vehiculos WHERE id = %s", (vehiculo_id,))
        vehiculo = db.fetchone()
        if not vehiculo:
            return jsonify({'error': 'Vehículo no encontrado'}), 404
            
        # ✨ Validar si alguna de las rutas ya fue cargada para evitar doble descuento de stock.
        # SOLO bloqueamos si ya tiene vehículo asignado Y carga confirmada.
        # Si carga_confirmada=TRUE pero vehiculo_id=NULL (datos inconsistentes), permitimos re-asignar.
        db.execute(
            "SELECT id FROM hoja_ruta WHERE id = ANY(%s) AND carga_confirmada = TRUE AND vehiculo_id IS NOT NULL",
            (hoja_ruta_ids,)
        )
        ya_cargadas = db.fetchall()
        if ya_cargadas:
            ids_str = ", ".join([str(r['id']) for r in ya_cargadas])
            return jsonify({'error': f'Las Hojas de Ruta {ids_str} ya han sido confirmadas como cargadas anteriormente.'}), 409

        # Si hay rutas con carga_confirmada=TRUE pero vehiculo_id=NULL, reseteamos el flag para poder re-asignar
        db.execute(
            "UPDATE hoja_ruta SET carga_confirmada = FALSE WHERE id = ANY(%s) AND carga_confirmada = TRUE AND vehiculo_id IS NULL",
            (hoja_ruta_ids,)
        )

        cap_kg = float(vehiculo['capacidad_kg'] or 0)
        cap_m3 = float(vehiculo['capacidad_volumen_m3'] or 0)
        
        # 2. Calcular Peso y Volumen Total de las Hojas de Ruta
        # Sumamos todos los pedidos (pendientes/preparados) de esas rutas
        query_calc = """
            SELECT 
                COALESCE(SUM(pd.cantidad * pr.peso_kg), 0) as total_peso,
                COALESCE(SUM(pd.cantidad * pr.volumen_m3), 0) as total_volumen
            FROM pedidos p
            JOIN pedidos_detalle pd ON p.id = pd.pedido_id
            JOIN productos pr ON pd.producto_id = pr.id
            WHERE p.hoja_ruta_id = ANY(%s) 
            AND p.estado IN ('pendiente', 'preparado') 
        """
        # Postgres requiere array literal para ANY: '{1,2,3}'
        # Pasamos lista directo, psycopg2 suele adaptarlo.
        db.execute(query_calc, (hoja_ruta_ids,))
        totales = db.fetchone()
        
        peso_req = float(totales['total_peso'])
        vol_req = float(totales['total_volumen'])
        
        # 3. Validar Capacidad (Si el vehículo tiene limites definidos > 0)
        errores = []
        if cap_kg > 0 and peso_req > cap_kg:
            errores.append(f"Exceso de Peso: {peso_req}kg > {cap_kg}kg")
        if cap_m3 > 0 and vol_req > cap_m3:
            errores.append(f"Exceso de Volumen: {vol_req}m3 > {cap_m3}m3")
            
        if errores:
             return jsonify({
                 'error': 'Capacidad excedida', 
                 'detalles': errores,
                 'requerido': {'kg': peso_req, 'm3': vol_req},
                 'disponible': {'kg': cap_kg, 'm3': cap_m3}
             }), 409
             
        # 4. Asignar Vehículo y Marcar Carga como Confirmada
        db.execute(
            "UPDATE hoja_ruta SET vehiculo_id = %s, carga_confirmada = TRUE WHERE id = ANY(%s)",
            (vehiculo_id, hoja_ruta_ids)
        )

        # 5. LÓGICA DE STOCK MÓVIL: Mover del Depósito al Camión
        # Traemos el detalle consolidado de productos en estas rutas
        query_items = """
            SELECT pd.producto_id, SUM(pd.cantidad) as total_cantidad
            FROM pedidos p
            JOIN pedidos_detalle pd ON p.id = pd.pedido_id
            WHERE p.hoja_ruta_id = ANY(%s) 
            AND p.estado IN ('pendiente', 'preparado')
            GROUP BY pd.producto_id
        """
        db.execute(query_items, (hoja_ruta_ids,))
        items_a_mover = db.fetchall()

        # Obtener negocio_id (asumimos que todas las HR son del mismo negocio)
        db.execute("SELECT negocio_id FROM hoja_ruta WHERE id = %s", (hoja_ruta_ids[0],))
        negocio_id = db.fetchone()['negocio_id']

        # ✨ VALIDACIÓN DE STOCK ANTES DE MOVER AL CAMIÓN
        db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'pedidos_stock_negativo'", (negocio_id,))
        config_row = db.fetchone()
        permitir_negativo = config_row and config_row['valor'] == 'Si'

        if not permitir_negativo:
            faltantes = []
            for item in items_a_mover:
                p_id = item['producto_id']
                cant_requerida = float(item['total_cantidad'])
                
                db.execute("SELECT stock, nombre FROM productos WHERE id = %s", (p_id,))
                prod = db.fetchone()
                
                if not prod or float(prod['stock']) < cant_requerida:
                    stock_actual = float(prod['stock']) if prod else 0
                    faltantes.append(f"{prod['nombre'] if prod else 'ID ' + str(p_id)} (Faltan: {cant_requerida - stock_actual} u.)")
            
            if faltantes:
                return jsonify({
                    'error': 'Stock insuficiente en depósito para cargar el vehículo',
                    'detalles': faltantes
                }), 409

        for item in items_a_mover:
            p_id = item['producto_id']
            cant = float(item['total_cantidad'])

            # A. Restar del Depósito Central
            db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (cant, p_id))

            # B. Sumar al Camión (UPSERT)
            db.execute("""
                INSERT INTO vehiculos_stock (vehiculo_id, producto_id, negocio_id, cantidad)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (vehiculo_id, producto_id) 
                DO UPDATE SET cantidad = vehiculos_stock.cantidad + EXCLUDED.cantidad, 
                              last_updated = CURRENT_TIMESTAMP
            """, (vehiculo_id, p_id, negocio_id, cant))
        
        # C. Pasar pedidos de 'pendiente' a 'preparado' automáticamente al confirmar la carga
        db.execute("""
            UPDATE pedidos 
            SET estado = 'preparado' 
            WHERE hoja_ruta_id = ANY(%s) AND estado = 'pendiente'
        """, (hoja_ruta_ids,))

        g.db_conn.commit()
        return jsonify({
            'message': f'Carga asignada correctamente a {vehiculo["modelo"]} ({vehiculo["patente"]})',
            'peso_total': peso_req,
            'volumen_total': vol_req,
            'productos_movidos': len(items_a_mover)
        })
        
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos/carga/hojas_ruta_disponibles', methods=['GET'])
@token_required
def get_hojas_ruta_disponibles_carga(current_user):
    negocio_id = request.args.get('negocio_id')
    db = get_db()
    
    # Buscamos hojas de ruta que:
    # 1. Sean del negocio
    # 2. Tengan estado 'borrador' o 'activa' (no finalizada)
    # 3. (Opcional) Tengan pedidos preparados? Por ahora traemos todas las activas recientes
    # Traemos también la suma de peso/volumen para mostrar en el front
    
    query = """
        SELECT 
            hr.id, 
            TO_CHAR(hr.fecha, 'YYYY-MM-DD') as fecha, 
            hr.estado, 
            v.nombre as vendedor_nombre,
            vh.modelo as vehiculo_asignado,
            COUNT(p.id) as cantidad_pedidos,
            COALESCE(SUM(pd.cantidad * pr.peso_kg), 0) as peso_kg,
            COALESCE(SUM(pd.cantidad * pr.volumen_m3), 0) as volumen_m3
        FROM hoja_ruta hr
        JOIN vendedores v ON hr.vendedor_id = v.id
        LEFT JOIN vehiculos vh ON hr.vehiculo_id = vh.id
        LEFT JOIN pedidos p ON hr.id = p.hoja_ruta_id AND p.estado IN ('pendiente', 'preparado')
        LEFT JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        LEFT JOIN productos pr ON pd.producto_id = pr.id
        WHERE hr.negocio_id = %s 
        AND hr.estado IN ('borrador', 'activa')
        GROUP BY hr.id, hr.fecha, hr.estado, v.nombre, vh.modelo
        ORDER BY hr.fecha DESC
    """
    
    
    db.execute(query, (negocio_id,))
    rows = db.fetchall()
    
    results = []
    for row in rows:
        r = dict(row)
        r['peso_kg'] = float(r['peso_kg'])
        r['volumen_m3'] = float(r['volumen_m3'])
        results.append(r)
        
    return jsonify(results)

@bp.route('/pedidos/<int:pedido_id>/entregar', methods=['POST'])
@token_required
def entregar_pedido(current_user, pedido_id):
    data = request.get_json()
    metodo_pago = data.get('metodo_pago') # 'Efectivo', 'Mercado Pago', 'Cuenta Corriente', etc.
    db = get_db()
    
    try:
        # 1. Obtener Pedido y Validar Estado
        db.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,))
        pedido = db.fetchone()
        
        if not pedido:
            return jsonify({'error': 'Pedido no encontrado'}), 404
            
        if pedido['estado'] not in ['en_camino', 'preparado', 'pendiente', 'entregado']:
            return jsonify({'error': f"El pedido no está en estado válido para esta acción (Estado actual: {pedido['estado']})"}), 400
            
        negocio_id = pedido['negocio_id']
        cliente_id = pedido['cliente_id']
        
        solo_bajada = data.get('solo_bajada') is True
        solo_cobro = data.get('solo_cobro') is True

        if solo_cobro and pedido['estado'] != 'entregado':
            return jsonify({'error': 'Solo se puede registrar el cobro si el pedido ya fue entregado (bajada confirmada).'}), 400

        # Si el pedido ya está cobrado (tiene venta_id), no permitir volver a cobrar
        if pedido.get('venta_id'):
             return jsonify({'error': 'Este pedido ya fue cobrado (tiene venta registrada)'}), 400

        # 2. Verificar Caja Abierta (Solo obligatorio para registrar venta / cobrar)
        sesion_abierta = None
        if not solo_bajada:
            db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
            sesion_abierta = db.fetchone()
            if not sesion_abierta:
                return jsonify({'error': 'La caja está cerrada. Debe abrir la caja para cobrar pedidos.'}), 409
            
        # 3. Obtener Detalles del Pedido
        db.execute("""
            SELECT pd.*, pr.nombre
            FROM pedidos_detalle pd
            JOIN productos pr ON pd.producto_id = pr.id
            WHERE pd.pedido_id = %s
        """, (pedido_id,))
        detalles_originales = db.fetchall()
        
        if not detalles_originales:
             # Caso raro: Pedido sin items. Solo actualizamos estado.
             db.execute("UPDATE pedidos SET estado = 'entregado' WHERE id = %s", (pedido_id,))
             g.db_conn.commit()
             return jsonify({'message': 'Pedido entregado (sin items que cobrar)'})

        # --- LÓGICA DE RECHAZO PARCIAL Y BONIFICACIONES (Solo si NO es solo_cobro) ---
        items_ajustados = data.get('items_ajustados', {}) if not solo_cobro else {}
        bonificaciones_ajustadas = data.get('bonificaciones_ajustadas', {}) if not solo_cobro else {}
        motivos_ajustados = data.get('motivos_ajustados', {}) if not solo_cobro else {}
        hr_id = pedido.get('hoja_ruta_id') or pedido.get('ho_ruta_id')
        
        tiene_ajustes = len(items_ajustados) > 0 or len(bonificaciones_ajustadas) > 0
        total_devuelto = 0
        detalles_devolucion = []

        # 4. Calcular Total Venta (Basado en cantidades reales o ajustadas)
        total_venta_calculado = 0
        notificaciones = []

        # 5. Iterar Detalles (Ajustar cantidades, guardar rebotes, calcular nuevo total)
        from datetime import datetime
        descuento_general = float(data.get('descuento', 0))
        
        items_para_venta = []
        for item in detalles_originales:
            producto_id = str(item['producto_id'])
            cantidad_original = float(item['cantidad'])
            
            # Si solo estamos cobrando, la cantidad original grabada en pd ya es la final ajustada
            if solo_cobro:
                cantidad_entregada = cantidad_original
            else:
                cantidad_entregada = float(items_ajustados.get(producto_id, cantidad_original))
            
            # Si hubo rechazo parcial (y no estamos solo cobrando)
            if not solo_cobro and cantidad_entregada < cantidad_original:
                cantidad_rechazada = cantidad_original - cantidad_entregada
                
                motivo_id = motivos_ajustados.get(producto_id)
                if motivo_id and hr_id:
                    db.execute("""
                        INSERT INTO pedidos_rebotes (negocio_id, pedido_id, hoja_ruta_id, producto_id, cantidad, motivo_rebote_id)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (negocio_id, pedido_id, hr_id, item['producto_id'], cantidad_rechazada, motivo_id))

                precio_u = float(item['precio_unitario'])
                subtotal_rechazo = cantidad_rechazada * precio_u
                total_devuelto += subtotal_rechazo
                detalles_devolucion.append({
                    'producto_id': item['producto_id'],
                    'cantidad_devuelta': cantidad_rechazada,
                    'precio_unitario': precio_u,
                    'subtotal': subtotal_rechazo
                })
                
                # Actualizamos la cantidad en el pedido detalle para que cuando lo cobren después ya esté bien
                subt_nuevo = cantidad_entregada * precio_u
                db.execute("""
                    UPDATE pedidos_detalle SET cantidad = %s, subtotal = %s WHERE pedido_id = %s AND producto_id = %s
                """, (cantidad_entregada, subt_nuevo, pedido_id, item['producto_id']))

            precio_unitario = float(item['precio_unitario'])
            
            if solo_cobro:
                bonif_item = float(item.get('bonificacion', 0))
            else:
                bonif_item = float(bonificaciones_ajustadas.get(producto_id, item.get('bonificacion', 0)))
                # Actualizar bonificacion
                if bonif_item != float(item.get('bonificacion', 0)):
                     db.execute("UPDATE pedidos_detalle SET bonificacion = %s WHERE pedido_id = %s AND producto_id = %s", 
                                (bonif_item, pedido_id, item['producto_id']))

            # La bonificación se aplica sobre la cantidad entregada
            subtotal_item = max(0, (cantidad_entregada - bonif_item) * precio_unitario)
            
            total_venta_calculado += subtotal_item
            items_para_venta.append({
                'item': item,
                'cantidad_entregada': cantidad_entregada,
                'subtotal': subtotal_item,
                'precio_unitario': precio_unitario,
                'bonif': bonif_item
            })

        total_final = max(0, total_venta_calculado - descuento_general)
        
        # Si NO es solo cobranza, actualizamos el total del pedido por los ajustes
        if not solo_cobro:
            db.execute("UPDATE pedidos SET total = %s WHERE id = %s", (total_final, pedido_id))

        # --- FLUJO DE COBRANZA (Venta) ---
        venta_id = None
        monto_cta_cte = 0
        
        # SI ES SOLO BAJADA (ENTREGA SIN COBRO), NO REGISTRAMOS VENTA
        if solo_bajada:
            metodo_pago = None # Evitar procesamiento de pagos
            
        if not solo_bajada and metodo_pago:
            # Registrar Venta(s)
            if metodo_pago == 'Mixto':
                monto_ef = float(data.get('monto_efectivo', 0))
                monto_mp = float(data.get('monto_mp', 0))
                monto_cta_cte = max(0, total_final - (monto_ef + monto_mp))
                
                # DETERMINAR MÉTODO PRINCIPAL PARA LOS DETALLES
                # Si hay efectivo, la venta principal es Efectivo. Si no hay pero hay MP, es MP. Si solo hay Cta Cte, es Cta Cte.
                metodo_principal = 'Efectivo' if monto_ef > 0 else ('Mercado Pago' if monto_mp > 0 else 'Cuenta Corriente')
                monto_principal = monto_ef if metodo_principal == 'Efectivo' else (monto_mp if metodo_principal == 'Mercado Pago' else monto_cta_cte)

                # 1. Venta Principal (Lleva los detalles para el stock/auditoría)
                db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                proximo_nro = db.fetchone()[0]
                db.execute(
                    'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
                    (negocio_id, cliente_id, current_user['id'], monto_principal, metodo_principal, datetime.now(), sesion_abierta['id'], descuento_general, pedido['vendedor_id'], hr_id, proximo_nro)
                )
                venta_id = db.fetchone()['id']
                
                # 2. Registrar Otras Partes como Ventas adicionales (sin detalles para no duplicar stock)
                if metodo_principal != 'Efectivo' and monto_ef > 0:
                    db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                    proximo_nro_sec = db.fetchone()[0]
                    db.execute(
                        'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                        (negocio_id, cliente_id, current_user['id'], monto_ef, 'Efectivo', datetime.now(), sesion_abierta['id'], 0, pedido['vendedor_id'], hr_id, proximo_nro_sec)
                    )
                
                if metodo_principal != 'Mercado Pago' and monto_mp > 0:
                    db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                    proximo_nro_sec = db.fetchone()[0]
                    db.execute(
                        'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                        (negocio_id, cliente_id, current_user['id'], monto_mp, 'Mercado Pago', datetime.now(), sesion_abierta['id'], 0, pedido['vendedor_id'], hr_id, proximo_nro_sec)
                    )

                if metodo_principal != 'Cuenta Corriente' and monto_cta_cte > 0:
                    db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                    proximo_nro_sec = db.fetchone()[0]
                    db.execute(
                        'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
                        (negocio_id, cliente_id, current_user['id'], monto_cta_cte, 'Cuenta Corriente', datetime.now(), sesion_abierta['id'], 0, pedido['vendedor_id'], hr_id, proximo_nro_sec)
                    )
                    v_cta_cte_id = db.fetchone()['id']
                    # Registrar Deuda en Cuenta Corriente
                    db.execute(
                        "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                        (cliente_id, f"Venta Mixta (Parte Cta Cte) - Pedido #{pedido_id}", monto_cta_cte, 0, datetime.now(), v_cta_cte_id)
                    )
                elif metodo_principal == 'Cuenta Corriente' and monto_cta_cte > 0:
                    # Si el principal es Cta Cte, ya tenemos la venta_id
                    db.execute(
                        "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                        (cliente_id, f"Venta Mixta (Principal Cta Cte) - Pedido #{pedido_id}", monto_cta_cte, 0, datetime.now(), venta_id)
                    )

            else:
                # Venta Normal (Único método)
                db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                proximo_nro = db.fetchone()[0]
                db.execute(
                    'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
                    (negocio_id, cliente_id, current_user['id'], total_final, metodo_pago, datetime.now(), sesion_abierta['id'], descuento_general, pedido['vendedor_id'], hr_id, proximo_nro)
                )
                venta_id = db.fetchone()['id']
                
                # Si el método es Cuenta Corriente, registrar en movimientos
                if metodo_pago == 'Cuenta Corriente':
                    db.execute(
                        "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                        (cliente_id, f"Venta - Pedido #{pedido_id}", total_final, 0, datetime.now(), venta_id)
                    )

            # Registrar Detalles de Venta (Solo a la venta principal para no triplicar stock/items)
            for p_venta in items_para_venta:
                # Persistir nombre para historial
                db.execute('SELECT nombre FROM productos WHERE id = %s', (p_venta['item']['producto_id'],))
                pn_res = db.fetchone()
                p_nom = pn_res['nombre'] if pn_res else "Producto"

                db.execute('INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                           (venta_id, p_venta['item']['producto_id'], p_venta['cantidad_entregada'], p_venta['precio_unitario'], p_venta['subtotal'], p_venta['bonif'], p_nom))

        # --- FLUJO DE STOCK Y REBOTES (Se hace en bajada, NO en solo_cobro) ---
        if not solo_cobro:
            for p_venta in items_para_venta:
                # LÓGICA DE STOCK MÓVIL: Descontar del Camión
                if p_venta['cantidad_entregada'] > 0:
                    # Obtener vehiculo_id de la HR
                    db.execute("SELECT vehiculo_id FROM hoja_ruta WHERE id = %s", (hr_id,))
                    hr_info = db.fetchone()
                    v_id = hr_info['vehiculo_id'] if hr_info else None

                    if v_id:
                        # A. Descontar del CAMIÓN
                        db.execute("""
                            UPDATE vehiculos_stock 
                            SET cantidad = cantidad - %s 
                            WHERE vehiculo_id = %s AND producto_id = %s
                        """, (p_venta['cantidad_entregada'], v_id, p_venta['item']['producto_id']))
                        
                    else:
                        # B. Fallback (Depósito Central) - Si por alguna razón no tiene vehículo asignado
                        db.execute('SELECT nombre, stock, stock_minimo FROM productos WHERE id = %s', (p_venta['item']['producto_id'],))
                        producto_info = db.fetchone()
                        stock_anterior = float(producto_info['stock'])
                        nuevo_stock = stock_anterior - p_venta['cantidad_entregada']
                        db.execute('UPDATE productos SET stock = %s WHERE id = %s', (nuevo_stock, p_venta['item']['producto_id']))
                        
                        if stock_anterior > producto_info['stock_minimo'] and nuevo_stock <= producto_info['stock_minimo']:
                            notificaciones.append(f"¡Bajo stock! {producto_info['nombre']} ({nuevo_stock} u.)")

            # 7. Registrar Devolución si hubo rechazos (Solo en bajada, sin id_venta para desacoplar)
            # Como devoluciones exige venta_id, registramos sin venta_id o con null si la DB lo permite
            # Ajuste de regla de negocio: Para Option 2, devoluciones debería permitir venta_id nulo
            # Pero en devolucion está como required? Verificaremos.
            if detalles_devolucion:
                db.execute("""
                    INSERT INTO devoluciones (negocio_id, cliente_id, venta_id, pedido_id, motivo, total_devuelto)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                """, (negocio_id, cliente_id, venta_id, pedido_id, data.get('motivo_devolucion', 'Rechazo Parcial en Entrega'), total_devuelto))
                devolucion_id = db.fetchone()['id']

                for dev in detalles_devolucion:
                    db.execute("""
        INSERT INTO devoluciones_detalle (devolucion_id, producto_id, cantidad_devuelta, precio_unitario, subtotal)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (devolucion_id, dev['producto_id'], dev['cantidad_devuelta'], dev['precio_unitario'], dev['subtotal']))

        # 8. Actualizar Pedido
        if solo_bajada:
             # Si solo bajamos mercadería, queda en 'entregado' pero sin venta_id
             db.execute("""
                UPDATE pedidos 
                SET estado = 'entregado', venta_id = NULL, fecha_entrega = CURRENT_TIMESTAMP, usuario_entrega_id = %s 
                WHERE id = %s
             """, (current_user['id'], pedido_id))
        else:
             # Si hubo cobro, enlazamos la venta
             db.execute("""
                UPDATE pedidos 
                SET estado = 'entregado', venta_id = %s, fecha_entrega = CURRENT_TIMESTAMP, usuario_entrega_id = %s 
                WHERE id = %s
             """, (venta_id, current_user['id'], pedido_id))
        
        # 9. Marcar visita en Hoja de Ruta (Solo en bajada)
        if not solo_cobro:
            if pedido.get('ho_ruta_id') or pedido.get('hoja_ruta_id'):
                hr_id = pedido.get('ho_ruta_id') or pedido.get('hoja_ruta_id')
                db.execute(
                    "UPDATE hoja_ruta_items SET visitado = TRUE, fecha_visita = CURRENT_TIMESTAMP WHERE hoja_ruta_id = %s AND cliente_id = %s",
                    (hr_id, cliente_id)
                )

        g.db_conn.commit()
        
        respuesta = {'message': 'Pago registrado con éxito' if solo_cobro else 'Entrega registrada con éxito'}
        if notificaciones:
            respuesta['notificaciones'] = notificaciones
        if venta_id:
            respuesta['venta_id'] = venta_id
        if detalles_devolucion:
            respuesta['message'] += ' con devoluciones'
            
        return jsonify(respuesta)
        
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- CORRECCIÓN DE PAGOS ---

@bp.route('/pedidos/<int:pedido_id>/corregir_pago', methods=['POST'])
@token_required
def corregir_pago_pedido(current_user, pedido_id):
    data = request.get_json()
    nuevo_metodo = data.get('nuevo_metodo_pago')
    motivo = data.get('motivo', '').strip()
    
    if not nuevo_metodo:
        return jsonify({'error': 'El nuevo método de pago es requerido'}), 400
        
    if not motivo:
        return jsonify({'error': 'El motivo de la corrección es obligatorio'}), 400

    db = get_db()
    try:
        # 1. Obtener pedido
        db.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,))
        pedido = db.fetchone()
        
        if not pedido or not pedido['venta_id']:
            return jsonify({'error': 'El pedido no existe o no tiene una venta cobrada asignada'}), 404

        venta_id = pedido['venta_id']
        cliente_id = pedido['cliente_id']
        negocio_id = pedido['negocio_id']

        # 2. Obtener venta original
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        
        if not venta:
            return jsonify({'error': 'Venta asociada no encontrada'}), 404
            
        metodo_actual = venta['metodo_pago']
        
        if metodo_actual == nuevo_metodo:
            return jsonify({'error': 'El pedido ya tiene ese método de pago registrado'}), 400

        # Validación Estricta: Si involucra Efectivo, MP, etc (no solo Cuenta Corriente) la caja debe estar abierta
        if metodo_actual != 'Cuenta Corriente' or nuevo_metodo != 'Cuenta Corriente':
            db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
            sesion_activa = db.fetchone()
            if not sesion_activa:
                return jsonify({'error': 'Para realizar esta corrección financiera debes tener la Caja Abierta.'}), 400

        from datetime import datetime
        
        # 3. Revertir efecto del método anterior (Cuenta Corriente)
        if metodo_actual == 'Cuenta Corriente':
            # Borramos el registro que generaba la deuda original vinculado a esta venta
            db.execute("DELETE FROM clientes_cuenta_corriente WHERE venta_id = %s AND debe > 0", (venta_id,))

        # 4. Aplicar el nuevo efecto
        if nuevo_metodo == 'Mixto':
            monto_ef = float(data.get('monto_efectivo', 0))
            monto_mp = float(data.get('monto_mp', 0))
            monto_cta_cte = float(data.get('monto_cta_cte', 0))
            
            # Determinamos cuál será el principal (el que conserva el venta_id original)
            metodo_principal = 'Efectivo' if monto_ef > 0 else ('Mercado Pago' if monto_mp > 0 else 'Cuenta Corriente')
            monto_principal = monto_ef if metodo_principal == 'Efectivo' else (monto_mp if metodo_principal == 'Mercado Pago' else monto_cta_cte)

            # Actualizar la venta principal (la que está enlazada al pedido)
            db.execute("UPDATE ventas SET metodo_pago = %s, total = %s, hoja_ruta_id = %s WHERE id = %s", 
                       (metodo_principal, monto_principal, pedido['hoja_ruta_id'], venta_id))
            
            # Crear las ventas adicionales si aplica (MP o Cta Cte adicionales)
            if metodo_principal != 'Efectivo' and monto_ef > 0:
                db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                proximo_nro_sec = db.fetchone()[0]
                db.execute(
                    'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                    (negocio_id, cliente_id, current_user['id'], monto_ef, 'Efectivo', datetime.now(), sesion_activa['id'], 0, pedido['vendedor_id'], pedido['hoja_ruta_id'], proximo_nro_sec)
                )
            
            if metodo_principal != 'Mercado Pago' and monto_mp > 0:
                db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                proximo_nro_sec = db.fetchone()[0]
                db.execute(
                    'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                    (negocio_id, cliente_id, current_user['id'], monto_mp, 'Mercado Pago', datetime.now(), sesion_activa['id'], 0, pedido['vendedor_id'], pedido['hoja_ruta_id'], proximo_nro_sec)
                )

            if monto_cta_cte > 0:
                v_cta_cte_id = venta_id if metodo_principal == 'Cuenta Corriente' else None
                if not v_cta_cte_id:
                     db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                     proximo_nro_sec = db.fetchone()[0]
                     db.execute(
                        'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, descuento, vendedor_id, hoja_ruta_id, numero_interno) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id',
                        (negocio_id, cliente_id, current_user['id'], monto_cta_cte, 'Cuenta Corriente', datetime.now(), sesion_activa['id'], 0, pedido['vendedor_id'], pedido['hoja_ruta_id'], proximo_nro_sec)
                    )
                     v_cta_cte_id = db.fetchone()['id']
                
                # Registrar Deuda en Cuenta Corriente
                db.execute(
                    "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                    (cliente_id, f"Corrección a Mixto (Cta Cte) - Pedido #{pedido_id}", monto_cta_cte, 0, datetime.now(), v_cta_cte_id)
                )
        
        elif nuevo_metodo == 'Cuenta Corriente':
            # Caso normal: Cambio a Cuenta Corriente simple
            db.execute(\
                "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha, venta_id) VALUES (%s, %s, %s, %s, %s, %s)",
                (cliente_id, f"Corrección a Cta Cte - Pedido #{pedido_id}", venta['total'], 0, datetime.now(), venta_id)
            )
            db.execute("UPDATE ventas SET metodo_pago = %s, hoja_ruta_id = %s WHERE id = %s", (nuevo_metodo, pedido['hoja_ruta_id'], venta_id))

        else:
            # 5. Caso normal: Otros métodos únicos
            db.execute("UPDATE ventas SET metodo_pago = %s, hoja_ruta_id = %s WHERE id = %s", (nuevo_metodo, pedido['hoja_ruta_id'], venta_id))
        
        # 6. Guardar historial de corrección en observaciones del pedido
        nota_auditoria = f"\n[Corrección Administrativa] Pago cambiado de {metodo_actual} a {nuevo_metodo}. Motivo: {motivo}"
        db.execute("UPDATE pedidos SET observaciones = CONCAT(COALESCE(observaciones, ''), %s) WHERE id = %s",
                   (nota_auditoria, pedido_id))

        g.db_conn.commit()
        return jsonify({'message': f'Pago corregido exitosamente a {nuevo_metodo}'})
        
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- STOCK MÓVIL / AJUSTES MANUALES ---

@bp.route('/vehiculos/<int:id>/stock/ajustar', methods=['POST'])
@token_required
def ajustar_stock_vehiculo(current_user, id):
    data = request.get_json()
    producto_id = data.get('producto_id')
    cantidad_nueva = data.get('cantidad_nueva')
    negocio_id = data.get('negocio_id')

    if producto_id is None or cantidad_nueva is None or negocio_id is None:
        return jsonify({'error': 'Faltan datos requeridos'}), 400

    try:
        cantidad_nueva = float(cantidad_nueva)
    except ValueError:
        return jsonify({'error': 'La cantidad debe ser numérica'}), 400

    db = get_db()
    try:
        # 1. Obtener stock actual del vehículo
        db.execute("SELECT cantidad FROM vehiculos_stock WHERE vehiculo_id = %s AND producto_id = %s", (id, producto_id))
        row = db.fetchone()
        cantidad_anterior = float(row['cantidad']) if row else 0.0
        diferencia = cantidad_nueva - cantidad_anterior

        # 2. Actualizar (UPSERT)
        db.execute("""
            INSERT INTO vehiculos_stock (vehiculo_id, producto_id, negocio_id, cantidad, last_updated)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (vehiculo_id, producto_id) 
            DO UPDATE SET cantidad = EXCLUDED.cantidad, last_updated = CURRENT_TIMESTAMP
        """, (id, producto_id, negocio_id, cantidad_nueva))

        # 3. Registrar ajuste para auditoría
        db.execute("""
            INSERT INTO inventario_ajustes 
            (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia, motivo)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (producto_id, current_user['id'], negocio_id, cantidad_anterior, cantidad_nueva, diferencia, f'Ajuste Manual Vehículo ID {id}')
        )

        g.db_conn.commit()
        return jsonify({'message': 'Stock de vehículo actualizado con éxito', 'cantidad_nueva': cantidad_nueva})

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos/<int:id>/ubicacion', methods=['POST'])
@token_required
def update_vehiculo_ubicacion(current_user, id):
    data = request.get_json()
    lat = data.get('latitud')
    lng = data.get('longitud')

    if lat is None or lng is None:
        return jsonify({'error': 'Faltan coordenadas'}), 400

    db = get_db()
    try:
        db.execute("""
            UPDATE vehiculos 
            SET latitud = %s, longitud = %s, ultima_actualizacion = CURRENT_TIMESTAMP 
            WHERE id = %s
        """, (lat, lng, id))
        g.db_conn.commit()
        return jsonify({'message': 'Ubicación actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- CHOFER / REPARTIDOR APP ENDPOINTS ---

@bp.route('/chofer/mis_rutas', methods=['GET'])
@token_required
def get_rutas_chofer(current_user):
    if current_user['rol'] != 'chofer':
        return jsonify({'error': 'Acceso denegado, rol chofer requerido'}), 403
    
    empleado_id = current_user.get('empleado_id')
    if not empleado_id:
        return jsonify({'error': 'Usuario no tiene empleado_id asociado'}), 400

    db = get_db()
    
    # 1. Encontrar vehiculo del chofer (donde esta como default_id o donde se haya asignado manual, 
    # por simplicidad usaremos las rutas del vehiculo que tiene asignado o le mostraremos todas las rutas en curso del negocio)
    # Lo más lógico: buscar todas las HR donde el vehículo asignado tenga a este empleado como chofer_default_id
    # O mejor: traemos las HR del negocio que estén Activas y que el vehículo asignado le pertenezca a este chofer
    
    query = """
        SELECT 
            hr.id, 
            TO_CHAR(hr.fecha, 'YYYY-MM-DD') as fecha, 
            hr.estado, 
            v.nombre as vendedor_nombre,
            vh.modelo as vehiculo_asignado,
            vh.patente as vehiculo_patente,
            COUNT(DISTINCT p.id) as cantidad_pedidos,
            COALESCE(SUM(pd.cantidad * pr.peso_kg), 0) as peso_kg,
            COALESCE(SUM(pd.cantidad * pr.volumen_m3), 0) as volumen_m3
        FROM hoja_ruta hr
        JOIN vendedores v ON hr.vendedor_id = v.id
        LEFT JOIN vehiculos vh ON hr.vehiculo_id = vh.id
        LEFT JOIN pedidos p ON hr.id = p.hoja_ruta_id AND p.estado IN ('pendiente', 'preparado', 'en_camino')
        LEFT JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        LEFT JOIN productos pr ON pd.producto_id = pr.id
        WHERE (hr.chofer_id = %s OR (hr.chofer_id IS NULL AND vh.chofer_default_id = %s))
        AND hr.estado IN ('activa', 'borrador') -- O solo activa? Mejor activa para que empiece a repartir
        GROUP BY hr.id, hr.vehiculo_id, hr.fecha, hr.estado, v.nombre, vh.modelo, vh.patente
        ORDER BY hr.fecha DESC
    """
    
    db.execute(query, (empleado_id, empleado_id))
    rows = db.fetchall()
    
    results = []
    for row in rows:
        r = dict(row)
        r['peso_kg'] = float(r['peso_kg'])
        r['volumen_m3'] = float(r['volumen_m3'])
        results.append(r)
        
    return jsonify(results)

@bp.route('/chofer/hoja_ruta/<int:id>', methods=['GET'])
@token_required
def get_hoja_ruta_chofer(current_user, id):
    if current_user['rol'] != 'chofer':
        return jsonify({'error': 'Acceso denegado, rol chofer requerido'}), 403

    db = get_db()
    
    # Cabecera
    db.execute("""
        SELECT hr.id, hr.negocio_id, hr.estado, TO_CHAR(hr.fecha, 'YYYY-MM-DD') as fecha, v.nombre as vendedor_nombre
        FROM hoja_ruta hr
        JOIN vendedores v ON hr.vendedor_id = v.id
        WHERE hr.id = %s
    """, (id,))
    cabecera = db.fetchone()
    if not cabecera:
        return jsonify({'error': 'No encontrado'}), 404

    # Traer items (paradas) ordenados
    db.execute("""
        SELECT hri.id as hoja_ruta_item_id, hri.hoja_ruta_id, hri.orden, hri.visitado,
               c.id as cliente_id, c.nombre as cliente_nombre, c.direccion as cliente_direccion, 
               c.telefono as cliente_telefono, c.ref_interna as cliente_zona,
               c.latitud, c.longitud
        FROM hoja_ruta_items hri
        JOIN clientes c ON hri.cliente_id = c.id
        WHERE hri.hoja_ruta_id = %s
        ORDER BY hri.orden ASC
    """, (id,))
    items_raw = db.fetchall()
    
    # Traer todos los pedidos de la HR para adjuntar a cada parada los productos exactos a bajar
    db.execute("""
        SELECT p.id as pedido_id, p.cliente_id, p.negocio_id, p.estado, p.total, p.venta_id,
               pr.id as producto_id, pr.nombre as producto_nombre, pd.precio_unitario, pd.cantidad
        FROM pedidos p
        JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        JOIN productos pr ON pd.producto_id = pr.id
        WHERE p.hoja_ruta_id = %s AND p.estado != 'anulado'
    """, (id,))
    productos_pedido = db.fetchall()
    
    # Agrupar productos por cliente
    pedidos_por_cliente = {}
    for prod in productos_pedido:
        cid = prod['cliente_id']
        if cid not in pedidos_por_cliente:
            pedidos_por_cliente[cid] = {
                'id': prod['pedido_id'],
                'pedido_id': prod['pedido_id'],
                'negocio_id': prod['negocio_id'],
                'estado': prod['estado'],
                'total': float(prod['total']),
                'venta_id': prod['venta_id'],
                'productos': []
            }
        pedidos_por_cliente[cid]['productos'].append({
            'producto_id': prod['producto_id'],
            'nombre': prod['producto_nombre'],
            'cantidad': float(prod['cantidad']),
            'precio_unitario': float(prod['precio_unitario'])
        })

    # Armar lista final
    items = []
    for item in items_raw:
        r = dict(item)
        r['pedido'] = pedidos_por_cliente.get(r['cliente_id'])
        items.append(r)

    result = dict(cabecera)
    result['items'] = items
    
    return jsonify(result)

@bp.route('/chofer/recorrido_unificado', methods=['GET'])
@token_required
def get_recorrido_unificado(current_user):
    if current_user['rol'] != 'chofer':
        return jsonify({'error': 'Acceso denegado, rol chofer requerido'}), 403
    
    empleado_id = current_user.get('empleado_id')
    if not empleado_id:
        return jsonify({'error': 'Usuario no tiene empleado_id asociado'}), 400

    db = get_db()
    
    # 1. Obtener todas las HRs activas/borrador del chofer (para validar pertenencia)
    db.execute("""
        SELECT hr.id 
        FROM hoja_ruta hr
        LEFT JOIN vehiculos vh ON hr.vehiculo_id = vh.id
        WHERE (hr.chofer_id = %s OR (hr.chofer_id IS NULL AND vh.chofer_default_id = %s))
        AND hr.estado IN ('activa', 'borrador')
    """, (empleado_id, empleado_id))
    todas_hr_ids = set(r['id'] for r in db.fetchall())
    
    if not todas_hr_ids:
        return jsonify({'items': []})

    # 2. Filtrar por hr_ids del query string (si se proporcionan)
    requested_ids_raw = request.args.getlist('hr_ids')
    if requested_ids_raw:
        try:
            requested_ids = set(int(i) for i in requested_ids_raw)
        except ValueError:
            return jsonify({'error': 'hr_ids inválidos'}), 400
        # Validar que los IDs pedidos pertenezcan a este chofer (seguridad)
        hr_ids = list(todas_hr_ids & requested_ids)
        if not hr_ids:
            return jsonify({'items': []})
    else:
        # Sin filtro: usar todas las HRs del chofer (comportamiento original)
        hr_ids = list(todas_hr_ids)

    # 3. Traer todos los items de esas HRs
    placeholders = ','.join(['%s'] * len(hr_ids))
    query_items = f"""
        SELECT hri.id as hoja_ruta_item_id, hri.hoja_ruta_id, hri.orden, hri.visitado,
               c.id as cliente_id, c.nombre as cliente_nombre, c.direccion as cliente_direccion, 
               c.telefono as cliente_telefono, c.ref_interna as cliente_zona,
               c.latitud, c.longitud,
               v.nombre as vendedor_nombre
        FROM hoja_ruta_items hri
        JOIN clientes c ON hri.cliente_id = c.id
        JOIN hoja_ruta hr ON hri.hoja_ruta_id = hr.id
        JOIN vendedores v ON hr.vendedor_id = v.id
        WHERE hri.hoja_ruta_id IN ({placeholders})
        ORDER BY hri.hoja_ruta_id, hri.orden ASC
    """
    db.execute(query_items, tuple(hr_ids))
    items_raw = db.fetchall()

    # 4. Traer pedidos asociados
    query_pedidos = f"""
        SELECT p.id as pedido_id, p.cliente_id, p.negocio_id, p.hoja_ruta_id, p.estado, p.total, p.venta_id,
               pr.id as producto_id, pr.nombre as producto_nombre, pr.precio_venta as precio_unitario, pd.cantidad
        FROM pedidos p
        JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        JOIN productos pr ON pd.producto_id = pr.id
        WHERE p.hoja_ruta_id IN ({placeholders}) AND p.estado != 'anulado'
    """
    db.execute(query_pedidos, tuple(hr_ids))
    productos_pedido = db.fetchall()

    # Agrupar productos por (cliente, hr)
    pedidos_por_cliente_hr = {}
    for prod in productos_pedido:
        key = f"{prod['cliente_id']}_{prod['hoja_ruta_id']}"
        if key not in pedidos_por_cliente_hr:
            pedidos_por_cliente_hr[key] = {
                'id': prod['pedido_id'],
                'pedido_id': prod['pedido_id'],
                'negocio_id': prod['negocio_id'],
                'hoja_ruta_id': prod['hoja_ruta_id'],
                'estado': prod['estado'],
                'total': float(prod['total']),
                'venta_id': prod['venta_id'],
                'productos': []
            }
        pedidos_por_cliente_hr[key]['productos'].append({
            'producto_id': prod['producto_id'],
            'nombre': prod['producto_nombre'],
            'cantidad': float(prod['cantidad']),
            'precio_unitario': float(prod['precio_unitario'])
        })

    items = []
    for item in items_raw:
        r = dict(item)
        r['pedido'] = pedidos_por_cliente_hr.get(f"{r['cliente_id']}_{r['hoja_ruta_id']}")
        items.append(r)

    return jsonify({'items': items})

# --- MOTIVOS DE REBOTE ---

@bp.route('/negocios/<int:negocio_id>/motivos_rebote', methods=['GET'])
@token_required
def get_motivos_rebote(current_user, negocio_id):
    db = get_db()
    db.execute("""
        SELECT id, descripcion 
        FROM motivos_rebote 
        WHERE negocio_id = %s AND activo = TRUE
        ORDER BY id ASC
    """, (negocio_id,))
    motivos = db.fetchall()
    return jsonify([dict(m) for m in motivos])

