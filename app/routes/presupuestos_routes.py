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
        # ✨ NUEVO: Calcular próximo número secuencial para este negocio
        db.execute("SELECT COALESCE(MAX(numero), 0) + 1 as next_nro FROM presupuestos WHERE negocio_id = %s", (negocio_id,))
        next_nro = db.fetchone()['next_nro']

        db.execute(
            """
            INSERT INTO presupuestos (
                cliente_id, vendedor_id, negocio_id, fecha, tipo_comprobante, 
                forma_pago, plazo_pago, bonificacion, interes, descuento_fijo, 
                fecha_entrega_estimada, observaciones, numero
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (
                data['cliente_id'], current_user['id'], negocio_id, datetime.datetime.now(),
                data.get('tipo_comprobante'), data.get('forma_pago'), data.get('plazo_pago'),
                data.get('bonificacion', 0), data.get('interes', 0), data.get('descuento_fijo', 0),
                data.get('fecha_entrega_estimada'), data.get('observaciones'), next_nro
            )
        )
        presupuesto_id = db.fetchone()['id']
        
        # Enviar detalles... (el resto del bucle de items sigue igual)
        
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
        return jsonify({'message': f'Presupuesto #{next_nro} creado con éxito', 'id': presupuesto_id, 'numero': next_nro}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en crear presupuesto: {e}")
        return jsonify({'error': 'Error interno del servidor al crear el presupuesto.'}), 500

def get_historial_presupuestos(current_user, negocio_id):
    db = get_db()
    db.execute(
            """
            SELECT 
                p.id, p.numero, p.fecha, p.convertido_a_venta, p.anulado,
                p.observaciones, p.fecha_entrega_estimada,
                c.nombre as cliente_nombre, 
                u.nombre as vendedor_nombre,
                ((SELECT SUM(pd.subtotal) FROM presupuestos_detalle pd WHERE pd.presupuesto_id = p.id) - COALESCE(p.descuento_fijo, 0)) * (1 - COALESCE(p.bonificacion, 0)/100) * (1 + COALESCE(p.interes, 0)/100) as total_presupuestado
            FROM presupuestos p
            JOIN clientes c ON p.cliente_id = c.id
            JOIN usuarios u ON p.vendedor_id = u.id
            WHERE p.negocio_id = %s 
            ORDER BY p.fecha DESC
            """, (negocio_id,)
        )
    presupuestos = db.fetchall()
    
    resultado = []
    for p in presupuestos:
        p_dict = dict(p)
        if p_dict.get('numero') is None:
            p_dict['numero'] = f"ID:{p_dict['id']}"
        resultado.append(p_dict)
        
    return jsonify(resultado)

# --- ✨ NUEVA RUTA: ANULAR UN PRESUPUESTO ---
@bp.route('/presupuestos/<int:presupuesto_id>/anular', methods=['PUT'])
@token_required
def anular_presupuesto(current_user, presupuesto_id):
    db = get_db()
    try:
        # Primero, verificamos que el presupuesto no esté ya facturado.
        db.execute("SELECT convertido_a_venta FROM presupuestos WHERE id = %s", (presupuesto_id,))
        presupuesto = db.fetchone()
        if presupuesto and presupuesto['convertido_a_venta']:
            return jsonify({'error': 'No se puede anular un presupuesto que ya ha sido facturado.'}), 409

        # Si todo está bien, lo actualizamos.
        db.execute(
            """
            UPDATE presupuestos 
            SET anulado = TRUE, fecha_anulacion = %s, usuario_anulacion_id = %s
            WHERE id = %s
            """,
            (datetime.datetime.now(), current_user['id'], presupuesto_id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Presupuesto anulado con éxito.'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- ✨ RUTA ESTRELLA: CONVERTIR PRESUPUESTO A VENTA ---
# (La habíamos esbozado, ahora está completa y robusta)
@bp.route('/presupuestos/<int:presupuesto_id>/convertir_a_venta', methods=['POST'])
@token_required
def convertir_a_venta(current_user, presupuesto_id):
    db = get_db()
    try:
        # 1. Obtenemos el presupuesto y validamos su estado
        db.execute("SELECT * FROM presupuestos WHERE id = %s", (presupuesto_id,))
        presupuesto = db.fetchone()
        if not presupuesto:
            return jsonify({'error': 'Presupuesto no encontrado.'}), 404
        if presupuesto['anulado'] or presupuesto['convertido_a_venta']:
            return jsonify({'error': 'Este presupuesto ya fue procesado (anulado o facturado).'}), 409

        # 2. Obtenemos la caja activa
        db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (presupuesto['negocio_id'],))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'No hay una caja abierta para registrar la venta.'}), 409
        
        # 3. Obtenemos los detalles y verificamos stock
        db.execute("SELECT * FROM presupuestos_detalle WHERE presupuesto_id = %s", (presupuesto_id,))
        detalles = db.fetchall()
        for item in detalles:
            db.execute("SELECT stock, nombre FROM productos WHERE id = %s", (item['producto_id'],))
            producto = db.fetchone()
            if producto['stock'] < item['cantidad']:
                return jsonify({'error': f"Stock insuficiente para '{producto['nombre']}'"}), 409
        
        # 4. Creamos la VENTA
        subtotal_base = sum(item['subtotal'] for item in detalles)
        descuento_fijo = float(presupuesto['descuento_fijo'] or 0)
        base_imponible = subtotal_base - descuento_fijo
        
        total_venta = (base_imponible * (1 - presupuesto['bonificacion']/100)) * (1 + presupuesto['interes']/100)
        db.execute(
            """
            INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (presupuesto['negocio_id'], presupuesto['cliente_id'], current_user['id'], total_venta, presupuesto['forma_pago'], datetime.datetime.now(), sesion_abierta['id'])
        )
        venta_id = db.fetchone()['id']

        # 5. Copiamos los detalles y actualizamos stock
        for item in detalles:
            # Recuperar nombre para persistencia
            db.execute("SELECT nombre FROM productos WHERE id = %s", (item['producto_id'],))
            p_res = db.fetchone()
            p_nom = p_res['nombre'] if p_res else "Producto"

            db.execute("INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s)",
                       (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], item['subtotal'], p_nom))
            db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (item['cantidad'], item['producto_id']))

        # 6. Marcamos el presupuesto como convertido
        db.execute("UPDATE presupuestos SET convertido_a_venta = TRUE, venta_id = %s WHERE id = %s", (venta_id, presupuesto_id))
        
        g.db_conn.commit()
        return jsonify({'message': f'Presupuesto convertido a Venta Nro. {venta_id} con éxito.', 'venta_id': venta_id}), 200

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- ✨ NUEVA RUTA: OBTENER DETALLES DE UN SOLO PRESUPUESTO ---
@bp.route('/presupuestos/<int:presupuesto_id>', methods=['GET'])
@token_required
def get_presupuesto_detalle(current_user, presupuesto_id):
    db = get_db()
    db.execute("SELECT * FROM presupuestos WHERE id = %s", (presupuesto_id,))
    presupuesto = db.fetchone()
    if not presupuesto:
        return jsonify({'error': 'Presupuesto no encontrado'}), 404
        
    db.execute("SELECT * FROM presupuestos_detalle WHERE presupuesto_id = %s", (presupuesto_id,))
    detalles = db.fetchall()
    
    cabecera = dict(presupuesto)
    if cabecera.get('numero') is None:
        cabecera['numero'] = f"ID:{cabecera['id']}"

    return jsonify({
        'cabecera': cabecera,
        'detalles': [dict(d) for d in detalles]
    })
