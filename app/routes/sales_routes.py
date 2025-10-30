# app/routes/sales_routes.py
from flask import Blueprint, request, jsonify
from app.auth_decorator import token_required
from app.db_utils import execute_query

bp = Blueprint('sales', __name__)

@bp.route('/api/negocios/<int:negocio_id>/ventas', methods=['POST'])
@token_required
def registrar_venta(current_user, negocio_id):
    data = request.get_json()

    # Verificar si la caja está abierta
    caja_abierta = execute_query(
        "SELECT id FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL",
        (negocio_id,),
        fetchone=True
    )
    if not caja_abierta:
        return jsonify({'message': 'La caja está cerrada. No se pueden registrar ventas.'}), 403

    # Verificar configuración de stock negativo
    stock_negativo_permiso = execute_query(
        "SELECT valor FROM configuraciones WHERE negocio_id = ? AND clave = 'vender_stock_negativo'",
        (negocio_id,),
        fetchone=True
    )
    permitir_stock_negativo = stock_negativo_permiso and stock_negativo_permiso['valor'] == 'true'

    # Validar stock de productos
    if not permitir_stock_negativo:
        for item in data['items']:
            producto = execute_query('SELECT stock, nombre FROM productos WHERE id = ?', (item['producto_id'],), fetchone=True)
            if producto['stock'] < item['cantidad']:
                return jsonify({'message': f"Stock insuficiente para el producto: {producto['nombre']}"}), 400

    # Insertar la venta
    query_venta = """
        INSERT INTO ventas (negocio_id, fecha, total, cliente_id, metodo_pago, caja_sesion_id)
        VALUES (?, NOW(), ?, ?, ?, ?)
    """
    execute_query(query_venta, (negocio_id, data['total'], data.get('cliente_id'), data['metodo_pago'], caja_abierta['id']), commit=True)
    
    # Necesitamos el ID de la venta recién creada. La forma de obtenerlo varía entre DBs.
    # Por simplicidad, asumimos que la última venta para esta caja es la que acabamos de crear.
    venta = execute_query("SELECT id FROM ventas WHERE caja_sesion_id = ? ORDER BY id DESC LIMIT 1", (caja_abierta['id'],), fetchone=True)
    venta_id = venta['id']

    # Insertar detalles y actualizar stock
    for item in data['items']:
        producto = execute_query('SELECT stock, nombre, stock_minimo FROM productos WHERE id = ?', (item['producto_id'],), fetchone=True)
        
        query_detalle = """
            INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal)
            VALUES (?, ?, ?, ?, ?)
        """
        execute_query(query_detalle, (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['subtotal']), commit=True)

        nuevo_stock = producto['stock'] - item['cantidad']
        execute_query('UPDATE productos SET stock = ? WHERE id = ?', (nuevo_stock, item['producto_id']), commit=True)

    return jsonify({'message': 'Venta registrada con éxito', 'venta_id': venta_id}), 201

# Aquí irían las otras rutas de ventas (get_historial, get_detalles, etc.)
# refactorizadas de la misma manera.
