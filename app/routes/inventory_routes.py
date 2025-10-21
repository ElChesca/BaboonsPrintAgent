from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('inventario_ops', __name__, url_prefix='/api')

@bp.route('/inventario/ajustar', methods=['POST'])
@token_required
def ajustar_stock(current_user):
    data = request.get_json()
    producto_id = data.get('producto_id')
    cantidad_nueva = data.get('cantidad_nueva')
    negocio_id = data.get('negocio_id') # Necesitamos saber a qué negocio pertenece

    if producto_id is None or cantidad_nueva is None or negocio_id is None:
        return jsonify({'error': 'Faltan datos requeridos (producto_id, cantidad_nueva, negocio_id)'}), 400

    try:
        cantidad_nueva = int(cantidad_nueva)
    except ValueError:
        return jsonify({'error': 'La cantidad nueva debe ser un número entero'}), 400

    db = get_db()
    try:
        # 1. Obtener stock actual para loguear
        db.execute("SELECT stock FROM productos WHERE id = %s AND negocio_id = %s", (producto_id, negocio_id))
        producto = db.fetchone()
        if not producto:
            return jsonify({'error': 'Producto no encontrado en este negocio'}), 404
        
        cantidad_anterior = producto['stock']
        diferencia = cantidad_nueva - cantidad_anterior

        # 2. Actualizar el stock en la tabla de productos
        db.execute("UPDATE productos SET stock = %s WHERE id = %s", (cantidad_nueva, producto_id))

        # 3. Registrar el ajuste en la tabla de historial
        db.execute(
            """
            INSERT INTO inventario_ajustes 
            (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (producto_id, current_user['id'], negocio_id, cantidad_anterior, cantidad_nueva, diferencia)
        )

        g.db_conn.commit()
        return jsonify({'message': 'Stock actualizado con éxito'}), 200

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500