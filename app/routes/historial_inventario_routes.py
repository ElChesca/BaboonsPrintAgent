# app/routes/historial_inventario_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime # Para manejar fechas

bp = Blueprint('historial_inventario', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/historial_inventario', methods=['GET'])
@token_required
def get_historial_inventario(current_user, negocio_id):
    db = get_db()

    # --- Filtros ---
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    producto_id = request.args.get('producto_id')

    # Base de la consulta
    query = """
        SELECT
            fecha_movimiento,
            producto_id,
            producto_nombre,
            tipo_movimiento,
            cantidad_cambio,
            stock_resultante,
            usuario_nombre -- ✨ NUEVA COLUMNA
        FROM (
            -- 1. VENTAS
            SELECT
                v.fecha AS fecha_movimiento,
                vd.producto_id,
                p.nombre AS producto_nombre,
                'Venta' AS tipo_movimiento,
                -vd.cantidad AS cantidad_cambio,
                (SELECT COALESCE(p_hist.stock, 0) + vd.cantidad FROM productos p_hist WHERE p_hist.id = vd.producto_id) AS stock_resultante,
                u.nombre AS usuario_nombre -- ✨ Obtenemos nombre de usuario
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN productos p ON vd.producto_id = p.id
            JOIN usuarios u ON v.usuario_id = u.id -- ✨ JOIN con usuarios
            WHERE v.negocio_id = %s

            UNION ALL

            -- 2. INGRESOS
            SELECT
                im.fecha AS fecha_movimiento,
                imd.producto_id,
                p.nombre AS producto_nombre,
                'Ingreso' AS tipo_movimiento,
                imd.cantidad AS cantidad_cambio,
                p.stock AS stock_resultante,
                u.nombre AS usuario_nombre -- ✨ Obtenemos nombre de usuario
            FROM ingresos_mercaderia_detalle imd
            JOIN ingresos_mercaderia im ON imd.ingreso_id = im.id
            JOIN productos p ON imd.producto_id = p.id
            JOIN usuarios u ON im.usuario_id = u.id -- ✨ JOIN con usuarios
            WHERE im.negocio_id = %s

            UNION ALL

            -- 3. AJUSTES
            SELECT
                ia.fecha AS fecha_movimiento,
                ia.producto_id,
                p.nombre AS producto_nombre,
                'Ajuste' AS tipo_movimiento,
                ia.diferencia AS cantidad_cambio,
                ia.cantidad_nueva AS stock_resultante,
                u.nombre AS usuario_nombre -- ✨ Obtenemos nombre de usuario
            FROM inventario_ajustes ia
            JOIN productos p ON ia.producto_id = p.id
            JOIN usuarios u ON ia.usuario_id = u.id -- ✨ JOIN con usuarios
            WHERE ia.negocio_id = %s
        ) AS historial_unificado
        WHERE 1=1 -- ✨ Placeholder para añadir filtros dinámicos
    """
    params = [negocio_id, negocio_id, negocio_id] # Lista de parámetros

    # --- Añadir filtros dinámicamente ---
    if fecha_desde:
        query += " AND fecha_movimiento >= %s"
        params.append(fecha_desde)

    if fecha_hasta:
        # Añadimos un día y usamos '<' para incluir todo el día 'hasta'
        try:
            fecha_hasta_dt = datetime.datetime.strptime(fecha_hasta, '%Y-%m-%d') + datetime.timedelta(days=1)
            query += " AND fecha_movimiento < %s"
            params.append(fecha_hasta_dt.strftime('%Y-%m-%d %H:%M:%S'))
        except ValueError:
            print(f"Formato de fecha_hasta inválido: {fecha_hasta}") # Log de error

    if producto_id:
        query += " AND producto_id = %s"
        params.append(producto_id)

    query += " ORDER BY fecha_movimiento DESC;" # Orden final

    try:
        db.execute(query, tuple(params)) # Pasamos los parámetros como tupla
        historial = db.fetchall()
        return jsonify([dict(row) for row in historial])
    except Exception as e:
        print(f"!!! ERROR getting inventory history: {e}")
        return jsonify({'error': f'Error al obtener historial: {str(e)}'}), 500