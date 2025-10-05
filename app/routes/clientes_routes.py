from flask import Blueprint, request, jsonify
from app import get_db
from .auth_routes import token_required # Importamos el decorador desde su nueva ubicación


bp = Blueprint('clientes', __name__)


# Ruta para obtener los clientes de un negocio
@bp.route('/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    db = get_db()
    clientes = db.execute('SELECT * FROM clientes WHERE negocio_id = ?', (negocio_id,)).fetchall()
    return jsonify([dict(row) for row in clientes])

@bp.route('/negocios/<int:negocio_id>/clientes', methods=['POST'])
@token_required
def create_cliente(current_user, negocio_id):
    """Crea un nuevo cliente para un negocio específico."""
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'INSERT INTO clientes (negocio_id, nombre, documento, telefono, email, direccion) VALUES (?, ?, ?, ?, ?, ?)',
        (negocio_id, data['nombre'], data.get('documento'), data.get('telefono'), data.get('email'), data.get('direccion'))
    )
    db.commit()
    return jsonify({'id': cursor.lastrowid, 'message': 'Cliente creado con éxito'}), 201

@bp.route('/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    """Actualiza un cliente existente."""
    data = request.get_json()
    db = get_db()
    # Aquí podríamos añadir una verificación de permisos extra si fuera necesario
    db.execute(
        'UPDATE clientes SET nombre = ?, documento = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?',
        (data.get('nombre'), data.get('documento'), data.get('telefono'), data.get('email'), data.get('direccion'), cliente_id)
    )
    db.commit()
    return jsonify({'message': 'Cliente actualizado con éxito'})

@bp.route('/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    """Elimina un cliente."""
    db = get_db()
    db.execute('DELETE FROM clientes WHERE id = ?', (cliente_id,))
    db.commit()
    return jsonify({'message': 'Cliente eliminado con éxito'})