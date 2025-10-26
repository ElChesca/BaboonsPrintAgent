from flask import Blueprint, jsonify, g, request # --- CAMBIO AQUÍ: Importamos request ---
from app.database import get_db
from app.auth_decorator import token_required
from datetime import date, timedelta # --- CAMBIO AQUÍ: Importamos para fechas default ---

bp = Blueprint('dashboard', __name__)

@bp.route('/negocios/<int:negocio_id>/dashboard/stats', methods=['GET'])
@token_required
def get_dashboard_stats(current_user, negocio_id):
    db = get_db()
    
    # --- CAMBIO AQUÍ: Leemos las fechas de la URL ---
    fecha_desde_str = request.args.get('fecha_desde') # Llega como 'YYYY-MM-DD'
    fecha_hasta_str = request.args.get('fecha_hasta')
    
    # --- CAMBIO AQUÍ: Definimos fecha_hasta_dt para incluir todo el día ---
    fecha_hasta_dt_str = None
    if fecha_hasta_str:
        fecha_hasta_dt_str = fecha_hasta_str + " 23:59:59" # Para incluir todo el día hasta el último segundo
        
    try:
        # --- Consulta para ventas del período ---
        params_ventas = {'negocio_id': negocio_id}
        query_ventas = """
            SELECT COALESCE(SUM(total), 0) AS total_periodo 
            FROM ventas 
            WHERE negocio_id = %(negocio_id)s AND estado = 'finalizada' 
        """
        
        # --- CAMBIO AQUÍ: Añadimos filtro de fecha si aplica ---
        if fecha_desde_str and fecha_hasta_dt_str:
            query_ventas += " AND fecha BETWEEN %(fecha_desde)s AND %(fecha_hasta)s"
            params_ventas['fecha_desde'] = fecha_desde_str
            params_ventas['fecha_hasta'] = fecha_hasta_dt_str # Usamos la fecha con hora
        else:
             # Default: Últimos 30 días para consistencia con los otros endpoints
             query_ventas += " AND fecha >= %(fecha_hace_30_dias)s" 
             params_ventas['fecha_hace_30_dias'] = date.today() - timedelta(days=30)

        db.execute(query_ventas, params_ventas)
        ventas_row = db.fetchone()
        ventas_periodo = ventas_row['total_periodo'] if ventas_row else 0

        # --- Consultas que NO dependen de fecha ---
        db.execute("SELECT COUNT(*) AS count FROM productos WHERE negocio_id = %s AND stock_actual <= stock_minimo", (negocio_id,))
        bajo_stock_count = db.fetchone()['count']

        db.execute("SELECT COUNT(*) AS count FROM clientes WHERE negocio_id = %s", (negocio_id,))
        total_clientes = db.fetchone()['count']

        # --- Consulta para actividad reciente (LIMIT 5, siempre las últimas sin importar fecha) ---
        # (Si quisieras que también filtre por fecha, se haría igual que en ventas_periodo)
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
        
        # --- CAMBIO AQUÍ: Devolvemos 'ventas_periodo' ---
        stats = {
            'ventas_periodo': round(ventas_periodo, 2), # Nombre de clave cambiado
            'productos_bajo_stock': bajo_stock_count,
            'total_clientes': total_clientes,
            'actividad_reciente': [dict(row) for row in ultimas_ventas]
        }
        return jsonify(stats)
        
    except Exception as e:
        print(f"Error en get_dashboard_stats: {e}")
        # Considera loggear el error completo aquí
        return jsonify({'error': 'Ocurrió un error en el servidor al obtener las estadísticas.'}), 500


# --- Ruta para Métodos de Pago (MODIFICADA) ---
@bp.route('/negocios/<int:negocio_id>/dashboard/payment_methods', methods=['GET'])
@token_required
def get_payment_methods_stats(current_user, negocio_id):
    db = get_db()
    
    # --- CAMBIO AQUÍ: Leemos las fechas ---
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')
    fecha_hasta_dt_str = None
    if fecha_hasta_str:
        fecha_hasta_dt_str = fecha_hasta_str + " 23:59:59"

    try:
        params = {'negocio_id': negocio_id}
        query = """
            SELECT metodo_pago, SUM(total) AS total
            FROM ventas           
            WHERE negocio_id = %(negocio_id)s AND estado = 'finalizada'
        """
        
        # --- CAMBIO AQUÍ: Añadimos filtro de fecha si aplica ---
        if fecha_desde_str and fecha_hasta_dt_str:
            query += " AND fecha BETWEEN %(fecha_desde)s AND %(fecha_hasta)s"
            params['fecha_desde'] = fecha_desde_str
            params['fecha_hasta'] = fecha_hasta_dt_str
        else:
            # Default: Últimos 30 días
            query += " AND fecha >= %(fecha_hace_30_dias)s"
            params['fecha_hace_30_dias'] = date.today() - timedelta(days=30)
            
        query += " GROUP BY metodo_pago ORDER BY total DESC"
        
        db.execute(query, params)
        data = db.fetchall()
        return jsonify([dict(row) for row in data])
        
    except Exception as e:
        print(f"Error en get_payment_methods_stats: {e}")
        return jsonify({'error': 'Ocurrió un error al obtener datos de métodos de pago.'}), 500


# --- Ruta para Ranking de Categorías (MODIFICADA) ---
@bp.route('/negocios/<int:negocio_id>/dashboard/category_ranking', methods=['GET'])
@token_required
def get_category_ranking(current_user, negocio_id):
    db = get_db()

    # --- CAMBIO AQUÍ: Leemos las fechas ---
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')
    fecha_hasta_dt_str = None
    if fecha_hasta_str:
        fecha_hasta_dt_str = fecha_hasta_str + " 23:59:59"

    try:
        params = {'negocio_id': negocio_id}
        query = """
            SELECT c.nombre, COALESCE(SUM(vd.subtotal), 0) AS total
            FROM ventas_detalle vd
            JOIN productos p ON vd.producto_id = p.id           
            -- --- CAMBIO AQUÍ: Usamos el nombre correcto de la tabla ---
            JOIN productos_categoria c ON p.categoria_id = c.id 
            JOIN ventas v ON vd.venta_id = v.id
            WHERE v.negocio_id = %(negocio_id)s AND v.estado = 'finalizada'
        """
        
        # --- CAMBIO AQUÍ: Añadimos filtro de fecha si aplica ---
        if fecha_desde_str and fecha_hasta_dt_str:
            query += " AND v.fecha BETWEEN %(fecha_desde)s AND %(fecha_hasta)s"
            params['fecha_desde'] = fecha_desde_str
            params['fecha_hasta'] = fecha_hasta_dt_str
        else:
            # Default: Últimos 30 días
            query += " AND v.fecha >= %(fecha_hace_30_dias)s"
            params['fecha_hace_30_dias'] = date.today() - timedelta(days=30)
            
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
        return jsonify({'error': 'Ocurrió un error al obtener el ranking de categorías.'}), 500

