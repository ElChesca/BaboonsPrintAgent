from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('ajuste_caja', __name__)

@bp.route('/negocios/<int:negocio_id>/caja/ajustes', methods=['POST'])
@token_required
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
        # 1. Validar que haya una caja abierta
        db.execute("SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL", (negocio_id,))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'No hay una sesión de caja activa para registrar el ajuste.'}), 409
        
        caja_sesion_id = sesion_abierta['id']
        
        # 2. Insertar el ajuste
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