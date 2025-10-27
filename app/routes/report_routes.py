from flask import Blueprint, jsonify, request
from app.database import get_db
from app.auth_decorator import token_required
from decimal import Decimal
import datetime
import traceback


bp = Blueprint('reports', __name__)

# --- Reporte de Ventas Diarias (Movido desde sales_routes.py) ---
@bp.route('/negocios/<int:negocio_id>/reportes/ventas_diarias')
@token_required
def reporte_ventas_diarias(current_user, negocio_id):
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    db = get_db()
    query = """
        SELECT date(fecha) as dia, SUM(total) as total_vendido, COUNT(id) as cantidad_ventas
        FROM ventas WHERE negocio_id = ?
    """
    params = [negocio_id]
    if fecha_desde:
        query += " AND date(fecha) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND date(fecha) <= ?"
        params.append(fecha_hasta)
    query += " GROUP BY date(fecha) ORDER BY date(fecha) DESC"
    reporte = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in reporte])

# --- ✨ NUEVO: Reporte de Ganancias por Producto ---
@bp.route('/negocios/<int:negocio_id>/reportes/ganancias', methods=['GET'])
@token_required
def get_reporte_ganancias(current_user, negocio_id):
    """
    Calcula la ganancia neta por producto en un rango de fechas.
    Ganancia = (Precio de Venta - Precio de Costo) * Cantidad Vendida.
    """
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')

    query = """
        SELECT
            p.id as producto_id,
            p.nombre as producto_nombre,
            SUM(vd.cantidad) as cantidad_vendida,
            SUM(vd.subtotal) as total_ventas,
            SUM(vd.cantidad * p.precio_costo) as total_costo,
            SUM(vd.subtotal - (vd.cantidad * p.precio_costo)) as ganancia_neta
        FROM
            ventas_detalle vd
        JOIN
            productos p ON vd.producto_id = p.id
        JOIN
            ventas v ON vd.venta_id = v.id
        WHERE
            v.negocio_id = ?
    """
    params = [negocio_id]

    if fecha_desde:
        query += " AND date(v.fecha) >= ?"
        params.append(fecha_desde)
    if fecha_hasta:
        query += " AND date(v.fecha) <= ?"
        params.append(fecha_hasta)
    
    query += " GROUP BY p.id, p.nombre ORDER BY ganancia_neta DESC"
    
    reporte = db.execute(query, tuple(params)).fetchall()
    return jsonify([dict(row) for row in reporte])


@bp.route('/negocios/<int:negocio_id>/ventas', methods=['GET'])
@token_required
def get_historial_ventas(current_user, negocio_id):
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    query = """
        SELECT v.id, v.fecha, v.total, c.nombre as cliente_nombre
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = %s
    """
    params = [negocio_id]

    if fecha_desde:
        query += ' AND v.fecha::date >= %s'
        params.append(fecha_desde)
    if fecha_hasta:
        query += ' AND v.fecha::date <= %s'
        params.append(fecha_hasta)
    
    query += ' ORDER BY v.fecha DESC'
    
    db.execute(query, tuple(params))
    ventas = db.fetchall()
    return jsonify([dict(row) for row in ventas])

@bp.route('/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_detalles_venta(current_user, venta_id):
    db = get_db()
    db.execute(
        """
        SELECT d.cantidad, d.precio_unitario, p.nombre 
        FROM ventas_detalle d JOIN productos p ON d.producto_id = p.id
        WHERE d.venta_id = %s
        """,
        (venta_id,)
    )
    detalles = db.fetchall()
    return jsonify([dict(row) for row in detalles])

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
       
        return jsonify({
            'saldo_inicial': float(saldo_inicial),
            'movimientos': movimientos_procesados,
            'fecha_desde': fecha_desde.strftime('%Y-%m-%d'),
            'fecha_hasta': fecha_hasta.strftime('%Y-%m-%d')
        })

#voy a hacer una prueba de error
    except Exception as e:
        print(f"Error en get_cta_cte_proveedor (Proveedor ID: {proveedor_id}):")
        traceback.print_exc()
        return jsonify({'error': f'Error al generar cuenta corriente: {str(e)}'}), 500