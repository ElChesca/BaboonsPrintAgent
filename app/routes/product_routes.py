# app/routes/product_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

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