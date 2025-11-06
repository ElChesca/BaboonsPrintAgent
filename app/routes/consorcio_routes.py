# app/routes/consorcio_routes.py
# ✨ ARCHIVO ACTUALIZADO (CON MÓDULOS DE UNIDADES + RECLAMOS) ✨

from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime # <-- Asegúrate de importar datetime

# 1. Creamos el blueprint
bp = Blueprint('consorcio', __name__)


# 2. --- FUNCIÓN HELPER DE SEGURIDAD (Admin) ---
def check_consorcio_permission(negocio_id, current_user):
    db = get_db()
    
    if current_user['rol'] not in ('admin', 'superadmin'):
        return {'error': 'Acción no permitida por rol'}, 403

    if current_user['rol'] == 'admin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
                   (current_user['id'], negocio_id))
        if not db.fetchone():
            return {'error': 'Usuario no asignado a este negocio'}, 403
    
    db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    
    if not negocio:
        return {'error': 'Negocio no encontrado'}, 404
    if negocio['tipo_app'] != 'consorcio':
        return {'error': 'Esta acción solo es válida para negocios de tipo "Consorcio"'}, 400
        
    return None, None


# 3. --- RUTAS CRUD PARA UNIDADES (Sin cambios) ---

# [GET] Obtener todas las unidades (Solo Admins)
@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['GET'])
@token_required
def get_unidades(current_user, negocio_id):
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error:
        return jsonify(error), status
    
    db = get_db()
    db.execute("""
        SELECT 
            u.*, 
            inquilino.nombre AS inquilino_nombre,
            propietario.nombre AS propietario_nombre
        FROM consorcio_unidades u
        LEFT JOIN usuarios inquilino ON u.inquilino_id = inquilino.id
        LEFT JOIN usuarios propietario ON u.propietario_id = propietario.id
        WHERE u.negocio_id = %s
        ORDER BY u.nombre_unidad
    """, (negocio_id,))
    unidades = db.fetchall()
    return jsonify([dict(row) for row in unidades])

# [POST] Crear una nueva unidad
@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['POST'])
@token_required
def create_unidad(current_user, negocio_id):
    # ... (código sin cambios)
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error: return jsonify(error), status
    data = request.get_json()
    if not data or not data.get('nombre_unidad'):
        return jsonify({'error': 'El campo "nombre_unidad" es obligatorio'}), 400
    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO consorcio_unidades (
                negocio_id, nombre_unidad, piso, metros_cuadrados, 
                coeficiente, inquilino_id, propietario_id, descripcion
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                negocio_id, data['nombre_unidad'], data.get('piso'),
                data.get('metros_cuadrados'), data.get('coeficiente'),
                data.get('inquilino_id') or None, data.get('propietario_id') or None,
                data.get('descripcion')
            )
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Unidad creada con éxito', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        if 'unique constraint' in str(e):
            return jsonify({'error': 'Ya existe una unidad con ese nombre en este consorcio'}), 409
        print(f"Error en create_unidad: {e}")
        return jsonify({'error': str(e)}), 500

# [PUT] Actualizar una unidad
@bp.route('/consorcio/unidades/<int:unidad_id>', methods=['PUT'])
@token_required
def update_unidad(current_user, unidad_id):
    # ... (código sin cambios)
    data = request.get_json()
    if not data or not data.get('nombre_unidad'):
        return jsonify({'error': 'El campo "nombre_unidad" es obligatorio'}), 400
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad:
        return jsonify({'error': 'Unidad no encontrada'}), 404
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute(
            """
            UPDATE consorcio_unidades SET
                nombre_unidad = %s, piso = %s, metros_cuadrados = %s, 
                coeficiente = %s, inquilino_id = %s, propietario_id = %s, descripcion = %s
            WHERE id = %s
            """,
            (
                data['nombre_unidad'], data.get('piso'), data.get('metros_cuadrados'),
                data.get('coeficiente'), data.get('inquilino_id') or None,
                data.get('propietario_id') or None, data.get('descripcion'),
                unidad_id
            )
        )
        g.db_conn.commit()
        return jsonify({'message': 'Unidad actualizada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        if 'unique constraint' in str(e):
            return jsonify({'error': 'Ya existe otra unidad con ese nombre en este consorcio'}), 409
        print(f"Error en update_unidad: {e}")
        return jsonify({'error': str(e)}), 500

# [DELETE] Borrar una unidad
@bp.route('/consorcio/unidades/<int:unidad_id>', methods=['DELETE'])
@token_required
def delete_unidad(current_user, unidad_id):
    # ... (código sin cambios)
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad:
        return jsonify({'error': 'Unidad no encontrada'}), 404
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute("DELETE FROM consorcio_unidades WHERE id = %s", (unidad_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad eliminada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        if 'foreign key constraint' in str(e):
            return jsonify({'error': 'No se puede eliminar la unidad, puede tener reclamos o expensas asociadas.'}), 400
        print(f"Error en delete_unidad: {e}")
        return jsonify({'error': str(e)}), 500


# =======================================================
# 4. --- ✨ NUEVAS RUTAS PARA RECLAMOS ✨ ---
# =======================================================
@bp.route('/consorcio/<int:negocio_id>/reclamos/estados', methods=['GET'])
@token_required
def get_reclamos_estados(current_user, negocio_id):
    # No se necesita validación de rol, todos pueden ver los estados
    db = get_db()
    try:
        db.execute(
            "SELECT nombre FROM consorcio_reclamos_estados WHERE negocio_id = %s ORDER BY orden, nombre",
            (negocio_id,)
        )
        estados = db.fetchall()
        # Devolvemos una lista simple de strings, ej: ["Abierto", "En Proceso", "Cerrado"]
        return jsonify([row['nombre'] for row in estados])
    except Exception as e:
        print(f"Error en get_reclamos_estados: {e}")
        return jsonify({'error': str(e)}), 500
    
# [GET] Obtener "mis" unidades (para inquilinos)
@bp.route('/consorcio/<int:negocio_id>/mis-unidades', methods=['GET'])
@token_required
def get_mis_unidades(current_user, negocio_id):
    # Esta ruta es para que un inquilino/propietario llene el <select>
    # al crear un reclamo.
    db = get_db()
    db.execute(
        """
        SELECT id, nombre_unidad FROM consorcio_unidades
        WHERE negocio_id = %s AND (inquilino_id = %s OR propietario_id = %s)
        ORDER BY nombre_unidad
        """,
        (negocio_id, current_user['id'], current_user['id'])
    )
    unidades = db.fetchall()
    return jsonify([dict(row) for row in unidades])


# [GET] Obtener lista de reclamos (inteligente, según rol)
@bp.route('/consorcio/<int:negocio_id>/reclamos', methods=['GET'])
@token_required
def get_reclamos(current_user, negocio_id):
    db = get_db()
    
    # Validar que el negocio sea de tipo 'consorcio'
    db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    if not negocio or negocio['tipo_app'] != 'consorcio':
         return jsonify({'error': 'Ruta no válida para este tipo de negocio'}), 400

    query_base = """
        SELECT 
            r.id, r.titulo, r.estado, r.fecha_creacion, r.fecha_actualizacion,
            u.nombre_unidad,
            creador.nombre AS creador_nombre,
            asignado.nombre AS asignado_nombre
        FROM consorcio_reclamos r
        JOIN consorcio_unidades u ON r.unidad_id = u.id
        JOIN usuarios creador ON r.usuario_creador_id = creador.id
        LEFT JOIN usuarios asignado ON r.usuario_asignado_id = asignado.id
        WHERE r.negocio_id = %s
    """
    params = [negocio_id]

    if current_user['rol'] not in ('admin', 'superadmin'):
        # Si es un usuario normal (inquilino), filtrar por SUS unidades
        query_base += " AND (u.inquilino_id = %s OR u.propietario_id = %s)"
        params.extend([current_user['id'], current_user['id']])
    
    query_base += " ORDER BY r.fecha_actualizacion DESC"
    
    db.execute(query_base, tuple(params))
    reclamos = db.fetchall()
    return jsonify([dict(row) for row in reclamos])


# [POST] Crear un nuevo reclamo
@bp.route('/consorcio/<int:negocio_id>/reclamos', methods=['POST'])
@token_required
def create_reclamo(current_user, negocio_id):
    data = request.get_json()
    if not data or not data.get('titulo') or not data.get('unidad_id'):
        return jsonify({'error': 'Título y Unidad son obligatorios'}), 400
    
    db = get_db()
    
    # --- Verificación de Seguridad ---
    # El usuario debe ser admin O ser el dueño/inquilino de la unidad
    unidad_id = data.get('unidad_id')
    
    if current_user['rol'] not in ('admin', 'superadmin'):
        db.execute(
            "SELECT 1 FROM consorcio_unidades WHERE id = %s AND negocio_id = %s AND (inquilino_id = %s OR propietario_id = %s)",
            (unidad_id, negocio_id, current_user['id'], current_user['id'])
        )
        if not db.fetchone():
            return jsonify({'error': 'No tiene permiso para crear reclamos para esta unidad.'}), 403
    
    try:
        db.execute(
            """
            INSERT INTO consorcio_reclamos
            (negocio_id, unidad_id, usuario_creador_id, titulo, descripcion, estado)
            VALUES (%s, %s, %s, %s, %s, 'Abierto')
            RETURNING id
            """,
            (
                negocio_id,
                unidad_id,
                current_user['id'],
                data['titulo'],
                data.get('descripcion')
            )
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo creado con éxito', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en create_reclamo: {e}")
        return jsonify({'error': str(e)}), 500


# [PUT] Actualizar un reclamo (Solo Admins)
@bp.route('/consorcio/reclamos/<int:reclamo_id>', methods=['PUT'])
@token_required
def update_reclamo(current_user, reclamo_id):
    data = request.get_json()
    
    db = get_db()
    
    # 1. Obtener el reclamo para saber su negocio_id
    db.execute("SELECT negocio_id FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
    reclamo = db.fetchone()
    if not reclamo:
        return jsonify({'error': 'Reclamo no encontrado'}), 404
        
    # 2. Validar que el admin tenga permisos sobre ese negocio
    error, status = check_consorcio_permission(reclamo['negocio_id'], current_user)
    if error:
        return jsonify(error), status
        
    # 3. Si tiene permiso, actualizar
    try:
        db.execute(
            """
            UPDATE consorcio_reclamos SET
                titulo = %s,
                descripcion = %s,
                estado = %s,
                usuario_asignado_id = %s,
                fecha_actualizacion = %s
            WHERE id = %s
            """,
            (
                data.get('titulo'),
                data.get('descripcion'),
                data.get('estado', 'Abierto'), # Default a 'Abierto' si no se envía
                data.get('usuario_asignado_id') or None,
                datetime.datetime.now(datetime.timezone.utc), # Actualizar timestamp
                reclamo_id
            )
        )
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo actualizado con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en update_reclamo: {e}")
        return jsonify({'error': str(e)}), 500
        

# [DELETE] Borrar un reclamo (Solo Admins)
@bp.route('/consorcio/reclamos/<int:reclamo_id>', methods=['DELETE'])
@token_required
def delete_reclamo(current_user, reclamo_id):
    db = get_db()
    
    # 1. Verificación de seguridad (similar a PUT)
    db.execute("SELECT negocio_id FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
    reclamo = db.fetchone()
    if not reclamo:
        return jsonify({'error': 'Reclamo no encontrado'}), 404
        
    error, status = check_consorcio_permission(reclamo['negocio_id'], current_user)
    if error:
        return jsonify(error), status
        
    # 3. Si tiene permiso, borrar
    try:
        db.execute("DELETE FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo eliminado con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en delete_reclamo: {e}")
        return jsonify({'error': str(e)}), 500