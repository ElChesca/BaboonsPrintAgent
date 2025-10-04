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
    """
    db = get_db()
    
    # 1. Ventas Totales del Día
    ventas_hoy = db.execute(
        "SELECT SUM(total) as total FROM ventas WHERE DATE(fecha) = DATE('now', 'localtime')"
    ).fetchone()['total'] or 0

    # 2. Conteo de Productos con Bajo Stock (ej: <= 5 unidades)
    bajo_stock_count = db.execute(
        "SELECT COUNT(*) as count FROM productos WHERE stock <= 5"
    ).fetchone()['count']

    # 3. Conteo Total de Clientes
    total_clientes = db.execute(
        "SELECT COUNT(*) as count FROM clientes"
    ).fetchone()['count']

    # 4. Últimas 5 Ventas (Actividad Reciente)
    ultimas_ventas = db.execute(
        """
        SELECT v.id, v.fecha, c.nombre as cliente_nombre, v.total 
        FROM ventas v
        JOIN clientes c ON v.cliente_id = c.id
        ORDER BY v.fecha DESC
        LIMIT 5
        """
    ).fetchall()

    # Compilamos todo en un solo objeto JSON
    stats = {
        'ventas_hoy': round(ventas_hoy, 2),
        'productos_bajo_stock': bajo_stock_count,
        'total_clientes': total_clientes,
        'actividad_reciente': [dict(row) for row in ultimas_ventas]
    }
    
    return jsonify(stats)