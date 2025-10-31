# app/routes/config_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

# Es buena práctica darle un nombre de blueprint que coincida con el módulo
bp = Blueprint('configuracion', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/configuraciones', methods=['GET'])
@token_required
def get_configuraciones(current_user, negocio_id):
    """Obtiene todas las configuraciones de un negocio en formato clave:valor."""
    db = get_db()
    db.execute("SELECT clave, valor FROM configuraciones WHERE negocio_id = %s", (negocio_id,))
    
    # Convertimos la lista de filas en un diccionario, que es más fácil de usar en JS
    configs = {row['clave']: row['valor'] for row in db.fetchall()}
    return jsonify(configs)

@bp.route('/negocios/<int:negocio_id>/configuraciones', methods=['POST'])
@token_required
def save_configuraciones(current_user, negocio_id):
    """Guarda un conjunto de configuraciones. Crea o actualiza según exista la clave."""
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403
        
    data = request.get_json()
    db = get_db()
    try:
        # Usamos una sola transacción para guardar todas las claves
        for clave, valor in data.items():
            # Esta consulta "UPSERT" inserta si no existe, o actualiza si ya existe.
            # Es la forma más eficiente y segura de guardar configuraciones.
            db.execute(
                """
                INSERT INTO configuraciones (negocio_id, clave, valor)
                VALUES (%s, %s, %s)
                ON CONFLICT (negocio_id, clave) DO UPDATE SET valor = EXCLUDED.valor
                """,
                (negocio_id, clave, valor)
            )
        g.db_conn.commit() # Usamos g.db_conn para confirmar la transacción
        return jsonify({'message': 'Configuración guardada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback() # Si algo falla, revertimos todos los cambios
        return jsonify({'error': str(e)}), 500
    

    