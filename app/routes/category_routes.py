from flask import Blueprint, jsonify, request, g
from app import get_db
from .auth_routes import token_required

bp = Blueprint('categories', __name__)

@bp.route('/categorias', methods=['GET'])
@token_required
def get_categorias(current_user):
    db = get_db()
    db.execute('SELECT * FROM productos_categoria ORDER BY nombre')
    categorias = db.fetchall()
    return jsonify([dict(row) for row in categorias])

@bp.route('/categorias', methods=['POST'])
@token_required
def create_categoria(current_user):
    """Crea una nueva categoría (solo admins)."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute('INSERT INTO productos_categoria (nombre) VALUES (?)', (data['nombre'],))
        db.commit()
        return jsonify({'id': cursor.lastrowid, 'nombre': data['nombre']}), 201
    except db.IntegrityError:
        return jsonify({'error': 'Esa categoría ya existe'}), 409

@bp.route('/categorias/<int:id>', methods=['PUT'])
@token_required
def update_categoria(current_user, id):
    """Actualiza el nombre de una categoría (solo admins)."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
        
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    db.execute('UPDATE productos_categoria SET nombre = ? WHERE id = ?', (data['nombre'], id))
    db.commit()
    return jsonify({'message': 'Categoría actualizada con éxito'})

@bp.route('/categorias/<int:id>', methods=['DELETE'])
@token_required
def delete_categoria(current_user, id):
    """Elimina una categoría (solo admins)."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    db = get_db()
    # En un futuro, podríamos verificar que la categoría no esté en uso antes de borrar.
    db.execute('DELETE FROM productos_categoria WHERE id = ?', (id,))
    db.commit()
    return jsonify({'message': 'Categoría eliminada con éxito'})