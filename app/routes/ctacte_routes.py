from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.routes.auth_routes import token_required
import datetime
import pytz

bp = Blueprint('ctacte', __name__)

@bp.route('/negocios/<int:negocio_id>/ctacte/clientes', methods=['GET'])
@token_required
def get_clientes_con_saldo(current_user, negocio_id):
    db = get_db()
    
    # Buscamos clientes que tengan movimientos en su cuenta corriente
    # Calculamos el saldo como SUM(debe) - SUM(haber)
    # Regla de sintaxis: NUNCA usar 'AS' para alias de tabla en FROM/JOIN
    query = """
        SELECT 
            c.id, 
            NULLIF(TRIM(c.nombre), '') as nombre, 
            c.direccion,
            COALESCE(SUM(cc.debe), 0) - COALESCE(SUM(cc.haber), 0) as saldo
        FROM clientes c
        JOIN clientes_cuenta_corriente cc ON c.id = cc.cliente_id
        WHERE c.negocio_id = %s AND c.activo = TRUE
        GROUP BY c.id, c.nombre, c.direccion
        HAVING (COALESCE(SUM(cc.debe), 0) - COALESCE(SUM(cc.haber), 0)) > 0
        ORDER BY c.nombre ASC
    """
    
    try:
        db.execute(query, (negocio_id,))
        clientes = db.fetchall()
        return jsonify([dict(c) for c in clientes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/clientes/<int:cliente_id>/balance', methods=['GET'])
@token_required
def get_cliente_balance(current_user, cliente_id):
    db = get_db()
    query = """
        SELECT COALESCE(SUM(debe), 0) - COALESCE(SUM(haber), 0) as saldo
        FROM clientes_cuenta_corriente
        WHERE cliente_id = %s
    """
    try:
        db.execute(query, (cliente_id,))
        res = db.fetchone()
        return jsonify({'saldo': float(res['saldo']) if res else 0.0})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/ctacte/cobro', methods=['POST'])
@token_required
def registrar_cobro(current_user, negocio_id):
    data = request.get_json()
    cliente_id = data.get('cliente_id')
    monto_total = float(data.get('monto_total', 0))
    metodo_pago = data.get('metodo_pago')
    observaciones = data.get('observaciones', '')
    
    if not cliente_id or monto_total <= 0 or not metodo_pago:
        return jsonify({'error': 'Datos incompletos'}), 400
        
    db = get_db()
    
    # 1. Validar Caja Abierta si hay efectivo
    # Obtenemos montos mixtos si aplica
    montos_mixtos = data.get('montos_mixtos', {})
    involucra_efectivo = (metodo_pago == 'Efectivo') or (metodo_pago == 'Mixto' and float(montos_mixtos.get('Efectivo', 0)) > 0)
    
    sesion_id = None
    if involucra_efectivo:
        db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
        sesion_row = db.fetchone()
        if not sesion_row:
            return jsonify({'error': 'La caja está cerrada. Debe abrirla para registrar cobros en efectivo.'}), 409
        sesion_id = sesion_row['id']
    else:
        # Aunque no sea efectivo, intentamos asociar a la sesión de caja abierta si existe para auditoría
        db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
        sesion_row = db.fetchone()
        if sesion_row:
            sesion_id = sesion_row['id']

    try:
        tz_ar = pytz.timezone('America/Argentina/Buenos_Aires')
        fecha_actual = datetime.datetime.now(tz_ar)
        
        # 2. Registrar Venta (Ingreso de dinero sin productos)
        # Esto permite que el dinero entre a la caja y aparezca en reportes de ventas por método
        if metodo_pago == 'Mixto':
            # Para pagos mixtos, creamos un registro por cada método que no sea Cta Cte (ya que esto es un COBRO de deuda anterior)
            # Nota: En este contexto 'Cuenta Corriente' no sería un método de pago válido para PAGAR la propia deuda de Cta Cte.
            for metodo, monto in montos_mixtos.items():
                monto_val = float(monto)
                if monto_val > 0:
                    db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
                    proximo_nro_sec = db.fetchone()[0]
                    db.execute(
                        """INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, numero_interno) 
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (negocio_id, cliente_id, current_user['id'], monto_val, metodo, fecha_actual, sesion_id, proximo_nro_sec)
                    )
        else:
            db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
            proximo_nro = db.fetchone()[0]
            db.execute(
                """INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, numero_interno) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (negocio_id, cliente_id, current_user['id'], monto_total, metodo_pago, fecha_actual, sesion_id, proximo_nro)
            )

        # 3. Registrar en Cuenta Corriente (HABER)
        concepto_cc = f"Cobro - {metodo_pago} - {observaciones}".strip(" - ")
        db.execute(
            "INSERT INTO clientes_cuenta_corriente (cliente_id, concepto, debe, haber, fecha) VALUES (%s, %s, %s, %s, %s)",
            (cliente_id, concepto_cc, 0, monto_total, fecha_actual)
        )
        
        # 4. Obtener Nuevo Saldo (DENTRO de la transacción)
        db.execute("""
            SELECT COALESCE(SUM(debe), 0) - COALESCE(SUM(haber), 0) as saldo
            FROM clientes_cuenta_corriente
            WHERE cliente_id = %s
        """, (cliente_id,))
        balance_res = db.fetchone()
        nuevo_saldo = float(balance_res['saldo']) if balance_res else 0.0

        db.connection.commit()

        return jsonify({
            'message': 'Cobro registrado correctamente', 
            'monto': monto_total,
            'nuevo_saldo': nuevo_saldo,
            'fecha': fecha_actual.isoformat()
        })
        
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500
