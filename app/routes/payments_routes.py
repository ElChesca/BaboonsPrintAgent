# app/routes/payments_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal
# --- Añadido para logging detallado ---
import traceback

bp = Blueprint('payments', __name__)

# --- RUTA 1: Obtener Facturas Pendientes de un Proveedor ---
@bp.route('/negocios/<int:negocio_id>/proveedores/<int:proveedor_id>/facturas-pendientes', methods=['GET'])
@token_required
def get_facturas_pendientes_proveedor(current_user, negocio_id, proveedor_id):
    """
    Devuelve las facturas de ingreso (ingresos_mercaderia) para un proveedor
    que tengan estado 'pendiente' o 'parcial'.
    """
    db = get_db()
    try:
        query = """
            SELECT
                im.id,
                im.fecha,
                im.referencia,
                im.factura_tipo,
                im.factura_prefijo,
                im.factura_numero,
                im.total_factura,
                im.estado_pago,
                COALESCE(im.total_factura, 0) - COALESCE((
                    SELECT SUM(ppi.monto_aplicado)
                    FROM pagos_proveedores_ingresos ppi
                    WHERE ppi.ingreso_mercaderia_id = im.id
                ), 0) AS saldo_pendiente
            FROM ingresos_mercaderia im
            WHERE im.negocio_id = %s
              AND im.proveedor_id = %s
              AND im.estado_pago IN ('pendiente', 'parcial')
              AND im.total_factura IS NOT NULL
            ORDER BY im.fecha ASC;
        """
        db.execute(query, (negocio_id, proveedor_id))
        facturas = db.fetchall()

        facturas_list = []
        for row in facturas:
            row_dict = dict(row)
            # Asegurar conversión segura a float, tratando None como 0
            row_dict['total_factura'] = float(row_dict.get('total_factura') or 0)
            row_dict['saldo_pendiente'] = float(row_dict.get('saldo_pendiente') or 0)
            if row_dict['saldo_pendiente'] > 0.005:
                 facturas_list.append(row_dict)

        return jsonify(facturas_list)

    except Exception as e:
        print(f"Error en get_facturas_pendientes_proveedor (Proveedor ID: {proveedor_id}):")
        traceback.print_exc() # Imprime el stack trace completo en los logs
        return jsonify({'error': f'Error al obtener facturas pendientes: {str(e)}'}), 500

# --- RUTA 2: Registrar un Nuevo Pago a Proveedor ---
@bp.route('/negocios/<int:negocio_id>/pagos-proveedores', methods=['POST'])
@token_required
def registrar_pago_proveedor(current_user, negocio_id):
    """
    Registra un pago a un proveedor, lo aplica a una o más facturas
    y actualiza saldos y estados.
    """
    data = request.get_json()

    proveedor_id = data.get('proveedor_id')
    monto_total_str = data.get('monto_total')
    metodo_pago = data.get('metodo_pago')
    aplicaciones = data.get('aplicaciones')
    referencia = data.get('referencia')
    fecha_pago_str = data.get('fecha')

    if not proveedor_id or not monto_total_str or not metodo_pago or not aplicaciones:
        return jsonify({'error': 'Faltan datos obligatorios (proveedor, monto, método, aplicaciones)'}), 400

    try:
        monto_total = Decimal(monto_total_str)
        if monto_total <= 0:
             return jsonify({'error': 'El monto total debe ser positivo'}), 400
    except Exception:
         return jsonify({'error': 'Monto total inválido'}), 400

    suma_aplicaciones = sum(Decimal(app.get('monto_aplicado', 0)) for app in aplicaciones if app.get('monto_aplicado'))
    if abs(monto_total - suma_aplicaciones) > Decimal('0.01'):
        return jsonify({'error': f'La suma de los montos aplicados ({suma_aplicaciones:.2f}) no coincide con el monto total del pago ({monto_total:.2f})'}), 400

    metodos_validos = ['Efectivo', 'Transferencia', 'Cheque', 'Nota de Crédito']
    if metodo_pago not in metodos_validos:
         return jsonify({'error': f'Método de pago inválido. Permitidos: {", ".join(metodos_validos)}'}), 400

    fecha_pago = datetime.datetime.now()
    if fecha_pago_str:
        try:
            fecha_pago_dt = datetime.datetime.strptime(fecha_pago_str, '%Y-%m-%d')
            # Combinar fecha con hora actual para tener timestamp completo si es necesario
            fecha_pago = datetime.datetime.combine(fecha_pago_dt.date(), datetime.datetime.now().time())
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido. Usar YYYY-MM-DD'}), 400

    db = get_db()
    try:
        # --- 1. Insertar el Pago Principal ---
        db.execute(
            """
            INSERT INTO pagos_proveedores
                (negocio_id, proveedor_id, fecha, monto_total, metodo_pago, referencia, usuario_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (negocio_id, proveedor_id, fecha_pago, monto_total, metodo_pago, referencia, current_user['id'])
        )
        pago_id = db.fetchone()['id']

        # --- 2. Insertar las Aplicaciones ---
        ids_ingresos_afectados = []
        for app in aplicaciones:
            ingreso_id = app.get('ingreso_id')
            monto_aplicado_str = app.get('monto_aplicado')

            if not ingreso_id or not monto_aplicado_str:
                raise ValueError(f"Aplicación inválida encontrada: {app}")

            try:
                monto_aplicado = Decimal(monto_aplicado_str)
                if monto_aplicado <= 0:
                     raise ValueError(f"Monto aplicado debe ser positivo: {app}")
            except Exception:
                 raise ValueError(f"Monto aplicado inválido: {app}")

            # Insertar el enlace pago-ingreso
            db.execute(
                """
                INSERT INTO pagos_proveedores_ingresos
                    (pago_proveedor_id, ingreso_mercaderia_id, monto_aplicado)
                VALUES (%s, %s, %s)
                """,
                (pago_id, ingreso_id, monto_aplicado)
            )
            ids_ingresos_afectados.append(ingreso_id)

        # --- 3. Actualizar Saldo Cta Cte del Proveedor ---
        db.execute(
            "UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s",
            (monto_total, proveedor_id)
        )

        # --- 4. Recalcular y Actualizar Estado de las Facturas Afectadas ---
        for ingreso_id in set(ids_ingresos_afectados):
             db.execute(
                 """
                 SELECT
                     im.total_factura,
                     COALESCE(SUM(ppi.monto_aplicado), 0) as total_pagado
                 FROM ingresos_mercaderia im
                 LEFT JOIN pagos_proveedores_ingresos ppi ON im.id = ppi.ingreso_mercaderia_id
                 WHERE im.id = %s
                 GROUP BY im.id, im.total_factura
                 """,
                 (ingreso_id,)
             )
             res = db.fetchone()
             if not res or res['total_factura'] is None:
                 print(f"Advertencia: No se pudo obtener total_factura o total_pagado para ingreso ID {ingreso_id}. Estado no actualizado.")
                 continue

             total_factura = Decimal(res['total_factura'])
             total_pagado = Decimal(res['total_pagado'] or 0)
             nuevo_estado = 'pendiente'

             if total_pagado >= total_factura - Decimal('0.01'):
                 nuevo_estado = 'pagada'
             elif total_pagado > Decimal('0.01'):
                  nuevo_estado = 'parcial'

             db.execute(
                 "UPDATE ingresos_mercaderia SET estado_pago = %s WHERE id = %s",
                 (nuevo_estado, ingreso_id)
             )

        # --- 5. Confirmar Transacción ---
        g.db_conn.commit()
        return jsonify({
            'message': 'Pago registrado y aplicado con éxito.',
            'pago_id': pago_id
        }), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_pago_proveedor:")
        traceback.print_exc()
        if isinstance(e, ValueError):
             return jsonify({'error': str(e)}), 400
        else:
             return jsonify({'error': 'Ocurrió un error interno al registrar el pago.'}), 500


# --- ✨ RUTA CUENTA CORRIENTE PROVEEDOR ---
@bp.route('/negocios/<int:negocio_id>/proveedores/<int:proveedor_id>/cuenta-corriente', methods=['GET'])
@token_required
def get_cta_cte_proveedor(current_user, negocio_id, proveedor_id):
    """
    Genera el reporte de cuenta corriente para un proveedor en un rango de fechas.
    Devuelve saldo inicial, movimientos (ingresos y pagos) y saldo final por movimiento.
    """
    db = get_db()

    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')

    try:
        if not fecha_hasta_str:
            fecha_hasta = datetime.date.today()
        else:
            fecha_hasta = datetime.datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date()

        if not fecha_desde_str:
            fecha_hoy = datetime.date.today()
            fecha_desde = fecha_hoy.replace(day=1)
        else:
            fecha_desde = datetime.datetime.strptime(fecha_desde_str, '%Y-%m-%d').date()

        if fecha_desde > fecha_hasta:
             return jsonify({'error': 'La fecha "Desde" no puede ser mayor que la fecha "Hasta"'}), 400

    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Usar YYYY-MM-DD'}), 400

    try:
        # --- Calcular Saldo Inicial ---
        params_saldo_inicial = {
            'negocio_id': negocio_id,
            'proveedor_id': proveedor_id,
            'fecha_desde': fecha_desde
        }
        db.execute(
            """
            SELECT COALESCE(SUM(total_factura), 0) as total_debe
            FROM ingresos_mercaderia
            WHERE negocio_id = %(negocio_id)s
              AND proveedor_id = %(proveedor_id)s
              AND DATE(fecha) < %(fecha_desde)s
              AND total_factura IS NOT NULL
            """, params_saldo_inicial
        )
        total_debe_anterior = db.fetchone()['total_debe'] or Decimal(0)

        db.execute(
            """
            SELECT COALESCE(SUM(monto_total), 0) as total_haber
            FROM pagos_proveedores
            WHERE negocio_id = %(negocio_id)s
              AND proveedor_id = %(proveedor_id)s
              AND DATE(fecha) < %(fecha_desde)s
            """, params_saldo_inicial
        )
        total_haber_anterior = db.fetchone()['total_haber'] or Decimal(0)

        saldo_inicial = total_debe_anterior - total_haber_anterior

        # --- Obtener Movimientos en el Rango ---
        params_movimientos = {
            'negocio_id': negocio_id,
            'proveedor_id': proveedor_id,
            'fecha_desde': fecha_desde,
            'fecha_hasta': fecha_hasta # Usar fecha_hasta directamente
        }
        query_movimientos = """
            SELECT
                fecha, 'Ingreso Factura' as tipo, id, total_factura as debe, 0 as haber,
                factura_tipo, factura_prefijo, factura_numero, referencia
            FROM ingresos_mercaderia
            WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s
              AND DATE(fecha) >= %(fecha_desde)s AND DATE(fecha) <= %(fecha_hasta)s -- Cambiado a <=
              AND total_factura IS NOT NULL
            UNION ALL
            SELECT
                fecha, 'Pago Realizado' as tipo, id, 0 as debe, monto_total as haber,
                NULL, NULL, NULL, referencia
            FROM pagos_proveedores
            WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s
              AND DATE(fecha) >= %(fecha_desde)s AND DATE(fecha) <= %(fecha_hasta)s -- Cambiado a <=
            ORDER BY fecha ASC, tipo DESC;
        """
        db.execute(query_movimientos, params_movimientos)
        movimientos_db = db.fetchall()

        # --- Procesar Movimientos ---
        movimientos_procesados = []
        saldo_actual = saldo_inicial
        movimientos_procesados.append({
            'fecha': fecha_desde.strftime('%Y-%m-%d'),
            'tipo': 'Saldo Anterior',
            'concepto': f"Saldo al {fecha_desde.strftime('%d/%m/%Y')}",
            'debe': None, 'haber': None, 'saldo': float(saldo_inicial)
        })

        for mov in movimientos_db:
            debe = mov['debe'] or Decimal(0)
            haber = mov['haber'] or Decimal(0)
            saldo_actual += debe - haber
            concepto = ""
            if mov['tipo'] == 'Ingreso Factura':
                 nro_factura = f"{mov['factura_tipo'] or 'FC'} {str(mov['factura_prefijo']).padStart(4,'0')}-{str(mov['factura_numero']).padStart(8,'0')}" if mov['factura_prefijo'] and mov['factura_numero'] else f"ID:{mov['id']}"
                 concepto = f"Factura {nro_factura}"
                 if mov['referencia']: concepto += f" ({mov['referencia']})"
            elif mov['tipo'] == 'Pago Realizado':
                 # --- ¡¡¡CORRECCIÓN AQUÍ!!! ---
                 # Usar {mov['id']} en lugar de ['id'] dentro de la f-string
                 concepto = f"Pago ({mov['referencia'] or f'ID:{mov['id']}'})"
                 # --- FIN CORRECCIÓN ---

            movimientos_procesados.append({
                'fecha': mov['fecha'].isoformat(),
                'tipo': mov['tipo'],
                'concepto': concepto,
                'debe': float(debe) if debe > 0 else None,
                'haber': float(haber) if haber > 0 else None,
                'saldo': float(saldo_actual)
            })

        # --- Devolver Resultados ---
        return jsonify({
            'saldo_inicial': float(saldo_inicial),
            'movimientos': movimientos_procesados,
            'fecha_desde': fecha_desde.strftime('%Y-%m-%d'),
            'fecha_hasta': fecha_hasta.strftime('%Y-%m-%d')
        })

    except Exception as e:
        print(f"Error en get_cta_cte_proveedor (Proveedor ID: {proveedor_id}):")
        traceback.print_exc()
        return jsonify({'error': f'Error al generar cuenta corriente: {str(e)}'}), 500
