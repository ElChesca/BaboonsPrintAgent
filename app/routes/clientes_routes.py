# app/routes/clientes_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('clientes', __name__)

@bp.route('/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    db = get_db()
    db.execute('SELECT * FROM clientes WHERE negocio_id = %s ORDER BY nombre', (negocio_id,))
    clientes = db.fetchall()
    return jsonify([dict(row) for row in clientes])

@bp.route('/negocios/<int:negocio_id>/clientes', methods=['POST'])
@token_required
def create_cliente(current_user, negocio_id):
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO clientes (negocio_id, nombre, dni, telefono, email, direccion) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id',
            (negocio_id, data['nombre'], data.get('dni'), data.get('telefono'), data.get('email'), data.get('direccion'))
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, **data}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        'UPDATE clientes SET nombre = %s, dni = %s, telefono = %s, email = %s, direccion = %s WHERE id = %s',
        (data.get('nombre'), data.get('dni'), data.get('telefono'), data.get('email'), data.get('direccion'), cliente_id)
    )
    g.db_conn.commit()
    return jsonify({'message': 'Cliente actualizado con éxito'})

@bp.route('/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    db = get_db()
    db.execute('DELETE FROM clientes WHERE id = %s', (cliente_id,))
    g.db_conn.commit()
    return jsonify({'message': 'Cliente eliminado con éxito'})