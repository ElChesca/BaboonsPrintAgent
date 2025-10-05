# app/routes/sales_routes.py
from flask import Blueprint, request, jsonify
from app.database import get_db
from .auth_routes import token_required
import datetime

bp = Blueprint('sales', __name__)

# --- Rutas para Ventas ---

@bp.route('/negocios/<int:negocio_id>/ventas', methods=['POST'])
@token_required
def registrar_venta(current_user, negocio_id):
    """ 
    Registra una nueva venta y descuenta el stock. 
    Es una operación transaccional.
    Ahora respeta la configuración de stock negativo y envía notificaciones de bajo stock.
    """
    data = request.get_json()
    cliente_id = data.get('cliente_id')
    detalles = data.get('detalles')
    total_venta = 0

    if not detalles:
        return jsonify({'message': 'La venta no tiene productos'}), 400

    db = get_db()
    cursor = db.cursor()
     # ✨ 1. VERIFICAR QUE LA CAJA ESTÉ ABIERTA
    sesion_abierta = cursor.execute(
        'SELECT id FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL', (negocio_id,)
    ).fetchone()
    if not sesion_abierta:
        return jsonify({'error': 'La caja está cerrada. No se pueden registrar ventas.'}), 409
    
    # ✨ 2. Leemos la configuración del negocio sobre el stock negativo
    config_stock_negativo = cursor.execute(
        "SELECT valor FROM configuraciones WHERE negocio_id = ? AND clave = 'vender_stock_negativo'",
        (negocio_id,)
    ).fetchone()
    
    permitir_negativo = config_stock_negativo and config_stock_negativo['valor'] == 'Si'
    
    # ✨ 3. Lista para guardar nuestras notificaciones
    notificaciones = []
    
    try:
        # --- INICIO DE LA TRANSACCIÓN ---
        
        # 1. Chequeo de Stock (Ahora respeta la configuración)
        if not permitir_negativo:
            for item in detalles:
                producto = cursor.execute('SELECT stock, nombre FROM productos WHERE id = ?', (item['producto_id'],)).fetchone()
                if producto is None or producto['stock'] < item['cantidad']:
                    db.rollback()
                    return jsonify({'error': f"Stock insuficiente para '{producto['nombre'] if producto else 'producto desconocido'}'"}), 409

        # 2. Calcular el total en el backend por seguridad
        for item in detalles:
            total_venta += item['cantidad'] * item['precio_unitario']

        # 3. Insertar la cabecera de la venta
          # 3. Insertar la cabecera de la venta
        cursor.execute(
            # ✨ AÑADIR el ID de la sesión a la venta
            'INSERT INTO ventas (negocio_id, cliente_id, total, metodo_pago, fecha, caja_sesion_id) VALUES (?, ?, ?, ?, ?, ?)',
            (negocio_id, cliente_id, total_venta, data.get('metodo_pago'), datetime.datetime.now(), sesion_abierta['id'])
        )        
        venta_id = cursor.lastrowid
        # ✨ Guardamos los detalles de pago si existen
        pago_detalle = data.get('pago_detalle')
        if pago_detalle:
                cursor.execute(
                    """
                    INSERT INTO ventas_pago_detalle (venta_id, nro_cupon, cliente_dni, tarjeta_numero, banco)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        venta_id, pago_detalle.get('nro_cupon'), pago_detalle.get('cliente_dni'),
                        pago_detalle.get('tarjeta_numero'), pago_detalle.get('banco')
                    )
                )
        # 4. Insertar los detalles, descontar stock y revisar notificaciones
        for item in detalles:
            # Obtenemos los datos del producto ANTES de la venta para la lógica de notificación
            producto_antes = cursor.execute('SELECT nombre, stock, stock_minimo FROM productos WHERE id = ?', (item['producto_id'],)).fetchone()
            stock_anterior = producto_antes['stock']

            subtotal = item['cantidad'] * item['precio_unitario']
            cursor.execute(
                'INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], subtotal)
            )
            
            nuevo_stock = stock_anterior - item['cantidad']
            cursor.execute(
                'UPDATE productos SET stock = ? WHERE id = ?',
                (nuevo_stock, item['producto_id'])
            )

            # ✨ 3. Lógica de Notificación CORREGIDA
            stock_minimo = producto_antes['stock_minimo']
            # La notificación se dispara si ANTES había suficiente stock y AHORA ya no.
            if stock_anterior > stock_minimo and nuevo_stock <= stock_minimo:
                mensaje = f"¡Bajo stock! A '{producto_antes['nombre']}' solo le quedan {nuevo_stock} unidades."
                notificaciones.append({'tipo': 'warning', 'mensaje': mensaje})
        
        db.commit()
        # --- FIN DE LA TRANSACCIÓN ---
        
        venta_creada = {'id': venta_id, 'total': total_venta} # Creamos un objeto simple de la venta

        return jsonify({
            'message': 'Venta registrada con éxito', 
            'venta': venta_creada,
            'notificaciones': notificaciones
        }), 201

    except Exception as e:
        db.rollback()
        return jsonify({'error': f'Ocurrió un error: {str(e)}'}), 500

@bp.route('/negocios/<int:negocio_id>/ventas', methods=['GET'])
@token_required
def get_historial_ventas(current_user, negocio_id):
    """ Devuelve la lista maestra de ventas para un negocio, con filtro de fecha. """
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    db = get_db()
    query = '''
        SELECT v.id, v.fecha, v.total, c.nombre as cliente_nombre
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = ?
    '''
    params = [negocio_id]

    if fecha_desde:
        query += ' AND date(v.fecha) >= ?'
        params.append(fecha_desde)
    if fecha_hasta:
        query += ' AND date(v.fecha) <= ?'
        params.append(fecha_hasta)
    
    query += ' ORDER BY v.fecha DESC'
    
    ventas = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in ventas])

@bp.route('/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_detalles_venta(current_user, venta_id):
    """ Devuelve los productos de una venta específica. """
    db = get_db()
    detalles = db.execute(
        'SELECT d.cantidad, d.precio_unitario, p.nombre FROM ventas_detalle d JOIN productos p ON d.producto_id = p.id WHERE d.venta_id = ?',
        (venta_id,)
    ).fetchall()
    return jsonify([dict(row) for row in detalles])
