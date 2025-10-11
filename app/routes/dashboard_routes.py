from flask import Blueprint, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('dashboard', __name__)

@bp.route('/negocios/<int:negocio_id>/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user, negocio_id):
    db = get_db()
    
    try:
        # ✨ CORRECCIÓN: Buscamos ventas en las últimas 24 horas en lugar de 'hoy'.
        # La sintaxis 'NOW() - INTERVAL '24 hours'' es estándar en PostgreSQL (usado por Render).
        db.execute(
            "SELECT SUM(total) as total FROM ventas WHERE negocio_id = %s AND fecha >= NOW() - INTERVAL '24 hours'",
            (negocio_id,)
        )
        ventas_row = db.fetchone()
        ventas_hoy = ventas_row['total'] if ventas_row and ventas_row['total'] is not None else 0

        db.execute("SELECT COUNT(*) as count FROM productos WHERE negocio_id = %s AND stock <= stock_minimo", (negocio_id,))
        bajo_stock_count = db.fetchone()['count']

        db.execute("SELECT COUNT(*) as count FROM clientes WHERE negocio_id = %s", (negocio_id,))
        total_clientes = db.fetchone()['count']

        db.execute(
            "SELECT v.fecha, c.nombre as cliente_nombre, v.total FROM ventas v LEFT JOIN clientes c ON v.cliente_id = c.id WHERE v.negocio_id = %s ORDER BY v.fecha DESC LIMIT 5",
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
        
    except Exception as e:
        print(f"Error en get_dashboard_stats: {e}")
        return jsonify({'error': 'Ocurrió un error en el servidor al obtener las estadísticas.'}), 500
    

# --- ✨ NUEVA RUTA PARA MÉTODOS DE PAGO ---
@bp.route('/negocios/<int:negocio_id>/dashboard/payment_methods', methods=['GET'])
@token_required
def get_payment_methods_stats(current_user, negocio_id):
    db = get_db()
    # Agrupamos las ventas de los últimos 30 días por método de pago y sumamos sus totales
    query = """
        SELECT metodo_pago, SUM(total) as total
        FROM ventas
        WHERE negocio_id = %s AND fecha >= NOW() - INTERVAL '30 days'
        GROUP BY metodo_pago
        ORDER BY total DESC;
    """
    db.execute(query, (negocio_id,))
    data = db.fetchall()
    return jsonify([dict(row) for row in data])


# --- ✨ NUEVA RUTA PARA RANKING DE CATEGORÍAS ---
@bp.route('/negocios/<int:negocio_id>/dashboard/category_ranking', methods=['GET'])
@token_required
def get_category_ranking(current_user, negocio_id):
    db = get_db()
    # Hacemos un JOIN complejo para llegar desde la venta hasta la categoría y sumar los subtotales.
    # Limitamos a las 5 categorías más vendidas en los últimos 30 días.
    query = """
        SELECT c.nombre, SUM(vd.subtotal) as total
        FROM ventas_detalle vd
        JOIN productos p ON vd.producto_id = p.id
        JOIN categorias c ON p.categoria_id = c.id
        JOIN ventas v ON vd.venta_id = v.id
        WHERE v.negocio_id = %s AND v.fecha >= NOW() - INTERVAL '30 days'
        GROUP BY c.nombre
        ORDER BY total DESC
        LIMIT 5;
    """
    db.execute(query, (negocio_id,))
    data = db.fetchall()
    return jsonify([dict(row) for row in data])