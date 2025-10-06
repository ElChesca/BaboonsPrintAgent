# app/routes/product_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('products', __name__)

@bp.route('/negocios/<int:negocio_id>/productos', methods=['GET'])
@token_required
def get_productos(current_user, negocio_id):
    db = get_db()
    db.execute("SELECT p.*, c.nombre as categoria_nombre FROM productos p LEFT JOIN productos_categoria c ON p.categoria_id = c.id WHERE p.negocio_id = %s ORDER BY p.nombre", (negocio_id,))
    productos = db.fetchall()
    return jsonify([dict(row) for row in productos])

@bp.route('/negocios/<int:negocio_id>/productos', methods=['POST'])
@token_required
def add_producto(current_user, negocio_id):
    nuevo_producto = request.get_json()
    # ... validaciones ...
    db = get_db()
    db.execute(
        """
        INSERT INTO productos (negocio_id, nombre, codigo_barras, stock, precio_costo, precio_venta, unidad_medida)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (negocio_id, nuevo_producto['nombre'], nuevo_producto.get('codigo_barras'), nuevo_producto['stock'], nuevo_producto.get('precio_costo'), nuevo_producto['precio_venta'], nuevo_producto.get('unidad_medida', 'unidades'))
    )
    nuevo_id = db.fetchone()['id']
    g.db_conn.commit()
    db.execute('SELECT * FROM productos WHERE id = %s', (nuevo_id,))
    producto_creado = db.fetchone()
    return jsonify(dict(producto_creado)), 201

@bp.route('/productos/<int:producto_id>', methods=['PUT'])
@token_required
def update_producto(current_user, producto_id):
    update_data = request.get_json()
    # ... lógica de construcción de fields y values con '%s'
    fields = [f"{key} = %s" for key in update_data.keys()]
    values = list(update_data.values())
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
    db = get_db()
    db.execute('DELETE FROM productos WHERE id = %s', (producto_id,))
    g.db_conn.commit()
    return jsonify({'mensaje': 'Producto eliminado con éxito'})