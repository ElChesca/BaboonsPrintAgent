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
    detalles = data.get('detalles') # [{producto_id, cantidad, precio_costo}]
    proveedor_id = data.get('proveedor_id')
    referencia = data.get('referencia')
    
    # --- CAMBIO AQUÍ: Recibimos los datos de la factura ---
    factura_tipo = data.get('factura_tipo')
    factura_prefijo = data.get('factura_prefijo')
    factura_numero = data.get('factura_numero')
    # estado_pago: por defecto será 'pendiente' gracias al DEFAULT de la DB

    if not detalles:
        return jsonify({'error': 'El ingreso no tiene productos'}), 400
    if not proveedor_id:
        return jsonify({'error': 'Debe seleccionar un proveedor'}), 400
    # Validación básica del número de factura (opcional pero recomendada)
    if not factura_tipo or not factura_prefijo or not factura_numero:
         return jsonify({'error': 'Debe ingresar Tipo, Prefijo y Número de Factura'}), 400


    db = get_db()
    total_factura_calculado = 0
    alertas_precios = []

    try:
        # Iniciamos la transacción explícitamente si tu wrapper get_db no lo hace
        # g.db_conn.begin() # Descomentar si es necesario

        # 1. Crear el registro maestro del ingreso (incluyendo datos de factura)
        #    estado_pago tomará el DEFAULT 'pendiente'
        db.execute(
            """
            INSERT INTO ingresos_mercaderia 
                (negocio_id, proveedor_id, referencia, fecha, usuario_id, 
                 factura_tipo, factura_prefijo, factura_numero, total_factura) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, proveedor_id, referencia, datetime.datetime.now(datetime.timezone.utc), current_user['id'],
             factura_tipo, factura_prefijo, factura_numero, 0) # Total inicial 0, se actualiza después
        )
        ingreso_id = db.fetchone()['id']
        
        # 2. Procesar cada detalle (sin cambios aquí, ya maneja costos y stock)
        for item in detalles:
            producto_id = item['producto_id']
            cantidad = item['cantidad']
            try:
                precio_costo_nuevo = float(item['precio_costo']) if item.get('precio_costo') is not None else None
            except (ValueError, TypeError):
                 precio_costo_nuevo = None 

            if cantidad <= 0:
                 continue 

            db.execute(
                'INSERT INTO ingresos_mercaderia_detalle (ingreso_id, producto_id, cantidad, precio_costo_unitario) VALUES (%s, %s, %s, %s)',
                (ingreso_id, producto_id, cantidad, precio_costo_nuevo)
            )
            
            if precio_costo_nuevo is not None:
                total_factura_calculado += cantidad * precio_costo_nuevo

            # --- Lógica de Actualización de Stock y Costos ---
            db.execute(
                'SELECT nombre, precio_costo FROM productos WHERE id = %s',
                (producto_id,)
            )
            producto_actual = db.fetchone()
            precio_costo_anterior = producto_actual['precio_costo'] if producto_actual else None
            nombre_producto = producto_actual['nombre'] if producto_actual else f"ID:{producto_id}"

            db.execute(
                'UPDATE productos SET stock = stock + %s WHERE id = %s',
                (cantidad, producto_id)
            )

            if precio_costo_nuevo is not None:
                db.execute(
                    'UPDATE productos SET precio_costo_anterior = precio_costo, precio_costo = %s WHERE id = %s',
                    (precio_costo_nuevo, producto_id)
                )
                
                if precio_costo_anterior is not None and precio_costo_anterior != 0:
                    variacion_pct = ((precio_costo_nuevo - precio_costo_anterior) / precio_costo_anterior) * 100
                    UMBRAL_VARIACION = 5.0 
                    if abs(variacion_pct) > UMBRAL_VARIACION:
                        alertas_precios.append({
                            'producto': nombre_producto,
                            'anterior': round(precio_costo_anterior, 2),
                            'nuevo': round(precio_costo_nuevo, 2),
                            'variacion': round(variacion_pct, 2)
                        })

        # 3. Actualizar el total_factura en el ingreso maestro
        db.execute(
            'UPDATE ingresos_mercaderia SET total_factura = %s WHERE id = %s',
            (total_factura_calculado, ingreso_id)
        )

        # 4. Actualizar el saldo del proveedor (¡Importante!)
        #    Sumamos el total de la factura al saldo que ya tenía
        db.execute(
            'UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte + %s WHERE id = %s',
            (total_factura_calculado, proveedor_id)
        )

        g.db_conn.commit()
        return jsonify({
            'message': 'Ingreso registrado, stock actualizado y costos comparados.', 
            'ingreso_id': ingreso_id,
            'alertas_precios': alertas_precios 
        }), 201
        
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_ingreso: {e}")
        traceback.print_exc()
        # Podríamos tener errores de FK si el proveedor_id no existe, etc.
        return jsonify({'error': f'Ocurrió un error al registrar el ingreso: {str(e)}'}), 500


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

