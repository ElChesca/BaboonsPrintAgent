# app/routes/consorcio_routes.py
# ✨ ARCHIVO ACTUALIZADO (CON UNIDADES + RECLAMOS + EXPENSAS) ✨

from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('consorcio', __name__)

# --- FUNCIÓN HELPER DE SEGURIDAD (Admin) ---
def check_consorcio_permission(negocio_id, current_user):
    # ... (código sin cambios)
    db = get_db()
    if current_user['rol'] not in ('admin', 'superadmin'):
        return {'error': 'Acción no permitida por rol'}, 403
    if current_user['rol'] == 'admin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
                   (current_user['id'], negocio_id))
        if not db.fetchone():
            return {'error': 'Usuario no asignado a este negocio'}, 403
    db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    if not negocio:
        return {'error': 'Negocio no encontrado'}, 404
    if negocio['tipo_app'] != 'consorcio':
        return {'error': 'Esta acción solo es válida para negocios de tipo "Consorcio"'}, 400
    return None, None

# ============================================
# --- 1. RUTAS DE UNIDADES (Sin cambios) ---
# ============================================
@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['GET'])
@token_required
def get_unidades(current_user, negocio_id):
    # ... (código sin cambios)
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error: return jsonify(error), status
    db = get_db()
    db.execute("SELECT u.*, i.nombre AS inquilino_nombre, p.nombre AS propietario_nombre FROM consorcio_unidades u LEFT JOIN usuarios i ON u.inquilino_id = i.id LEFT JOIN usuarios p ON u.propietario_id = p.id WHERE u.negocio_id = %s ORDER BY u.nombre_unidad", (negocio_id,))
    return jsonify([dict(row) for row in db.fetchall()])

@bp.route('/consorcio/<int:negocio_id>/unidades', methods=['POST'])
@token_required
def create_unidad(current_user, negocio_id):
    # ... (código sin cambios)
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error: return jsonify(error), status
    data = request.get_json()
    if not data or not data.get('nombre_unidad'):
        return jsonify({'error': 'El campo "nombre_unidad" es obligatorio'}), 400
    db = get_db()
    try:
        db.execute("INSERT INTO consorcio_unidades (negocio_id, nombre_unidad, piso, metros_cuadrados, coeficiente, inquilino_id, propietario_id, descripcion) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                   (negocio_id, data['nombre_unidad'], data.get('piso'), data.get('metros_cuadrados'), data.get('coeficiente'), data.get('inquilino_id') or None, data.get('propietario_id') or None, data.get('descripcion')))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Unidad creada con éxito', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        if 'unique constraint' in str(e): return jsonify({'error': 'Ya existe una unidad con ese nombre en este consorcio'}), 409
        return jsonify({'error': str(e)}), 500

@bp.route('/consorcio/unidades/<int:unidad_id>', methods=['PUT'])
@token_required
def update_unidad(current_user, unidad_id):
    # ... (código sin cambios)
    data = request.get_json()
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad: return jsonify({'error': 'Unidad no encontrada'}), 404
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute("UPDATE consorcio_unidades SET nombre_unidad = %s, piso = %s, metros_cuadrados = %s, coeficiente = %s, inquilino_id = %s, propietario_id = %s, descripcion = %s WHERE id = %s",
                   (data['nombre_unidad'], data.get('piso'), data.get('metros_cuadrados'), data.get('coeficiente'), data.get('inquilino_id') or None, data.get('propietario_id') or None, data.get('descripcion'), unidad_id))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad actualizada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        if 'unique constraint' in str(e): return jsonify({'error': 'Ya existe otra unidad con ese nombre en este consorcio'}), 409
        return jsonify({'error': str(e)}), 500

@bp.route('/consorcio/unidades/<int:unidad_id>', methods=['DELETE'])
@token_required
def delete_unidad(current_user, unidad_id):
    # ... (código sin cambios)
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_unidades WHERE id = %s", (unidad_id,))
    unidad = db.fetchone()
    if not unidad: return jsonify({'error': 'Unidad no encontrada'}), 404
    error, status = check_consorcio_permission(unidad['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute("DELETE FROM consorcio_unidades WHERE id = %s", (unidad_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad eliminada con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        if 'foreign key constraint' in str(e): return jsonify({'error': 'No se puede eliminar la unidad, tiene datos asociados.'}), 400
        return jsonify({'error': str(e)}), 500


# ============================================
# --- 2. RUTAS DE RECLAMOS (Sin cambios) ---
# ============================================
@bp.route('/consorcio/<int:negocio_id>/reclamos/estados', methods=['GET'])
@token_required
def get_reclamos_estados(current_user, negocio_id):
    # ... (código sin cambios)
    db = get_db()
    try:
        db.execute("SELECT nombre FROM consorcio_reclamos_estados WHERE negocio_id = %s ORDER BY orden, nombre", (negocio_id,))
        estados = db.fetchall()
        return jsonify([row['nombre'] for row in estados])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/consorcio/<int:negocio_id>/mis-unidades', methods=['GET'])
@token_required
def get_mis_unidades(current_user, negocio_id):
    # ... (código sin cambios)
    db = get_db()
    db.execute("SELECT id, nombre_unidad FROM consorcio_unidades WHERE negocio_id = %s AND (inquilino_id = %s OR propietario_id = %s) ORDER BY nombre_unidad",
               (negocio_id, current_user['id'], current_user['id']))
    return jsonify([dict(row) for row in db.fetchall()])

@bp.route('/consorcio/<int:negocio_id>/reclamos', methods=['GET'])
@token_required
def get_reclamos(current_user, negocio_id):
    # ... (código sin cambios)
    db = get_db()
    db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
    negocio = db.fetchone()
    if not negocio or negocio['tipo_app'] != 'consorcio':
         return jsonify({'error': 'Ruta no válida para este tipo de negocio'}), 400
    query_base = "SELECT r.id, r.titulo, r.estado, r.fecha_creacion, r.fecha_actualizacion, u.nombre_unidad, c.nombre AS creador_nombre, a.nombre AS asignado_nombre FROM consorcio_reclamos r JOIN consorcio_unidades u ON r.unidad_id = u.id JOIN usuarios c ON r.usuario_creador_id = c.id LEFT JOIN usuarios a ON r.usuario_asignado_id = a.id WHERE r.negocio_id = %s"
    params = [negocio_id]
    if current_user['rol'] not in ('admin', 'superadmin'):
        query_base += " AND (u.inquilino_id = %s OR u.propietario_id = %s)"
        params.extend([current_user['id'], current_user['id']])
    query_base += " ORDER BY r.fecha_actualizacion DESC"
    db.execute(query_base, tuple(params))
    return jsonify([dict(row) for row in db.fetchall()])

@bp.route('/consorcio/<int:negocio_id>/reclamos', methods=['POST'])
@token_required
def create_reclamo(current_user, negocio_id):
    # ... (código sin cambios)
    data = request.get_json()
    if not data or not data.get('titulo') or not data.get('unidad_id'):
        return jsonify({'error': 'Título y Unidad son obligatorios'}), 400
    db = get_db()
    unidad_id = data.get('unidad_id')
    if current_user['rol'] not in ('admin', 'superadmin'):
        db.execute("SELECT 1 FROM consorcio_unidades WHERE id = %s AND negocio_id = %s AND (inquilino_id = %s OR propietario_id = %s)",
                   (unidad_id, negocio_id, current_user['id'], current_user['id']))
        if not db.fetchone():
            return jsonify({'error': 'No tiene permiso para crear reclamos para esta unidad.'}), 403
    try:
        db.execute("INSERT INTO consorcio_reclamos (negocio_id, unidad_id, usuario_creador_id, titulo, descripcion, estado) VALUES (%s, %s, %s, %s, %s, 'Abierto') RETURNING id",
                   (negocio_id, unidad_id, current_user['id'], data['titulo'], data.get('descripcion')))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo creado con éxito', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/consorcio/reclamos/<int:reclamo_id>', methods=['PUT'])
@token_required
def update_reclamo(current_user, reclamo_id):
    # ... (código sin cambios)
    data = request.get_json()
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
    reclamo = db.fetchone()
    if not reclamo: return jsonify({'error': 'Reclamo no encontrado'}), 404
    error, status = check_consorcio_permission(reclamo['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute("UPDATE consorcio_reclamos SET titulo = %s, descripcion = %s, estado = %s, usuario_asignado_id = %s, fecha_actualizacion = %s WHERE id = %s",
                   (data.get('titulo'), data.get('descripcion'), data.get('estado', 'Abierto'), data.get('usuario_asignado_id') or None, datetime.datetime.now(datetime.timezone.utc), reclamo_id))
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo actualizado con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/consorcio/reclamos/<int:reclamo_id>', methods=['DELETE'])
@token_required
def delete_reclamo(current_user, reclamo_id):
    # ... (código sin cambios)
    db = get_db()
    db.execute("SELECT negocio_id FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
    reclamo = db.fetchone()
    if not reclamo: return jsonify({'error': 'Reclamo no encontrado'}), 404
    error, status = check_consorcio_permission(reclamo['negocio_id'], current_user)
    if error: return jsonify(error), status
    try:
        db.execute("DELETE FROM consorcio_reclamos WHERE id = %s", (reclamo_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Reclamo eliminado con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# ============================================
# --- 3. ✨ NUEVAS RUTAS PARA EXPENSAS ✨ ---
# ============================================

# [POST] Crear un nuevo período de expensas (en Borrador)
@bp.route('/consorcio/<int:negocio_id>/expensas-periodos', methods=['POST'])
@token_required
def create_expensa_periodo(current_user, negocio_id):
    # Solo Admins pueden crear períodos
    error, status = check_consorcio_permission(negocio_id, current_user)
    if error:
        return jsonify(error), status
        
    data = request.get_json()
    # 'periodo' debe venir como 'YYYY-MM-DD' (usar el día 1)
    if not data or not data.get('periodo') or not data.get('fecha_vencimiento'):
        return jsonify({'error': 'Periodo y Fecha de Vencimiento son obligatorios'}), 400

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO consorcio_expensas_periodos 
            (negocio_id, periodo, fecha_vencimiento, total_gastos_ordinarios, total_gastos_extraordinarios, estado)
            VALUES (%s, %s, %s, %s, %s, 'Borrador')
            RETURNING id
            """,
            (
                negocio_id,
                data['periodo'],
                data['fecha_vencimiento'],
                data.get('total_gastos_ordinarios', 0.0),
                data.get('total_gastos_extraordinarios', 0.0)
            )
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': 'Período creado en Borrador', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        if 'unique constraint' in str(e):
            return jsonify({'error': 'Ya existe un período de expensas para ese mes'}), 409
        print(f"Error en create_expensa_periodo: {e}")
        return jsonify({'error': str(e)}), 500

# [POST] Emitir un período (calcular y generar deudas para todas las unidades)
@bp.route('/consorcio/expensas-periodos/<int:periodo_id>/emitir', methods=['POST'])
@token_required
def emitir_expensa_periodo(current_user, periodo_id):
    db = get_db()
    
    # 1. Validar permisos de Admin
    db.execute("SELECT negocio_id, estado, total_gastos_ordinarios, total_gastos_extraordinarios FROM consorcio_expensas_periodos WHERE id = %s", (periodo_id,))
    periodo = db.fetchone()
    if not periodo:
        return jsonify({'error': 'Período no encontrado'}), 404
        
    error, status = check_consorcio_permission(periodo['negocio_id'], current_user)
    if error:
        return jsonify(error), status
        
    # 2. Validar estado
    if periodo['estado'] != 'Borrador':
        return jsonify({'error': 'Este período ya fue emitido o está cerrado'}), 400
        
    # 3. Obtener todas las unidades de ese negocio
    db.execute("SELECT id, coeficiente FROM consorcio_unidades WHERE negocio_id = %s", (periodo['negocio_id'],))
    unidades = db.fetchall()
    if not unidades:
        return jsonify({'error': 'No hay unidades en este consorcio para emitir expensas'}), 400

    try:
        # 4. Iniciar transacción: Calcular y crear todas las expensas individuales
        for unidad in unidades:
            coeficiente = unidad['coeficiente'] or 0.0
            
            monto_ord = float(periodo['total_gastos_ordinarios']) * float(coeficiente)
            monto_ext = float(periodo['total_gastos_extraordinarios']) * float(coeficiente)
            monto_total = monto_ord + monto_ext
            
            db.execute(
                """
                INSERT INTO consorcio_expensas_unidades
                (periodo_id, unidad_id, monto_ordinario, monto_extraordinario, monto_total, saldo_pendiente, estado_pago)
                VALUES (%s, %s, %s, %s, %s, %s, 'Pendiente')
                """,
                (periodo_id, unidad['id'], monto_ord, monto_ext, monto_total, monto_total)
            )
            
        # 5. Si todo salió bien, actualizar el estado del período
        db.execute("UPDATE consorcio_expensas_periodos SET estado = 'Emitido' WHERE id = %s", (periodo_id,))
        
        g.db_conn.commit()
        return jsonify({'message': f'Expensas emitidas con éxito para {len(unidades)} unidades.'}), 200
        
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en emitir_expensa_periodo: {e}")
        return jsonify({'error': str(e)}), 500

# [GET] Listar todos los períodos
@bp.route('/consorcio/<int:negocio_id>/expensas-periodos', methods=['GET'])
@token_required
def get_expensa_periodos(current_user, negocio_id):
    # Esta ruta es segura para todos (admins e inquilinos)
    db = get_db()
    db.execute(
        "SELECT * FROM consorcio_expensas_periodos WHERE negocio_id = %s ORDER BY periodo DESC",
        (negocio_id,)
    )
    periodos = db.fetchall()
    return jsonify([dict(row) for row in periodos])

# [GET] Ver el detalle de un período (con todas sus unidades)
@bp.route('/consorcio/expensas-periodos/<int:periodo_id>/detalles', methods=['GET'])
@token_required
def get_expensa_periodo_detalles(current_user, periodo_id):
    # Ruta segura para todos (la lógica del inquilino filtra en el frontend)
    db = get_db()
    
    # 1. Obtener el período
    db.execute("SELECT * FROM consorcio_expensas_periodos WHERE id = %s", (periodo_id,))
    periodo = db.fetchone()
    if not periodo:
        return jsonify({'error': 'Período no encontrado'}), 404
        
    # 2. Obtener las deudas de las unidades
    db.execute(
        """
        SELECT 
            eu.*, 
            u.nombre_unidad,
            u.inquilino_id,
            u.propietario_id
        FROM consorcio_expensas_unidades eu
        JOIN consorcio_unidades u ON eu.unidad_id = u.id
        WHERE eu.periodo_id = %s
        ORDER BY u.nombre_unidad
        """,
        (periodo_id,)
    )
    unidades_expensas = db.fetchall()
    
    return jsonify({
        'periodo': dict(periodo),
        'detalles': [dict(row) for row in unidades_expensas]
    })

# [POST] Registrar un pago para una expensa de unidad
@bp.route('/consorcio/expensas-unidades/<int:expensa_unidad_id>/registrar-pago', methods=['POST'])
@token_required
def registrar_pago_expensa(current_user, expensa_unidad_id):
    data = request.get_json()
    monto_pagado = data.get('monto_pagado')
    notas = data.get('notas_pago')
    
    if monto_pagado is None:
        return jsonify({'error': 'El monto pagado es obligatorio'}), 400
        
    db = get_db()
    
    # 1. Validar permisos de Admin
    db.execute(
        """
        SELECT p.negocio_id, eu.saldo_pendiente, eu.monto_total
        FROM consorcio_expensas_unidades eu
        JOIN consorcio_expensas_periodos p ON eu.periodo_id = p.id
        WHERE eu.id = %s
        """,
        (expensa_unidad_id,)
    )
    expensa = db.fetchone()
    if not expensa:
        return jsonify({'error': 'Registro de expensa no encontrado'}), 404
        
    error, status = check_consorcio_permission(expensa['negocio_id'], current_user)
    if error:
        return jsonify(error), status
        
    # 2. Calcular nuevo saldo
    try:
        monto_pagado = float(monto_pagado)
        saldo_anterior = float(expensa['saldo_pendiente'])
        nuevo_saldo = saldo_anterior - monto_pagado
        
        estado_pago = 'Pendiente'
        if nuevo_saldo <= 0:
            estado_pago = 'Pagado'
            nuevo_saldo = 0.0 # No guardar saldos negativos
        elif nuevo_saldo < float(expensa['monto_total']):
            estado_pago = 'Pago Parcial'

        # 3. Actualizar el registro
        db.execute(
            """
            UPDATE consorcio_expensas_unidades SET
                saldo_pendiente = %s,
                estado_pago = %s,
                fecha_pago = %s,
                notas_pago = %s
            WHERE id = %s
            """,
            (
                nuevo_saldo,
                estado_pago,
                datetime.datetime.now(datetime.timezone.utc),
                notas,
                expensa_unidad_id
            )
        )
        g.db_conn.commit()
        return jsonify({'message': 'Pago registrado con éxito'}), 200
        
    except Exception as e:
        g.db_conn.rollback()
        print(f"Error en registrar_pago_expensa: {e}")
        return jsonify({'error': str(e)}), 500

# [GET] Ver "Mis Expensas" (para inquilinos)
@bp.route('/consorcio/<int:negocio_id>/mis-expensas', methods=['GET'])
@token_required
def get_mis_expensas(current_user, negocio_id):
    db = get_db()
    
    # Esta ruta es para el inquilino
    db.execute(
        """
        SELECT 
            eu.id as expensa_unidad_id,
            p.periodo,
            p.fecha_vencimiento,
            u.nombre_unidad,
            eu.monto_total,
            eu.saldo_pendiente,
            eu.estado_pago
        FROM consorcio_expensas_unidades eu
        JOIN consorcio_expensas_periodos p ON eu.periodo_id = p.id
        JOIN consorcio_unidades u ON eu.unidad_id = u.id
        WHERE 
            p.negocio_id = %s
            AND p.estado = 'Emitido'
            AND (u.inquilino_id = %s OR u.propietario_id = %s)
        ORDER BY
            p.periodo DESC
        """,
        (negocio_id, current_user['id'], current_user['id'])
    )
    expensas = db.fetchall()
    return jsonify([dict(row) for row in expensas])