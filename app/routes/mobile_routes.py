# app/routes/mobile_routes.py
from flask import Blueprint, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

# Definimos el blueprint, igual que tus otros módulos
bp = Blueprint('mobile', __name__)

@bp.route('/negocios/<int:negocio_id>/mobile/check-producto/<string:codigo_barras>', methods=['GET'])
@token_required
def check_producto(current_user, negocio_id, codigo_barras):
    """
    API que devuelve la info de un producto, su stock y TODAS
    sus listas de precios asociadas a ese negocio.
    """
    try:
        db = get_db()
        
        # 1. Buscar el producto por código de barras y negocio
        db.execute(
            """
            SELECT id, nombre, stock 
            FROM productos 
            WHERE codigo_barras = %s AND negocio_id = %s
            """,
            (codigo_barras, negocio_id)
        )
        producto = db.fetchone()
        
        if not producto:
            return jsonify({'error': 'Producto no encontrado'}), 404

        # 2. Buscar TODAS las listas de precios de ESE negocio
        #    y el precio específico de ESE producto (si existe)
        db.execute(
            """
            SELECT 
                lp.id as lista_id,
                lp.nombre_lista,
                lp.descripcion_regla AS regla_aplicada,
                p.valor
            FROM 
                listas_precios lp
            LEFT JOIN 
                precios p ON lp.id = p.lista_precio_id AND p.producto_id = %s
            WHERE 
                lp.negocio_id = %s
            ORDER BY
                lp.id
            """,
            (producto['id'], negocio_id)
        )
        # Convertimos a diccionario (ya que fetchall devuelve RealDictRow o tupla)
        precios_lista = [dict(row) for row in db.fetchall()]

        # 3. Construir la respuesta JSON
        respuesta = {
            "id": producto['id'],
            "descripcion": producto['nombre'],
            "stock_actual": producto['stock'],
            "precios": precios_lista 
        }
        
        return jsonify(respuesta)

    except Exception as e:
        # Es un GET, no necesitamos rollback
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mobile/hojas-ruta-activas', methods=['GET'])
@token_required
def get_hojas_ruta_activas(current_user, negocio_id):
    try:
        db = get_db()
        vendedor_id = current_user.get('vendedor_id')
        db.execute("""
            SELECT id, estado, fecha::text, vendedor_id
            FROM hoja_ruta 
            WHERE negocio_id = %s AND vendedor_id = %s AND estado = 'activa'
        """, (negocio_id, vendedor_id))
        return jsonify(db.fetchall())
    except Exception as e:
        return jsonify({'error': str(e)}), 500