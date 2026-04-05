# app/routes/proveedor_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('proveedores', __name__)

@bp.route('/negocios/<int:negocio_id>/proveedores', methods=['GET'])
@token_required
def get_proveedores(current_user, negocio_id):
    db = get_db()
    # --- CAMBIO AQUÍ: Incluimos saldo_cta_cte ---
    db.execute('SELECT id, nombre, contacto, telefono, email, saldo_cta_cte, cuit, condicion_fiscal, datos_bancarios, condiciones_pago FROM proveedores WHERE negocio_id = %s ORDER BY nombre', (negocio_id,))
    proveedores = db.fetchall()
    return jsonify([dict(row) for row in proveedores])

@bp.route('/negocios/<int:negocio_id>/proveedores', methods=['POST'])
@token_required
def create_proveedor(current_user, negocio_id):
    # Solo admin y superadmin pueden crear
    # (Asumiendo que tenés una lógica similar en otros POSTs)
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        # saldo_cta_cte tomará el DEFAULT 0
        db.execute(
            'INSERT INTO proveedores (nombre, contacto, telefono, email, negocio_id, cuit, condicion_fiscal, datos_bancarios, condiciones_pago) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, saldo_cta_cte',
            (data['nombre'], data.get('contacto'), data.get('telefono'), data.get('email'), negocio_id, data.get('cuit'), data.get('condicion_fiscal'), data.get('datos_bancarios'), data.get('condiciones_pago'))
        )
        nuevo_proveedor = db.fetchone()
        g.db_conn.commit()
        # Devolvemos el proveedor completo, incluyendo el saldo inicial
        return jsonify({'id': nuevo_proveedor['id'], **data, 'saldo_cta_cte': nuevo_proveedor['saldo_cta_cte']}), 201
    except Exception as e:
        g.db_conn.rollback()
        # Manejo de error para nombre único si lo tienes en la DB
        if 'UNIQUE constraint' in str(e) or 'duplicate key value violates unique constraint' in str(e):
             return jsonify({'error': 'Ese proveedor ya existe'}), 409
        print(f"Error en create_proveedor: {e}") # Loguear el error real
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al crear el proveedor.'}), 500

@bp.route('/proveedores/<int:id>', methods=['PUT'])
@token_required
def update_proveedor(current_user, id):
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    # Excluimos saldo_cta_cte, se actualiza por ingresos/pagos
    campos_actualizables = {k: v for k, v in data.items() if k in ('nombre', 'contacto', 'telefono', 'email', 'cuit', 'condicion_fiscal', 'datos_bancarios', 'condiciones_pago')}
    if not campos_actualizables.get('nombre'): # El nombre sigue siendo obligatorio al editar
         return jsonify({'error': 'El nombre es obligatorio'}), 400

    set_clause = ", ".join([f"{key} = %s" for key in campos_actualizables])
    values = list(campos_actualizables.values()) + [id]
    
    db = get_db()
    try:
        db.execute(
            f'UPDATE proveedores SET {set_clause} WHERE id = %s',
            tuple(values)
        )
        # Verificamos si se actualizó alguna fila
        if db.rowcount == 0:
             return jsonify({'error': 'Proveedor no encontrado'}), 404
        g.db_conn.commit()
        return jsonify({'message': 'Proveedor actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en update_proveedor: {e}")
        import traceback
        traceback.print_exc()
        # Podríamos tener un error de nombre duplicado aquí también
        if 'UNIQUE constraint' in str(e) or 'duplicate key value violates unique constraint' in str(e):
             return jsonify({'error': 'Ya existe otro proveedor con ese nombre'}), 409
        return jsonify({'error': 'Ocurrió un error al actualizar el proveedor.'}), 500


@bp.route('/proveedores/<int:id>', methods=['DELETE'])
@token_required
def delete_proveedor(current_user, id):
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'message': 'Acción no permitida'}), 403
    
    db = get_db()
    try:
        # (Opcional: Verificar si el proveedor tiene saldo != 0 o movimientos antes de borrar)
        db.execute('DELETE FROM proveedores WHERE id = %s', (id,))
        if db.rowcount == 0:
            return jsonify({'error': 'Proveedor no encontrado'}), 404
        g.db_conn.commit()
        return jsonify({'message': 'Proveedor eliminado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en delete_proveedor: {e}")
        import traceback
        traceback.print_exc()
        # Podríamos tener un error si hay FK constraints (ej: ingresos asociados)
        if 'violates foreign key constraint' in str(e):
            return jsonify({'error': 'No se puede eliminar el proveedor porque tiene registros asociados (ingresos, etc.).'}), 409
        return jsonify({'error': 'Ocurrió un error al eliminar el proveedor.'}), 500
