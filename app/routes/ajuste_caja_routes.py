from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('ajuste_caja', __name__)

# ✨ LA CORRECCIÓN CLAVE: Combinamos GET y POST en una sola ruta
@bp.route('/negocios/<int:negocio_id>/caja/ajustes', methods=['GET', 'POST'])
@token_required
def manejar_ajustes(current_user, negocio_id):
    # Si la petición es de tipo POST, ejecutamos la lógica para registrar un nuevo ajuste.
    if request.method == 'POST':
        return registrar_ajuste(current_user, negocio_id)
    
    # Si la petición es de tipo GET, ejecutamos la lógica para obtener el historial.
    if request.method == 'GET':
        return get_historial_ajustes(current_user, negocio_id)

def registrar_ajuste(current_user, negocio_id):
    data = request.get_json()
    tipo = data.get('tipo')
    monto = data.get('monto')
    concepto = data.get('concepto')
    observaciones = data.get('observaciones')

    if not all([tipo, monto, concepto]):
        return jsonify({'error': 'Tipo, monto y concepto son obligatorios.'}), 400
    if tipo not in ['Ingreso', 'Egreso']:
        return jsonify({'error': 'El tipo debe ser "Ingreso" o "Egreso".'}), 400
    if not isinstance(monto, (int, float)) or monto <= 0:
        return jsonify({'error': 'El monto debe ser un número positivo.'}), 400

    db = get_db()
    try:
        db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'No hay una sesión de caja activa para registrar el ajuste.'}), 409
        
        caja_sesion_id = sesion_abierta['id']
        
        db.execute(
            """
            INSERT INTO caja_ajustes (negocio_id, usuario_id, caja_sesion_id, fecha, tipo, monto, concepto, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (negocio_id, current_user['id'], caja_sesion_id, datetime.datetime.now(), tipo, monto, concepto, observaciones)
        )
        
        g.db_conn.commit()
        return jsonify({'message': f'Ajuste de tipo "{tipo}" registrado con éxito.'}), 201

    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_ajuste: {e}")
        return jsonify({'error': 'Ocurrió un error en el servidor.'}), 500

def get_historial_ajustes(current_user, negocio_id):
    db = get_db()
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    tipo = request.args.get('tipo')  # 'Ingreso' o 'Egreso'
    limit = request.args.get('limit', type=int)
    offset = request.args.get('offset', type=int, default=0)

    query = """
        SELECT 
            ca.fecha, ca.tipo, ca.monto, ca.concepto,
            u.nombre as usuario_nombre,
            cs.fecha_cierre 
        FROM caja_ajustes ca
        JOIN usuarios u ON ca.usuario_id = u.id
        LEFT JOIN caja_sesiones cs ON ca.caja_sesion_id = cs.id
        WHERE ca.negocio_id = %s
    """
    params = [negocio_id]

    # Identificar tipo de base de datos para el filtro de fechas
    try:
        db_type = getattr(g, 'db_type', 'postgres')
    except Exception:
        db_type = 'postgres'

    if db_type == 'sqlite':
        date_filter_desde = " AND DATE(ca.fecha) >= %s"
        date_filter_hasta = " AND DATE(ca.fecha) <= %s"
    else:  # PostgreSQL
        date_filter_desde = " AND ca.fecha::date >= %s"
        date_filter_hasta = " AND ca.fecha::date <= %s"

    if fecha_desde:
        query += date_filter_desde
        params.append(fecha_desde)
    if fecha_hasta:
        query += date_filter_hasta
        params.append(fecha_hasta)
    
    if tipo:
        query += " AND ca.tipo = %s"
        params.append(tipo)

    query += " ORDER BY ca.fecha DESC"
    
    if limit:
        query += " LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset)

    try:
        print(f"🔍 [Backend] Query: {query}")
        print(f"🔍 [Backend] Params: {params}")
        db.execute(query, tuple(params))
        ajustes = db.fetchall()
        print(f"✅ [Backend] Found {len(ajustes)} adjustments.")
        return jsonify([dict(row) for row in ajustes])
    except Exception as e:
        print(f"Error en get_historial_ajustes: {e}")
        return jsonify({'error': 'Ocurrió un error al obtener el historial de ajustes.'}), 500
    