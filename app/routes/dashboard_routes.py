# app/routes/dashboard_routes.py
from flask import Blueprint, jsonify, request
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('dashboard', __name__)

@bp.route('/negocios/<int:negocio_id>/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user, negocio_id):
    db = get_db()

    # 1. Ventas Totales del Día
    db.execute(
        "SELECT SUM(total) as total FROM ventas WHERE negocio_id = %s AND fecha::date = CURRENT_DATE",
        (negocio_id,)
    )
    ventas_row = db.fetchone()
    ventas_hoy = ventas_row['total'] if ventas_row and ventas_row['total'] is not None else 0

    # 2. Conteo de Productos con Bajo Stock
    db.execute(
        "SELECT COUNT(*) as count FROM productos WHERE negocio_id = %s AND stock <= stock_minimo AND stock > 0",
        (negocio_id,)
    )
    bajo_stock_count = db.fetchone()['count']

    # 3. Conteo Total de Clientes
    db.execute(
        "SELECT COUNT(*) as count FROM clientes WHERE negocio_id = %s",
        (negocio_id,)
    )
    total_clientes = db.fetchone()['count']

    # 4. Últimas 5 Ventas
    db.execute(
        """
        SELECT v.id, v.fecha, c.nombre as cliente_nombre, v.total 
        FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = %s ORDER BY v.fecha DESC LIMIT 5
        """,
        (negocio_id,)
    )
    ultimas_ventas = db.fetchall()

    stats = {
        'ventas_hoy': round(ventas_hoy, 2),
        'productos_bajo_stock': bajo_stock_count,
        'total_clientes': total_clientes,
        'actividad_reciente': [dict(row) for row in ultimas_ventas]
    }
    return jsonify(stats)