# app/routes/user_routes.py
from flask import Blueprint, request, jsonify
from app.database import get_db, bcrypt
from app.auth_decorator import token_required

bp = Blueprint('users', __name__)

# --- Rutas para Usuarios (SOLO ADMINS) ---
# EN: app/routes/user_routes.py
@bp.route('/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    """
    Obtiene la lista de todos los usuarios y los negocios que tienen asignados.
    Cualquier usuario logueado puede ver la lista.
    """
    db = get_db()
    
    # 1. Obtenemos la lista base de usuarios
    usuarios_rows = db.execute('SELECT id, nombre, rol FROM usuarios ORDER BY nombre').fetchall()
    # Convertimos a una lista de diccionarios para poder modificarla
    usuarios = [dict(row) for row in usuarios_rows]
    
    # 2. Recorremos cada usuario para añadirle sus negocios asignados
    for user in usuarios:
        negocios_rows = db.execute(
            """
            SELECT n.id, n.nombre 
            FROM negocios n 
            JOIN usuarios_negocios un ON n.id = un.negocio_id 
            WHERE un.usuario_id = ?
            """,
            (user['id'],)
        ).fetchall()
        user['negocios_asignados'] = [dict(row) for row in negocios_rows]
        
    # 3. Devolvemos la lista completa y enriquecida
    return jsonify(usuarios)

@bp.route('/usuarios', methods=['POST'])
@token_required
def create_usuario(current_user):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    if not all(k in data for k in ['nombre', 'email', 'password', 'rol']):
        return jsonify({'message': 'Faltan datos'}), 400

    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            (data['nombre'], data['email'], hashed_password, data['rol'])
        )
        db.commit()
        return jsonify({'id': cursor.lastrowid, 'message': 'Usuario creado con éxito'}), 201
    except db.IntegrityError:
        return jsonify({'message': 'El email ya está en uso'}), 409

@bp.route('/usuarios/<int:id>', methods=['PUT'])
@token_required
def update_usuario(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    rol = data.get('rol')
    negocios_ids = data.get('negocios_ids', [])

    db = get_db()
    db.execute('UPDATE usuarios SET rol = ? WHERE id = ?', (rol, id))
    db.execute('DELETE FROM usuarios_negocios WHERE usuario_id = ?', (id,))
    
    if rol == 'operador' and negocios_ids:
        for negocio_id in negocios_ids:
            db.execute('INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (?, ?)', (id, negocio_id))
    
    db.commit()
    return jsonify({'message': 'Usuario actualizado con éxito'})

@bp.route('/usuarios/<int:usuario_id>', methods=['GET'])
@token_required
def get_usuario_por_id(current_user, usuario_id):
    """ Devuelve los datos de un usuario específico por su ID. """
    db = get_db()
    # Seleccionamos solo los datos seguros, nunca la contraseña
    usuario = db.execute(
        'SELECT id, nombre, rol FROM usuarios WHERE id = ?',
        (usuario_id,)
    ).fetchone()

    if usuario is None:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    
    return jsonify(dict(usuario))
