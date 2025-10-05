# app/routes/user_routes.py
from flask import Blueprint, jsonify, g
from app.database import get_db
from app.extensions import bcrypt
from app.auth_decorator import token_required

bp = Blueprint('users', __name__)

@bp.route('/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    """
    Obtiene la lista de todos los usuarios y los negocios que tienen asignados.
    """
    db = get_db()
    
    db.execute('SELECT id, nombre, rol, email FROM usuarios ORDER BY nombre')
    usuarios_rows = db.fetchall()
    usuarios = [dict(row) for row in usuarios_rows]
    
    # Se asume la existencia de la tabla 'usuarios_negocios'
    for user in usuarios:
        db.execute(
            """
            SELECT n.id, n.nombre 
            FROM negocios n 
            JOIN usuarios_negocios un ON n.id = un.negocio_id 
            WHERE un.usuario_id = %s
            """,
            (user['id'],)
        )
        negocios_rows = db.fetchall()
        user['negocios_asignados'] = [dict(row) for row in negocios_rows]
        
    return jsonify(usuarios)

@bp.route('/usuarios/<int:usuario_id>', methods=['GET'])
@token_required
def get_usuario_por_id(current_user, usuario_id):
    """ Devuelve los datos de un usuario específico por su ID. """
    db = get_db()
    db.execute(
        'SELECT id, nombre, rol, email FROM usuarios WHERE id = %s',
        (usuario_id,)
    )
    usuario = db.fetchone()

    if usuario is None:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    return jsonify(dict(usuario))