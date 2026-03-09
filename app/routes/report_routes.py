# app/routes/report_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required
from decimal import Decimal
import datetime
import traceback
import math

bp = Blueprint('reports', __name__)

# ===============================================
# ✨ FUNCIÓN HELPER DE SEGURIDAD 
# ===============================================
def check_user_negocio_permission(current_user, negocio_id):
    """
    Verifica si el usuario actual tiene permisos sobre el negocio_id.
    """
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return False
    if current_user['rol'] == 'superadmin':
        return True
    db = get_db()
    db.execute(
        "SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
        (current_user['id'], negocio_id)
    )
    return db.fetchone() is not None

# --- RUTA REPORTE DE CAJA ---
@bp.route('/negocios/<int:negocio_id>/reportes/caja', methods=['GET'])
@token_required
def get_reporte_caja(current_user, negocio_id):
    db = get_db()
    
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403

    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    # ✨ (NUEVO) Filtro de Usuario
    usuario_id = request.args.get('usuario_id')

    params = [negocio_id]    
    query = """
        SELECT 
            cs.id, 
            cs.fecha_apertura, 
            cs.fecha_cierre, 
            cs.monto_inicial, 
            cs.monto_final_esperado, 
            cs.monto_final_contado, 
            cs.diferencia,
            u.nombre as usuario_nombre 
        FROM caja_sesiones cs 
        JOIN usuarios u ON cs.usuario_id = u.id 
        WHERE cs.negocio_id = %s AND cs.fecha_cierre IS NOT NULL
    """

    # (Lógica de filtros de fecha...)
    try:
        db_type = g.db_type
    except AttributeError:
        db_type = 'postgres'
        
    if db_type == 'sqlite':
        date_filter_desde = " AND DATE(cs.fecha_apertura) >= %s"
        date_filter_hasta = " AND DATE(cs.fecha_apertura) <= %s"
    else: # PostgreSQL
        date_filter_desde = " AND CAST(cs.fecha_apertura AS DATE) >= %s"
        date_filter_hasta = " AND CAST(cs.fecha_apertura AS DATE) <= %s"

    if fecha_desde:
        query += date_filter_desde
        params.append(fecha_desde)
    if fecha_hasta:
        query += date_filter_hasta
        params.append(fecha_hasta)
        
    # ✨ (NUEVO) Aplicar filtro de usuario
    if usuario_id:
        query += " AND cs.usuario_id = %s"
        params.append(usuario_id)

    query += " ORDER BY cs.fecha_apertura DESC"

    db.execute(query, tuple(params))
    sesiones_rows = db.fetchall()
    
    # ✨ --- CORRECCIÓN DE ERROR 500 (VERSIÓN ROBUSTA) --- ✨
    sesiones_list = []
    for row in sesiones_rows:
        row_dict = dict(row)
        
        # 1. Convertir Decimales (AHORA CON CONTROL DE NaN/Inf)
        for key in ['monto_inicial', 'monto_final_contado', 'monto_final_esperado', 'diferencia']:
            if key in row_dict and isinstance(row_dict[key], Decimal):
                
                # --- ESTA ES LA CORRECCIÓN ---
                if row_dict[key].is_nan() or row_dict[key].is_infinite():
                    row_dict[key] = None # Convertir a 'null' en JSON
                else:
                    row_dict[key] = float(row_dict[key])
                # --- FIN DE LA CORRECCIÓN ---

            # Bonus: Controlar floats que ya sean NaN/Inf (si g.db_type es sqlite, por ej.)
            elif key in row_dict and isinstance(row_dict[key], float):
                if math.isnan(row_dict[key]) or math.isinf(row_dict[key]):
                    row_dict[key] = None # Convertir a 'null' en JSON

        # 2. Convertir Datetimes (sin cambios, esto estaba bien)
        for key in ['fecha_apertura', 'fecha_cierre']:
            if key in row_dict and isinstance(row_dict[key], (datetime.datetime, datetime.date)):
                row_dict[key] = row_dict[key].isoformat()
        
        sesiones_list.append(row_dict)
    
    return jsonify(sesiones_list)

# --- RUTA DETALLES CIERRE DE CAJA ---

@bp.route('/reportes/caja/<int:sesion_id>/detalles', methods=['GET'])
@token_required
def get_detalles_cierre_caja(current_user, sesion_id):
    db = get_db()
    db.execute('SELECT negocio_id FROM caja_sesiones WHERE id = %s', (sesion_id,))
    sesion = db.fetchone()
    if not sesion:
        return jsonify({'error': 'Sesión no encontrada'}), 404
    
    if not check_user_negocio_permission(current_user, sesion['negocio_id']):
        return jsonify({'error': 'No tiene permisos sobre esta sesión'}), 403

    db.execute('SELECT metodo_pago, SUM(total) as total_por_metodo FROM ventas WHERE caja_sesion_id = %s GROUP BY metodo_pago', (sesion_id,))
    desglose_pagos_rows = db.fetchall()
    
    # ✨ Corrección Decimal/float
    desglose_pagos = {}
    for row in desglose_pagos_rows:
        total = row['total_por_metodo']
        if isinstance(total, Decimal):
            total = float(total)
        desglose_pagos[row['metodo_pago']] = total
        
    return jsonify(desglose_pagos)

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
                 nro_factura = f"{mov['factura_tipo'] or 'FC'} {str(mov['factura_prefijo']).zfill(4)}-{str(mov['factura_numero']).zfill(8)}" if mov['factura_prefijo'] and mov['factura_numero'] else f"ID:{mov['id']}"
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
        reporte_list = []
        for row in reporte:
            r = dict(row)
            for k, v in r.items():
                if isinstance(v, Decimal):
                    r[k] = float(v)
            reporte_list.append(r)
        return jsonify(reporte_list)
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
    try:
        db_type = g.db_type
    except AttributeError:
        db_type = 'postgres' # Default seguro para producción

    if db_type == 'sqlite':
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

    if db_type == 'sqlite':
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
            if isinstance(row_dict['total_vendido'], Decimal):
                row_dict['total_vendido'] = float(row_dict['total_vendido'])
            reporte_list.append(row_dict)

        return jsonify(reporte_list)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- ✨ NUEVO REPORTE DE ENTREGAS (Logística) ✨ ---
@bp.route('/negocios/<int:negocio_id>/reportes/entregas', methods=['GET'])
@token_required
def get_reporte_entregas(current_user, negocio_id):
    db = get_db()
    
    fecha_desde_str = request.args.get('fecha_desde')
    fecha_hasta_str = request.args.get('fecha_hasta')
    
    # Consulta base
    query = """
        SELECT 
            hr.id,
            hr.fecha,
            hr.estado,
            COALESCE(vend.nombre, 'Sin Vendedor') as vendedor_nombre,
            veh.patente as vehiculo_patente,
            (SELECT COUNT(*) FROM hoja_ruta_items hri WHERE hri.hoja_ruta_id = hr.id) as total_clientes,
            (SELECT COUNT(*) FROM hoja_ruta_items hri WHERE hri.hoja_ruta_id = hr.id AND hri.visitado = TRUE) as visitados_count,
            (SELECT COUNT(DISTINCT p.id) 
             FROM pedidos p 
             WHERE p.hoja_ruta_id = hr.id AND p.estado != 'anulado') as pedidos_total_count,
            (SELECT COUNT(DISTINCT p.id) 
             FROM pedidos p 
             WHERE p.hoja_ruta_id = hr.id AND p.estado = 'entregado') as pedidos_entregados_count,
            (SELECT COALESCE(SUM(pd.cantidad * prod.peso_kg), 0)
             FROM pedidos p
             JOIN pedidos_detalle pd ON p.id = pd.pedido_id
             JOIN productos prod ON pd.producto_id = prod.id
             WHERE p.hoja_ruta_id = hr.id AND p.estado != 'anulado') as total_kilos,
            (SELECT COALESCE(SUM(v.total), 0)
             FROM pedidos p 
             JOIN ventas v ON p.venta_id = v.id 
             WHERE p.hoja_ruta_id = hr.id AND p.estado = 'entregado') as total_recaudado
        FROM hoja_ruta hr
        LEFT JOIN vendedores vend ON hr.vendedor_id = vend.id
        LEFT JOIN vehiculos veh ON hr.vehiculo_id = veh.id
        WHERE vend.negocio_id = %s
    """
    params = [negocio_id]

    if fecha_desde_str:
        query += " AND hr.fecha >= %s"
        params.append(fecha_desde_str)
    
    if fecha_hasta_str:
        query += " AND hr.fecha <= %s"
        params.append(fecha_hasta_str)
        
    query += " ORDER BY hr.fecha DESC, hr.id DESC"
    
    try:
        db.execute(query, tuple(params))
        rows = db.fetchall()
        
        reporte_list = []
        for row in rows:
            r = dict(row)
            # Conversiones de tipos
            if isinstance(r['fecha'], (datetime.date, datetime.datetime)):
                r['fecha'] = r['fecha'].isoformat()
            if isinstance(r['total_recaudado'], Decimal):
                r['total_recaudado'] = float(r['total_recaudado'])
            if isinstance(r['total_kilos'], Decimal):
                r['total_kilos'] = float(r['total_kilos'])
            
            # Calcular efectividad (si hay clientes)
            if r['total_clientes'] > 0:
                r['efectividad'] = (r['visitados_count'] / r['total_clientes']) * 100
            else:
                r['efectividad'] = 0
                
            reporte_list.append(r)
            
        return jsonify(reporte_list)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/reportes/bajadas-detalle', methods=['GET'])
@token_required
def get_reporte_bajadas_detalle(current_user, negocio_id):
    db = get_db()
    
    if not check_user_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'No tiene permisos sobre este negocio'}), 403

    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    chofer_id = request.args.get('chofer_id')
    hoja_ruta_id = request.args.get('hoja_ruta_id')

    query = """
        SELECT 
            p.id as pedido_id,
            p.fecha_entrega as fecha_confirmacion,
            hr.id as hr_id,
            v.nombre as chofer_nombre,
            c.nombre as cliente_nombre,
            p.total as monto_pedido,
            p.estado,
            u.nombre as usuario_confirmacion
        FROM pedidos p
        JOIN hoja_ruta hr ON p.hoja_ruta_id = hr.id
        JOIN vendedores v ON hr.vendedor_id = v.id
        JOIN clientes c ON p.cliente_id = c.id
        LEFT JOIN usuarios u ON p.usuario_entrega_id = u.id
        WHERE p.negocio_id = %s AND p.fecha_entrega IS NOT NULL
    """
    params = [negocio_id]

    if fecha_desde:
        query += " AND CAST(p.fecha_entrega AS DATE) >= %s"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND CAST(p.fecha_entrega AS DATE) <= %s"
        params.append(fecha_hasta)
    if chofer_id:
        query += " AND hr.vendedor_id = %s"
        params.append(chofer_id)
    if hoja_ruta_id:
        query += " AND hr.id = %s"
        params.append(hoja_ruta_id)

    query += " ORDER BY p.fecha_entrega DESC"

    try:
        db.execute(query, tuple(params))
        rows = db.fetchall()
        
        reporte_list = []
        for row in rows:
            r = dict(row)
            if r['fecha_confirmacion']:
                r['fecha_confirmacion'] = r['fecha_confirmacion'].isoformat()
            if isinstance(r['monto_pedido'], Decimal):
                r['monto_pedido'] = float(r['monto_pedido'])
            reporte_list.append(r)
            
        return jsonify(reporte_list)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
