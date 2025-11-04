# app/routes/negocios_routes.py
# ✨ ARCHIVO ACTUALIZADO ✨

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
        # ✨ CAMBIO: Se añade n.tipo_app a todas las consultas
        if current_user['rol'] == 'superadmin':
            db.execute("SELECT id, nombre, direccion, tipo_app FROM negocios ORDER BY nombre")
        
        elif current_user['rol'] == 'admin':
             db.execute(
                 """
                 SELECT n.id, n.nombre, n.direccion, n.tipo_app
                 FROM negocios n
                 JOIN usuarios_negocios un ON n.id = un.negocio_id
                 WHERE un.usuario_id = %s
                 ORDER BY n.nombre
                 """,
                 (current_user['id'],)
             )
        else: # Operador
             db.execute(
                 """
                 SELECT n.id, n.nombre, n.direccion, n.tipo_app
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

    creador_id = current_user['id']
    
    # ✨ CAMBIO: Obtenemos el tipo_app, con 'retail' como default
    nombre = data['nombre']
    direccion = data.get('direccion', '')
    tipo_app = data.get('tipo_app', 'retail') # Default a 'retail'
    
    db = get_db()
    try:
        # ✨ CAMBIO: Insertamos el tipo_app
        db.execute(
            'INSERT INTO negocios (nombre, direccion, tipo_app) VALUES (%s, %s, %s) RETURNING id',
            (nombre, direccion, tipo_app)
        )
        nuevo_id = db.fetchone()['id']

        db.execute(
            'INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)',
            (creador_id, nuevo_id)
        )

        g.db_conn.commit()

        # ✨ CAMBIO: Devolvemos el tipo_app
        return jsonify({
            'id': nuevo_id, 
            'nombre': nombre, 
            'direccion': direccion,
            'tipo_app': tipo_app
        }), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! DATABASE ERROR in add_negocio: {e}")
        return jsonify({'error': f'Error al crear y asignar negocio: {str(e)}'}), 500

@bp.route('/negocios/<int:id>', methods=['GET'])
@token_required
def obtener_negocio(current_user, id):
    db = get_db()
    # SELECT * ya incluirá la nueva columna 'tipo_app'
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
        
        # ✨ CAMBIO: Permitimos actualizar el tipo_app
        nombre = datos['nombre']
        direccion = datos.get('direccion', '')
        tipo_app = datos.get('tipo_app', 'retail') # Default a 'retail'

        db = get_db()
        db.execute(
            'UPDATE negocios SET nombre = %s, direccion = %s, tipo_app = %s WHERE id = %s', 
            (nombre, direccion, tipo_app, id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500