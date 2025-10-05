# app/routes/product_routes.py
from flask import Blueprint, request, jsonify
from app.database import get_db
from .auth_routes import token_required

bp = Blueprint('products', __name__)

# --- Rutas para Productos ---

@bp.route('/negocios/<int:negocio_id>/productos', methods=['GET'])
@token_required
def get_productos(current_user, negocio_id):
    db = get_db()
    query = """
        SELECT
            p.*,
            c.nombre as categoria_nombre,
            prov.nombre as proveedor_nombre
        FROM
            productos p
        LEFT JOIN
            productos_categoria c ON p.categoria_id = c.id
        LEFT JOIN
            proveedores prov ON p.proveedor_id = prov.id
        WHERE
            p.negocio_id = %s -- ✨ Cambio 1: Parámetro para PostgreSQL
        ORDER BY
            p.nombre
    """
    # ✨ Cambio 2: Se separa la ejecución de la obtención de resultados
    db.execute(query, (negocio_id,))
    productos = db.fetchall()
    
    return jsonify([dict(row) for row in productos])

@bp.route('/productos/<int:producto_id>', methods=['GET'])
@token_required
def get_producto_por_id(current_user, producto_id):
    db = get_db()
    # --- CORRECCIÓN ---
    db.execute(
        """
        SELECT id, nombre, stock, precio_venta, precio_costo, unidad_medida, 
               categoria_id, stock_minimo, sku, codigo_barras, proveedor_id
        FROM productos 
        WHERE id = %s
        """,
        (producto_id,)
    )
    producto = db.fetchone()
    # --------------------
    if producto is None:
        return jsonify({'error': 'Producto no encontrado'}), 404
    return jsonify(dict(producto))



@bp.route('/negocios/<int:negocio_id>/productos', methods=['POST'])
@token_required
def add_producto(current_user, negocio_id):
    nuevo_producto = request.get_json()
    # ... (validaciones)

    db = get_db()
    cursor = db.cursor()
    # ✨ Consulta actualizada para insertar los nuevos campos
    cursor.execute(
        """
        INSERT INTO productos (negocio_id, nombre, stock, precio_venta, precio_costo, 
                               unidad_medida, categoria_id, stock_minimo, sku, codigo_barras, proveedor_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            negocio_id, nuevo_producto['nombre'], nuevo_producto.get('stock'),
            nuevo_producto.get('precio_venta'), nuevo_producto.get('precio_costo'),
            nuevo_producto.get('unidad_medida'), nuevo_producto.get('categoria_id'),
            nuevo_producto.get('stock_minimo'), nuevo_producto.get('sku'),
            nuevo_producto.get('codigo_barras'), nuevo_producto.get('proveedor_id')
        )
    )
    db.commit()
    nuevo_id = cursor.lastrowid
    producto_creado = db.execute('SELECT * FROM productos WHERE id = ?', (nuevo_id,)).fetchone()
    return jsonify(dict(producto_creado)), 201

@bp.route('/productos/<int:producto_id>', methods=['PUT'])
@token_required
def update_producto(current_user, producto_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Solo un Admin puede modificar'}), 403
    
    update_data = request.get_json()
    # ✨ Añadimos los nuevos campos a la lista de campos válidos para actualizar
    campos_validos = [
        'nombre', 'stock', 'precio_venta', 'precio_costo', 'unidad_medida', 
        'categoria_id', 'stock_minimo', 'sku', 'codigo_barras', 'proveedor_id'
    ]
    
    fields = [f"{key} = ?" for key in update_data.keys() if key in campos_validos]
    values = [value for key, value in update_data.items() if key in campos_validos]
    
    if not fields:
        return jsonify({'error': 'No hay campos válidos para actualizar'}), 400
    
    values.append(producto_id)
    db = get_db()
    db.execute(f"UPDATE productos SET {', '.join(fields)} WHERE id = ?", tuple(values))
    db.commit()
    producto_actualizado = db.execute('SELECT * FROM productos WHERE id = ?', (producto_id,)).fetchone()
    return jsonify(dict(producto_actualizado))

@bp.route('/productos/<int:producto_id>', methods=['DELETE'])
@token_required
def delete_producto(current_user, producto_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida para Usuarios - Solo Admin'}), 403
    
    db = get_db()
    db.execute('DELETE FROM productos WHERE id = ?', (producto_id,))
    db.commit()
    return jsonify({'mensaje': 'Producto eliminado con éxito'})