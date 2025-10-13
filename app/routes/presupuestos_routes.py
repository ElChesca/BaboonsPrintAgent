from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('presupuestos', __name__)

# --- CREAR Y LISTAR PRESUPUESTOS ---
# ✨ LA CORRECCIÓN CLAVE: Unificamos GET y POST en una sola ruta.
@bp.route('/negocios/<int:negocio_id>/presupuestos', methods=['GET', 'POST'])
@token_required
def manejar_presupuestos(current_user, negocio_id):
    if request.method == 'POST':
        return create_presupuesto(current_user, negocio_id)
    else: # GET
        return get_historial_presupuestos(current_user, negocio_id)

def create_presupuesto(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles')
    
    if not data.get('cliente_id') or not detalles:
        return jsonify({'error': 'Faltan datos obligatorios (cliente o productos).'}), 400
    
    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO presupuestos (
                cliente_id, vendedor_id, negocio_id, fecha, tipo_comprobante, 
                forma_pago, plazo_pago, bonificacion, interes, 
                fecha_entrega_estimada, observaciones
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                data['cliente_id'], current_user['id'], negocio_id, datetime.datetime.now(),
                data.get('tipo_comprobante'), data.get('forma_pago'), data.get('plazo_pago'),
                data.get('bonificacion', 0), data.get('interes', 0),
                data.get('fecha_entrega_estimada'), data.get('observaciones')
            )
        )
        presupuesto_id = db.fetchone()['id']
        
        for item in detalles:
            subtotal_item = item['cantidad'] * item['precio_unitario']
            db.execute(
                """
                INSERT INTO presupuestos_detalle (
                    presupuesto_id, producto_id, descripcion_producto, 
                    cantidad, precio_unitario, subtotal
                )
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    presupuesto_id, item['producto_id'], item['descripcion_producto'],
                    item['cantidad'], item['precio_unitario'], subtotal_item
                )
            )
        
        g.db_conn.commit()
        return jsonify({'message': 'Presupuesto creado con éxito', 'id': presupuesto_id}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en crear presupuesto: {e}")
        return jsonify({'error': 'Error interno del servidor al crear el presupuesto.'}), 500

def get_historial_presupuestos(current_user, negocio_id):
    db = get_db()
    db.execute(
        """
        SELECT p.id, p.fecha, p.convertido_a_venta, p.anulado, c.nombre as cliente_nombre, u.nombre as vendedor_nombre
        FROM presupuestos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN usuarios u ON p.vendedor_id = u.id
        WHERE p.negocio_id = %s ORDER BY p.fecha DESC
        """, (negocio_id,)
    )
    presupuestos = db.fetchall()
    return jsonify([dict(p) for p in presupuestos])

# --- ✨ LA RUTA ESTRELLA: CONVERTIR PRESUPUESTO A VENTA ✨ ---
@bp.route('/presupuestos/<int:presupuesto_id>/convertir_a_venta', methods=['POST'])
@token_required
def convertir_a_venta(current_user, presupuesto_id):
    db = get_db()
    try:
        # 1. Obtener el presupuesto y sus detalles
        db.execute("SELECT * FROM presupuestos WHERE id = %s", (presupuesto_id,))
        presupuesto = db.fetchone()
        
        # ... (Validar que el presupuesto no esté ya convertido o anulado) ...

        db.execute("SELECT * FROM presupuestos_detalle WHERE presupuesto_id = %s", (presupuesto_id,))
        detalles = db.fetchall()

        # 2. (OPCIONAL PERO RECOMENDADO) Verificar stock
        for item in detalles:
            db.execute("SELECT stock FROM productos WHERE id = %s", (item['producto_id'],))
            producto = db.fetchone()
            if producto['stock'] < item['cantidad']:
                return jsonify({'error': f"Stock insuficiente para {item['descripcion_producto']}"}), 409
        
        # 3. Crear la Venta
        total_venta = sum(item['subtotal'] for item in detalles) # Simplificado, podrías recalcular
        db.execute(
            """
            INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, ...)
            VALUES (%s, %s, %s, %s, ...) RETURNING id
            """,
            (presupuesto['negocio_id'], presupuesto['cliente_id'], current_user['id'], total_venta, ...)
        )
        venta_id = db.fetchone()['id']

        # 4. Copiar los detalles y actualizar stock
        for item in detalles:
            db.execute(
                """
                INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['subtotal'])
            )
            db.execute(
                "UPDATE productos SET stock = stock - %s WHERE id = %s",
                (item['cantidad'], item['producto_id'])
            )

        # 5. Marcar el presupuesto como convertido
        db.execute(
            "UPDATE presupuestos SET convertido_a_venta = TRUE, venta_id = %s WHERE id = %s",
            (venta_id, presupuesto_id)
        )
        
        g.db_conn.commit()
        return jsonify({'message': 'Presupuesto convertido a venta con éxito', 'venta_id': venta_id}), 200

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500