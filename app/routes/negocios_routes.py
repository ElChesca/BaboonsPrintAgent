# app/routes/negocios_routes.py
from flask import Blueprint, request, jsonify
from app import get_db
from .auth_routes import token_required

bp = Blueprint('negocios', __name__)

# --- Rutas para Negocios ---
# app/routes/negocios_routes.py
from flask import Blueprint, jsonify
from app import get_db
from .auth_routes import token_required

bp = Blueprint('negocios', __name__)

@bp.route('/negocios', methods=['GET'])
@token_required
def get_negocios(current_user):
    db = get_db()
    db.execute(
        """
        SELECT n.id, n.nombre 
        FROM negocios n 
        JOIN usuarios_negocios un ON n.id = un.negocio_id 
        WHERE un.usuario_id = %s
        """,
        (current_user['id'],)
    )
    negocios = db.fetchall()
    return jsonify([dict(row) for row in negocios])

@bp.route('/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    """Añade un nuevo negocio (solo para admins)."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    nuevo_negocio = request.get_json()
    if not nuevo_negocio or 'nombre' not in nuevo_negocio:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400

    nombre = nuevo_negocio['nombre']
    direccion = nuevo_negocio.get('direccion', '')

    db = get_db()
    cursor = db.cursor()
    cursor.execute('INSERT INTO negocios (nombre, direccion) VALUES (?, ?)', (nombre, direccion))
    db.commit()
    nuevo_id = cursor.lastrowid
    return jsonify({'id': nuevo_id, 'nombre': nombre, 'direccion': direccion}), 201

@bp.route('/negocios/<int:id>', methods=['GET'])
@token_required
def obtener_negocio(current_user, id):
    db = get_db()
    # Aquí podríamos añadir una lógica para verificar si el usuario tiene permiso para ver este negocio específico
    negocio = db.execute('SELECT * FROM negocios WHERE id = ?', (id,)).fetchone()
    if negocio is None:
        return jsonify({'error': 'Negocio no encontrado'}), 404
    return jsonify(dict(negocio))
    
@bp.route('/negocios/<int:id>', methods=['PUT'])
@token_required
def actualizar_negocio(current_user, id):
    """Actualiza un negocio (solo para admins)."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    try:
        datos = request.get_json()
        nombre = datos['nombre']
        direccion = datos.get('direccion', '')
        db = get_db()
        db.execute('UPDATE negocios SET nombre = ?, direccion = ? WHERE id = ?', (nombre, direccion, id))
        db.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    
# --- ✨ RUTA DE PRUEBA TEMPORAL ---
# # ATENCIÓN: BORRAR O COMENTAR DESPUÉS DE USARLA
# @bp.route('/test-db-connection', methods=['GET'])
# def test_db_connection():
#     print("--- INICIANDO PRUEBA DE CONEXIÓN A LA DB ---")
#     try:
#         db_cursor = get_db()
#         print("PASO 1: get_db() funcionó.")

#         db_cursor.execute('SELECT * FROM negocios')
#         print("PASO 2: La consulta SELECT * FROM negocios se ejecutó.")

#         negocios = db_cursor.fetchall()
#         print(f"PASO 3: Se encontraron {len(negocios)} negocios.")

#         return jsonify([dict(row) for row in negocios])
#     except Exception as e:
#         print(f"--- ERROR EN LA PRUEBA DE CONEXIÓN ---: {str(e)}")
#         return jsonify({'error': str(e)}), 500