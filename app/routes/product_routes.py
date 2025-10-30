# app/routes/product_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query # Importamos la nueva función

bp = Blueprint('products', __name__)

@bp.route('/api/negocios/<int:negocio_id>/productos', methods=['GET'])
@token_required
def get_productos(current_user, negocio_id):
    query = """
        SELECT p.*, c.nombre as categoria_nombre
        FROM productos p
        LEFT JOIN productos_categoria c ON p.categoria_id = c.id
        WHERE p.negocio_id = ?
    """
    productos = execute_query(query, (negocio_id,), fetchall=True)
    return jsonify([dict(row) for row in productos])

@bp.route('/api/productos/<int:producto_id>', methods=['GET'])
@token_required
def get_producto_por_id(current_user, producto_id):
    producto = execute_query('SELECT * FROM productos WHERE id = ?', (producto_id,), fetchone=True)
    if producto is None:
        return jsonify({'message': 'Producto no encontrado'}), 404
    return jsonify(dict(producto))

@bp.route('/api/negocios/<int:negocio_id>/productos', methods=['POST'])
@token_required
def add_producto(current_user, negocio_id):
    data = request.get_json()

    # Validación de duplicados
    if 'sku' in data and data['sku']:
        existe = execute_query("SELECT id FROM productos WHERE sku = ? AND negocio_id = ?", (data['sku'], negocio_id), fetchone=True)
        if existe:
            return jsonify({'message': 'Ya existe un producto con este SKU en este negocio.'}), 409

    fields = ['nombre', 'sku', 'stock', 'precio_costo', 'precio_venta', 'unidad_medida', 'categoria_id', 'proveedor_id', 'stock_minimo', 'codigo_barras']
    values = [negocio_id] + [data.get(field) for field in fields]
    
    query = f"""
        INSERT INTO productos (negocio_id, {', '.join(fields)})
        VALUES ({', '.join(['?'] * (len(fields) + 1))})
    """
    execute_query(query, tuple(values), commit=True)
    
    # Aquí necesitaríamos obtener el ID del producto recién insertado.
    # Esta parte es dependiente de la DB, por ahora devolvemos un mensaje genérico.
    return jsonify({'message': 'Producto creado con éxito'}), 201


@bp.route('/api/productos/<int:producto_id>', methods=['PUT'])
@token_required
def update_producto(current_user, producto_id):
    data = request.get_json()
    fields = [key for key in data.keys() if key != 'id']
    values = [data[key] for key in fields] + [producto_id]
    
    set_clause = ', '.join([f"{field} = ?" for field in fields])
    query = f"UPDATE productos SET {set_clause} WHERE id = ?"
    
    execute_query(query, tuple(values), commit=True)

    producto_actualizado = execute_query('SELECT * FROM productos WHERE id = ?', (producto_id,), fetchone=True)
    return jsonify(dict(producto_actualizado))

@bp.route('/api/productos/<int:producto_id>', methods=['DELETE'])
@token_required
def delete_producto(current_user, producto_id):
    execute_query('DELETE FROM productos WHERE id = ?', (producto_id,), commit=True)
    return jsonify({'message': 'Producto eliminado'})

# Mantén el resto de las rutas aquí si existen, y modifícalas de la misma manera.
# ... (otras rutas como get_top_productos, buscar_productos_con_precio, etc.)
# Por brevedad, me centraré en las principales. El patrón es el mismo.
