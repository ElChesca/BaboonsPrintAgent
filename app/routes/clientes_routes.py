# app/routes/clientes_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('clientes', __name__)

@bp.route('/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    db = get_db()
    # SELECT * es correcto aquí, ya que traerá todas las columnas, incluidas las nuevas.
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
        # ✨ CORRECCIÓN: Se incluyen todos los nuevos campos en la sentencia INSERT.
        db.execute(
            """
            INSERT INTO clientes (negocio_id, nombre, dni, telefono, email, direccion, 
                                  tipo_cliente, tipo_documento, condicion_venta, posicion_iva, 
                                  lista_precios, credito_maximo, ciudad, provincia, ref_interna)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (negocio_id, data.get('nombre'), data.get('dni'), data.get('telefono'), data.get('email'), data.get('direccion'),
             data.get('tipo_cliente', 'Individuo'), data.get('tipo_documento', 'DNI'), data.get('condicion_venta', 'Contado'),
             data.get('posicion_iva', 'Consumidor Final'), data.get('lista_precios'), data.get('credito_maximo', 0),
             data.get('ciudad'), data.get('provincia'), data.get('ref_interna'))
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        # Devolvemos el objeto completo con su nuevo ID.
        return jsonify({'id': nuevo_id, **data}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No se recibieron datos para actualizar'}), 400

    # ✨ MEJORA: Construcción dinámica de la consulta UPDATE.
    # Esto permite actualizar solo los campos que se envían y es mucho más seguro y flexible.
    
    # Lista de campos permitidos para actualizar
    allowed_fields = ['nombre', 'dni', 'telefono', 'email', 'direccion', 
                      'tipo_cliente', 'tipo_documento', 'condicion_venta', 'posicion_iva', 
                      'lista_precios', 'credito_maximo', 'ciudad', 'provincia', 'ref_interna']
    
    # Construimos la parte SET de la consulta
    set_parts = []
    values = []
    for field in allowed_fields:
        if field in data:
            set_parts.append(f"{field} = %s")
            values.append(data[field])

    if not set_parts:
        return jsonify({'error': 'Ningún campo válido para actualizar'}), 400

    # Añadimos el ID del cliente al final de la lista de valores
    values.append(cliente_id)
    
    query = f"UPDATE clientes SET {', '.join(set_parts)} WHERE id = %s"
    
    db = get_db()
    try:
        db.execute(query, tuple(values))
        g.db_conn.commit()
        return jsonify({'message': 'Cliente actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    db = get_db()
    # Aquí podrías añadir una lógica para verificar si el cliente tiene saldo en cta. cte. antes de borrar.
    db.execute('DELETE FROM clientes WHERE id = %s', (cliente_id,))
    g.db_conn.commit()
    return jsonify({'message': 'Cliente eliminado con éxito'})

@bp.route('/clientes/<int:cliente_id>/cuenta_corriente', methods=['GET'])
@token_required
def get_cuenta_corriente(current_user, cliente_id):
    db = get_db()
    db.execute(
        "SELECT * FROM clientes_cuenta_corriente WHERE cliente_id = %s ORDER BY fecha ASC",
        (cliente_id,)
    )
    movimientos = db.fetchall()
    return jsonify([dict(row) for row in movimientos])