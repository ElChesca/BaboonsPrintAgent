from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('historial_inventario', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/historial_inventario', methods=['GET'])
@token_required
def get_historial_inventario(current_user, negocio_id):
    """
    Obtiene el historial unificado de movimientos de inventario para un negocio.
    """
    db = get_db()
    
    # Parámetros opcionales para filtrar (los añadiremos luego si es necesario)
    # fecha_desde = request.args.get('fecha_desde')
    # fecha_hasta = request.args.get('fecha_hasta')
    # producto_id = request.args.get('producto_id')
    
    query = """
        SELECT 
            fecha_movimiento,
            producto_id,
            producto_nombre,
            tipo_movimiento,
            cantidad_cambio,
            stock_resultante 
            -- , usuario_nombre -- Descomentar si añadiste usuario
        FROM (
            -- 1. VENTAS
            SELECT 
                v.fecha AS fecha_movimiento,
                vd.producto_id,
                p.nombre AS producto_nombre,
                'Venta' AS tipo_movimiento,
                -vd.cantidad AS cantidad_cambio,
                -- Cálculo aproximado de stock resultante (puede necesitar ajuste)
                (SELECT COALESCE(p_hist.stock, 0) + vd.cantidad FROM productos p_hist WHERE p_hist.id = vd.producto_id) AS stock_resultante
                -- , u.nombre AS usuario_nombre
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN productos p ON vd.producto_id = p.id
            WHERE v.negocio_id = %s -- Filtro por negocio

            UNION ALL

            -- 2. INGRESOS
            SELECT 
                im.fecha AS fecha_movimiento,
                imd.producto_id,
                p.nombre AS producto_nombre,
                'Ingreso' AS tipo_movimiento,
                imd.cantidad AS cantidad_cambio,
                p.stock AS stock_resultante -- Stock actual después del ingreso
                -- , u.nombre AS usuario_nombre
            FROM ingresos_mercaderia_detalle imd
            JOIN ingresos_mercaderia im ON imd.ingreso_id = im.id
            JOIN productos p ON imd.producto_id = p.id
            WHERE im.negocio_id = %s -- Filtro por negocio

            UNION ALL

            -- 3. AJUSTES
            SELECT 
                ia.fecha AS fecha_movimiento,
                ia.producto_id,
                p.nombre AS producto_nombre,
                'Ajuste' AS tipo_movimiento,
                ia.diferencia AS cantidad_cambio,
                ia.cantidad_nueva AS stock_resultante
                -- , u.nombre AS usuario_nombre
            FROM inventario_ajustes ia
            JOIN productos p ON ia.producto_id = p.id
            WHERE ia.negocio_id = %s -- Filtro por negocio
        ) AS historial_unificado
        ORDER BY 
            fecha_movimiento DESC;
    """
    
    try:
        # Ejecutamos la consulta pasando el negocio_id tres veces (una por cada SELECT en el UNION)
        db.execute(query, (negocio_id, negocio_id, negocio_id))
        historial = db.fetchall()
        return jsonify([dict(row) for row in historial])
    except Exception as e:
        print(f"!!! ERROR getting inventory history: {e}") # Log para el servidor
        return jsonify({'error': f'Error al obtener historial: {str(e)}'}), 500