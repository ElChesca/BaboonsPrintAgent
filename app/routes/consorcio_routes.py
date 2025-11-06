# app/routes/consorcio_routes.py
# ✨ ARCHIVO NUEVO ✨

from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

# 1. Creamos un nuevo blueprint para todas las rutas de "Consorcio"
bp = Blueprint('consorcio', __name__)


# 2. --- FUNCIÓN HELPER DE SEGURIDAD ---
# Esta función valida el rol Y el tipo de app (nuestra Capa 2 de seguridad)
def check_consorcio_permission(negocio_id, current_user):
    db = get_db()
    
    # 1. Chequeo de rol
    if current_user['rol'] not in ('admin', 'superadmin'):
        return {'error': 'Acción no permitida por rol'}, 403

    # 2. Chequeo de asignación (el admin debe estar asignado a ese negocio)
    # (El superadmin puede gestionar todo)
    if current_user['rol'] == 'admin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
                   (current_user['id'], negocio_id))
        if not db.fetchone():
            return {'error': 'Usuario no asignado a este negocio'}, 403
    
    # 3. Chequeo de TIPO de App (Seguridad Capa 2)
    db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    
    if not negocio:
        return {'error': 'Negocio no encontrado'}, 404
    if negocio['tipo_app'] != 'consorcio':
        return {'error': 'Esta acción solo es válida para negocios de tipo "Consorcio"'}, 400
        
    return None, None # Sin error


# 3. --- RUTAS CRUD PARA LAS UNIDADES ---

# [GET] Obtener todas las unidades de un consorcio
@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['GET'])
@token_required
def get_unidades(current_user, negocio_id):
    # Validamos permisos antes de actuar
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error:
        return jsonify(error), status
    
    db = get_db()
    # Hacemos JOIN con usuarios para obtener los nombres (muy útil para el frontend)
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


# [POST] Crear una nueva unidad en un consorcio
@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['POST'])
@token_required
def create_unidad(current_user, negocio_id):
    # Validamos permisos
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error:
        return jsonify(error), status

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
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                negocio_id,
                data['nombre_unidad'],
                data.get('piso'),
                data.get('metros_cuadrados'),
                data.get('coeficiente'),
                data.get('inquilino_id') or None, # Manejar Nulos
                data.get('propietario_id') or None,
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


# [PUT] Actualizar una unidad específica
@bp.route('/consorcio/unidades/<int:unidad_id>', methods=['PUT'])
@token_required
def update_unidad(current_user, unidad_id):
    data = request.get_json()
    if not data or not data.get('nombre_unidad'):
        return jsonify({'error': 'El campo "nombre_unidad" es obligatorio'}), 400

    db = get_db()
    
    # Verificación de seguridad:
    # 1. Obtener el negocio_id de la unidad que se quiere editar
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad:
        return jsonify({'error': 'Unidad no encontrada'}), 404
    
    # 2. Usar ese negocio_id para chequear permisos
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error:
        return jsonify(error), status

    # 3. Si tiene permiso, actualizar
    try:
        db.execute(
            """
            UPDATE consorcio_unidades SET
                nombre_unidad = %s, piso = %s, metros_cuadrados = %s, 
                coeficiente = %s, inquilino_id = %s, propietario_id = %s, descripcion = %s
            WHERE id = %s
            """,
            (
                data['nombre_unidad'],
                data.get('piso'),
                data.get('metros_cuadrados'),
                data.get('coeficiente'),
                data.get('inquilino_id') or None,
                data.get('propietario_id') or None,
                data.get('descripcion'),
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
    db = get_db()
    
    # Verificación de seguridad (similar a PUT)
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad:
        return jsonify({'error': 'Unidad no encontrada'}), 404
    
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error:
        return jsonify(error), status

    try:
        db.execute("DELETE FROM consorcio_unidades WHERE id = %s", (unidad_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad eliminada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        # Si tiene reclamos o expensas asociadas, la BD fallará (Foreign Key)
        if 'foreign key constraint' in str(e):
            return jsonify({'error': 'No se puede eliminar la unidad, puede tener reclamos o expensas asociadas.'}), 400
        print(f"Error en delete_unidad: {e}")
        return jsonify({'error': str(e)}), 500