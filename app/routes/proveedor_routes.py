# app/routes/proveedor_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('proveedores', __name__)

@bp.route('/negocios/<int:negocio_id>/proveedores', methods=['GET'])
@token_required
def get_proveedores(current_user, negocio_id):
    db = get_db()
    db.execute('SELECT * FROM proveedores WHERE negocio_id = %s ORDER BY nombre', (negocio_id,))
    proveedores = db.fetchall()
    return jsonify([dict(row) for row in proveedores])

@bp.route('/negocios/<int:negocio_id>/proveedores', methods=['POST'])
@token_required
def create_proveedor(current_user, negocio_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO proveedores (nombre, contacto, telefono, email, negocio_id) VALUES (%s, %s, %s, %s, %s) RETURNING id',
            (data['nombre'], data.get('contacto'), data.get('telefono'), data.get('email'), negocio_id)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, **data}), 201
    except Exception as e:
        g.db_conn.rollback()
        # Manejo de error para nombre único si lo tienes en la DB
        if 'UNIQUE constraint' in str(e):
             return jsonify({'error': 'Ese proveedor ya existe'}), 409
        return jsonify({'error': str(e)}), 500

@bp.route('/proveedores/<int:id>', methods=['PUT'])
@token_required
def update_proveedor(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    db = get_db()
    db.execute(
        'UPDATE proveedores SET nombre = %s, contacto = %s, telefono = %s, email = %s WHERE id = %s',
        (data.get('nombre'), data.get('contacto'), data.get('telefono'), data.get('email'), id)
    )
    g.db_conn.commit()
    return jsonify({'message': 'Proveedor actualizado con éxito'})

@bp.route('/proveedores/<int:id>', methods=['DELETE'])
@token_required
def delete_proveedor(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    db = get_db()
    db.execute('DELETE FROM proveedores WHERE id = %s', (id,))
    g.db_conn.commit()
    return jsonify({'message': 'Proveedor eliminado con éxito'})