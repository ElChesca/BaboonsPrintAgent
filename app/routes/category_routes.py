# app/routes/category_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query

bp = Blueprint('categories', __name__)

@bp.route('/api/negocios/<int:negocio_id>/categorias', methods=['GET'])
@token_required
def get_categorias(current_user, negocio_id):
    query = "SELECT * FROM productos_categoria WHERE negocio_id = ? ORDER BY nombre"
    categorias = execute_query(query, (negocio_id,), fetchall=True)
    return jsonify([dict(c) for c in categorias])

@bp.route('/api/negocios/<int:negocio_id>/categorias', methods=['POST'])
@token_required
def create_categoria(current_user, negocio_id):
    data = request.get_json()
    nombre = data.get('nombre')
    if not nombre:
        return jsonify({'message': 'El nombre es requerido'}), 400

    query = "INSERT INTO productos_categoria (negocio_id, nombre) VALUES (?, ?)"
    execute_query(query, (negocio_id, nombre), commit=True)
    
    return jsonify({'message': 'Categoría creada con éxito'}), 201

@bp.route('/api/categorias/<int:id>', methods=['PUT'])
@token_required
def update_categoria(current_user, id):
    data = request.get_json()
    nombre = data.get('nombre')
    if not nombre:
        return jsonify({'message': 'El nombre no puede estar vacío'}), 400

    query = "UPDATE productos_categoria SET nombre = ? WHERE id = ?"
    execute_query(query, (nombre, id), commit=True)
    return jsonify({'message': 'Categoría actualizada'})

@bp.route('/api/categorias/<int:id>', methods=['DELETE'])
@token_required
def delete_categoria(current_user, id):
    execute_query("DELETE FROM productos_categoria WHERE id = ?", (id,), commit=True)
    return jsonify({'message': 'Categoría eliminada'})
