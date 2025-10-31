# app/routes/category_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('categories', __name__)

@bp.route('/negocios/<int:negocio_id>/categorias', methods=['GET'])
@token_required
def get_categorias(current_user, negocio_id):
    db = get_db()
    db.execute('SELECT * FROM productos_categoria WHERE negocio_id = %s ORDER BY nombre', (negocio_id,))
    categorias = db.fetchall()
    return jsonify([dict(row) for row in categorias])

@bp.route('/negocios/<int:negocio_id>/categorias', methods=['POST'])
@token_required
def create_categoria(current_user, negocio_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO productos_categoria (nombre, negocio_id) VALUES (%s, %s) RETURNING id',
            (data['nombre'], negocio_id)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'nombre': data['nombre']}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': 'Esa categoría ya existe o ocurrió un error'}), 409

@bp.route('/categorias/<int:id>', methods=['PUT'])
@token_required
def update_categoria(current_user, id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    db.execute('UPDATE productos_categoria SET nombre = %s WHERE id = %s', (data['nombre'], id))
    g.db_conn.commit()
    return jsonify({'message': 'Categoría actualizada con éxito'})

@bp.route('/categorias/<int:id>', methods=['DELETE'])
@token_required
def delete_categoria(current_user, id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()
    db.execute('DELETE FROM productos_categoria WHERE id = %s', (id,))
    g.db_conn.commit()
    return jsonify({'message': 'Categoría eliminada con éxito'})
