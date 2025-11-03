# app/routes/category_routes.py
# ✨ ARCHIVO ACTUALIZADO ✨
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('categories', __name__)

@bp.route('/negocios/<int:negocio_id>/categorias', methods=['GET'])
@token_required
def get_categorias(current_user, negocio_id):
    db = get_db()
    
    # ✨ --- CONSULTA RECURSIVA (CORREGIDA Y SEGURA) --- ✨
    # Esta consulta previene bucles infinitos y asegura
    # que solo se traigan datos del negocio_id solicitado.
    query = """
    WITH RECURSIVE categorias_recursivas AS (
        -- 1. Base Case: Categorías raíz (padre es NULL) para ESTE negocio
        SELECT
            id,
            nombre,
            negocio_id,
            categoria_padre_id,
            0 AS nivel,
            ARRAY[id] AS path_ids, -- Usado para detectar bucles
            nombre AS ruta_categoria,
            (REPEAT('    ', 0) || nombre) AS nombre_indentado
        FROM
            productos_categoria
        WHERE
            categoria_padre_id IS NULL AND negocio_id = %s  -- Filtro 1: Padres del negocio

        UNION ALL

        -- 2. Recursive Step: Hijos de las categorías ya encontradas
        SELECT
            hijo.id,
            hijo.nombre,
            hijo.negocio_id,
            hijo.categoria_padre_id,
            padre.nivel + 1,
            padre.path_ids || hijo.id, -- Añadimos el ID al path
            (padre.ruta_categoria || ' > ' || hijo.nombre) AS ruta_categoria,
            (REPEAT('    ', padre.nivel + 1) || hijo.nombre) AS nombre_indentado
        FROM
            productos_categoria hijo
        INNER JOIN
            categorias_recursivas padre ON hijo.categoria_padre_id = padre.id
        WHERE
            -- ✨ CORRECCIÓN CLAVE (RE-INTRODUCIDA):
            -- 1. Aseguramos que el hijo también pertenezca al negocio
            hijo.negocio_id = %s
            -- 2. Prevención de bucle infinito:
            --    Evita que un hijo se una si ya está en el 'path'
            AND NOT (hijo.id = ANY(padre.path_ids))
    )
    -- 3. Select final
    SELECT
        id,
        nombre,
        categoria_padre_id,
        nivel,
        ruta_categoria,
        nombre_indentado
    FROM
        categorias_recursivas
    ORDER BY
        ruta_categoria;
    """
    
    try:
        # ✨ Pasamos el negocio_id DOS VECES, uno para cada %s
        db.execute(query, (negocio_id, negocio_id)) 
        categorias = db.fetchall()
        return jsonify([dict(row) for row in categorias])
    except Exception as e:
        # Si la consulta falla, ahora sabremos por qué
        g.db_conn.rollback()
        print(f"Error en la consulta recursiva de categorías: {e}")
        return jsonify({'error': f'Error de base de datos al cargar categorías: {str(e)}'}), 500
    
    
@bp.route('/negocios/<int:negocio_id>/categorias', methods=['POST'])
@token_required
def create_categoria(current_user, negocio_id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    nombre = data.get('nombre')
    # ✨ Obtenemos el ID del padre. Si es "" o None, lo convertimos a None (NULL)
    categoria_padre_id = data.get('categoria_padre_id') or None
    
    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400
    
    db = get_db()
    try:
        db.execute(
            # ✨ Actualizamos el INSERT
            'INSERT INTO productos_categoria (nombre, negocio_id, categoria_padre_id) VALUES (%s, %s, %s) RETURNING id',
            (nombre, negocio_id, categoria_padre_id)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        # Devolvemos el objeto completo
        return jsonify({
            'id': nuevo_id, 
            'nombre': nombre,
            'categoria_padre_id': categoria_padre_id
        }), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': 'Esa categoría ya existe o ocurrió un error'}), 409

@bp.route('/categorias/<int:id>', methods=['PUT'])
@token_required
def update_categoria(current_user, id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    nombre = data.get('nombre')
    # ✨ Obtenemos el ID del padre
    categoria_padre_id = data.get('categoria_padre_id') or None

    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    # ✨ Verificación de seguridad: Una categoría no puede ser su propio padre
    if categoria_padre_id is not None and int(categoria_padre_id) == id:
        return jsonify({'error': 'Una categoría no puede ser subcategoría de sí misma'}), 400

    db = get_db()
    try:
        # ✨ Actualizamos el UPDATE
        db.execute(
            'UPDATE productos_categoria SET nombre = %s, categoria_padre_id = %s WHERE id = %s', 
            (nombre, categoria_padre_id, id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Categoría actualizada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': 'Ocurrió un error al actualizar'}), 500


@bp.route('/categorias/<int:id>', methods=['DELETE'])
@token_required
def delete_categoria(current_user, id):
    if current_user['rol'] not in ['admin', 'superadmin']:
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()
    try:
        # ✨ VERIFICACIÓN DE SEGURIDAD: Chequeamos si tiene subcategorías
        db.execute('SELECT 1 FROM productos_categoria WHERE categoria_padre_id = %s', (id,))
        if db.fetchone():
            return jsonify({'error': 'No se puede eliminar la categoría porque tiene subcategorías asociadas.'}), 400

        # Si no tiene hijos, la borramos
        db.execute('DELETE FROM productos_categoria WHERE id = %s', (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Categoría eliminada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
         # Manejo de error si un producto la está usando (Foreign Key)
        if 'violates foreign key constraint' in str(e):
            return jsonify({'error': 'No se puede eliminar: hay productos asignados a esta categoría.'}), 400
        return jsonify({'error': str(e)}), 500