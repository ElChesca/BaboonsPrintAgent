# app/routes/precios_especificos_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('precios_especificos', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/precios_especificos/bulk', methods=['POST'])
@token_required
def save_precios_especificos_bulk(current_user, negocio_id):
    """
    Recibe una lista de precios específicos para una lista de precios dada y los guarda (inserta o actualiza).
    Si el precio es nulo o vacío, elimina el precio específico existente.
    """
    data = request.get_json()
    lista_de_precio_id = data.get('lista_de_precio_id')
    precios = data.get('precios', []) # Espera una lista de {producto_id: X, precio: Y}

    if not lista_de_precio_id or not isinstance(precios, list):
        return jsonify({'error': 'Datos inválidos'}), 400

    db = get_db()
    try:
        # Usamos una sola transacción
        for item in precios:
            producto_id = item.get('producto_id')
            precio = item.get('precio')

            if not producto_id: continue # Saltar si falta producto_id

            if precio is not None and precio != '':
                # Si hay precio, hacemos UPSERT
                db.execute(
                    """
                    INSERT INTO precios_especificos (negocio_id, lista_de_precio_id, producto_id, precio)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (negocio_id, lista_de_precio_id, producto_id) 
                    DO UPDATE SET precio = EXCLUDED.precio
                    """,
                    (negocio_id, lista_de_precio_id, producto_id, precio)
                )
            else:
                # Si el precio es null o vacío, eliminamos el registro si existe
                db.execute(
                    """
                    DELETE FROM precios_especificos
                    WHERE negocio_id = %s AND lista_de_precio_id = %s AND producto_id = %s
                    """,
                    (negocio_id, lista_de_precio_id, producto_id)
                )
        
        g.db_conn.commit()
        return jsonify({'message': 'Precios específicos guardados con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! ERROR saving specific prices: {e}")
        return jsonify({'error': f'Error al guardar precios: {str(e)}'}), 500