# app/routes/income_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
import traceback 

bp = Blueprint('income', __name__)

# --- Rutas para Ingresos de Mercadería ---
@bp.route('/negocios/<int:negocio_id>/ingresos', methods=['POST'])
@token_required
def registrar_ingreso(current_user, negocio_id):
    data = request.get_json()
    detalles = data.get('detalles') 
    proveedor_id = data.get('proveedor_id')
    referencia = data.get('referencia')
    orden_compra_id = data.get('orden_compra_id')
    
    factura_tipo = data.get('factura_tipo')
    factura_prefijo = data.get('factura_prefijo')
    factura_numero = data.get('factura_numero')

    db = get_db()
    
    if not detalles:
        return jsonify({'error': 'El ingreso no tiene productos'}), 400
    if not proveedor_id:
        return jsonify({'error': 'Debe seleccionar un proveedor'}), 400
    if not factura_tipo or not factura_numero:
         return jsonify({'error': 'Debe ingresar Tipo y Número de Factura'}), 400

    total_factura_calculado = 0
    alertas_precios = []

    try:
        cae = data.get('cae')
        cae_vencimiento = data.get('cae_vencimiento')
        fecha_emision = data.get('fecha_emision')
        punto_venta = data.get('punto_venta')
        if not punto_venta and factura_prefijo:
            try: punto_venta = int(factura_prefijo)
            except: punto_venta = 0

        iva_27 = float(data.get('iva_27') or 0)
        iva_21 = float(data.get('iva_21') or 0)
        iva_105 = float(data.get('iva_105') or 0)
        iva_25 = float(data.get('iva_25') or 0)
        iva_percepcion = float(data.get('iva_percepcion') or 0)
        iibb_percepcion = float(data.get('iibb_percepcion') or 0)
        neto_gravado = float(data.get('neto_gravado') or 0)
        exento = float(data.get('exento') or 0)
        no_gravado = float(data.get('no_gravado') or 0)
        impuestos_internos = float(data.get('impuestos_internos') or 0)
        total_comprobante = float(data.get('total_factura') or 0)

        db.execute(
            """
            INSERT INTO ingresos_mercaderia 
                (negocio_id, proveedor_id, referencia, fecha, usuario_id, 
                 factura_tipo, factura_prefijo, factura_numero, total_factura, orden_compra_id,
                 punto_venta, cae, cae_vencimiento, fecha_emision,
                 iva_27, iva_21, iva_105, iva_25, iva_percepcion, iibb_percepcion, impuestos_internos, neto_gravado, exento, no_gravado) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, proveedor_id, referencia, datetime.datetime.now(datetime.timezone.utc), current_user['id'],
             factura_tipo, factura_prefijo, factura_numero, total_comprobante, orden_compra_id,
             punto_venta, cae, cae_vencimiento, fecha_emision,
             iva_27, iva_21, iva_105, iva_25, iva_percepcion, iibb_percepcion, impuestos_internos, neto_gravado, exento, no_gravado) 
        )
        ingreso_id = db.fetchone()['id']
        
        for item in detalles:
            producto_id = item.get('producto_id')
            nombre_ia = item.get('nombre') 
            
            if not producto_id:
                db.execute("SELECT id FROM productos_categoria WHERE negocio_id = %s AND nombre = 'IA Scanner' LIMIT 1", (negocio_id,))
                cat_row = db.fetchone()
                if cat_row:
                    categoria_id = cat_row['id']
                else:
                    db.execute("INSERT INTO productos_categoria (negocio_id, nombre) VALUES (%s, 'IA Scanner') RETURNING id", (negocio_id,))
                    categoria_id = db.fetchone()['id']
                
                db.execute(
                    """
                    INSERT INTO productos (negocio_id, categoria_id, nombre, precio_costo, stock, iva_porcentaje)
                    VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
                    """,
                    (negocio_id, categoria_id, nombre_ia or "Producto Nuevo IA", 0, 0, float(item.get('iva_porcentaje') or 21.0))
                )
                producto_id = db.fetchone()['id']

            cantidad = float(item['cantidad'])
            try:
                precio_costo_nuevo = float(item['precio_costo']) if item.get('precio_costo') is not None else None
            except (ValueError, TypeError):
                 precio_costo_nuevo = None 

            if cantidad <= 0:
                 continue 

            precio_costo_unitario = precio_costo_nuevo 
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
            
            costo_neto = precio_costo_unitario * (1 - (dto1/100)) * (1 - (dto2/100)) if precio_costo_unitario else 0
            
            if not total_comprobante: 
                total_factura_calculado += cantidad * (precio_costo_unitario or 0)

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
    data = request.get_json()
    factura_tipo = data.get('factura_tipo')
    factura_prefijo = data.get('factura_prefijo')
    factura_numero = data.get('factura_numero')
    total_factura = data.get('total')
    referencia = data.get('referencia')
    fecha_str = data.get('fecha') 

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
                fecha = datetime.datetime.strptime(fecha_str, '%Y-%m-%d')
            except ValueError:
                fecha = datetime.datetime.now(datetime.timezone.utc)
        else:
            fecha = datetime.datetime.now(datetime.timezone.utc)

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
    db = get_db()
    proveedor_id = request.args.get('proveedor_id')
    limit = request.args.get('limit', default=50, type=int)
    offset = request.args.get('offset', default=0, type=int)
    
    try:
        query = """
            SELECT 
                i.id, i.fecha, i.referencia, i.total_factura, p.nombre as proveedor_nombre,
                i.factura_tipo, i.factura_prefijo, i.factura_numero, i.estado_pago,
                COALESCE((
                    SELECT SUM(monto_aplicado) 
                    FROM pagos_proveedores_ingresos 
                    WHERE ingreso_mercaderia_id = i.id
                ), 0) as monto_pagado,
                (COALESCE(i.total_factura, 0) - COALESCE((
                    SELECT SUM(monto_aplicado) 
                    FROM pagos_proveedores_ingresos 
                    WHERE ingreso_mercaderia_id = i.id
                ), 0)) as saldo_pendiente
            FROM 
                ingresos_mercaderia i
            LEFT JOIN 
                proveedores p ON i.proveedor_id = p.id
            WHERE 
                i.negocio_id = %s 
        """
        params = [negocio_id]
        
        if proveedor_id and proveedor_id != 'null':
            query += " AND i.proveedor_id = %s "
            params.append(int(proveedor_id))
            
        query += " ORDER BY i.fecha DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        db.execute(query, tuple(params))
        ingresos = db.fetchall()
        
        result = []
        for row in ingresos:
            d = dict(row)
            prefijo = str(d.get('factura_prefijo') or 0).zfill(4)
            numero = str(d.get('factura_numero') or 0).zfill(8)
            d['factura_completa'] = f"{d.get('factura_tipo','FC')} {prefijo}-{numero}"
            result.append(d)
        
        return jsonify(result)
    except Exception as e:
        print(f"Error en get_historial_ingresos: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/ingresos/<int:ingreso_id>/detalles', methods=['GET'])
@token_required
def get_detalles_ingreso(current_user, ingreso_id):
    db = get_db()
    try:
        db.execute(
            """
            SELECT i.total_factura, i.iva_21, i.iva_105, i.iva_percepcion, i.iibb_percepcion, 
                   i.impuestos_internos, i.neto_gravado, i.exento, i.no_gravado, i.factura_tipo, i.factura_prefijo, 
                   i.factura_numero, i.cae, i.fecha_emision, p.nombre as proveedor_nombre
            FROM ingresos_mercaderia i
            LEFT JOIN proveedores p ON i.proveedor_id = p.id
            WHERE i.id = %s
            """, (ingreso_id,)
        )
        maestro = db.fetchone()

        db.execute(
            """
            SELECT d.cantidad, d.precio_costo_unitario, d.iva_porcentaje, d.descuento_1, d.descuento_2, p.nombre, p.sku 
            FROM ingresos_mercaderia_detalle d 
            JOIN productos p ON d.producto_id = p.id 
            WHERE d.ingreso_id = %s
            """,
            (ingreso_id,)
        )
        detalles = db.fetchall()
        
        return jsonify({
            'maestro': dict(maestro) if maestro else {},
            'detalles': [dict(row) for row in detalles]
        })
    except Exception as e:
        print(f"Error en get_detalles_ingreso: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Ocurrió un error al obtener los detalles del ingreso.'}), 500


@bp.route('/ingresos/<int:ingreso_id>/marcar_pagada', methods=['PUT'])
@token_required
def marcar_ingreso_pagado(current_user, ingreso_id):
     if current_user['rol'] not in ('admin', 'superadmin'):
         return jsonify({'message': 'Acción no permitida'}), 403

     db = get_db()
     try:
         db.execute("SELECT proveedor_id, total_factura, estado_pago FROM ingresos_mercaderia WHERE id = %s", (ingreso_id,))
         ingreso = db.fetchone()

         if not ingreso:
             return jsonify({'error': 'Ingreso no encontrado'}), 404
         if ingreso['estado_pago'] == 'pagada':
             return jsonify({'message': 'El ingreso ya estaba marcado como pagado.'}), 200

         proveedor_id = ingreso['proveedor_id']
         total_a_pagar = float(ingreso['total_factura'] or 0)

         # 1. Cambiar estado
         db.execute("UPDATE ingresos_mercaderia SET estado_pago = 'pagada' WHERE id = %s", (ingreso_id,))
         
         # 2. Restar del saldo del proveedor
         db.execute("UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s", (total_a_pagar, proveedor_id))

         g.db_conn.commit()
         return jsonify({'message': 'Ingreso marcado como pagado correctamente.'}), 200

     except Exception as e:
         g.db_conn.rollback()
         print(f"Error en marcar_ingreso_pagado: {e}")
         traceback.print_exc()
         return jsonify({'error': 'Ocurrió un error al marcar el ingreso como pagado.'}), 500


@bp.route('/negocios/<int:negocio_id>/ingresos/<int:ingreso_id>', methods=['DELETE'])
@token_required
def eliminar_ingreso(current_user, negocio_id, ingreso_id):
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'error': 'No tiene permisos para realizar esta acción'}), 403

    db = get_db()
    try:
        db.execute("SELECT proveedor_id, total_factura, afecta_stock, estado_pago FROM ingresos_mercaderia WHERE id = %s AND negocio_id = %s", (ingreso_id, negocio_id))
        ingreso = db.fetchone()
        
        if not ingreso:
            return jsonify({'error': 'Ingreso no encontrado'}), 404

        # --- 🛡️ CANDADO DE SEGURIDAD: No borrar si ya tiene pagos ---
        db.execute("SELECT COUNT(*) as pagos_count FROM pagos_proveedores_ingresos WHERE ingreso_mercaderia_id = %s", (ingreso_id,))
        pagos_vinculados = db.fetchone()['pagos_count']
        
        if pagos_vinculados > 0 or ingreso['estado_pago'] == 'pagada':
            return jsonify({'error': 'No se puede eliminar un ingreso que ya tiene pagos registrados (totales o parciales).'}), 400

        if ingreso['afecta_stock']:
            db.execute("SELECT producto_id, cantidad FROM ingresos_mercaderia_detalle WHERE ingreso_id = %s", (ingreso_id,))
            detalles = db.fetchall()
            for d in detalles:
                db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (d['cantidad'], d['producto_id']))

        total_a_revertir = float(ingreso['total_factura'] or 0)
        db.execute("UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s", (total_a_revertir, ingreso['proveedor_id']))

        db.execute("DELETE FROM ingresos_mercaderia_detalle WHERE ingreso_id = %s", (ingreso_id,))
        db.execute("DELETE FROM ingresos_mercaderia WHERE id = %s", (ingreso_id,))

        g.db_conn.commit()
        return jsonify({'message': 'Ingreso eliminado correctamente y saldos revertidos.'})

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en eliminar_ingreso: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Error al eliminar: {str(e)}'}), 500
