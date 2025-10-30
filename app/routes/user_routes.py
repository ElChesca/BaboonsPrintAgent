# app/routes/user_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query # Importamos la utilidad
from app.extensions import bcrypt

bp = Blueprint('users', __name__)

# NOTA: La lógica para obtener, crear y actualizar usuarios es compleja
# y depende mucho de las reglas de negocio. Esta es una versión simplificada
# que sigue el patrón de la base de datos dual.

@bp.route('/api/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acceso no autorizado'}), 403

    from flask import g

    # La función de agregación de cadenas varía entre SQLite y PostgreSQL
    if g.db_type == 'postgres':
        agg_func = "STRING_AGG(n.nombre, ', ')"
    else:
        agg_func = "GROUP_CONCAT(n.nombre)"

    # Obtener todos los usuarios con sus negocios asociados
    query = f"""
        SELECT u.id, u.nombre, u.email, u.rol, {agg_func} as negocios
        FROM usuarios u
        LEFT JOIN usuarios_negocios un ON u.id = un.usuario_id
        LEFT JOIN negocios n ON un.negocio_id = n.id
        GROUP BY u.id, u.nombre, u.email, u.rol
    """
    # Nota: PostgreSQL requiere que todas las columnas no agregadas estén en el GROUP BY

    users = execute_query(query, fetchall=True)
    return jsonify([dict(row) for row in users])


@bp.route('/api/usuarios', methods=['POST'])
@token_required
def create_user(current_user):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acceso no autorizado'}), 403

    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')
    password = data.get('password')
    rol = data.get('rol', 'empleado')
    negocios_ids = data.get('negocios_ids', [])

    if not all([nombre, email, password]):
        return jsonify({'message': 'Faltan datos requeridos'}), 400

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Insertar usuario
    insert_user_query = "INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)"
    execute_query(insert_user_query, (nombre, email, hashed_password, rol), commit=True)
    
    # Obtener el ID del nuevo usuario (esto es dependiente de la DB)
    # Por simplicidad, lo buscamos por email
    new_user = execute_query("SELECT id FROM usuarios WHERE email = ?", (email,), fetchone=True)
    user_id = new_user['id']

    # Asociar negocios
    for negocio_id in negocios_ids:
        execute_query("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (?, ?)", (user_id, negocio_id), commit=True)

    return jsonify({'message': 'Usuario creado con éxito'}), 201


@bp.route('/api/usuarios/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acceso no autorizado'}), 403

    data = request.get_json()
    # Lógica para actualizar rol, nombre, etc.
    nuevo_rol = data.get('rol')
    if nuevo_rol:
        execute_query("UPDATE usuarios SET rol = ? WHERE id = ?", (nuevo_rol, user_id), commit=True)

    # Lógica para actualizar asociaciones de negocios
    negocios_ids = data.get('negocios_ids')
    if negocios_ids is not None:
        # Primero borrar asociaciones existentes
        execute_query("DELETE FROM usuarios_negocios WHERE usuario_id = ?", (user_id,), commit=True)
        # Luego añadir las nuevas
        for negocio_id in negocios_ids:
            execute_query("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (?, ?)", (user_id, negocio_id), commit=True)

    return jsonify({'message': 'Usuario actualizado correctamente'})
