# app/routes/negocios_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('negocios', __name__)

@bp.route('/negocios', methods=['GET'])
@token_required
def get_negocios(current_user):
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return jsonify({'error': 'Error interno de autenticación'}), 500

    db = get_db()
    try:
        # ✨ --- CAMBIO CLAVE --- ✨
        if current_user['rol'] == 'superadmin':
            # SuperAdmin ve TODOS los negocios
            db.execute("SELECT id, nombre, direccion FROM negocios ORDER BY nombre")
        elif current_user['rol'] == 'admin':
             # Admin (y Operador) ven SOLO los asignados
             db.execute(
                """
                SELECT n.id, n.nombre, n.direccion
                FROM negocios n
                JOIN usuarios_negocios un ON n.id = un.negocio_id
                WHERE un.usuario_id = %s
                ORDER BY n.nombre
                """,
                (current_user['id'],)
            )
        else: # Operador (o rol desconocido)
             db.execute(
                """
                SELECT n.id, n.nombre, n.direccion
                FROM negocios n
                JOIN usuarios_negocios un ON n.id = un.negocio_id
                WHERE un.usuario_id = %s
                ORDER BY n.nombre
                """,
                (current_user['id'],)
            )

        negocios = db.fetchall()
        return jsonify([dict(row) for row in negocios])

    except Exception as e:
        print(f"!!! DATABASE ERROR in get_negocios: {e}")
        g.db_conn.rollback()
        return jsonify({'error': f'Error al obtener negocios: {str(e)}'}), 500

@bp.route('/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    data = request.get_json()
    if not data or 'nombre' not in data:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400
    
    db = get_db()
    try:
        db.execute('INSERT INTO negocios (nombre, direccion) VALUES (%s, %s) RETURNING id', (data['nombre'], data.get('direccion', '')))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'nombre': data['nombre'], 'direccion': data.get('direccion', '')}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:id>', methods=['GET'])
@token_required
def obtener_negocio(current_user, id):
    db = get_db()
    db.execute('SELECT * FROM negocios WHERE id = %s', (id,))
    negocio = db.fetchone()
    if negocio is None:
        return jsonify({'error': 'Negocio no encontrado'}), 404
    return jsonify(dict(negocio))

@bp.route('/negocios/<int:id>', methods=['PUT'])
@token_required
def actualizar_negocio(current_user, id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    try:
        datos = request.get_json()
        db = get_db()
        db.execute('UPDATE negocios SET nombre = %s, direccion = %s WHERE id = %s', (datos['nombre'], datos.get('direccion', ''), id))
        g.db_conn.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500