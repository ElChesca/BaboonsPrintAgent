# app/routes/income_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
import traceback # Para logs de error más detallados

bp = Blueprint('income', __name__)

# --- Rutas para Ingresos de Mercadería ---
@bp.route('/negocios/<int:negocio_id>/ingresos', methods=['POST'])
@token_required
def registrar_ingreso(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles') # [{producto_id, cantidad, precio_costo, descuento_1, descuento_2, iva_porcentaje}]
    proveedor_id = data.get('proveedor_id')
    referencia = data.get('referencia')
    orden_compra_id = data.get('orden_compra_id')
    
    factura_tipo = data.get('factura_tipo')
    factura_prefijo = data.get('factura_prefijo')
    factura_numero = data.get('factura_numero')

    db = get_db()
    # --- MIGRACIÓN AUTOMÁTICA (ARCA + IMPUESTOS) ---
    try:
        db.execute("ALTER TABLE productos ADD COLUMN IF NOT EXISTS iva_porcentaje DECIMAL DEFAULT 21.0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS punto_venta INTEGER")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS cae VARCHAR(20)")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS cae_vencimiento DATE")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS fecha_emision DATE")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS iva_21 DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS iva_105 DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS iva_percepcion DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS iibb_percepcion DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS neto_gravado DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS exento DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS no_gravado DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia_detalle ADD COLUMN IF NOT EXISTS iva_porcentaje DECIMAL DEFAULT 21.0")
        db.execute("ALTER TABLE ingresos_mercaderia_detalle ADD COLUMN IF NOT EXISTS descuento_1 DECIMAL DEFAULT 0")
        db.execute("ALTER TABLE ingresos_mercaderia_detalle ADD COLUMN IF NOT EXISTS descuento_2 DECIMAL DEFAULT 0")
        g.db_conn.commit()
    except: pass

    if not detalles:
        return jsonify({'error': 'El ingreso no tiene productos'}), 400
    if not proveedor_id:
        return jsonify({'error': 'Debe seleccionar un proveedor'}), 400
    if not factura_tipo or not factura_numero:
         return jsonify({'error': 'Debe ingresar Tipo y Número de Factura'}), 400

    total_factura_calculado = 0
    alertas_precios = []

    try:
        # --- Campos ARCA e Impuestos ---
        cae = data.get('cae')
        cae_vencimiento = data.get('cae_vencimiento')
        fecha_emision = data.get('fecha_emision')
        punto_venta = data.get('punto_venta')
        if not punto_venta and factura_prefijo:
            try: punto_venta = int(factura_prefijo)
            except: punto_venta = 0

        iva_21 = float(data.get('iva_21') or 0)
        iva_105 = float(data.get('iva_105') or 0)
        iva_percepcion = float(data.get('iva_percepcion') or 0)
        iibb_percepcion = float(data.get('iibb_percepcion') or 0)
        neto_gravado = float(data.get('neto_gravado') or 0)
        exento = float(data.get('exento') or 0)
        no_gravado = float(data.get('no_gravado') or 0)
        total_comprobante = float(data.get('total_factura') or 0)

        # 1. Crear el registro maestro del ingreso
        db.execute(
            """
            INSERT INTO ingresos_mercaderia 
                (negocio_id, proveedor_id, referencia, fecha, usuario_id, 
                 factura_tipo, factura_prefijo, factura_numero, total_factura, orden_compra_id,
                 punto_venta, cae, cae_vencimiento, fecha_emision,
                 iva_21, iva_105, iva_percepcion, iibb_percepcion, neto_gravado, exento, no_gravado) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, proveedor_id, referencia, datetime.datetime.now(datetime.timezone.utc), current_user['id'],
             factura_tipo, factura_prefijo, factura_numero, total_comprobante, orden_compra_id,
             punto_venta, cae, cae_vencimiento, fecha_emision,
             iva_21, iva_105, iva_percepcion, iibb_percepcion, neto_gravado, exento, no_gravado) 
        )
        ingreso_id = db.fetchone()['id']
        
        # 2. Procesar cada detalle
        for item in detalles:
            producto_id = item['producto_id']
            cantidad = float(item['cantidad'])
            try:
                precio_costo_nuevo = float(item['precio_costo']) if item.get('precio_costo') is not None else None
            except (ValueError, TypeError):
                 precio_costo_nuevo = None 

            if cantidad <= 0:
                 continue 

            precio_costo_unitario = precio_costo_nuevo # Bruto
            dto1 = float(item.get('descuento_1') or 0)
            dto2 = float(item.get('descuento_2') or 0)
            iva_p = float(item.get('iva_porcentaje') or 21.0)

            db.execute(
                """
                INSERT INTO ingresos_mercaderia_detalle 
                (ingreso_id, producto_id, cantidad, precio_costo_unitario, descuento_1, descuento_2, iva_porcentaje) 
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (ingreso_id, producto_id, cantidad, precio_costo_unitario, dto1, dto2, iva_p)
            )
            
            # Cálculo para stock (actualizamos precio_costo neto sin IVA)
            # Neto = Bruto * (1 - dto1/100) * (1 - dto2/100)
            costo_neto = precio_costo_unitario * (1 - (dto1/100)) * (1 - (dto2/100)) if precio_costo_unitario else 0
            
            if not total_comprobante: 
                total_factura_calculado += cantidad * (precio_costo_unitario or 0)

            # --- Lógica de Actualización de Stock y Costos ---
            db.execute('SELECT nombre, precio_costo FROM productos WHERE id = %s', (producto_id,))
            producto_actual = db.fetchone()
            precio_costo_anterior = producto_actual['precio_costo'] if producto_actual else None
            nombre_producto = producto_actual['nombre'] if producto_actual else f"ID:{producto_id}"

            db.execute('UPDATE productos SET stock = stock + %s WHERE id = %s', (cantidad, producto_id))

            if costo_neto > 0:
                db.execute(
                    'UPDATE productos SET precio_costo_anterior = precio_costo, precio_costo = %s WHERE id = %s',
                    (costo_neto, producto_id)
                )
                
                if precio_costo_anterior is not None and precio_costo_anterior != 0:
                    variacion_pct = ((costo_neto - precio_costo_anterior) / precio_costo_anterior) * 100
                    UMBRAL_VARIACION = 5.0 
                    if abs(variacion_pct) > UMBRAL_VARIACION:
                        alertas_precios.append({
                            'producto': nombre_producto,
                            'anterior': round(precio_costo_anterior, 2),
                            'nuevo': round(costo_neto, 2),
                            'variacion': round(variacion_pct, 2)
                        })

        # 3. Finalizar
        total_final = total_comprobante if total_comprobante > 0 else total_factura_calculado
        db.execute('UPDATE ingresos_mercaderia SET total_factura = %s WHERE id = %s', (total_final, ingreso_id))

        if orden_compra_id:
            db.execute("UPDATE ordenes_compra SET estado = 'completada' WHERE id = %s AND negocio_id = %s", (orden_compra_id, negocio_id))

        db.execute('UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte + %s WHERE id = %s', (total_final, proveedor_id))

        g.db_conn.commit()
        return jsonify({
            'message': 'Ingreso registrado correctamente.', 
            'ingreso_id': ingreso_id,
            'alertas_precios': alertas_precios 
        }), 201
        
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_ingreso: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500



@bp.route('/negocios/<int:negocio_id>/proveedores/<int:proveedor_id>/comprobante', methods=['POST'])
@token_required
def registrar_comprobante(current_user, negocio_id, proveedor_id):
    """
    Registra un comprobante (factura, remito, etc.) que NO modifica stock.
    Solo afecta la cuenta corriente del proveedor.
    """
    data = request.get_json()
    
    factura_tipo = data.get('factura_tipo')
    factura_prefijo = data.get('factura_prefijo')
    factura_numero = data.get('factura_numero')
    total_factura = data.get('total')
    referencia = data.get('referencia')
    fecha_str = data.get('fecha') # Opcional, si no viene usamos ahora

    if not all([factura_tipo, factura_prefijo, factura_numero, total_factura]):
        return jsonify({'error': 'Faltan datos obligatorios (tipo, prefijo, número, total)'}), 400
    
    try:
        total_factura = float(total_factura)
    except (ValueError, TypeError):
        return jsonify({'error': 'El total debe ser un número válido'}), 400

    db = get_db()
    try:
        if fecha_str:
            try:
                # Intentamos parsear la fecha si viene del frontend (YYYY-MM-DD)
                fecha = datetime.datetime.strptime(fecha_str, '%Y-%m-%d')
            except ValueError:
                fecha = datetime.datetime.now(datetime.timezone.utc)
        else:
            fecha = datetime.datetime.now(datetime.timezone.utc)

        # 1. Crear el registro en ingresos_mercaderia con afecta_stock = False
        db.execute(
            """
            INSERT INTO ingresos_mercaderia 
                (negocio_id, proveedor_id, referencia, fecha, usuario_id, 
                 factura_tipo, factura_prefijo, factura_numero, total_factura, afecta_stock, estado_pago) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, proveedor_id, referencia, fecha, current_user['id'],
             factura_tipo, factura_prefijo, factura_numero, total_factura, False, 'pendiente')
        )
        ingreso_id = db.fetchone()['id']

        # 2. Actualizar el saldo del proveedor
        db.execute(
            'UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte + %s WHERE id = %s',
            (total_factura, proveedor_id)
        )

        g.db_conn.commit()
        return jsonify({
            'message': 'Comprobante registrado correctamente en la cuenta corriente.', 
            'id': ingreso_id
        }), 201
        
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_comprobante: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Ocurrió un error al registrar el comprobante: {str(e)}'}), 500


@bp.route('/negocios/<int:negocio_id>/ingresos', methods=['GET'])
@token_required
def get_historial_ingresos(current_user, negocio_id):
    """Devuelve la lista maestra de ingresos, ahora con proveedor, factura y estado."""
    db = get_db()
    try:
        # --- CAMBIO AQUÍ: Traemos los nuevos campos ---
        db.execute(
            """
            SELECT 
                i.id, i.fecha, i.referencia, i.total_factura, p.nombre as proveedor_nombre,
                i.factura_tipo, i.factura_prefijo, i.factura_numero, i.estado_pago 
            FROM 
                ingresos_mercaderia i
            LEFT JOIN 
                proveedores p ON i.proveedor_id = p.id
            WHERE 
                i.negocio_id = %s 
            ORDER BY 
                i.fecha DESC
            """,
            (negocio_id,)
        )
        ingresos = db.fetchall()
        # Formatear el número de factura para la respuesta (opcional)
        for ingreso in ingresos:
             ingreso['factura_completa'] = f"{ingreso.get('factura_tipo','')} {ingreso.get('factura_prefijo','')}-{ingreso.get('factura_numero','')}"
        
        return jsonify([dict(row) for row in ingresos])
    except Exception as e:
        print(f"Error en get_historial_ingresos: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al obtener el historial de ingresos.'}), 500


@bp.route('/ingresos/<int:ingreso_id>/detalles', methods=['GET'])
@token_required
def get_detalles_ingreso(current_user, ingreso_id):
    """Devuelve los productos de un ingreso específico."""
    db = get_db()
    try:
        db.execute(
            """
            SELECT d.cantidad, d.precio_costo_unitario, p.nombre, p.sku 
            FROM ingresos_mercaderia_detalle d 
            JOIN productos p ON d.producto_id = p.id 
            WHERE d.ingreso_id = %s
            """,
            (ingreso_id,)
        )
        detalles = db.fetchall()
        return jsonify([dict(row) for row in detalles])
    except Exception as e:
        print(f"Error en get_detalles_ingreso: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al obtener los detalles del ingreso.'}), 500

# --- ✨ NUEVA RUTA (Ejemplo): Marcar una factura como pagada ---
# Esto pertenecería al futuro módulo de Pagos, pero lo pongo acá como idea
@bp.route('/ingresos/<int:ingreso_id>/marcar_pagada', methods=['PUT'])
@token_required
def marcar_ingreso_pagado(current_user, ingreso_id):
     # Validar permisos (admin/superadmin)
     if current_user['rol'] not in ('admin', 'superadmin'):
         return jsonify({'message': 'Acción no permitida'}), 403

     db = get_db()
     try:
         # Obtenemos el total y proveedor para ajustar saldo
         db.execute("SELECT proveedor_id, total_factura, estado_pago FROM ingresos_mercaderia WHERE id = %s", (ingreso_id,))
         ingreso = db.fetchone()

         if not ingreso:
             return jsonify({'error': 'Ingreso no encontrado'}), 404
         if ingreso['estado_pago'] == 'pagada':
             return jsonify({'message': 'El ingreso ya estaba marcado como pagado.'}), 200 # O 409 si preferís error

         proveedor_id = ingreso['proveedor_id']
         total_a_restar = ingreso['total_factura'] or 0 # Si es null, asumimos 0

         # Iniciamos transacción
         # g.db_conn.begin() # Si es necesario

         # 1. Cambiar estado
         db.execute("UPDATE ingresos_mercaderia SET estado_pago = 'pagada' WHERE id = %s", (ingreso_id,))
         
         # 2. Restar del saldo del proveedor
         db.execute("UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s", (total_a_restar, proveedor_id))

         g.db_conn.commit()
         return jsonify({'message': 'Ingreso marcado como pagado y saldo de proveedor actualizado.'}), 200

     except Exception as e:
         g.db_conn.rollback()
         print(f"Error en marcar_ingreso_pagado: {e}")
         traceback.print_exc()
         return jsonify({'error': 'Ocurrió un error al marcar el ingreso como pagado.'}), 500

