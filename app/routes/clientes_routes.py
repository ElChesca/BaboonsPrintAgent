# app/routes/clientes_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('clientes', __name__)

@bp.route('/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    query_search = request.args.get('search', '').strip()
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    offset = (page - 1) * limit
    revisado_filter = request.args.get('revisado', 'all') # all, yes, no
    zona_filter = request.args.get('zona', '').strip()

    db = get_db()
    
    # 1. Base Query Params
    params_count = [negocio_id]
    where_clause = "WHERE c.negocio_id = %s"

    # ✨ LÓGICA DE FILTRADO DE CLIENTES POR VENDEDOR
    
    # Caso A: Si es VENDEDOR, forzamos el filtro para que solo vea SUS clientes
    if current_user['rol'] == 'vendedor':
        if not current_user.get('vendedor_id'):
             # Si es vendedor pero no tiene ID asociado, no ve nada por seguridad
             return jsonify({'data': [], 'pagination': {'total_items': 0, 'total_pages': 0, 'current_page': 1, 'items_per_page': limit}})
        
        where_clause += " AND c.vendedor_id = %s"
        params_count.append(current_user['vendedor_id'])
    
    # Caso B: Si es ADMIN y pide filtrar por vendedor (ej. para armar ruta)
    else:
        vendedor_filter_id = request.args.get('vendedor_id')
        if vendedor_filter_id:
            where_clause += " AND c.vendedor_id = %s"
            params_count.append(vendedor_filter_id)

    if query_search:
        where_clause += " AND (c.nombre ILIKE %s OR c.direccion ILIKE %s OR c.ref_interna ILIKE %s OR c.dni ILIKE %s OR CAST(c.id AS TEXT) ILIKE %s)"
        params_count.extend([f'%{query_search}%', f'%{query_search}%', f'%{query_search}%', f'%{query_search}%', f'%{query_search}%'])

    if revisado_filter == 'yes':
        where_clause += " AND c.revisado = TRUE"
    elif revisado_filter == 'no':
        where_clause += " AND (c.revisado = FALSE OR c.revisado IS NULL)"

    if zona_filter:
        where_clause += " AND c.ref_interna = %s"
        params_count.append(zona_filter)


    # 2. Contar total
    count_sql = f"SELECT COUNT(*) FROM clientes c {where_clause}"
    db.execute(count_sql, tuple(params_count))
    total_items = db.fetchone()['count']

    # 3. Datos paginados
    sql = f"""
        SELECT c.*, lp.nombre AS lista_de_precio_nombre, v.nombre AS vendedor_nombre,
               u.nombre AS usuario_revision_nombre
        FROM clientes c
        LEFT JOIN listas_de_precios lp ON c.lista_de_precio_id = lp.id
        LEFT JOIN vendedores v ON c.vendedor_id = v.id
        LEFT JOIN usuarios u ON c.usuario_revision_id = u.id
        {where_clause}
        ORDER BY c.nombre ASC
        LIMIT %s OFFSET %s
    """
    
    # params para query final
    params_query = list(params_count) # Copia
    params_query.extend([limit, offset])

    db.execute(sql, tuple(params_query))
    clientes = db.fetchall()

    return jsonify({
        'data': [dict(row) for row in clientes],
        'pagination': {
            'total_items': total_items,
            'total_pages': (total_items + limit - 1) // limit,
            'current_page': page,
            'items_per_page': limit
        }
    })


@bp.route('/negocios/<int:negocio_id>/clientes/zonas', methods=['GET'])
@token_required
def get_zonas(current_user, negocio_id):
    """Retorna lista de Zonas distintas (ref_interna) para el filtro."""
    db = get_db()
    db.execute("""
        SELECT DISTINCT ref_interna
        FROM clientes
        WHERE negocio_id = %s AND ref_interna IS NOT NULL AND ref_interna != ''
        ORDER BY ref_interna ASC
    """, (negocio_id,))
    zonas = [row['ref_interna'] for row in db.fetchall()]
    return jsonify(zonas)


@bp.route('/negocios/<int:negocio_id>/clientes', methods=['POST'])

@token_required
def create_cliente(current_user, negocio_id):
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    lista_id = data.get('lista_de_precio_id') # Usar el nombre correcto de la columna
    
    # Obtén el ID directamente de los datos JSON que envía el frontend
    db = get_db()

    # ✨ VALIDACIÓN EXTRA: Evitar duplicados por DNI dentro del mismo negocio
    dni = data.get('dni')
    
    # Si viene vacío, lo forzamos a None para evitar problemas de unicidad con strings vacíos
    if not dni or not str(dni).strip():
        dni = None
        data['dni'] = None

    if dni:
        db.execute("SELECT id FROM clientes WHERE negocio_id = %s AND dni = %s", (negocio_id, dni))
        existing = db.fetchone()
        if existing:
            return jsonify({'error': f'Ya existe un cliente con el DNI/CUIT {dni} (ID: {existing["id"]})'}), 409

    try:
        # ✨ CORRECCIÓN: Se incluyen todos los nuevos campos en la sentencia INSERT.
        db.execute(
            """
            INSERT INTO clientes (negocio_id, nombre, dni, telefono, email, direccion,
                                  tipo_cliente, tipo_documento, condicion_venta, posicion_iva,
                                  lista_precios, credito_maximo, ciudad, provincia, ref_interna, lista_de_precio_id,
                                  latitud, longitud, vendedor_id, actividad,
                                  visita_lunes, visita_martes, visita_miercoles, visita_jueves, visita_viernes, visita_sabado, visita_domingo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (negocio_id, data.get('nombre'), data.get('dni'), data.get('telefono'), data.get('email'), data.get('direccion'),
             data.get('tipo_cliente', 'Individuo'), data.get('tipo_documento', 'DNI'), data.get('condicion_venta', 'Contado'),
             data.get('posicion_iva', 'Consumidor Final'), data.get('lista_precios'), data.get('credito_maximo', 0),
             data.get('ciudad'), data.get('provincia'), data.get('ref_interna'), lista_id,
             data.get('latitud'), data.get('longitud'), data.get('vendedor_id'), data.get('actividad'),
             data.get('visita_lunes', False), data.get('visita_martes', False), data.get('visita_miercoles', False),
             data.get('visita_jueves', False), data.get('visita_viernes', False), data.get('visita_sabado', False),
             data.get('visita_domingo', False))
        )

        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        # Devolvemos el objeto completo con su nuevo ID.
        return jsonify({'id': nuevo_id, **data}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se recibieron datos para actualizar'}), 400

    # ✨ MEJORA: Construcción dinámica de la consulta UPDATE.
    # Esto permite actualizar solo los campos que se envían y es mucho más seguro y flexible.
    
    # Lista de campos permitidos para actualizar
    allowed_fields = ['nombre', 'dni', 'telefono', 'email', 'direccion',
                      'tipo_cliente', 'tipo_documento', 'condicion_venta', 'posicion_iva',
                      'lista_precios', 'credito_maximo', 'ciudad', 'provincia', 'ref_interna','lista_de_precio_id',
                      'latitud', 'longitud', 'vendedor_id', 'actividad',
                      'visita_lunes', 'visita_martes', 'visita_miercoles', 'visita_jueves', 
                      'visita_viernes', 'visita_sabado', 'visita_domingo']
    
    db = get_db()

    # ✨ VALIDACIÓN EXTRA: Si se actualiza DNI, verificar unicidad
    if 'dni' in data:
        # Sanitizar DNI vacío
        if not data['dni'] or not str(data['dni']).strip():
            data['dni'] = None
            
        dni = data['dni']
        if dni:
            db.execute("SELECT id FROM clientes WHERE negocio_id = (SELECT negocio_id FROM clientes WHERE id = %s) AND dni = %s AND id != %s", (cliente_id, dni, cliente_id))
            existing = db.fetchone()
            if existing:
                return jsonify({'error': f'El DNI {dni} ya pertenece a otro cliente (ID: {existing["id"]})'}), 409

    # Construimos la parte SET de la consulta
    set_parts = []
    values = []
    for field in allowed_fields:
        if field in data:
            set_parts.append(f"{field} = %s")
            values.append(data[field])

    if not set_parts:
        return jsonify({'error': 'Ningún campo válido para actualizar'}), 400

    # Añadimos el ID del cliente al final de la lista de valores
    values.append(cliente_id)

    query = f"UPDATE clientes SET {', '.join(set_parts)} WHERE id = %s"

    db = get_db()
    try:
        db.execute(query, tuple(values))
        g.db_conn.commit()
        return jsonify({'message': 'Cliente actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    db = get_db()
    # Aquí podrías añadir una lógica para verificar si el cliente tiene saldo en cta. cte. antes de borrar.
    db.execute('DELETE FROM clientes WHERE id = %s', (cliente_id,))
    g.db_conn.commit()
    return jsonify({'message': 'Cliente eliminado con éxito'})

@bp.route('/clientes/<int:cliente_id>/cuenta_corriente', methods=['GET'])
@token_required
def get_cuenta_corriente(current_user, cliente_id):
    db = get_db()
    db.execute(
        "SELECT * FROM clientes_cuenta_corriente WHERE cliente_id = %s ORDER BY fecha ASC",
        (cliente_id,)
    )
    movimientos = db.fetchall()
    return jsonify([dict(row) for row in movimientos])

@bp.route('/clientes/<int:cliente_id>/toggle_revision', methods=['PUT'])
@token_required
def toggle_revision(current_user, cliente_id):
    db = get_db()
    
    # Check current state first
    db.execute("SELECT revisado FROM clientes WHERE id = %s", (cliente_id,))
    cliente = db.fetchone()
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404
        
    nuevo_estado = not cliente['revisado']
    
    if nuevo_estado:
        # Mark as revised
        db.execute("""
            UPDATE clientes 
            SET revisado = TRUE, 
                fecha_revision = NOW(), 
                usuario_revision_id = %s 
            WHERE id = %s
        """, (current_user['id'], cliente_id))
    else:
        # Unmark (optional: clear date/user or keep history? keeping simple: clear)
        db.execute("""
            UPDATE clientes 
            SET revisado = FALSE, 
                fecha_revision = NULL, 
                usuario_revision_id = NULL 
            WHERE id = %s
        """, (cliente_id,))
        
    g.db_conn.commit()
    
    return jsonify({
        'message': 'Estado de revisión actualizado', 
        'revisado': nuevo_estado
    })


# --- ACCIONES MASIVAS ---

@bp.route('/negocios/<int:negocio_id>/clientes/bulk/zona', methods=['PUT'])
@token_required
def bulk_asignar_zona(current_user, negocio_id):
    data = request.get_json()
    cliente_ids = data.get('cliente_ids', [])
    zona_id = data.get('zona_id')  # None = desasignar

    if not cliente_ids:
        return jsonify({'error': 'No se enviaron clientes'}), 400

    db = get_db()
    try:
        db.execute(
            f"UPDATE clientes SET zona_id = %s WHERE negocio_id = %s AND id = ANY(%s::int[])",
            (zona_id, negocio_id, cliente_ids)
        )
        g.db_conn.commit()
        return jsonify({'message': f'{len(cliente_ids)} clientes actualizados con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/clientes/bulk/vendedor', methods=['PUT'])
@token_required
def bulk_asignar_vendedor(current_user, negocio_id):
    data = request.get_json()
    cliente_ids = data.get('cliente_ids', [])
    vendedor_id = data.get('vendedor_id')  # None = desasignar

    if not cliente_ids:
        return jsonify({'error': 'No se enviaron clientes'}), 400

    db = get_db()
    try:
        db.execute(
            f"UPDATE clientes SET vendedor_id = %s WHERE negocio_id = %s AND id = ANY(%s::int[])",
            (vendedor_id, negocio_id, cliente_ids)
        )
        g.db_conn.commit()
        return jsonify({'message': f'{len(cliente_ids)} clientes actualizados con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
