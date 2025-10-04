# app/routes/proveedor_routes.py
from flask import Blueprint, jsonify, request
from app import get_db
from .auth_routes import token_required

bp = Blueprint('proveedores', __name__)

@bp.route('/negocios/<int:negocio_id>/proveedores', methods=['GET'])
@token_required
def get_proveedores(current_user, negocio_id):
    db = get_db()
    proveedores = db.execute(
        'SELECT * FROM proveedores WHERE negocio_id = ? ORDER BY nombre',
        (negocio_id,)
    ).fetchall()
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
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO proveedores (nombre, contacto, telefono, email, negocio_id) VALUES (?, ?, ?, ?, ?)',
            (data['nombre'], data.get('contacto'), data.get('telefono'), data.get('email'), negocio_id)
        )
        db.commit()
        return jsonify({'id': cursor.lastrowid, **data}), 201
    except db.IntegrityError:
        return jsonify({'error': 'Ese proveedor ya existe'}), 409

@bp.route('/proveedores/<int:id>', methods=['PUT'])
@token_required
def update_proveedor(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    db = get_db()
    db.execute(
        'UPDATE proveedores SET nombre = ?, contacto = ?, telefono = ?, email = ? WHERE id = ?',
        (data.get('nombre'), data.get('contacto'), data.get('telefono'), data.get('email'), id)
    )
    db.commit()
    return jsonify({'message': 'Proveedor actualizado con éxito'})

@bp.route('/proveedores/<int:id>', methods=['DELETE'])
@token_required
def delete_proveedor(current_user, id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida para Usuarios - Solo Admin'}), 403

    db = get_db()
    db.execute('DELETE FROM proveedores WHERE id = ?', (id,))
    db.commit()
    return jsonify({'message': 'Proveedor eliminado con éxito'})