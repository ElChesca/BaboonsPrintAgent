# app/routes/sales_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('sales', __name__)

@bp.route('/negocios/<int:negocio_id>/ventas', methods=['POST'])
@token_required
def registrar_venta(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles')
    db = get_db()
    
    # Valida que la caja esté abierta
    db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
    sesion_abierta = db.fetchone()
    if not sesion_abierta:
        return jsonify({'error': 'La caja está cerrada. No se pueden registrar ventas.'}), 409

    # Valida stock si es necesario
    db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'vender_stock_negativo'", (negocio_id,))
    config_row = db.fetchone()
    permitir_negativo = config_row and config_row['valor'] == 'Si'
    
    if not permitir_negativo:
        for item in detalles:
            db.execute('SELECT stock, nombre FROM productos WHERE id = %s', (item['producto_id'],))
            producto = db.fetchone()
            if not producto or producto['stock'] < item['cantidad']:
                return jsonify({'error': f"Stock insuficiente para '{producto['nombre'] if producto else 'ID desconocido'}'"}), 409
    
    try:
        total_venta = sum(item['cantidad'] * item['precio_unitario'] for item in detalles)
        
        db.execute(
            'INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id',
            (negocio_id, data.get('cliente_id'), current_user['id'], total_venta, data.get('metodo_pago'), datetime.datetime.now(), sesion_abierta['id'])
        )
        venta_id = db.fetchone()['id']

        pago_detalle = data.get('pago_detalle')
        if pago_detalle:
            db.execute(
                'INSERT INTO ventas_pago_detalle (venta_id, nro_cupon, cliente_dni, tarjeta_numero, banco) VALUES (%s, %s, %s, %s, %s)',
                (venta_id, pago_detalle.get('nro_cupon'), pago_detalle.get('cliente_dni'), pago_detalle.get('tarjeta_numero'), pago_detalle.get('banco'))
            )
        
        notificaciones = []
        for item in detalles:
            db.execute('SELECT nombre, stock, stock_minimo FROM productos WHERE id = %s', (item['producto_id'],))
            producto_antes = db.fetchone()
            stock_anterior = producto_antes['stock']
            
            db.execute('INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (%s, %s, %s, %s, %s)',
                       (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['cantidad'] * item['precio_unitario']))
            
            nuevo_stock = stock_anterior - item['cantidad']
            db.execute('UPDATE productos SET stock = %s WHERE id = %s', (nuevo_stock, item['producto_id']))

            stock_minimo = producto_antes['stock_minimo']
            if stock_anterior > stock_minimo and nuevo_stock <= stock_minimo:
                notificaciones.append({
                    'tipo': 'warning', 
                    'mensaje': f"¡Bajo stock! A '{producto_antes['nombre']}' solo le quedan {nuevo_stock} unidades."
                })
        
        g.db_conn.commit()
        return jsonify({
            'message': 'Venta registrada con éxito', 
            'venta_id': venta_id,
            'notificaciones': notificaciones
        }), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
    
    # --- ✨ NUEVA RUTA MEJORADA PARA OBTENER EL HISTORIAL ---
@bp.route('/negocios/<int:negocio_id>/ventas', methods=['GET'])
@token_required

@bp.route('/negocios/<int:negocio_id>/historial_ventas', methods=['GET'],endpoint='get_historial_por_negocio') # Asegúrate que la ruta coincida con tu API
@token_required
def get_historial_ventas(current_user, negocio_id):
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')

    # --- ✨ INICIO DE LA CORRECCIÓN ✨ ---
    # La consulta ahora pide TODAS las columnas que el frontend necesita para
    # mostrar correctamente el estado de la factura.
    query = """
        SELECT 
            v.id, 
            v.fecha, 
            v.total, 
            v.metodo_pago, 
            c.nombre AS cliente_nombre,
            v.estado,
            v.tipo_factura,
            v.numero_factura
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = %s
    """
    # --- FIN DE LA CORRECCIÓN ---
    
    params = [negocio_id]

    # Añadir filtros de fecha si se proporcionan
    if fecha_desde:
        query += " AND v.fecha >= %s"
        params.append(fecha_desde)
    if fecha_hasta:
        # Añadimos un día para incluir todo el día de la fecha 'hasta'
        fecha_hasta_dt = datetime.datetime.strptime(fecha_hasta, '%Y-%m-%d') + datetime.timedelta(days=1)
        query += " AND v.fecha < %s"
        params.append(fecha_hasta_dt.strftime('%Y-%m-%d'))
        
    query += " ORDER BY v.id DESC" # Ordenar por ID descendente es más común para historiales
    
    db.execute(query, tuple(params))
    ventas = db.fetchall()
    
    # Convertimos los resultados a un formato JSON friendly
    # Esto ya lo hacías bien, no necesita cambios.
    resultado_json = [dict(venta) for venta in ventas]
    return jsonify(resultado_json)

# --- RUTA PARA OBTENER DETALLES (Ya la tenías) ---
@bp.route('/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_venta_detalles(current_user, venta_id):
    db = get_db()
    db.execute("""
        SELECT vd.*, p.nombre
        FROM ventas_detalle vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = %s
    """, (venta_id,))
    detalles = db.fetchall()
    return jsonify([dict(d) for d in detalles])


# --- ✨ NUEVA RUTA: OBTENER TODOS LOS DETALLES DE UNA VENTA ESPECÍFICA ---
@bp.route('/ventas/<int:venta_id>', methods=['GET'])
@token_required
def get_venta_completa(current_user, venta_id):
    db = get_db()
    try:
        # 1. Obtenemos la cabecera de la venta
        db.execute("SELECT * FROM ventas WHERE id = %s", (venta_id,))
        venta = db.fetchone()
        if not venta:
            return jsonify({'error': 'Venta no encontrada'}), 404

        # 2. Obtenemos los detalles (productos) de la venta
        db.execute(
            """
            SELECT vd.*, p.nombre as producto_nombre 
            FROM ventas_detalle vd 
            JOIN productos p ON vd.producto_id = p.id 
            WHERE vd.venta_id = %s
            """,
            (venta_id,)
        )
        detalles = db.fetchall()

        # 3. Obtenemos los datos del cliente (si existe)
        cliente = None
        if venta['cliente_id']:
            db.execute("SELECT * FROM clientes WHERE id = %s", (venta['cliente_id'],))
            cliente = db.fetchone()

        # 4. Devolvemos todo en un solo paquete JSON
        return jsonify({
            'cabecera': dict(venta),
            'detalles': [dict(d) for d in detalles],
            'cliente': dict(cliente) if cliente else None
        })

    except Exception as e:
        print(f"Error en get_venta_completa: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500
