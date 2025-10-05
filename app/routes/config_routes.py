# app/routes/config_routes.py
from flask import Blueprint, jsonify, request
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('config', __name__)

@bp.route('/negocios/<int:negocio_id>/configuraciones', methods=['GET'])
@token_required
def get_configuraciones(current_user, negocio_id):
    db = get_db()
    configs = db.execute(
        'SELECT clave, valor FROM configuraciones WHERE negocio_id = ?', (negocio_id,)
    ).fetchall()
    # Convertimos la lista de filas a un diccionario clave:valor
    return jsonify({row['clave']: row['valor'] for row in configs})

@bp.route('/negocios/<int:negocio_id>/configuraciones', methods=['PUT'])
@token_required
def update_configuraciones(current_user, negocio_id):
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    nuevas_configs = request.get_json()
    db = get_db()
    for clave, valor in nuevas_configs.items():
        # Intenta actualizar. Si no existe, inserta (UPSERT)
        db.execute(
            """
            INSERT INTO configuraciones (negocio_id, clave, valor) VALUES (?, ?, ?)
            ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
            """,
            (negocio_id, clave, valor)
        )
    db.commit()
    return jsonify({'message': 'Configuración guardada con éxito'})