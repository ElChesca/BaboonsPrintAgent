# app/routes/report_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
from decimal import Decimal
import datetime
import traceback

bp = Blueprint('reports', __name__)

# (Otras rutas de reportes...)

# --- RUTA CUENTA CORRIENTE PROVEEDOR ---
@bp.route('/negocios/<int:negocio_id>/proveedores/<int:proveedor_id>/cuenta-corriente', methods=['GET'])
@token_required
def get_cta_cte_proveedor(current_user, negocio_id, proveedor_id):
    db = get_db()
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')

    try:
        # ... (Validación de fechas sin cambios) ...
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
        # --- Calcular Saldo Inicial (sin cambios) ---
        params_saldo_inicial = { 'negocio_id': negocio_id, 'proveedor_id': proveedor_id, 'fecha_desde': fecha_desde }
        db.execute("SELECT COALESCE(SUM(total_factura), 0) as total_debe FROM ingresos_mercaderia WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s AND DATE(fecha) < %(fecha_desde)s AND total_factura IS NOT NULL", params_saldo_inicial)
        total_debe_anterior = db.fetchone()['total_debe'] or Decimal(0)
        db.execute("SELECT COALESCE(SUM(monto_total), 0) as total_haber FROM pagos_proveedores WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s AND DATE(fecha) < %(fecha_desde)s", params_saldo_inicial)
        total_haber_anterior = db.fetchone()['total_haber'] or Decimal(0)
        saldo_inicial = total_debe_anterior - total_haber_anterior

        # --- Obtener Movimientos (sin cambios) ---
        params_movimientos = { 'negocio_id': negocio_id, 'proveedor_id': proveedor_id, 'fecha_desde': fecha_desde, 'fecha_hasta': fecha_hasta }
        query_movimientos = """
            SELECT fecha, 'Ingreso Factura' as tipo, id, total_factura as debe, 0 as haber, factura_tipo, factura_prefijo, factura_numero, referencia
            FROM ingresos_mercaderia WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s AND DATE(fecha) >= %(fecha_desde)s AND DATE(fecha) <= %(fecha_hasta)s AND total_factura IS NOT NULL
            UNION ALL
            SELECT fecha, 'Pago Realizado' as tipo, id, 0 as debe, monto_total as haber, NULL, NULL, NULL, referencia
            FROM pagos_proveedores WHERE negocio_id = %(negocio_id)s AND proveedor_id = %(proveedor_id)s AND DATE(fecha) >= %(fecha_desde)s AND DATE(fecha) <= %(fecha_hasta)s
            ORDER BY fecha ASC, tipo DESC;
        """
        db.execute(query_movimientos, params_movimientos)
        movimientos_db = db.fetchall()

        # --- Procesar Movimientos (CON LA ALTERNATIVA) ---
        movimientos_procesados = []
        saldo_actual = saldo_inicial
        movimientos_procesados.append({ 'fecha': fecha_desde.strftime('%Y-%m-%d'), 'tipo': 'Saldo Anterior', 'concepto': f"Saldo al {fecha_desde.strftime('%d/%m/%Y')}", 'debe': None, 'haber': None, 'saldo': float(saldo_inicial) })

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
                 # --- ✨ ALTERNATIVA MÁS SIMPLE ✨ ---
                 detalle_pago = mov['referencia']
                 if not detalle_pago:
                     detalle_pago = f"ID:{mov['id']}"
                 concepto = f"Pago ({detalle_pago})"
                 # --- FIN ALTERNATIVA ---

            movimientos_procesados.append({ 'fecha': mov['fecha'].isoformat(), 'tipo': mov['tipo'], 'concepto': concepto, 'debe': float(debe) if debe > 0 else None, 'haber': float(haber) if haber > 0 else None, 'saldo': float(saldo_actual) })

        # --- Devolver Resultados (sin cambios) ---
        return jsonify({ 'saldo_inicial': float(saldo_inicial), 'movimientos': movimientos_procesados, 'fecha_desde': fecha_desde.strftime('%Y-%m-%d'), 'fecha_hasta': fecha_hasta.strftime('%Y-%m-%d') })

    except Exception as e:
        print(f"Error en get_cta_cte_proveedor (Proveedor ID: {proveedor_id}):")
        traceback.print_exc()
        return jsonify({'error': f'Error al generar cuenta corriente: {str(e)}'}), 500

@bp.route('/negocios/<int:negocio_id>/reportes/ganancias', methods=['GET'])
@token_required
def get_reporte_ganancias(current_user, negocio_id):
    db = get_db()
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')

    # Base de la consulta
    query = """
        SELECT
            p.nombre as producto_nombre,
            SUM(vd.cantidad) as cantidad_vendida,
            SUM(vd.subtotal) as total_ventas,
            SUM(p.precio_costo * vd.cantidad) as total_costo,
            SUM(vd.subtotal) - SUM(p.precio_costo * vd.cantidad) as ganancia_neta
        FROM
            ventas v
        JOIN
            ventas_detalle vd ON v.id = vd.venta_id
        JOIN
            productos p ON vd.producto_id = p.id
        WHERE
            v.negocio_id = %s
    """
    params = [negocio_id]

    # Añadir filtros de fecha si se proporcionan
    if fecha_desde_str:
        query += " AND v.fecha >= %s"
        params.append(fecha_desde_str)
    if fecha_hasta_str:
        # Para que la fecha 'hasta' sea inclusiva, añadimos un día y comparamos con '<'
        # o simplemente comparamos la fecha directamente si la columna es de tipo DATE
        fecha_hasta = datetime.datetime.strptime(fecha_hasta_str, '%Y-%m-%d').date() + datetime.timedelta(days=1)
        query += " AND v.fecha < %s"
        params.append(fecha_hasta.strftime('%Y-%m-%d'))

    query += """
        GROUP BY
            p.nombre
        ORDER BY
            ganancia_neta DESC
    """

    try:
        db.execute(query, tuple(params))
        reporte = db.fetchall()
        # Convertir a una lista de diccionarios para la respuesta JSON
        return jsonify([dict(row) for row in reporte])
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/reportes/ventas_diarias', methods=['GET'])
@token_required
def get_reporte_ventas_diarias(current_user, negocio_id):
    db = get_db()
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')

    # Determinar el tipo de base de datos para la función de fecha
    if g.db_type == 'sqlite':
        date_select = "DATE(v.fecha) as dia"
    else: # Asumimos PostgreSQL
        date_select = "CAST(v.fecha AS DATE) as dia"

    query = f"""
        SELECT
            {date_select},
            COUNT(v.id) as cantidad_ventas,
            SUM(v.total) as total_vendido
        FROM
            ventas v
        WHERE
            v.negocio_id = %s
    """
    params = [negocio_id]

    if g.db_type == 'sqlite':
        date_filter_col = "DATE(v.fecha)"
    else: # Asumimos PostgreSQL
        date_filter_col = "CAST(v.fecha AS DATE)"

    if fecha_desde_str:
        query += f" AND {date_filter_col} >= %s"
        params.append(fecha_desde_str)
    if fecha_hasta_str:
        query += f" AND {date_filter_col} <= %s"
        params.append(fecha_hasta_str)

    query += """
        GROUP BY
            dia
        ORDER BY
            dia DESC
    """

    try:
        db.execute(query, tuple(params))
        reporte = db.fetchall()
        # Convertir a una lista de diccionarios para la respuesta JSON
        # Y asegurarse de que 'dia' sea un string en formato ISO
        reporte_list = []
        for row in reporte:
            row_dict = dict(row)
            if isinstance(row_dict['dia'], datetime.date):
                row_dict['dia'] = row_dict['dia'].isoformat()
            reporte_list.append(row_dict)

        return jsonify(reporte_list)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

