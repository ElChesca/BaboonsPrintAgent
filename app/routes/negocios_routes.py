# app/routes/negocios_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query

bp = Blueprint('negocios', __name__)

@bp.route('/api/negocios', methods=['GET'])
@token_required
def get_negocios(current_user):
    # Obtiene solo los negocios a los que el usuario tiene acceso
    query = """
        SELECT n.id, n.nombre
        FROM negocios n
        JOIN usuarios_negocios un ON n.id = un.negocio_id
        WHERE un.usuario_id = ?
    """
    negocios = execute_query(query, (current_user['id'],), fetchall=True)
    return jsonify([dict(row) for row in negocios])

@bp.route('/api/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'No tienes permiso para crear negocios'}), 403
    
    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')

    if not nombre:
        return jsonify({'message': 'El nombre del negocio es requerido'}), 400

    query = "INSERT INTO negocios (nombre, descripcion) VALUES (?, ?)"
    execute_query(query, (nombre, descripcion), commit=True)
    
    return jsonify({'message': 'Negocio creado con éxito'}), 201

@bp.route('/api/negocios/<int:id>', methods=['GET'])
@token_required
def obtener_negocio(current_user, id):
    negocio = execute_query("SELECT * FROM negocios WHERE id = ?", (id,), fetchone=True)
    if not negocio:
        return jsonify({'message': 'Negocio no encontrado'}), 404
    return jsonify(dict(negocio))

@bp.route('/api/negocios/<int:id>', methods=['PUT'])
@token_required
def actualizar_negocio(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'No tienes permiso para editar negocios'}), 403

    data = request.get_json()
    nombre = data.get('nombre')
    descripcion = data.get('descripcion')

    if not nombre:
        return jsonify({'message': 'El nombre no puede estar vacío'}), 400

    query = "UPDATE negocios SET nombre = ?, descripcion = ? WHERE id = ?"
    execute_query(query, (nombre, descripcion, id), commit=True)

    return jsonify({'message': 'Negocio actualizado correctamente'})
