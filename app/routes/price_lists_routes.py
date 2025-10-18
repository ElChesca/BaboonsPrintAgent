# app/routes/price_lists_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

# 1. Creamos un nuevo Blueprint para las listas de precios
bp = Blueprint('price_lists', __name__)

# --- RUTAS PARA GESTIONAR LAS LISTAS DE PRECIOS ---

@bp.route('/negocios/<int:negocio_id>/listas_precios', methods=['POST'])
@token_required
def crear_lista_precios(current_user, negocio_id):
    """Crea una nueva lista de precios para un negocio."""
    data = request.get_json()
    nombre = data.get('nombre')
    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO listas_de_precios (negocio_id, nombre, descripcion, activa, fecha_desde, fecha_hasta)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                negocio_id,
                nombre,
                data.get('descripcion'),
                data.get('activa', True),
                data.get('fecha_desde'),
                data.get('fecha_hasta')
            )
        )
        lista_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Lista de precios creada con éxito', 'id': lista_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/listas_precios', methods=['GET'])
@token_required
def get_listas_precios_por_negocio(current_user, negocio_id):
    """Obtiene todas las listas de precios de un negocio."""
    db = get_db()
    db.execute("SELECT * FROM listas_de_precios WHERE negocio_id = %s ORDER BY nombre", (negocio_id,))
    listas = db.fetchall()
    return jsonify([dict(lista) for lista in listas])

@bp.route('/listas_precios/<int:lista_id>', methods=['GET'])
@token_required
def get_lista_precio_con_reglas(current_user, lista_id):
    """Obtiene una lista de precios específica junto con todas sus reglas."""
    db = get_db()
    
    # Obtenemos la cabecera de la lista
    db.execute("SELECT * FROM listas_de_precios WHERE id = %s", (lista_id,))
    lista = db.fetchone()
    if not lista:
        return jsonify({'error': 'Lista de precios no encontrada'}), 404

    # Obtenemos las reglas asociadas
    db.execute(
       """
        SELECT             
            r.id,
            r.lista_de_precio_id,
            r.producto_id,
            r.categoria_id,
            r.cantidad_minima,
            r.precio_fijo,
            r.porcentaje_descuento,
            r.aplicar_a_todas_categorias,                        
            p.nombre as producto_nombre, 
            c.nombre as categoria_nombre
        FROM listas_de_precios_reglas r
        LEFT JOIN productos p ON r.producto_id = p.id
        LEFT JOIN productos_categoria c ON r.categoria_id = c.id
        WHERE r.lista_de_precio_id = %s
        """,
        (lista_id,)
    )
    reglas = db.fetchall()
    
    return jsonify({
        'lista': dict(lista),
        'reglas': [dict(regla) for regla in reglas]
    })


# --- RUTAS PARA GESTIONAR LAS REGLAS DE UNA LISTA ---

@bp.route('/listas_precios/<int:lista_id>/reglas', methods=['POST'])
@token_required
def agregar_regla_a_lista(current_user, lista_id):
    """Agrega una nueva regla a una lista de precios existente."""
    data = request.get_json()
    
    db = get_db()
    try:
        db.execute(
           """
            INSERT INTO listas_de_precios_reglas 
            (lista_de_precio_id, producto_id, categoria_id, cantidad_minima, 
             precio_fijo, porcentaje_descuento, aplicar_a_todas_categorias)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                lista_id,
                data.get('producto_id'),
                data.get('categoria_id'),
                data.get('cantidad_minima', 1),
                data.get('precio_fijo'),
                data.get('porcentaje_descuento'),
                data.get('aplicar_a_todas_categorias', False) # Aceptamos el nuevo campo
            )
        )
        g.db_conn.commit()
        return jsonify({'message': 'Regla agregada con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        # Capturamos el error de la base de datos para dar un mensaje más claro
        if 'chk_regla' in str(e):
             return jsonify({'error': 'La regla debe tener un producto/categoría y un precio/descuento.'}), 400
        return jsonify({'error': str(e)}), 500

@bp.route('/reglas/<int:regla_id>', methods=['DELETE'])
@token_required
def eliminar_regla(current_user, regla_id):
    """Elimina una regla específica."""
    db = get_db()
    try:
        db.execute("DELETE FROM listas_de_precios_reglas WHERE id = %s", (regla_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Regla eliminada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500