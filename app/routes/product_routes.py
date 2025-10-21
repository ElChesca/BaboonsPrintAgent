# app/routes/product_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
from app.pricing_logic import get_precio_producto # Importa el motor de precios

bp = Blueprint('products', __name__)

@bp.route('/negocios/<int:negocio_id>/productos', methods=['GET'])
@token_required
def get_productos(current_user, negocio_id):
    db = get_db()
    db.execute(
        """
        SELECT p.*, c.nombre as categoria_nombre, prov.nombre as proveedor_nombre
        FROM productos p
        LEFT JOIN productos_categoria c ON p.categoria_id = c.id
        LEFT JOIN proveedores prov ON p.proveedor_id = prov.id
        WHERE p.negocio_id = %s ORDER BY p.nombre
        """,
        (negocio_id,)
    )
    productos = db.fetchall()
    return jsonify([dict(row) for row in productos])

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
    try:
        db.execute(
            """
            INSERT INTO productos (negocio_id, nombre, stock, precio_venta, precio_costo, unidad_medida, 
                                   categoria_id, stock_minimo, sku, codigo_barras, proveedor_id) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                negocio_id, data.get('nombre'), data.get('stock'), data.get('precio_venta'), data.get('precio_costo'),
                data.get('unidad_medida'), data.get('categoria_id'), data.get('stock_minimo'), data.get('sku'),
                data.get('codigo_barras'), data.get('proveedor_id')
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
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Solo un Admin puede modificar'}), 403
    
    update_data = request.get_json()
    campos_validos = [
        'nombre', 'stock', 'precio_venta', 'precio_costo', 'unidad_medida', 
        'categoria_id', 'stock_minimo', 'sku', 'codigo_barras', 'proveedor_id'
    ]
    fields = [f"{key} = %s" for key in update_data.keys() if key in campos_validos]
    values = [value for key, value in update_data.items() if key in campos_validos]
    
    if not fields:
        return jsonify({'error': 'No hay campos válidos para actualizar'}), 400
    
    values.append(producto_id)
    db = get_db()
    db.execute(f"UPDATE productos SET {', '.join(fields)} WHERE id = %s", tuple(values))
    g.db_conn.commit()
    
    db.execute('SELECT * FROM productos WHERE id = %s', (producto_id,))
    producto_actualizado = db.fetchone()
    return jsonify(dict(producto_actualizado))

@bp.route('/productos/<int:producto_id>', methods=['DELETE'])
@token_required
def delete_producto(current_user, producto_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    db = get_db()
    db.execute('DELETE FROM productos WHERE id = %s', (producto_id,))
    g.db_conn.commit()
    return jsonify({'mensaje': 'Producto eliminado con éxito'})


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
            p.stock
        FROM productos p
        JOIN (
            SELECT vd.producto_id, COUNT(vd.producto_id) as total_ventas
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.negocio_id = %s
            GROUP BY vd.producto_id
            ORDER BY total_ventas DESC
            LIMIT %s
        ) as top_productos ON p.id = top_productos.producto_id;
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
    
    db = get_db()
    
    # Buscamos productos que coincidan con el término de búsqueda
    db.execute(
        """
        SELECT id, nombre, precio_venta, stock 
        FROM productos 
        WHERE negocio_id = %s AND (
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
            cliente_id=cliente_id
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
# en app/routes/product_routes.py
# en app/routes/product_routes.py

@bp.route('/negocios/<int:negocio_id>/recalculate-prices', methods=['POST'])
@token_required
def recalculate_prices(current_user, negocio_id):
    data = request.get_json()
    print(f"--- Recalculate Prices Request ---") # <-- LOG 1
    print(f"Received data: {data}")             # <-- LOG 2
    
    product_ids = data.get('product_ids', [])
    cliente_id = data.get('cliente_id', None)
    if cliente_id == '':
        cliente_id = None

    if not product_ids:
        print("No product IDs received, returning empty.") # <-- LOG 3
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
                cliente_id=cliente_id
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
    