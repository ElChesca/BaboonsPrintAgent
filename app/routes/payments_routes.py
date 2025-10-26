# app/routes/payments_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal # Import Decimal for currency calculations

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
        # Añadimos un cálculo de saldo pendiente en la misma consulta   
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
              AND im.total_factura IS NOT NULL -- Solo facturas con total definido
            ORDER BY im.fecha ASC; 
        """
        db.execute(query, (negocio_id, proveedor_id))
        facturas = db.fetchall()
        
        # Convertir Decimal a float para jsonify y calcular saldo pendiente real
        facturas_list = []
        for row in facturas:
            row_dict = dict(row)
            row_dict['total_factura'] = float(row_dict.get('total_factura', 0) or 0)
            # El saldo pendiente ya se calcula en SQL, lo convertimos a float
            row_dict['saldo_pendiente'] = float(row_dict.get('saldo_pendiente', 0) or 0)
            # Solo añadir si el saldo pendiente es > 0 (por si acaso)
            if row_dict['saldo_pendiente'] > 0.005: # Usar una pequeña tolerancia
                 facturas_list.append(row_dict)

        return jsonify(facturas_list)

    except Exception as e:
        print(f"Error en get_facturas_pendientes_proveedor: {e}")
        # Considera usar traceback para más detalle en logs
        # import traceback
        # traceback.print_exc()
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
    
    # --- Validaciones de Entrada ---
    proveedor_id = data.get('proveedor_id')
    monto_total_str = data.get('monto_total')
    metodo_pago = data.get('metodo_pago')
    aplicaciones = data.get('aplicaciones') # Lista de {ingreso_id: x, monto_aplicado: y}
    referencia = data.get('referencia')
    fecha_pago_str = data.get('fecha') # Opcional, si no viene usa CURRENT_TIMESTAMP

    if not proveedor_id or not monto_total_str or not metodo_pago or not aplicaciones:
        return jsonify({'error': 'Faltan datos obligatorios (proveedor, monto, método, aplicaciones)'}), 400
        
    try:
        monto_total = Decimal(monto_total_str)
        if monto_total <= 0:
             return jsonify({'error': 'El monto total debe ser positivo'}), 400
    except Exception:
         return jsonify({'error': 'Monto total inválido'}), 400

    # Validar que la suma de aplicaciones coincida (aproximadamente) con el monto total
    suma_aplicaciones = sum(Decimal(app.get('monto_aplicado', 0)) for app in aplicaciones if app.get('monto_aplicado'))
    if abs(monto_total - suma_aplicaciones) > Decimal('0.01'): # Tolerancia por redondeo
        return jsonify({'error': f'La suma de los montos aplicados ({suma_aplicaciones:.2f}) no coincide con el monto total del pago ({monto_total:.2f})'}), 400

    # Validar métodos de pago permitidos (debe coincidir con el CHECK de la DB)
    metodos_validos = ['Efectivo', 'Transferencia', 'Cheque', 'Nota de Crédito']
    if metodo_pago not in metodos_validos:
         return jsonify({'error': f'Método de pago inválido. Permitidos: {", ".join(metodos_validos)}'}), 400

    # Determinar la fecha del pago
    fecha_pago = datetime.datetime.now() # Default
    if fecha_pago_str:
        try:
            # Asume formato YYYY-MM-DD del input date HTML
            fecha_pago = datetime.datetime.strptime(fecha_pago_str, '%Y-%m-%d')
            # Podrías querer ajustar la hora o zona horaria aquí si es necesario
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

        # --- 2. Insertar las Aplicaciones y Actualizar Estados de Factura ---
        ids_ingresos_afectados = []
        for app in aplicaciones:
            ingreso_id = app.get('ingreso_id')
            monto_aplicado_str = app.get('monto_aplicado')
            
            if not ingreso_id or not monto_aplicado_str:
                raise ValueError(f"Aplicación inválida encontrada: {app}") # Provoca rollback

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
        # Restamos el monto total del pago al saldo actual
        db.execute(
            "UPDATE proveedores SET saldo_cta_cte = saldo_cta_cte - %s WHERE id = %s",
            (monto_total, proveedor_id)
        )

        # --- 4. Recalcular y Actualizar Estado de las Facturas Afectadas ---
        # Usamos un bucle para recalcular el estado de cada factura afectada
        # Esto es más seguro que intentar adivinar el estado directamente
        for ingreso_id in set(ids_ingresos_afectados): # Usar set para evitar duplicados
             # Obtener total de la factura y total pagado hasta ahora
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
             if not res: continue # Factura no encontrada? (raro)

             total_factura = Decimal(res['total_factura'] or 0)
             total_pagado = Decimal(res['total_pagado'] or 0)
             nuevo_estado = 'pendiente' # Default

             if total_pagado >= total_factura - Decimal('0.01'): # Pagada (con tolerancia)
                 nuevo_estado = 'pagada'
             elif total_pagado > Decimal('0.01'): # Pagada parcialmente
                  nuevo_estado = 'parcial'
             
             # Actualizar estado en la DB
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
        print(f"Error en registrar_pago_proveedor: {e}")
        # import traceback
        # traceback.print_exc()
        # Devolver un mensaje de error más específico si es posible
        if isinstance(e, ValueError):
             return jsonify({'error': str(e)}), 400 # Error en los datos de entrada
        else:
             return jsonify({'error': f'Ocurrió un error al registrar el pago: {str(e)}'}), 500
