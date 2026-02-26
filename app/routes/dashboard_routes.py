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
                COUNT(*) FILTER (WHERE estado IN ('pendiente', 'preparado', 'en_ruta')) AS pendientes,
                COALESCE(SUM(total) FILTER (WHERE estado = 'entregado'), 0) AS facturacion
            FROM pedidos
            WHERE negocio_id = %s AND fecha >= %s AND fecha < %s
        """, (negocio_id, desde, hasta_siguiente))
        kpi_p = dict(db.fetchone())

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
        ventas_por_dia = [{'fecha': str(r['dia']), 'total': float(r['total'])} for r in db.fetchall()]

        # 5. Ranking Vendedores
        db.execute("""
            SELECT v.nombre,
                   COUNT(p.id) AS pedidos,
                   COALESCE(SUM(p.total) FILTER (WHERE p.estado = 'entregado'), 0) AS total
            FROM vendedores v
            LEFT JOIN pedidos p ON p.vendedor_id = v.id
              AND p.negocio_id = %s AND p.fecha >= %s AND p.fecha < %s
            WHERE v.negocio_id = %s
            GROUP BY v.id, v.nombre
            ORDER BY total DESC LIMIT 5
        """, (negocio_id, desde, hasta_siguiente, negocio_id))
        ranking = [dict(r) for r in db.fetchall()]
        for r in ranking:
            r['total'] = float(r['total'])

        # 6. Últimas Hojas de Ruta
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
        rutas = []
        for r in db.fetchall():
            row = dict(r)
            if row.get('fecha'):
                row['fecha'] = str(row['fecha'])
            rutas.append(row)

        return jsonify({
            'kpis': {
                'facturacion': float(kpi_p.get('facturacion', 0)),
                'pedidos_total': int(kpi_p.get('total', 0)),
                'pedidos_entregados': int(kpi_p.get('entregados', 0)),
                'pedidos_pendientes': int(kpi_p.get('pendientes', 0)),
                'rutas_completadas': int(kpi_r.get('rutas_completadas', 0)),
                'clientes_visitados': int(kpi_c.get('clientes_visitados', 0)),
            },
            'ventas_por_dia': ventas_por_dia,
            'ranking_vendedores': ranking,
            'ultimas_rutas': rutas
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
