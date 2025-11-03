# app/routes/user_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.extensions import bcrypt
from app.auth_decorator import token_required
from werkzeug.security import generate_password_hash, check_password_hash

bp = Blueprint('users', __name__)

# app/routes/users_routes.py

@bp.route('/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    # --- 1. CORRECCIÓN DE PERMISOS ---
    # Permitimos el acceso a 'admin' y 'superadmin'
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()

    # --- 2. LÓGICA DE ROLES Y CONSULTA OPTIMIZADA ---
    try:
        if current_user['rol'] == 'superadmin':
            # SuperAdmin: Ve a TODOS los usuarios de TODOS los negocios.
            # Usamos json_agg para agrupar los negocios en un array JSON en una sola consulta.
            query = """
                SELECT
                    u.id, u.nombre, u.email, u.rol,
                    COALESCE(
                        json_agg(json_build_object('id', n.id, 'nombre', n.nombre))
                        FILTER (WHERE n.id IS NOT NULL),
                        '[]'
                    ) AS negocios_asignados
                FROM usuarios u
                LEFT JOIN usuarios_negocios un ON u.id = un.usuario_id
                LEFT JOIN negocios n ON un.negocio_id = n.id
                GROUP BY u.id, u.nombre, u.email, u.rol
                ORDER BY u.nombre;
            """
            db.execute(query)
            usuarios = db.fetchall()

        else: # current_user['rol'] == 'admin'
            # Admin: Ve solo a los usuarios que comparten al menos un negocio con él.
            query = """
                WITH admin_negocios AS (
                    -- Obtenemos los IDs de los negocios del admin actual
                    SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s
                ),
                usuarios_visibles AS (
                    -- Obtenemos los IDs de todos los usuarios que están en esos negocios
                    SELECT DISTINCT usuario_id FROM usuarios_negocios
                    WHERE negocio_id IN (SELECT negocio_id FROM admin_negocios)
                )
                SELECT
                    u.id, u.nombre, u.email, u.rol,
                    COALESCE(
                        -- Mostramos solo los negocios que el admin actual también puede ver
                        json_agg(json_build_object('id', n.id, 'nombre', n.nombre))
                        FILTER (WHERE n.id IS NOT NULL AND n.id IN (SELECT negocio_id FROM admin_negocios)),
                        '[]'
                    ) AS negocios_asignados
                FROM usuarios u
                JOIN usuarios_visibles uv ON u.id = uv.usuario_id
                LEFT JOIN usuarios_negocios un ON u.id = un.usuario_id
                LEFT JOIN negocios n ON un.negocio_id = n.id
                GROUP BY u.id, u.nombre, u.email, u.rol
                ORDER BY u.nombre;
            """
            db.execute(query, (current_user['id'],))
            usuarios = db.fetchall()

        return jsonify([dict(row) for row in usuarios])

    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! ERROR en get_usuarios: {e}")
        return jsonify({'error': f'Error al obtener usuarios: {str(e)}'}), 500


# En app/routes/users_routes.py

@bp.route('/usuarios', methods=['POST'])
@token_required
def create_user(current_user):
    # --- 1. CORRECCIÓN DE PERMISOS ---
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email y contraseña son obligatorios'}), 400

    email = data.get('email')
    nombre = data.get('nombre', email) # Default nombre a email si no se provee
    rol = data.get('rol', 'operador')
    hashed_password = generate_password_hash(data['password']) # Asumo que tenés una función para hashear
    negocios_ids_nuevos = data.get('negocios_ids', [])

    db = get_db()
    try:
        # --- 2. LÓGICA DE ASIGNACIÓN DE NEGOCIOS POR ROL ---
        negocios_para_asignar = []
        if current_user['rol'] == 'superadmin':
            # El SuperAdmin puede asignar cualquier negocio que le envíen
            negocios_para_asignar = negocios_ids_nuevos

        else: # current_user['rol'] == 'admin'
            # Un Admin solo puede asignar los negocios que él mismo tiene
            db.execute("SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s", (current_user['id'],))
            negocios_del_admin = {row['negocio_id'] for row in db.fetchall()}

            # Filtramos la lista: solo asignamos los que el admin tiene permiso
            for negocio_id in negocios_ids_nuevos:
                if int(negocio_id) in negocios_del_admin:
                    negocios_para_asignar.append(negocio_id)
                else:
                    # Opcional: loguear que un admin intentó asignar un negocio sin permiso
                    print(f"Admin {current_user['id']} intentó asignar negocio {negocio_id} sin permiso.")

        # Insertamos el nuevo usuario
        db.execute(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES (%s, %s, %s, %s) RETURNING id",
            (nombre, email, hashed_password, rol)
        )
        nuevo_usuario_id = db.fetchone()['id']

        # Asignamos los negocios filtrados
        if negocios_para_asignar:
            for negocio_id in negocios_para_asignar:
                db.execute(
                    "INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)",
                    (nuevo_usuario_id, negocio_id)
                )

        g.db_conn.commit()
        return jsonify({'message': 'Usuario creado con éxito', 'id': nuevo_usuario_id}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! ERROR en create_user: {e}")
        if 'UNIQUE constraint' in str(e): # Asumiendo PostgreSQL/SQLite
             return jsonify({'error': 'El email ya existe'}), 409
        return jsonify({'error': f'Error al crear usuario: {str(e)}'}), 500
    

# En app/routes/users_routes.py

@bp.route('/usuarios/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    # --- 1. CORRECCIÓN DE PERMISOS ---
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    nuevo_rol = data.get('rol')
    negocios_ids_nuevos = data.get('negocios_ids') # El frontend envía la lista completa de IDs

    db = get_db()

    try:
        # --- 2. VERIFICACIÓN DE PERMISO DE EDICIÓN ---
        if current_user['rol'] == 'admin':
            # Un Admin solo puede editar usuarios que compartan al menos un negocio con él
            db.execute(
                """
                SELECT 1 FROM usuarios_negocios
                WHERE usuario_id = %s
                AND negocio_id IN (SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s)
                """,
                (user_id, current_user['id'])
            )
            if not db.fetchone():
                 return jsonify({'message': 'No tiene permiso para editar este usuario'}), 403

        # --- 3. ACTUALIZAR ROL ---
        if nuevo_rol:
            db.execute("UPDATE usuarios SET rol = %s WHERE id = %s", (nuevo_rol, user_id))

        # --- 4. ACTUALIZAR ASIGNACIÓN DE NEGOCIOS (Lógica por Rol) ---
        if negocios_ids_nuevos is not None: # Chequea si la lista fue enviada (incluso si está vacía)

            if current_user['rol'] == 'superadmin':
                # SuperAdmin: borra todo y reasigna la lista completa
                db.execute("DELETE FROM usuarios_negocios WHERE usuario_id = %s", (user_id,))
                if negocios_ids_nuevos:
                    for negocio_id in negocios_ids_nuevos:
                        db.execute("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)", (user_id, negocio_id))

            else: # current_user['rol'] == 'admin'
                # Admin: Solo puede modificar las asignaciones de los negocios que él administra

                # Obtenemos los negocios que el admin PUEDE gestionar
                db.execute("SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s", (current_user['id'],))
                negocios_del_admin_set = {row['negocio_id'] for row in db.fetchall()}

                # Obtenemos las asignaciones ACTUALES del usuario que estamos editando
                db.execute("SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s", (user_id,))
                negocios_actuales_set = {row['negocio_id'] for row in db.fetchall()}

                # La nueva lista que envía el frontend (convertida a set de enteros)
                negocios_nuevos_set = {int(nid) for nid in negocios_ids_nuevos}

                # Calcular qué añadir: (Lo nuevo) - (Lo actual)
                to_add = negocios_nuevos_set - negocios_actuales_set
                # Calcular qué quitar: (Lo actual) - (Lo nuevo)
                to_remove = negocios_actuales_set - negocios_nuevos_set

                for negocio_id in to_add:
                    if negocio_id in negocios_del_admin_set: # Seguridad: solo añade si el admin tiene permiso
                        db.execute("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)", (user_id, negocio_id))

                for negocio_id in to_remove:
                    if negocio_id in negocios_del_admin_set: # Seguridad: solo quita si el admin tiene permiso
                        db.execute("DELETE FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (user_id, negocio_id))

        g.db_conn.commit()
        return jsonify({'message': 'Usuario actualizado con éxito'})

    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! ERROR en update_user: {e}")
        return jsonify({'error': f'Error al actualizar usuario: {str(e)}'}), 500