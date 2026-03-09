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
    limit = request.args.get('limit', type=int)
    offset = request.args.get('offset', type=int, default=0)
    tipo = request.args.get('tipo') # Nuevo filtro por tipo de movimiento

    # Base de la consulta
    query = """
        SELECT
            fecha_movimiento,
            producto_id,
            producto_nombre,
            tipo_movimiento,
            cantidad_cambio,
            stock_resultante,
            usuario_nombre,
            motivo,
            hoja_ruta_id,
            pedido_id
        FROM (
            -- 1. VENTAS (Incluimos Hoja de Ruta y Pedido si existen)
            SELECT
                v.fecha AS fecha_movimiento,
                vd.producto_id,
                p.nombre AS producto_nombre,
                'Venta' AS tipo_movimiento,
                -vd.cantidad AS cantidad_cambio,
                (SELECT COALESCE(p_hist.stock, 0) + vd.cantidad FROM productos p_hist WHERE p_hist.id = vd.producto_id) AS stock_resultante,
                u.nombre AS usuario_nombre,
                'Venta Registrada' AS motivo,
                pe.hoja_ruta_id,
                pe.id AS pedido_id
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            LEFT JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN usuarios u ON v.usuario_id = u.id
            LEFT JOIN pedidos pe ON v.id = pe.venta_id
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
                u.nombre AS usuario_nombre,
                'Ingreso de Mercadería' AS motivo,
                NULL AS hoja_ruta_id,
                NULL AS pedido_id
            FROM ingresos_mercaderia_detalle imd
            JOIN ingresos_mercaderia im ON imd.ingreso_id = im.id
            LEFT JOIN productos p ON imd.producto_id = p.id
            LEFT JOIN usuarios u ON im.usuario_id = u.id
            WHERE im.negocio_id = %s

            UNION ALL

            -- 3. AJUSTES (No Notas de Crédito)
            SELECT
                ia.fecha AS fecha_movimiento,
                ia.producto_id,
                p.nombre AS producto_nombre,
                'Ajuste' AS tipo_movimiento,
                ia.diferencia AS cantidad_cambio,
                ia.cantidad_nueva AS stock_resultante,
                u.nombre AS usuario_nombre,
                COALESCE(ia.motivo, 'Ajuste Manual') AS motivo,
                NULL AS hoja_ruta_id,
                NULL AS pedido_id
            FROM inventario_ajustes ia
            LEFT JOIN productos p ON ia.producto_id = p.id
            LEFT JOIN usuarios u ON ia.usuario_id = u.id
            WHERE ia.negocio_id = %s AND (ia.motivo IS NULL OR ia.motivo NOT LIKE 'Nota de Crédito%%')

            UNION ALL

            -- 3.b. NOTAS DE CRÉDITO (Devolución de stock)
            SELECT
                ia.fecha AS fecha_movimiento,
                ia.producto_id,
                p.nombre AS producto_nombre,
                'Nota de Crédito' AS tipo_movimiento,
                ia.diferencia AS cantidad_cambio,
                ia.cantidad_nueva AS stock_resultante,
                u.nombre AS usuario_nombre,
                ia.motivo AS motivo,
                NULL AS hoja_ruta_id,
                NULL AS pedido_id
            FROM inventario_ajustes ia
            LEFT JOIN productos p ON ia.producto_id = p.id
            LEFT JOIN usuarios u ON ia.usuario_id = u.id
            WHERE ia.negocio_id = %s AND ia.motivo LIKE 'Nota de Crédito%%'

            UNION ALL

            -- 4. PEDIDOS (Reserva de Stock)
            SELECT
                pe.fecha AS fecha_movimiento,
                pd.producto_id,
                p.nombre AS producto_nombre,
                'Reserva Pedido' AS tipo_movimiento,
                -pd.cantidad AS cantidad_cambio,
                NULL AS stock_resultante,
                'Sistema/Vendedor' AS usuario_nombre,
                'Pedido Pendiente/Preparado' AS motivo,
                pe.hoja_ruta_id,
                pe.id AS pedido_id
            FROM pedidos_detalle pd
            JOIN pedidos pe ON pd.pedido_id = pe.id
            LEFT JOIN productos p ON pd.producto_id = p.id
            WHERE pe.negocio_id = %s AND pe.estado IN ('preparado', 'entregado', 'en_camino')

            UNION ALL

            -- 5. REBOTES
            SELECT
                pr.fecha AS fecha_movimiento,
                pr.producto_id,
                p.nombre AS producto_nombre,
                'Rebote' AS tipo_movimiento,
                pr.cantidad AS cantidad_cambio,
                NULL AS stock_resultante,
                'Chofer' AS usuario_nombre,
                mr.descripcion AS motivo,
                pr.hoja_ruta_id AS hoja_ruta_id,
                pr.pedido_id
            FROM pedidos_rebotes pr
            LEFT JOIN productos p ON pr.producto_id = p.id
            LEFT JOIN motivos_rebote mr ON pr.motivo_rebote_id = mr.id
            WHERE pr.negocio_id = %s
        ) AS historial_unificado
        WHERE 1=1
    """
    params = [negocio_id] * 6  # Lista de parámetros (uno por cada SELECT)

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

    if tipo:
        query += " AND tipo_movimiento = %s"
        params.append(tipo)

    query += " ORDER BY fecha_movimiento DESC" # Orden final
    
    if limit:
        query += " LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset)
    
    query += ";"

    try:
        print(f"🔍 [Backend Inv] Querying for negocio_id: {negocio_id}")
        db.execute(query, tuple(params)) # Pasamos los parámetros como tupla
        historial = db.fetchall()
        print(f"✅ [Backend Inv] Found {len(historial)} records.")
        return jsonify([dict(row) for row in historial])
    except Exception as e:
        print(f"!!! ERROR getting inventory history: {e}")
        return jsonify({'error': f'Error al obtener historial: {str(e)}'}), 500