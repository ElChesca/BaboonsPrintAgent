# app/routes/user_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.extensions import bcrypt
from app.auth_decorator import token_required

bp = Blueprint('users', __name__)

@bp.route('/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    if current_user['rol'] != 'admin': return jsonify({'message': 'Acción no permitida'}), 403
    db = get_db()
    db.execute('SELECT id, nombre, email, rol FROM usuarios')
    usuarios_rows = db.fetchall()
    usuarios = [dict(row) for row in usuarios_rows]
    for user in usuarios:
        db.execute('SELECT n.id, n.nombre FROM negocios n JOIN usuarios_negocios un ON n.id = un.negocio_id WHERE un.usuario_id = %s', (user['id'],))
        negocios_rows = db.fetchall()
        user['negocios_asignados'] = [dict(row) for row in negocios_rows]
    return jsonify(usuarios)

@bp.route('/usuarios', methods=['POST'])
@token_required
def create_usuario(current_user):
    if current_user['rol'] != 'admin': return jsonify({'message': 'Acción no permitida'}), 403
    data = request.get_json()
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    db = get_db()
    try:
        db.execute('INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, %s) RETURNING id', (data['nombre'], data['email'], hashed_password, data['rol']))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Usuario creado con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'message': 'El email ya está en uso'}), 409

@bp.route('/usuarios/<int:id>', methods=['PUT'])
@token_required
def update_usuario(current_user, id):
    if current_user['rol'] != 'admin': return jsonify({'message': 'Acción no permitida'}), 403
    data = request.get_json()
    db = get_db()
    db.execute('UPDATE usuarios SET rol = %s WHERE id = %s', (data.get('rol'), id))
    db.execute('DELETE FROM usuarios_negocios WHERE usuario_id = %s', (id,))
    if data.get('rol') == 'operador' and data.get('negocios_ids'):
        for negocio_id in data['negocios_ids']:
            db.execute('INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)', (id, negocio_id))
    g.db_conn.commit()
    return jsonify({'message': 'Usuario actualizado con éxito'})