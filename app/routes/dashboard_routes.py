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

