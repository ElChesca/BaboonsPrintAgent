# app/routes/clientes_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query

bp = Blueprint('clientes', __name__)

@bp.route('/api/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    query = "SELECT * FROM clientes WHERE negocio_id = ?"
    clientes = execute_query(query, (negocio_id,), fetchall=True)
    return jsonify([dict(c) for c in clientes])


@bp.route('/api/negocios/<int:negocio_id>/clientes', methods=['POST'])
@token_required
def create_cliente(current_user, negocio_id):
    data = request.get_json()
    nombre = data.get('nombre')

    if not nombre:
        return jsonify({'message': 'El nombre es requerido'}), 400

    fields = ['nombre', 'email', 'telefono', 'direccion', 'cuit']
    values = [negocio_id] + [data.get(f) for f in fields]

    query = f"""
        INSERT INTO clientes (negocio_id, {', '.join(fields)})
        VALUES (?, ?, ?, ?, ?, ?)
    """
    execute_query(query, tuple(values), commit=True)
    
    return jsonify({'message': 'Cliente creado con éxito'}), 201

@bp.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    data = request.get_json()
    fields = [key for key in data.keys() if key != 'id']
    values = [data[key] for key in fields] + [cliente_id]
    
    set_clause = ', '.join([f"{field} = ?" for field in fields])
    query = f"UPDATE clientes SET {set_clause} WHERE id = ?"
    
    execute_query(query, tuple(values), commit=True)
    return jsonify({'message': 'Cliente actualizado'})


@bp.route('/api/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    execute_query("DELETE FROM clientes WHERE id = ?", (cliente_id,), commit=True)
    return jsonify({'message': 'Cliente eliminado'})

@bp.route('/api/clientes/<int:cliente_id>/cuenta_corriente', methods=['GET'])
@token_required
def get_cuenta_corriente(current_user, cliente_id):
    query = "SELECT * FROM ventas WHERE cliente_id = ? ORDER BY fecha DESC"
    movimientos = execute_query(query, (cliente_id,), fetchall=True)
    return jsonify([dict(m) for m in movimientos])
