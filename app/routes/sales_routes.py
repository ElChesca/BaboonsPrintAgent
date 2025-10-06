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
    
    config_row = db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'vender_stock_negativo'", (negocio_id,)).fetchone()
    permitir_negativo = config_row and config_row['valor'] == 'Si'
    
    if not permitir_negativo:
        for item in detalles:
            db.execute('SELECT stock, nombre FROM productos WHERE id = %s', (item['producto_id'],))
            producto = db.fetchone()
            if not producto or producto['stock'] < item['cantidad']:
                return jsonify({'error': f"Stock insuficiente para '{producto['nombre'] if producto else 'ID desconocido'}'"}), 409
    
    try:
        total_venta = sum(item['cantidad'] * item['precio_unitario'] for item in detalles)
        db.execute('INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id',
                   (negocio_id, data.get('cliente_id'), current_user['id'], total_venta, data.get('metodo_pago'), datetime.datetime.now()))
        venta_id = db.fetchone()['id']

        for item in detalles:
            db.execute('INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (%s, %s, %s, %s, %s)',
                       (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['cantidad'] * item['precio_unitario']))
            db.execute('UPDATE productos SET stock = stock - %s WHERE id = %s', (item['cantidad'], item['producto_id']))
        
        g.db_conn.commit()
        return jsonify({'message': 'Venta registrada con éxito', 'venta_id': venta_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500