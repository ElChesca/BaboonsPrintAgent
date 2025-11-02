# app/routes/gastos_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal

bp = Blueprint('gastos', __name__)

# ===============================================
# ✨ FUNCIÓN HELPER DE SEGURIDAD (NUEVA) ✨
# ===============================================
def check_user_negocio_permission(current_user, negocio_id):
    """
    Verifica si el usuario actual tiene permisos sobre el negocio_id.
    Retorna True si es 'superadmin' o si está asignado.
    Retorna False en caso contrario.
    """
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return False # Error de autenticación base

    if current_user['rol'] == 'superadmin':
        return True # Superadmin puede hacer todo

    # Para admin y operador, verificar la tabla de unión
    db = get_db()
    db.execute(
        "SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
        (current_user['id'], negocio_id)
    )
    if db.fetchone():
        return True # Está asignado
    
    return False # No está asignado

# ===============================================
# RUTAS PARA CATEGORÍAS DE GASTO
# ===============================================

@bp.route('/negocios/<int:negocio_id>/categorias_gasto/activas', methods=['GET'])
@token_required
def get_categorias_gasto_activas(current_user, negocio_id):
    """
    Obtiene solo categorías activas para los dropdowns.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---
    
    db = get_db()
    try:
        db.execute(
            "SELECT id, descripcion FROM categorias_gasto WHERE negocio_id = %s AND estado = 'Activa' ORDER BY descripcion", 
            (negocio_id,)
        )
        categorias = [dict(row) for row in db.fetchall()]
        return jsonify(categorias)
    except Exception as e:
        print(f"!!! DATABASE ERROR in get_categorias_gasto_activas: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/categorias_gasto', methods=['GET', 'POST'])
@token_required
def handle_categorias_gasto(current_user, negocio_id):
    """
    Maneja la obtención (GET) y creación (POST) de categorías de gasto.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---

    # --- Lógica para GET ---
    if request.method == 'GET':
        db = get_db()
        try:
            db.execute(
                "SELECT id, descripcion, estado FROM categorias_gasto WHERE negocio_id = %s ORDER BY descripcion", 
                (negocio_id,)
            )
            categorias = [dict(row) for row in db.fetchall()]
            return jsonify(categorias)
        except Exception as e:
            print(f"!!! DATABASE ERROR in get_categorias_gasto: {e}")
            return jsonify({'error': str(e)}), 500

    # --- Lógica para POST ---
    if request.method == 'POST':
        data = request.get_json()
        if not data or 'descripcion' not in data:
            return jsonify({'error': 'Campo "descripcion" es obligatorio'}), 400

        usuario_creacion_id = current_user['id']
        
        db = get_db()
        try:
            db.execute(
                """
                INSERT INTO categorias_gasto (negocio_id, usuario_creacion_id, descripcion, estado, fecha_creacion)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    negocio_id, 
                    usuario_creacion_id,
                    data['descripcion'],
                    data.get('estado', 'Activa'),
                    datetime.datetime.now()
                )
            )
            nuevo_id = db.fetchone()['id']
            g.db_conn.commit()
            return jsonify({'id': nuevo_id, 'message': 'Categoría creada con éxito'}), 201
        except Exception as e:
            g.db_conn.rollback()
            print(f"!!! DATABASE ERROR in add_categoria_gasto: {e}")
            return jsonify({'error': str(e)}), 500

# --- ✨ (FIN DEL CAMBIO) --- ✨

@bp.route('/negocios/<int:negocio_id>/categorias_gasto/<int:id>', methods=['PUT'])
@token_required
def update_categoria_gasto(current_user, negocio_id, id):
    """
    Actualiza una categoría de gasto específica.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---

    data = request.get_json()
    if not data or 'descripcion' not in data or 'estado' not in data:
        return jsonify({'error': 'Campos "descripcion" y "estado" son obligatorios'}), 400

    db = get_db()
    try:
        db.execute(
            "UPDATE categorias_gasto SET descripcion = %s, estado = %s WHERE id = %s AND negocio_id = %s",
            (data['descripcion'], data['estado'], id, negocio_id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Categoría actualizada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! DATABASE ERROR in update_categoria_gasto: {e}")
        return jsonify({'error': str(e)}), 500

# ===============================================
# RUTAS PARA GASTOS OPERATIVOS
# ===============================================

@bp.route('/negocios/<int:negocio_id>/gastos', methods=['GET'])
@token_required
def get_gastos(current_user, negocio_id):
    """
    Obtiene la lista de gastos (join con categorías) para un negocio.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---
    
    db = get_db()
    try:
        db.execute(
            """
            SELECT 
                g.id, g.fecha, g.monto, g.descripcion, g.metodo_pago, g.estado,
                c.descripcion AS categoria,
                g.categoria_gasto_id
            FROM gastos_operativos g
            LEFT JOIN categorias_gasto c ON g.categoria_gasto_id = c.id
            WHERE g.negocio_id = %s
            ORDER BY g.fecha DESC
            LIMIT 100
            """, 
            (negocio_id,)
        )
        gastos_rows = [dict(row) for row in db.fetchall()]
        gastos_list = []
        for row in gastos_rows:
            row_dict = dict(row)
            if isinstance(row_dict['monto'],Decimal):
                row_dict['monto'] = float(row_dict['monto'])
            gastos_list.append(row_dict)
        
        return jsonify(gastos_list)
    
    except Exception as e:
        print(f"!!! DATABASE ERROR in get_gastos: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/gastos', methods=['POST'])
@token_required
def add_gasto(current_user, negocio_id):
    """
    Registra un nuevo gasto para el negocio_id de la URL.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---

    data = request.get_json()
    if not data or not data.get('monto') or not data.get('categoria_gasto_id'):
        return jsonify({'error': 'Campos "monto" y "categoria_gasto_id" son obligatorios'}), 400

    usuario_id = current_user['id']
    fecha = data.get('fecha') or datetime.datetime.now()
    
    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO gastos_operativos (
                negocio_id, usuario_id, categoria_gasto_id, proveedor_id, caja_sesion_id,
                fecha, monto, metodo_pago, descripcion, estado
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                negocio_id, 
                usuario_id,
                data['categoria_gasto_id'],
                data.get('proveedor_id'),
                data.get('caja_sesion_id'),
                fecha,
                data['monto'],
                data.get('metodo_pago'),
                data.get('descripcion'),
                data.get('estado', 'Pagado')
            )
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Gasto registrado con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! DATABASE ERROR in add_gasto: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/gastos/<int:id>', methods=['PUT'])
@token_required
def update_gasto(current_user, negocio_id, id):
    """
    Actualiza un gasto existente.
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---

    data = request.get_json()
    if not data or not data.get('monto') or not data.get('categoria_gasto_id'):
        return jsonify({'error': 'Campos "monto" y "categoria_gasto_id" son obligatorios'}), 400

    db = get_db()
    try:
        db.execute(
            """
            UPDATE gastos_operativos SET 
                categoria_gasto_id = %s,
                fecha = %s,
                monto = %s,
                descripcion = %s,
                metodo_pago = %s,
                estado = %s
            WHERE id = %s AND negocio_id = %s
            """,
            (
                data['categoria_gasto_id'],
                data.get('fecha'),
                data['monto'],
                data.get('descripcion'),
                data.get('metodo_pago'),
                data.get('estado'),
                id,
                negocio_id
            )
        )
        g.db_conn.commit()
        return jsonify({'message': 'Gasto actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! DATABASE ERROR in update_gasto: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/gastos/anular/<int:id>', methods=['PUT'])
@token_required
def anular_gasto(current_user, negocio_id, id):
    """
    Anula un gasto (cambia estado a 'Anulado').
    """
    # ✨ --- VALIDACIÓN DE PERMISO --- ✨
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403
    # --- FIN VALIDACIÓN ---

    db = get_db()
    try:
        db.execute(
            "UPDATE gastos_operativos SET estado = 'Anulado' WHERE id = %s AND negocio_id = %s",
            (id, negocio_id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Gasto anulado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! DATABASE ERROR in anular_gasto: {e}")
        return jsonify({'error': str(e)}), 500