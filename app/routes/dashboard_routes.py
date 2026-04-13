from flask import Blueprint, jsonify, g, request 
from app.database import get_db
from app.auth_decorator import token_required
from datetime import date, timedelta, datetime, time 

bp = Blueprint('dashboard', __name__)

@bp.route('/negocios/<int:negocio_id>/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user, negocio_id):
    db = get_db()
    
    fecha_desde_str = request.args.get('fecha_desde') 
    fecha_hasta_str = request.args.get('fecha_hasta')
    
    fecha_hasta_dt_siguiente = None
    if fecha_hasta_str:
        try:
            fecha_hasta_date = datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date()
            fecha_hasta_dt_siguiente = fecha_hasta_date + timedelta(days=1)
        except ValueError:
             fecha_hasta_str = None 
             fecha_hasta_dt_siguiente = None

    try:
        params_ventas = {'negocio_id': negocio_id}
        query_ventas = """
            SELECT COALESCE(SUM(total), 0) AS total_periodo 
            FROM ventas 
            WHERE negocio_id = %(negocio_id)s AND estado = 'finalizada' 
        """
        
        if fecha_desde_str and fecha_hasta_dt_siguiente:
            query_ventas += " AND fecha >= %(fecha_desde)s AND fecha < %(fecha_hasta_siguiente)s"
            params_ventas['fecha_desde'] = fecha_desde_str
            params_ventas['fecha_hasta_siguiente'] = fecha_hasta_dt_siguiente 
        else:
             fecha_hoy = date.today()
             params_ventas['fecha_hace_30_dias'] = fecha_hoy - timedelta(days=30)
             params_ventas['fecha_manana'] = fecha_hoy + timedelta(days=1)
             query_ventas += " AND fecha >= %(fecha_hace_30_dias)s AND fecha < %(fecha_manana)s"
             

        db.execute(query_ventas, params_ventas)
        ventas_row = db.fetchone()
        ventas_periodo = ventas_row['total_periodo'] if ventas_row else 0

        # --- CORRECCIÓN AQUÍ: Cambiamos stock_actual por stock ---
        # (Ajusta 'stock' si tu columna se llama diferente, ej: 'cantidad')
        db.execute("SELECT COUNT(*) AS count FROM productos WHERE negocio_id = %s AND stock <= stock_minimo", (negocio_id,))
        bajo_stock_count = db.fetchone()['count']

        db.execute("SELECT COUNT(*) AS count FROM clientes WHERE negocio_id = %s", (negocio_id,))
        total_clientes = db.fetchone()['count']

        db.execute(
            """
            SELECT v.fecha, c.nombre AS cliente_nombre, v.total 
            FROM ventas v 
            LEFT JOIN clientes c ON v.cliente_id = c.id 
            WHERE v.negocio_id = %s AND v.estado = 'finalizada'
            ORDER BY v.fecha DESC 
            LIMIT 5 
            """,
            (negocio_id,)
        )
        ultimas_ventas = db.fetchall()
        
        stats = {
            'ventas_periodo': round(ventas_periodo, 2), 
            'productos_bajo_stock': bajo_stock_count,
            'total_clientes': total_clientes,
            'actividad_reciente': [dict(row) for row in ultimas_ventas]
        }
        return jsonify(stats)
        
    except Exception as e:
        print(f"Error en get_dashboard_stats: {e}")
        import traceback
        traceback.print_exc() 
        return jsonify({'error': 'Ocurrió un error en el servidor al obtener las estadísticas.'}), 500


# --- Ruta para Métodos de Pago (AJUSTADA) ---
@bp.route('/negocios/<int:negocio_id>/dashboard/payment_methods', methods=['GET'])
@token_required
def get_payment_methods_stats(current_user, negocio_id):
    db = get_db()
    
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')
    
    fecha_hasta_dt_siguiente = None
    if fecha_hasta_str:
        try:
            fecha_hasta_date = datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date()
            fecha_hasta_dt_siguiente = fecha_hasta_date + timedelta(days=1)
        except ValueError:
            fecha_hasta_str = None
            fecha_hasta_dt_siguiente = None

    try:
        params = {'negocio_id': negocio_id}
        query = """
            SELECT metodo_pago, SUM(total) AS total
            FROM ventas           
            WHERE negocio_id = %(negocio_id)s AND estado = 'finalizada'
        """
        
        if fecha_desde_str and fecha_hasta_dt_siguiente:
            query += " AND fecha >= %(fecha_desde)s AND fecha < %(fecha_hasta_siguiente)s"
            params['fecha_desde'] = fecha_desde_str
            params['fecha_hasta_siguiente'] = fecha_hasta_dt_siguiente
        else:
            fecha_hoy = date.today()
            params['fecha_hace_30_dias'] = fecha_hoy - timedelta(days=30)
            params['fecha_manana'] = fecha_hoy + timedelta(days=1)
            query += " AND fecha >= %(fecha_hace_30_dias)s AND fecha < %(fecha_manana)s"
            
        query += " GROUP BY metodo_pago ORDER BY total DESC"
        
        db.execute(query, params)
        data = db.fetchall()
        return jsonify([dict(row) for row in data])
        
    except Exception as e:
        print(f"Error en get_payment_methods_stats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al obtener datos de métodos de pago.'}), 500


# --- Ruta para Ranking de Categorías (AJUSTADA) ---
@bp.route('/negocios/<int:negocio_id>/dashboard/category_ranking', methods=['GET'])
@token_required
def get_category_ranking(current_user, negocio_id):
    db = get_db()

    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')
    
    fecha_hasta_dt_siguiente = None
    if fecha_hasta_str:
        try:
            fecha_hasta_date = datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date()
            fecha_hasta_dt_siguiente = fecha_hasta_date + timedelta(days=1)
        except ValueError:
            fecha_hasta_str = None
            fecha_hasta_dt_siguiente = None

    try:
        params = {'negocio_id': negocio_id}
        query = """
            SELECT c.nombre, COALESCE(SUM(vd.subtotal), 0) AS total
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id           
            -- --- CORRECCIÓN AQUÍ: Usamos el nombre correcto de la tabla ---
            JOIN productos_categoria c ON p.categoria_id = c.id 
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.negocio_id = %(negocio_id)s AND v.estado = 'finalizada'
        """
        
        if fecha_desde_str and fecha_hasta_dt_siguiente:
            query += " AND v.fecha >= %(fecha_desde)s AND v.fecha < %(fecha_hasta_siguiente)s"
            params['fecha_desde'] = fecha_desde_str
            params['fecha_hasta_siguiente'] = fecha_hasta_dt_siguiente
        else:
            fecha_hoy = date.today()
            params['fecha_hace_30_dias'] = fecha_hoy - timedelta(days=30)
            params['fecha_manana'] = fecha_hoy + timedelta(days=1)
            query += " AND v.fecha >= %(fecha_hace_30_dias)s AND v.fecha < %(fecha_manana)s"
            
        query += """
            GROUP BY c.id, c.nombre
            ORDER BY total DESC
            LIMIT 5
        """
        
        db.execute(query, params)
        data = db.fetchall()
        return jsonify([dict(row) for row in data])
        
    except Exception as e:
        print(f"Error en get_category_ranking: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al obtener el ranking de categorías.'}), 500


# --- Dashboard Distribuidora ---
@bp.route('/negocios/<int:negocio_id>/dashboard/distribucion', methods=['GET'])
@token_required
def get_dashboard_distribucion(current_user, negocio_id):
    db = get_db()

    desde_str = request.args.get('desde')
    hasta_str = request.args.get('hasta')

    hoy = date.today()
    try:
        desde = datetime.strptime(desde_str, '%Y-%m-%d').date() if desde_str else hoy - timedelta(days=30)
        hasta = datetime.strptime(hasta_str, '%Y-%m-%d').date() if hasta_str else hoy
    except ValueError:
        desde = hoy - timedelta(days=30)
        hasta = hoy

    hasta_siguiente = hasta + timedelta(days=1)

    try:
        # 1. KPIs de Pedidos
        db.execute("""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE estado = 'entregado') AS entregados,
                COUNT(*) FILTER (WHERE estado IN ('pendiente', 'preparado', 'en_camino')) AS pendientes,
                COALESCE(SUM(total) FILTER (WHERE estado = 'entregado'), 0) AS facturacion
            FROM pedidos
            WHERE negocio_id = %s AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        kpis = dict(db.fetchone())

        # 2. KPIs de Rutas
        db.execute("""
            SELECT
                COUNT(*) FILTER (WHERE estado = 'completada') AS rutas_completadas
            FROM hoja_ruta
            WHERE negocio_id = %s AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        kpi_r = dict(db.fetchone())

        # 3. Clientes visitados únicos
        db.execute("""
            SELECT COUNT(DISTINCT cliente_id) AS clientes_visitados
            FROM pedidos
            WHERE negocio_id = %s AND estado = 'entregado'
              AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        kpi_c = dict(db.fetchone())

        # 4. Ventas por día
        db.execute("""
            SELECT DATE(fecha) AS dia,
                   COALESCE(SUM(total), 0) AS total
            FROM pedidos
            WHERE negocio_id = %s AND estado = 'entregado'
              AND fecha >= %s AND fecha < %s
            GROUP BY dia ORDER BY dia
        """, (negocio_id, desde, hasta_siguiente))
        ventas_dia = [{'fecha': str(r['dia']), 'total': float(r['total'])} for r in db.fetchall()]

        # 5. Ranking Vendedores
        db.execute("""
            SELECT 
                v.nombre, 
                COUNT(DISTINCT p.id) AS pedidos, 
                COALESCE(SUM(p.total), 0) AS total,
                (
                    SELECT COUNT(*) 
                    FROM hoja_ruta_items hri
                    JOIN hoja_ruta hr ON hri.hoja_ruta_id = hr.id
                    WHERE hr.vendedor_id = v.id 
                      AND hr.fecha >= %s AND hr.fecha < %s
                      AND hri.visitado = TRUE
                ) as visitas
            FROM vendedores v
            LEFT JOIN pedidos p ON v.id = p.vendedor_id AND p.fecha >= %s AND p.fecha < %s AND p.estado = 'entregado'
            WHERE v.negocio_id = %s AND v.activo = TRUE
            GROUP BY v.id, v.nombre
            ORDER BY total DESC
            LIMIT 5
        """, (desde, hasta_siguiente, desde, hasta_siguiente, negocio_id))
        ranking_v = [dict(row) for row in db.fetchall()]
        for r in ranking_v:
            r['total'] = float(r['total'])
            r['visitas'] = int(r['visitas'])

        # 6. Ranking Productos (Mas pedidos por cantidad)
        db.execute("""
            SELECT pr.nombre, SUM(pd.cantidad) as total_vendido, COUNT(DISTINCT pd.pedido_id) as pedidos
            FROM pedidos_detalle pd
            JOIN pedidos p ON pd.pedido_id = p.id
            JOIN productos pr ON pd.producto_id = pr.id
            WHERE p.negocio_id = %s AND p.fecha >= %s AND p.fecha < %s AND p.estado = 'entregado'
            GROUP BY pr.id, pr.nombre
            ORDER BY total_vendido DESC
            LIMIT 5
        """, (negocio_id, desde, hasta_siguiente))
        ranking_p = [dict(row) for row in db.fetchall()]

        # 7. Ranking Clientes (Más compradores por monto)
        db.execute("""
            SELECT c.nombre, SUM(p.total) as total_gastado, COUNT(p.id) as pedidos
            FROM pedidos p
            JOIN clientes c ON p.cliente_id = c.id
            WHERE p.negocio_id = %s AND p.fecha >= %s AND p.fecha < %s AND p.estado = 'entregado'
            GROUP BY c.id, c.nombre
            ORDER BY total_gastado DESC
            LIMIT 5
        """, (negocio_id, desde, hasta_siguiente))
        ranking_c = [dict(row) for row in db.fetchall()]

        # 8. Eficacia de Entrega (OK vs con Rebotes)
        db.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM pedidos_rebotes pr WHERE pr.pedido_id = p.id)) as entregas_ok,
                COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM pedidos_rebotes pr WHERE pr.pedido_id = p.id)) as entregas_con_rebote
            FROM pedidos p
            WHERE p.negocio_id = %s AND p.fecha >= %s AND p.fecha < %s AND p.estado = 'entregado'
        """, (negocio_id, desde, hasta_siguiente))
        eficacia = dict(db.fetchone())

        # 9. Mix de Cobranza (Metodos de Pago)
        db.execute("""
            SELECT v.metodo_pago, SUM(p.total) as total
            FROM pedidos p
            JOIN ventas v ON p.venta_id = v.id
            WHERE p.negocio_id = %s AND p.fecha >= %s AND p.fecha < %s AND p.estado = 'entregado'
            GROUP BY v.metodo_pago
        """, (negocio_id, desde, hasta_siguiente))
        mix_c = [dict(row) for row in db.fetchall()]

        # 10. Top Motivos de Rebote
        db.execute("""
            SELECT mr.descripcion as motivo, COUNT(*) as cantidad
            FROM pedidos_rebotes pr
            JOIN motivos_rebote mr ON pr.motivo_rebote_id = mr.id
            WHERE pr.negocio_id = %s AND pr.fecha >= %s AND pr.fecha < %s
            GROUP BY mr.id, mr.descripcion
            ORDER BY cantidad DESC
            LIMIT 5
        """, (negocio_id, desde, hasta_siguiente))
        motivos_r = [dict(row) for row in db.fetchall()]

        # 11. Últimas Hojas de Ruta
        db.execute("""
            SELECT hr.id, hr.fecha, hr.estado,
                   v.nombre AS vendedor_nombre,
                   COUNT(DISTINCT p.id) AS total_pedidos
            FROM hoja_ruta hr
            LEFT JOIN vendedores v ON hr.vendedor_id = v.id
            LEFT JOIN pedidos p ON p.hoja_ruta_id = hr.id
            WHERE hr.negocio_id = %s
            GROUP BY hr.id, hr.fecha, hr.estado, v.nombre
            ORDER BY hr.fecha DESC LIMIT 5
        """, (negocio_id,))
        ultimas_r = []
        for r in db.fetchall():
            row = dict(r)
            if row.get('fecha'):
                row['fecha'] = str(row['fecha'])
            ultimas_r.append(row)

        return jsonify({
            'kpis': {
                'facturacion': float(kpis.get('facturacion', 0)),
                'pedidos_total': int(kpis.get('total', 0)),
                'pedidos_entregados': int(kpis.get('entregados', 0)),
                'pedidos_pendientes': int(kpis.get('pendientes', 0)),
                'rutas_completadas': int(kpi_r.get('rutas_completadas', 0)),
                'clientes_visitados': int(kpi_c.get('clientes_visitados', 0)),
            },
            'ventas_por_dia': ventas_dia,
            'ranking_vendedores': ranking_v,
            'ranking_productos': ranking_p,
            'ranking_clientes': ranking_c,
            'efectividad_entrega': eficacia,
            'mix_cobranza': mix_c,
            'motivos_rebote': motivos_r,
            'ultimas_rutas': ultimas_r
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/dashboard/profitability', methods=['GET'])
@token_required
def get_dashboard_profitability(current_user, negocio_id):
    db = get_db()
    desde = request.args.get('desde', (date.today() - timedelta(days=30)).isoformat())
    hasta = request.args.get('hasta', date.today().isoformat())
    hasta_siguiente = (datetime.strptime(hasta, '%Y-%m-%d').date() + timedelta(days=1)).isoformat()

    try:
        # 1. Ventas Totales en el periodo
        db.execute("""
            SELECT COALESCE(SUM(total), 0) as total_ventas, COUNT(*) as cantidad_ventas
            FROM ventas
            WHERE negocio_id = %s AND estado = 'finalizada' AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        res_ventas = db.fetchone()

        # 2. Costo Directo (Productos de reventa que no son Restó o no tienen receta)
        db.execute("""
            SELECT SUM(p.precio_costo * vd.cantidad) as costo_total
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN productos p ON vd.producto_id = p.id
            WHERE v.negocio_id = %s AND v.estado = 'finalizada' 
              AND v.fecha >= %s AND v.fecha < %s
              AND (v.metodo_pago NOT LIKE 'Ventas Restó%%')
        """, (negocio_id, desde, hasta_siguiente))
        costo_directo = db.fetchone()['costo_total'] or 0

        # 3. Costo por Recetas (Restó / BOM) con Fallback para ítems sin receta definida
        # Primero calculamos el costo basado en recetas definidas
        db.execute("""
            SELECT SUM(r.cantidad * i.precio_costo * vd.cantidad) as costo_total
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN menu_items mi ON vd.producto_id = mi.producto_id
            JOIN menu_recetas r ON mi.id = r.menu_item_id
            JOIN productos i ON r.insumo_id = i.id
            WHERE v.negocio_id = %s AND v.estado = 'finalizada' 
              AND v.fecha >= %s AND v.fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        costo_recetas = db.fetchone()['costo_total'] or 0

        # Segundo: Para ítems de Restó que NO tienen receta, usamos su costo directo (si lo tienen)
        db.execute("""
            SELECT SUM(p.precio_costo * vd.cantidad) as costo_total
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN productos p ON vd.producto_id = p.id
            WHERE v.negocio_id = %s AND v.estado = 'finalizada' 
              AND v.fecha >= %s AND v.fecha < %s
              AND v.metodo_pago LIKE 'Ventas Restó%%'
              AND NOT EXISTS (
                SELECT 1 FROM menu_items mi 
                JOIN menu_recetas r ON mi.id = r.menu_item_id 
                WHERE mi.producto_id = p.id
              )
        """, (negocio_id, desde, hasta_siguiente))
        costo_resto_directo = db.fetchone()['costo_total'] or 0

        costo_recetas += costo_resto_directo

        # 4. Ingresos de Mercadería (Compras)
        db.execute("""
            SELECT COALESCE(SUM(total_factura), 0) as total_compras
            FROM ingresos_mercaderia
            WHERE negocio_id = %s AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        total_compras = db.fetchone()['total_compras'] or 0

        total_ventas = float(res_ventas['total_ventas'] or 0)
        costo_total_estimado = float(costo_directo + costo_recetas)
        margen = total_ventas - costo_total_estimado
        porcentaje_margen = (margen / total_ventas * 100) if total_ventas > 0 else 0

        return jsonify({
            'ventas_totales': total_ventas,
            'costo_total_estimado': costo_total_estimado,
            'margen_bruto': margen,
            'porcentaje_margen': round(porcentaje_margen, 2),
            'total_compras': float(total_compras),
            'costo_desglosado': {
                'directo': float(costo_directo),
                'recetas': float(costo_recetas)
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
