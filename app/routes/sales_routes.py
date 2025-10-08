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