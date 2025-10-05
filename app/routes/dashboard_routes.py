# app/routes/dashboard_routes.py
from flask import Blueprint, jsonify
from app import get_db
from .auth_routes import token_required

bp = Blueprint('dashboard', __name__)

@bp.route('/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user):
    """
    Recopila y devuelve las estadísticas clave para el dashboard.
    Ahora adaptado para PostgreSQL.
    """
    db = get_db()
    negocio_id = current_user.get('negocio_activo_id') # Asumimos que el negocio activo se pasa en el token
    if not negocio_id:
        # Si no hay negocio activo, intentamos obtener el primero asignado al usuario
        db.execute('SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s LIMIT 1', (current_user['id'],))
        negocio_asignado = db.fetchone()
        if not negocio_asignado:
            return jsonify({'error': 'El usuario no tiene un negocio asignado'}), 400
        negocio_id = negocio_asignado['id']

    # --- 1. Ventas Totales del Día ---
    # ✨ Sintaxis de fecha corregida para PostgreSQL y separación de execute/fetchone
    db.execute(
        "SELECT SUM(total) as total FROM ventas WHERE negocio_id = %s AND fecha::date = CURRENT_DATE",
        (negocio_id,)
    )
    ventas_row = db.fetchone()
    ventas_hoy = ventas_row['total'] if ventas_row and ventas_row['total'] is not None else 0

    # --- 2. Conteo de Productos con Bajo Stock ---
    # ✨ Separación de execute/fetchone
    db.execute(
        "SELECT COUNT(*) as count FROM productos WHERE negocio_id = %s AND stock <= stock_minimo AND stock > 0",
        (negocio_id,)
    )
    bajo_stock_count = db.fetchone()['count']

    # --- 3. Conteo Total de Clientes ---
    # ✨ Separación de execute/fetchone
    db.execute(
        "SELECT COUNT(*) as count FROM clientes WHERE negocio_id = %s",
        (negocio_id,)
    )
    total_clientes = db.fetchone()['count']

    # --- 4. Últimas 5 Ventas (Actividad Reciente) ---
    # ✨ Separación de execute/fetchall y parámetro %s
    db.execute(
        """
        SELECT v.id, v.fecha, c.nombre as cliente_nombre, v.total 
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = %s
        ORDER BY v.fecha DESC
        LIMIT 5
        """,
        (negocio_id,)
    )
    ultimas_ventas = db.fetchall()

    # Compilamos todo en un solo objeto JSON
    stats = {
        'ventas_hoy': round(ventas_hoy, 2),
        'productos_bajo_stock': bajo_stock_count,
        'total_clientes': total_clientes,
        'actividad_reciente': [dict(row) for row in ultimas_ventas]
    }
    
    return jsonify(stats)