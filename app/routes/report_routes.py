from flask import Blueprint, jsonify, request
from app.database import get_db
from app.auth_decorator import token_required


bp = Blueprint('reports', __name__)

# --- Reporte de Ventas Diarias (Movido desde sales_routes.py) ---
@bp.route('/negocios/<int:negocio_id>/reportes/ventas_diarias')
@token_required
def reporte_ventas_diarias(current_user, negocio_id):
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    db = get_db()
    query = """
        SELECT date(fecha) as dia, SUM(total) as total_vendido, COUNT(id) as cantidad_ventas
        FROM ventas WHERE negocio_id = ?
    """
    params = [negocio_id]
    if fecha_desde:
        query += " AND date(fecha) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND date(fecha) <= ?"
        params.append(fecha_hasta)
    query += " GROUP BY date(fecha) ORDER BY date(fecha) DESC"
    reporte = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in reporte])

# --- ✨ NUEVO: Reporte de Ganancias por Producto ---
@bp.route('/negocios/<int:negocio_id>/reportes/ganancias', methods=['GET'])
@token_required
def get_reporte_ganancias(current_user, negocio_id):
    """
    Calcula la ganancia neta por producto en un rango de fechas.
    Ganancia = (Precio de Venta - Precio de Costo) * Cantidad Vendida.
    """
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')

    query = """
        SELECT
            p.id as producto_id,
            p.nombre as producto_nombre,
            SUM(vd.cantidad) as cantidad_vendida,
            SUM(vd.subtotal) as total_ventas,
            SUM(vd.cantidad * p.precio_costo) as total_costo,
            SUM(vd.subtotal - (vd.cantidad * p.precio_costo)) as ganancia_neta
        FROM
            ventas_detalle vd
        JOIN
            productos p ON vd.producto_id = p.id
        JOIN
            ventas v ON vd.venta_id = v.id
        WHERE
            v.negocio_id = ?
    """
    params = [negocio_id]

    if fecha_desde:
        query += " AND date(v.fecha) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND date(v.fecha) <= ?"
        params.append(fecha_hasta)
    
    query += " GROUP BY p.id, p.nombre ORDER BY ganancia_neta DESC"
    
    reporte = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in reporte])