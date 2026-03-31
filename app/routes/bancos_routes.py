# app/routes/bancos_routes.py
# ─── Módulo Bancos: Cheques & Echeqs ─────────────────────────────────────────
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
from decimal import Decimal
import datetime

bp = Blueprint('bancos', __name__)

# ─── Helper: Verificar permiso de negocio ────────────────────────────────────
def check_negocio_permission(current_user, negocio_id):
    if not current_user or 'rol' not in current_user:
        return False
    if current_user['rol'] == 'superadmin':
        return True
    db = get_db()
    db.execute(
        "SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
        (current_user['id'], negocio_id)
    )
    return db.fetchone() is not None


# ─── Helper: serializar cheque ───────────────────────────────────────────────
def _serialize_cheque(row):
    d = dict(row)
    for k, v in d.items():
        if isinstance(v, Decimal):
            d[k] = float(v)
        elif isinstance(v, (datetime.date, datetime.datetime)):
            d[k] = v.isoformat()
    return d


# =============================================================================
# DASHBOARD / RESUMEN KPIs
# =============================================================================

@bp.route('/negocios/<int:negocio_id>/cheques/resumen', methods=['GET'])
@token_required
def get_resumen_cheques(current_user, negocio_id):
    """KPIs de posición bancaria: total en cartera, próximos a vencer, rechazados."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403

    db = get_db()
    hoy = datetime.date.today()
    proximos_dias = hoy + datetime.timedelta(days=7)

    try:
        # Total en cartera (cheques de terceros disponibles)
        db.execute("""
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM cheques
            WHERE negocio_id = %s AND tipo = 'tercero' AND estado = 'en_cartera'
        """, (negocio_id,))
        total_cartera = float(db.fetchone()['total'])

        # Cheques próximos a vencer (en_cartera, vencen en 7 días)
        db.execute("""
            SELECT COUNT(*) AS cant, COALESCE(SUM(monto), 0) AS monto
            FROM cheques
            WHERE negocio_id = %s AND tipo = 'tercero' AND estado = 'en_cartera'
              AND fecha_vencimiento BETWEEN %s AND %s
        """, (negocio_id, hoy, proximos_dias))
        row_prox = db.fetchone()
        proximos = {'cantidad': row_prox['cant'], 'monto': float(row_prox['monto'])}

        # Cheques rechazados activos (sin resolver)
        db.execute("""
            SELECT COUNT(*) AS cant, COALESCE(SUM(monto), 0) AS monto
            FROM cheques
            WHERE negocio_id = %s AND estado = 'rechazado'
        """, (negocio_id,))
        row_rej = db.fetchone()
        rechazados = {'cantidad': row_rej['cant'], 'monto': float(row_rej['monto'])}

        # Cheques propios emitidos pendientes (estado 'aplicado' / en_cartera para propios)
        db.execute("""
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM cheques
            WHERE negocio_id = %s AND tipo = 'propio' AND estado IN ('en_cartera', 'aplicado')
        """, (negocio_id,))
        total_propios = float(db.fetchone()['total'])

        return jsonify({
            'total_cartera': total_cartera,
            'proximos_vencer': proximos,
            'rechazados': rechazados,
            'total_propios_pendientes': total_propios
        })

    except Exception as e:
        print(f"[bancos] ERROR get_resumen_cheques: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# LISTAR CHEQUES
# =============================================================================

@bp.route('/negocios/<int:negocio_id>/cheques', methods=['GET'])
@token_required
def get_cheques(current_user, negocio_id):
    """Lista cheques con filtros: tipo, estado, modalidad, fecha_desde, fecha_hasta."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403

    tipo      = request.args.get('tipo')         # propio | tercero
    estado    = request.args.get('estado')        # en_cartera | depositado | ...
    modalidad = request.args.get('modalidad')     # fisico | echeq
    f_desde   = request.args.get('fecha_desde')
    f_hasta   = request.args.get('fecha_hasta')

    db = get_db()
    sql = """
        SELECT
            c.id, c.tipo, c.modalidad, c.banco, c.numero_cheque,
            c.nombre_librador, c.cuit_librador, c.monto,
            c.fecha_emision, c.fecha_vencimiento, c.estado, c.origen, c.destino,
            c.echeq_id, c.observaciones, c.fecha_registro,
            cl.nombre AS nombre_cliente,
            pr.nombre AS nombre_proveedor
        FROM cheques c
        LEFT JOIN clientes cl ON c.cliente_id = cl.id
        LEFT JOIN proveedores pr ON c.proveedor_id = pr.id
        WHERE c.negocio_id = %s
    """
    params = [negocio_id]

    if tipo:
        sql += " AND c.tipo = %s"
        params.append(tipo)
    if estado:
        sql += " AND c.estado = %s"
        params.append(estado)
    if modalidad:
        sql += " AND c.modalidad = %s"
        params.append(modalidad)
    if f_desde:
        sql += " AND c.fecha_vencimiento >= %s"
        params.append(f_desde)
    if f_hasta:
        sql += " AND c.fecha_vencimiento <= %s"
        params.append(f_hasta)

    sql += " ORDER BY c.fecha_vencimiento ASC, c.id DESC LIMIT 500"

    try:
        db.execute(sql, params)
        cheques = [_serialize_cheque(row) for row in db.fetchall()]
        return jsonify(cheques)
    except Exception as e:
        print(f"[bancos] ERROR get_cheques: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# CREAR CHEQUE
# =============================================================================

@bp.route('/negocios/<int:negocio_id>/cheques', methods=['POST'])
@token_required
def crear_cheque(current_user, negocio_id):
    """
    Registra un nuevo cheque (recibido de cliente o emitido a proveedor).
    Campos obligatorios: tipo, modalidad, banco, numero_cheque, monto, fecha_vencimiento.
    """
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Body JSON requerido'}), 400

    required = ['tipo', 'modalidad', 'banco', 'numero_cheque', 'monto', 'fecha_vencimiento']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'Campo "{field}" es obligatorio'}), 400

    # Determinar estado inicial y origen según tipo
    if data['tipo'] == 'tercero':
        estado_inicial = 'en_cartera'
        origen_default = data.get('origen', 'manual')
    else:  # propio
        estado_inicial = 'aplicado'  # ya fue entregado al proveedor
        origen_default = 'emision_propia'

    db = get_db()
    try:
        db.execute("""
            INSERT INTO cheques (
                negocio_id, tipo, modalidad, banco, numero_cheque,
                cuit_librador, nombre_librador, monto,
                fecha_emision, fecha_vencimiento, estado,
                origen, venta_id, cliente_id,
                destino, proveedor_id,
                echeq_id, echeq_cbu,
                usuario_registro_id, observaciones
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s
            ) RETURNING id
        """, (
            negocio_id,
            data['tipo'],
            data['modalidad'],
            data['banco'],
            data['numero_cheque'],
            data.get('cuit_librador'),
            data.get('nombre_librador'),
            data['monto'],
            data.get('fecha_emision'),
            data['fecha_vencimiento'],
            estado_inicial,
            origen_default,
            data.get('venta_id'),
            data.get('cliente_id'),
            data.get('destino'),
            data.get('proveedor_id'),
            data.get('echeq_id'),
            data.get('echeq_cbu'),
            current_user['id'],
            data.get('observaciones'),
        ))
        nuevo_id = db.fetchone()['id']

        # Registrar primer movimiento
        tipo_mov = 'ingreso' if data['tipo'] == 'tercero' else 'pago_proveedor'
        db.execute("""
            INSERT INTO cheques_movimientos (
                cheque_id, negocio_id, tipo_movimiento,
                estado_anterior, estado_nuevo,
                cliente_id, proveedor_id,
                usuario_id, observaciones
            ) VALUES (%s, %s, %s, NULL, %s, %s, %s, %s, %s)
        """, (
            nuevo_id, negocio_id, tipo_mov,
            estado_inicial,
            data.get('cliente_id'),
            data.get('proveedor_id'),
            current_user['id'],
            data.get('observaciones'),
        ))

        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Cheque registrado con éxito'}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"[bancos] ERROR crear_cheque: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# DETALLE + HISTORIAL DE UN CHEQUE
# =============================================================================

@bp.route('/negocios/<int:negocio_id>/cheques/<int:cheque_id>', methods=['GET'])
@token_required
def get_cheque_detalle(current_user, negocio_id, cheque_id):
    """Detalle completo de un cheque + historial de movimientos."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403

    db = get_db()
    try:
        # Cheque principal
        db.execute("""
            SELECT c.*,
                   cl.nombre AS nombre_cliente,
                   pr.nombre AS nombre_proveedor,
                   u.nombre  AS usuario_registro
            FROM cheques c
            LEFT JOIN clientes   cl ON c.cliente_id            = cl.id
            LEFT JOIN proveedores pr ON c.proveedor_id          = pr.id
            LEFT JOIN usuarios    u  ON c.usuario_registro_id   = u.id
            WHERE c.id = %s AND c.negocio_id = %s
        """, (cheque_id, negocio_id))
        cheque = db.fetchone()
        if not cheque:
            return jsonify({'error': 'Cheque no encontrado'}), 404

        cheque_data = _serialize_cheque(cheque)

        # Historial de movimientos
        db.execute("""
            SELECT m.*,
                   cl.nombre AS nombre_cliente,
                   pr.nombre AS nombre_proveedor,
                   u.nombre  AS nombre_usuario
            FROM cheques_movimientos m
            LEFT JOIN clientes    cl ON m.cliente_id   = cl.id
            LEFT JOIN proveedores pr ON m.proveedor_id = pr.id
            LEFT JOIN usuarios    u  ON m.usuario_id   = u.id
            WHERE m.cheque_id = %s
            ORDER BY m.fecha ASC
        """, (cheque_id,))
        movimientos = [_serialize_cheque(row) for row in db.fetchall()]

        return jsonify({'cheque': cheque_data, 'movimientos': movimientos})

    except Exception as e:
        print(f"[bancos] ERROR get_cheque_detalle: {e}")
        return jsonify({'error': str(e)}), 500


# =============================================================================
# TRANSICIONES DE ESTADO
# =============================================================================

def _transicion_estado(current_user, negocio_id, cheque_id,
                        estados_validos_origen, estado_nuevo,
                        tipo_movimiento, extra_data=None):
    """Helper genérico para cambiar el estado de un cheque y registrar el movimiento."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403

    db = get_db()
    try:
        db.execute(
            "SELECT id, estado FROM cheques WHERE id = %s AND negocio_id = %s",
            (cheque_id, negocio_id)
        )
        cheque = db.fetchone()
        if not cheque:
            return jsonify({'error': 'Cheque no encontrado'}), 404

        if cheque['estado'] not in estados_validos_origen:
            return jsonify({
                'error': f'Operación no válida. Estado actual: {cheque["estado"]}'
            }), 409

        estado_anterior = cheque['estado']
        extra = extra_data or {}

        # Actualizar cheque
        updates = "estado = %s, fecha_actualizacion = NOW()"
        params_up = [estado_nuevo]
        if extra.get('proveedor_id'):
            updates += ", proveedor_id = %s, destino = %s"
            params_up += [extra['proveedor_id'], extra.get('destino', 'endoso_proveedor')]
        params_up += [cheque_id, negocio_id]

        db.execute(f"UPDATE cheques SET {updates} WHERE id = %s AND negocio_id = %s", params_up)

        # Registrar movimiento
        db.execute("""
            INSERT INTO cheques_movimientos (
                cheque_id, negocio_id, tipo_movimiento,
                estado_anterior, estado_nuevo,
                cliente_id, proveedor_id,
                tiene_factura, nro_factura,
                usuario_id, observaciones
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            cheque_id, negocio_id, tipo_movimiento,
            estado_anterior, estado_nuevo,
            extra.get('cliente_id'), extra.get('proveedor_id'),
            extra.get('tiene_factura', False), extra.get('nro_factura'),
            current_user['id'], extra.get('observaciones'),
        ))

        g.db_conn.commit()
        return jsonify({'message': f'Cheque actualizado a "{estado_nuevo}"'}), 200

    except Exception as e:
        g.db_conn.rollback()
        print(f"[bancos] ERROR en transicion {tipo_movimiento}: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/cheques/<int:cheque_id>/depositar', methods=['PUT'])
@token_required
def depositar_cheque(current_user, negocio_id, cheque_id):
    """Marca el cheque como depositado en banco."""
    data = request.get_json() or {}
    return _transicion_estado(
        current_user, negocio_id, cheque_id,
        estados_validos_origen=['en_cartera'],
        estado_nuevo='depositado',
        tipo_movimiento='deposito',
        extra_data={'observaciones': data.get('observaciones')}
    )


@bp.route('/negocios/<int:negocio_id>/cheques/<int:cheque_id>/endosar', methods=['PUT'])
@token_required
def endosar_cheque(current_user, negocio_id, cheque_id):
    """Endosa (transfiere) el cheque a un proveedor."""
    data = request.get_json() or {}
    if not data.get('proveedor_id'):
        return jsonify({'error': 'proveedor_id es obligatorio'}), 400
    return _transicion_estado(
        current_user, negocio_id, cheque_id,
        estados_validos_origen=['en_cartera'],
        estado_nuevo='endosado',
        tipo_movimiento='endoso_salida',
        extra_data={
            'proveedor_id':  data.get('proveedor_id'),
            'destino':       'endoso_proveedor',
            'tiene_factura': data.get('tiene_factura', False),
            'nro_factura':   data.get('nro_factura'),
            'observaciones': data.get('observaciones'),
        }
    )


@bp.route('/negocios/<int:negocio_id>/cheques/<int:cheque_id>/rechazar', methods=['PUT'])
@token_required
def rechazar_cheque(current_user, negocio_id, cheque_id):
    """Registra el rechazo bancario de un cheque."""
    data = request.get_json() or {}
    return _transicion_estado(
        current_user, negocio_id, cheque_id,
        estados_validos_origen=['en_cartera', 'depositado'],
        estado_nuevo='rechazado',
        tipo_movimiento='rechazo',
        extra_data={'observaciones': data.get('observaciones')}
    )


@bp.route('/negocios/<int:negocio_id>/cheques/<int:cheque_id>/anular', methods=['PUT'])
@token_required
def anular_cheque(current_user, negocio_id, cheque_id):
    """Anula un cheque (corrección de error)."""
    data = request.get_json() or {}
    return _transicion_estado(
        current_user, negocio_id, cheque_id,
        estados_validos_origen=['en_cartera', 'aplicado'],
        estado_nuevo='anulado',
        tipo_movimiento='anulacion',
        extra_data={'observaciones': data.get('observaciones')}
    )


# =============================================================================
# LISTAS DE APOYO (para combos del frontend)
# =============================================================================

@bp.route('/negocios/<int:negocio_id>/clientes/lista', methods=['GET'])
@token_required
def get_clientes_lista(current_user, negocio_id):
    """Lista ligera de clientes para combo-box en modales."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403
    db = get_db()
    try:
        db.execute(
            "SELECT id, nombre FROM clientes WHERE negocio_id = %s AND activo = TRUE ORDER BY nombre",
            (negocio_id,)
        )
        return jsonify([dict(r) for r in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/proveedores/lista', methods=['GET'])
@token_required
def get_proveedores_lista(current_user, negocio_id):
    """Lista ligera de proveedores para combo-box en modales."""
    if not check_negocio_permission(current_user, negocio_id):
        return jsonify({'error': 'Sin permisos'}), 403
    db = get_db()
    try:
        db.execute(
            "SELECT id, nombre FROM proveedores WHERE negocio_id = %s ORDER BY nombre",
            (negocio_id,)
        )
        return jsonify([dict(r) for r in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
