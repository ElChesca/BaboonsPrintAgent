from flask import Blueprint, request, jsonify, g, current_app
from app.database import get_db
from app.auth_decorator import token_required
from app.pricing_logic import get_precio_producto # Importa el motor de precios
import os
import uuid
from PIL import Image
from werkzeug.utils import secure_filename

bp = Blueprint('products', __name__)

@bp.route('/productos', methods=['GET'])
@token_required
def buscar_productos_compat(current_user):
    """Ruta de compatibilidad para el buscador antiguo de pedidos."""
    query_term = request.args.get('search', '')
    negocio_id = request.args.get('negocio_id')
    
    if not negocio_id:
        return jsonify({'error': 'Falta negocio_id'}), 400

    db = get_db()
    db.execute(
        """
        SELECT id, nombre, alias, precio_venta, stock, sku, imagen_url, ubicacion
        FROM productos
        WHERE negocio_id = %s AND activo = TRUE AND (
            nombre ILIKE %s OR
            sku ILIKE %s OR
            codigo_barras = %s
        )
        LIMIT 20
        """,
        (negocio_id, f"%{query_term}%", f"%{query_term}%", query_term)
    )
    productos = db.fetchall()
    return jsonify([dict(p) for p in productos])

@bp.route('/negocios/<int:negocio_id>/productos', methods=['GET'])
@token_required
def get_productos(current_user, negocio_id):
    lista_id = request.args.get('lista_id', type=int)
    mostrar_inactivos = request.args.get('mostrar_inactivos', 'false').lower() == 'true'
    
    db = get_db()
    
    query = """
        SELECT 
            p.*, 
            c.nombre as categoria_nombre, 
            prov.nombre as proveedor_nombre,
            (SELECT COALESCE(SUM(cantidad), 0) FROM vehiculos_stock WHERE producto_id = p.id) as stock_movil,
            (
                SELECT COALESCE(SUM(pd_inner.cantidad), 0)
                FROM pedidos p_inner
                JOIN pedidos_detalle pd_inner ON p_inner.id = pd_inner.pedido_id
                LEFT JOIN hoja_ruta hr ON p_inner.hoja_ruta_id = hr.id
                WHERE pd_inner.producto_id = p.id
                  AND p_inner.estado IN ('pendiente', 'preparado')
                  AND (hr.id IS NULL OR hr.carga_confirmada IS FALSE)
                  AND p_inner.negocio_id = %s
            ) as stock_comprometido
        FROM productos p
        LEFT JOIN productos_categoria c ON p.categoria_id = c.id
        LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
        WHERE p.negocio_id = %s
    """
    params = [negocio_id, negocio_id]
    
    if not mostrar_inactivos:
        query += " AND p.activo = TRUE"
        
    query += " ORDER BY p.nombre"
    
    db.execute(query, tuple(params))
    productos = db.fetchall()

    # Obtener patentes de vehículos con stock para los productos listados
    # Lo hacemos en Python para garantizar compatibilidad total SQLite/Postgres (evitar STRING_AGG vs GROUP_CONCAT)
    db.execute("""
        SELECT vs.producto_id, v.patente
        FROM vehiculos_stock vs
        JOIN vehiculos v ON vs.vehiculo_id = v.id
        WHERE vs.cantidad != 0 AND v.negocio_id = %s
    """, (negocio_id,))
    stock_movil_data = db.fetchall()
    
    patentes_map = {}
    for row in stock_movil_data:
        pid = row['producto_id']
        patente = row['patente']
        if pid not in patentes_map:
            patentes_map[pid] = []
        patentes_map[pid].append(patente)

    result_list = []
    for p in productos:
        p_dict = dict(p)
        p_dict['patentes_movil'] = ", ".join(patentes_map.get(p['id'], []))
        
        if lista_id:
            # Calcular el precio para esta lista
            p_dict['precio_venta'] = get_precio_producto(
                db_cursor=db,
                producto_id=p['id'],
                negocio_id=negocio_id,
                lista_de_precio_id_override=lista_id
            )
        result_list.append(p_dict)
        
    return jsonify(result_list)

@bp.route('/productos/<int:producto_id>', methods=['GET'])
@token_required
def get_producto_por_id(current_user, producto_id):
    db = get_db()
    db.execute('SELECT * FROM productos WHERE id = %s', (producto_id,))
    producto = db.fetchone()
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404
    return jsonify(dict(producto))

@bp.route('/negocios/<int:negocio_id>/productos', methods=['POST'])
@token_required
def add_producto(current_user, negocio_id):
    data = request.get_json()
    db = get_db()

    # Primero, verificar si el SKU ya existe para este negocio
    sku = data.get('sku')
    if sku:
        db.execute(
            "SELECT id FROM productos WHERE sku = %s AND negocio_id = %s",
            (sku, negocio_id)
        )
        if db.fetchone():
            return jsonify({'message': 'Ya existe un producto con este SKU en este negocio.'}), 409

    try:
        db.execute(
            """
            INSERT INTO productos (negocio_id, nombre, stock, precio_venta, precio_costo, unidad_medida,
                                   categoria_id, stock_minimo, sku, codigo_barras, proveedor_id, alias,
                                   peso_kg, volumen_m3, imagen_url, ubicacion, tipo_producto)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """ ,
            (
                negocio_id, data.get('nombre'), data.get('stock'), data.get('precio_venta'), data.get('precio_costo'),
                data.get('unidad_medida'), data.get('categoria_id'), data.get('stock_minimo'), sku,
                data.get('codigo_barras'), data.get('proveedor_id'), data.get('alias'),
                data.get('peso_kg', 0), data.get('volumen_m3', 0), data.get('imagen_url'), data.get('ubicacion', 'Depósito 1'),
                data.get('tipo_producto', 'final')
            )
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()

        db.execute('SELECT * FROM productos WHERE id = %s', (nuevo_id,))
        producto_creado = db.fetchone()
        return jsonify(dict(producto_creado)), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/productos/<int:producto_id>', methods=['PUT'])
@token_required
def update_producto(current_user, producto_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Solo Admin o Superadmin pueden modificar'}), 403

    update_data = request.get_json()
    campos_validos = [
        'nombre', 'stock', 'precio_venta', 'precio_costo', 'unidad_medida',
        'categoria_id', 'stock_minimo', 'sku', 'codigo_barras', 'proveedor_id', 'alias',
        'peso_kg', 'volumen_m3', 'imagen_url', 'ubicacion', 'tipo_producto'
    ]
    fields = [f"{key} = %s" for key in update_data.keys() if key in campos_validos]
    values = [value for key, value in update_data.items() if key in campos_validos]

    if not fields:
        return jsonify({'error': 'No hay campos válidos para actualizar'}), 400

    values.append(producto_id)
    db = get_db()

    # ✨ AUDITORÍA: Leer valores actuales antes del UPDATE
    campos_a_auditar = ['precio_venta', 'precio_costo', 'stock']
    try:
        db.execute("SELECT stock, precio_venta, precio_costo, negocio_id FROM productos WHERE id = %s", (producto_id,))
        prod_actual = db.fetchone()

        if prod_actual:
            negocio_id_prod = prod_actual['negocio_id']

            # 1. Registrar en productos_bitacora los cambios de precio y stock
            for campo in campos_a_auditar:
                if campo in update_data:
                    val_anterior = prod_actual[campo]
                    val_nuevo = update_data[campo]
                    try:
                        if val_anterior is not None and float(val_anterior) == float(val_nuevo):
                            continue  # Sin cambio, no registrar
                    except (TypeError, ValueError):
                        pass
                    db.execute(
                        """
                        INSERT INTO productos_bitacora
                            (producto_id, usuario_id, usuario_nombre, campo, valor_anterior, valor_nuevo)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (producto_id, current_user['id'], current_user.get('nombre', 'Sistema'),
                         campo, val_anterior, val_nuevo)
                    )

            # 2. Si cambió el stock, registrar también en inventario_ajustes
            if 'stock' in update_data:
                nuevo_stock = float(update_data['stock'])
                cantidad_anterior = float(prod_actual['stock'])
                if cantidad_anterior != nuevo_stock:
                    diferencia = nuevo_stock - cantidad_anterior
                    db.execute(
                        """
                        INSERT INTO inventario_ajustes
                        (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia, motivo)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (producto_id, current_user['id'], negocio_id_prod,
                         cantidad_anterior, nuevo_stock, diferencia, 'Edición Manual')
                    )
    except Exception as e_audit:
        print(f"Error en auditoría de producto: {e_audit}")
        # No bloqueamos el update si falla la auditoría

    db.execute(f"UPDATE productos SET {', '.join(fields)} WHERE id = %s", tuple(values))
    g.db_conn.commit()

    db.execute('SELECT * FROM productos WHERE id = %s', (producto_id,))
    producto_actualizado = db.fetchone()
    return jsonify(dict(producto_actualizado))


@bp.route('/productos/<int:producto_id>/bitacora', methods=['GET'])
@token_required
def get_bitacora_producto(current_user, producto_id):
    """Devuelve el historial de cambios manuales de un producto."""
    db = get_db()
    db.execute(
        """
        SELECT id, campo, valor_anterior, valor_nuevo, usuario_nombre,
               fecha AT TIME ZONE 'America/Argentina/Buenos_Aires' AS fecha_local
        FROM productos_bitacora
        WHERE producto_id = %s
        ORDER BY fecha DESC
        LIMIT 100
        """,
        (producto_id,)
    )
    rows = db.fetchall()
    return jsonify([dict(r) for r in rows])

@bp.route('/productos/<int:producto_id>', methods=['DELETE'])
@token_required
def delete_producto(current_user, producto_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()
    # Cambio a desactivación lógica
    db.execute('UPDATE productos SET activo = FALSE WHERE id = %s', (producto_id,))
    g.db_conn.commit()
    return jsonify({'mensaje': 'Producto desactivado con éxito'})

@bp.route('/productos/<int:producto_id>/reactivar', methods=['PUT'])
@token_required
def reactivar_producto(current_user, producto_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()
    db.execute('UPDATE productos SET activo = TRUE WHERE id = %s', (producto_id,))
    g.db_conn.commit()
    return jsonify({'mensaje': 'Producto reactivado con éxito'})


# --- ✨ NUEVO ENDPOINT PARA PRODUCTOS TOP (POS) ✨ ---
@bp.route('/negocios/<int:negocio_id>/productos/top', methods=['GET'])
@token_required
def get_top_productos(current_user, negocio_id):
    # El número de productos a mostrar se puede pasar como parámetro, con 12 por defecto.
    limit = request.args.get('limit', 12, type=int)
    db = get_db()

    # Esta consulta cuenta cuántas veces se vendió cada producto, los ordena y trae los más vendidos.
    query = """
        SELECT
            p.id,
            p.nombre,
            p.precio_venta,
            p.stock,
            p.imagen_url,
            p.alias
        FROM productos p
        JOIN (
            SELECT vd.producto_id, COUNT(vd.producto_id) as total_ventas
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.negocio_id = %s
            GROUP BY vd.producto_id
            ORDER BY total_ventas DESC
            LIMIT %s
        ) as top_productos ON p.id = top_productos.producto_id
        WHERE p.activo = TRUE;
    """
    
    db.execute(query, (negocio_id, limit))
    productos = db.fetchall()
    return jsonify([dict(p) for p in productos])

@bp.route('/negocios/<int:negocio_id>/productos/buscar', methods=['GET'])
@token_required
def buscar_productos_con_precio(current_user, negocio_id):
    """
    Busca productos por nombre y devuelve el precio calculado para un cliente específico.
    Esta es la ruta que usará tu pantalla de ventas (POS).
    """
    query_term = request.args.get('query', '')
    cliente_id = request.args.get('cliente_id', None) # Recibimos el cliente desde el frontend
    lista_id_override = request.args.get('lista_de_precio_id', None)
    
    db = get_db()

    # Buscamos productos que coincidan con el término de búsqueda
    db.execute(
        """
        SELECT id, nombre, alias, precio_venta, stock, sku, imagen_url, ubicacion
        FROM productos
        WHERE negocio_id = %s AND activo = TRUE AND (
            nombre ILIKE %s OR
            sku ILIKE %s OR
            codigo_barras = %s
        )
        LIMIT 10
        """,
        (negocio_id, f"%{query_term}%", f"%{query_term}%", query_term)
    )
    productos = db.fetchall()

    resultados_con_precio_final = []
    for producto in productos:
        precio_base = float(producto['precio_venta'])
        precio_final = get_precio_producto(
            db_cursor=db,
            producto_id=producto['id'],
            negocio_id=negocio_id,
            cliente_id=cliente_id,
            lista_de_precio_id_override=lista_id_override
        )

        producto_dict = dict(producto)
        # Devolvemos ambos precios
        producto_dict['precio_original'] = precio_base
        producto_dict['precio_final'] = precio_final
        # Renombramos precio_venta para evitar confusión
        producto_dict.pop('precio_venta', None)

        resultados_con_precio_final.append(producto_dict)

    return jsonify(resultados_con_precio_final)

# ✨ --- NUEVA RUTA PARA RECALCULAR PRECIOS EN LOTE --- ✨
@bp.route('/negocios/<int:negocio_id>/recalculate-prices', methods=['POST'])
@token_required
def recalculate_prices(current_user, negocio_id):
    print("--- >>> Recalculate endpoint hit! <<< ---")

    data = request.get_json()
    print(f"--- Recalculate Prices Request ---") # <-- LOG 1
    print(f"Received data: {data}")             # <-- LOG 2
    
    product_ids = data.get('product_ids', [])
    cliente_id = data.get('cliente_id', None)
    lista_id_override = data.get('lista_de_precio_id', None)

    if cliente_id == '':
        cliente_id = None
    # ✨ Si el frontend envía lista vacía, la tratamos como None
    if lista_id_override == '': lista_id_override = None

    if not product_ids:
        print("No hay IDs de productos recep., Se retorna vacio") # <-- LOG 3
        return jsonify({})

    db = get_db()
    precios_actualizados = {}

    try: # <-- Añadimos un try/except para capturar errores aquí
        for prod_id in product_ids:
            print(f"Processing product ID: {prod_id}") # <-- LOG 4
            db.execute("SELECT precio_venta FROM productos WHERE id = %s", (prod_id,))
            producto_info = db.fetchone()

            if not producto_info:
                print(f"Product ID {prod_id} not found in database.") # <-- LOG 5
                # Podemos decidir qué hacer: ¿saltarlo o devolver un error? Por ahora lo saltamos.
                continue

            precio_base = float(producto_info['precio_venta'])

            precio_final = get_precio_producto(
                db_cursor=db,
                producto_id=prod_id,
                negocio_id=negocio_id,
                cliente_id=cliente_id,
                lista_de_precio_id_override=lista_id_override
            )

            precios_actualizados[prod_id] = {
                'precio_original': precio_base,
                'precio_final': precio_final
            }
            print(f"Calculated prices for {prod_id}: {precios_actualizados[prod_id]}") # <-- LOG 6

        print(f"Returning updated prices: {precios_actualizados}") # <-- LOG 7
        return jsonify(precios_actualizados)

    except Exception as e:
        print(f"!!! EXCEPTION during price recalculation: {e}") # <-- LOG DE ERROR
        # Devolvemos un error 500 explícito si algo falla aquí dentro
        return jsonify({'error': f'Internal error during recalculation: {str(e)}'}), 500
    

# End Point para obtener los productos por Cod desde el Cel
# en app/routes/product_routes.py

@bp.route('/negocios/<int:negocio_id>/productos/por_codigo', methods=['GET'])
@token_required
def get_producto_por_codigo(current_user, negocio_id):
    codigo = request.args.get('codigo', '')
    print(f"--- Mobile Scan Search ---") # LOG 1
    print(f"Negocio ID: {negocio_id}, Codigo recibido: '{codigo}'") # LOG 2

    if not codigo:
        print("Error: No code received.") # LOG 3
        return jsonify({'error': 'Se requiere un código (SKU o barras)'}), 400

    db = get_db()
    try: # Añadimos Try/Except para capturar errores de DB
        query = """
            SELECT id, nombre, stock, precio_venta, sku, codigo_barras
            FROM productos
            WHERE negocio_id = %s AND activo = TRUE AND (TRIM(LOWER(codigo_barras)) LIKE %s OR TRIM(LOWER(sku)) LIKE %s)
            LIMIT 1
            """
        # Normalizamos el código y lo envolvemos con '%' para la búsqueda de 'contiene'
        codigo_normalizado = f"%{codigo.strip().lower()}%"
        params = (negocio_id, codigo_normalizado, codigo_normalizado)
        print(f"Executing query: {query} with params: {params}") # LOG 4

        db.execute(query, params)
        producto = db.fetchone()

        if not producto:
            print(f"Producto NOT FOUND for code '{codigo}' in negocio {negocio_id}.") # LOG 5
            return jsonify({'error': 'Producto no encontrado'}), 404

        print(f"Producto FOUND: {dict(producto)}") # LOG 6
        return jsonify(dict(producto))

    except Exception as e:
        print(f"!!! DATABASE ERROR searching by code: {e}") # LOG DE ERROR
        return jsonify({'error': f'Error interno de base de datos: {str(e)}'}), 500

# --- ✨ ACCIONES MASIVAS ✨ ---

@bp.route('/productos/bulk', methods=['DELETE'])
@token_required
def bulk_delete_productos(current_user):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    product_ids = data.get('product_ids', [])
    
    if not product_ids:
        return jsonify({'error': 'No se proporcionaron IDs de productos'}), 400

    db = get_db()
    try:
        # Cambio a desactivación masiva lógica
        db.execute("UPDATE productos SET activo = FALSE WHERE id = ANY(%s)", (product_ids,))
        g.db_conn.commit()
        return jsonify({'mensaje': f'{len(product_ids)} productos desactivados con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/productos/bulk/categoria', methods=['PUT'])
@token_required
def bulk_update_categoria(current_user):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    product_ids = data.get('product_ids', [])
    nueva_categoria_id = data.get('categoria_id')

    if not product_ids or nueva_categoria_id is None:
        return jsonify({'error': 'Faltan datos (IDs o Categoría)'}), 400

    db = get_db()
    try:
        db.execute(
            "UPDATE productos SET categoria_id = %s WHERE id = ANY(%s)",
            (nueva_categoria_id, product_ids)
        )
        g.db_conn.commit()
        return jsonify({'mensaje': f'Categoría actualizada en {len(product_ids)} productos'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/productos/bulk/tipo', methods=['PUT'])
@token_required
def bulk_update_tipo(current_user):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    product_ids = data.get('product_ids', [])
    nuevo_tipo = data.get('tipo_producto')

    if not product_ids or not nuevo_tipo:
        return jsonify({'error': 'Faltan datos (IDs o Tipo)'}), 400

    db = get_db()
    try:
        db.execute(
            "UPDATE productos SET tipo_producto = %s WHERE id = ANY(%s)",
            (nuevo_tipo, product_ids)
        )
        g.db_conn.commit()
        return jsonify({'mensaje': f'Tipo de producto actualizado en {len(product_ids)} productos'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
@bp.route('/productos/<int:producto_id>/upload-image', methods=['POST'])
@token_required
def upload_product_image(current_user, producto_id):
    if 'imagen' not in request.files:
        return jsonify({'error': 'No se encontró la imagen en la solicitud'}), 400

    file = request.files['imagen']
    if file.filename == '':
        return jsonify({'error': 'No se seleccionó ninguna imagen'}), 400

    db = get_db()
    # Verificar si el producto existe
    db.execute("SELECT negocio_id FROM productos WHERE id = %s", (producto_id,))
    producto = db.fetchone()
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404

    # Lógica de guardado y compresión
    try:
        ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            return jsonify({'error': 'Formato no soportado'}), 400

        filename = f"prod_{producto_id}_{uuid.uuid4().hex[:8]}.webp"
        
        # Ruta en el volumen persistente
        upload_folder = os.path.join(current_app.static_folder, 'img', 'premios', 'productos')
        os.makedirs(upload_folder, exist_ok=True)
        filepath_img = os.path.join(upload_folder, filename)

        # Abrir y comprimir con Pillow
        img = Image.open(file)
        
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        max_size = 800
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            
        img.save(filepath_img, "WEBP", quality=80)

        relative_path = f"/static/img/premios/productos/{filename}"
        db.execute("UPDATE productos SET imagen_url = %s WHERE id = %s", (relative_path, producto_id))
        g.db_conn.commit()

        return jsonify({'message': 'Imagen subida correctamente', 'imagen_url': relative_path})

    except Exception as e:
        print(f"Error procesando imagen: {e}")
        return jsonify({'error': 'Error al procesar la imagen'}), 500
@bp.route('/productos/<int:producto_id>/image', methods=['DELETE'])
@token_required
def delete_product_image(current_user, producto_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Solo Admin o Superadmin pueden modificar'}), 403

    db = get_db()
    # 1. Buscar la URL de la imagen actual
    db.execute("SELECT imagen_url FROM productos WHERE id = %s", (producto_id,))
    producto = db.fetchone()
    if not producto:
        return jsonify({'error': 'Producto no encontrado'}), 404

    imagen_url = producto.get('imagen_url')
    if not imagen_url:
        return jsonify({'message': 'El producto no tiene imagen'}), 200

    try:
        # 2. Eliminar archivo físico si existe
        # Asumimos que la URL empieza con /static/...
        if imagen_url.startswith('/static/'):
            relative_path = imagen_url[1:] # quitar la primera barra
            filepath = os.path.join(current_app.root_path, relative_path)
            if os.path.exists(filepath):
                os.remove(filepath)

        # 3. Actualizar DB
        db.execute("UPDATE productos SET imagen_url = NULL WHERE id = %s", (producto_id,))
        g.db_conn.commit()

        return jsonify({'message': 'Imagen eliminada con éxito'})

    except Exception as e:
        print(f"Error borrando imagen: {e}")
        return jsonify({'error': 'Error al eliminar la imagen'}), 500
@bp.route('/productos/<int:producto_id>/comprometido', methods=['GET'])
@token_required
def get_comprometido_detalle(current_user, producto_id):
    """Retorna el detalle de pedidos y HR que tienen este producto comprometido."""
    db = get_db()
    
    # Primero buscamos el nombre del producto
    db.execute("SELECT nombre, unidad_medida FROM productos WHERE id = %s", (producto_id,))
    prod = db.fetchone()
    if not prod:
        return jsonify({'error': 'Producto no encontrado'}), 404
        
    query = """
        SELECT 
            p.id as pedido_id,
            c.nombre as cliente_nombre,
            p.estado as pedido_estado,
            p.hoja_ruta_id,
            v.nombre as hr_vendedor,
            hr.fecha as hr_fecha,
            pd.cantidad
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN pedidos_detalle pd ON p.id = pd.pedido_id
        LEFT JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
        LEFT JOIN vendedores v ON hr.vendedor_id = v.id
        WHERE pd.producto_id = %s 
          AND p.estado IN ('pendiente', 'preparado')
          AND (hr.id IS NULL OR hr.carga_confirmada IS FALSE)
        ORDER BY hr.fecha DESC NULLS LAST, p.id DESC
    """
    db.execute(query, (producto_id,))
    detalles = db.fetchall()
    
    return jsonify({
        'producto_nombre': prod['nombre'],
        'unidad_medida': prod['unidad_medida'],
        'detalles': [dict(d) for d in detalles]
    })
