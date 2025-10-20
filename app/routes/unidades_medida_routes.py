from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('unidades_medida', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/unidades_medida', methods=['GET'])
@token_required
def get_unidades(current_user, negocio_id):
    db = get_db()
    db.execute("SELECT * FROM unidades_medida WHERE negocio_id = %s ORDER BY nombre", (negocio_id,))
    unidades = db.fetchall()
    return jsonify([dict(row) for row in unidades])

@bp.route('/negocios/<int:negocio_id>/unidades_medida', methods=['POST'])
@token_required
def create_unidad(current_user, negocio_id):
    data = request.get_json()
    try:
        db = get_db()
        db.execute(
            "INSERT INTO unidades_medida (negocio_id, nombre, abreviatura) VALUES (%s, %s, %s)",
            (negocio_id, data['nombre'], data['abreviatura'])
        )
        g.db_conn.commit()
        return jsonify({'message': 'Unidad de medida creada con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/unidades_medida/<int:id>', methods=['PUT'])
@token_required
def update_unidad(current_user, id):
    data = request.get_json()
    try:
        db = get_db()
        db.execute(
            "UPDATE unidades_medida SET nombre = %s, abreviatura = %s WHERE id = %s",
            (data['nombre'], data['abreviatura'], id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Unidad de medida actualizada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/unidades_medida/<int:id>', methods=['DELETE'])
@token_required
def delete_unidad(current_user, id):
    try:
        db = get_db()
        db.execute("DELETE FROM unidades_medida WHERE id = %s", (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad de medida eliminada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500