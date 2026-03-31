from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
from app.services.mercado_pago_service import MercadoPagoService

bp = Blueprint('admin_apps', __name__)

@bp.route('/admin/modules', methods=['GET'])
@token_required
def get_modules(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        # Asegurar que el nuevo módulo de reservas exista
        db.execute("SELECT code FROM modules WHERE code = 'reservas'")
        if not db.fetchone():
            db.execute("INSERT INTO modules (code, name, category) VALUES ('reservas', 'Reservas de Mesas', 'Gestión Restó')")
            db.execute("SELECT 1 FROM type_permissions WHERE business_type = 'resto' AND module_code = 'reservas'")
            if not db.fetchone():
                db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES ('resto', 'reservas')")
            g.db_conn.commit()

        db.execute("SELECT * FROM modules ORDER BY category, name")
        modules = db.fetchall()
        return jsonify([dict(m) for m in modules])
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/permissions', methods=['GET'])
@token_required
def get_permissions(current_user):
    db = get_db()
    try:
        # --- AUTO-SEED DE MÓDULOS (Regla 14) ---
        
        # 1. Reservas
        db.execute("SELECT code FROM modules WHERE code = 'reservas'")
        if not db.fetchone():
            db.execute("INSERT INTO modules (code, name, category) VALUES ('reservas', 'Reservas de Mesas', 'Gestión Restó')")
            db.execute("SELECT 1 FROM type_permissions WHERE business_type = 'resto' AND module_code = 'reservas'")
            if not db.fetchone():
                db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES ('resto', 'reservas')")
        
        # 2. Eventos (Disponible en varios tipos)
        db.execute("SELECT code FROM modules WHERE code = 'eventos'")
        if not db.fetchone():
            db.execute("INSERT INTO modules (code, name, category) VALUES ('eventos', 'Gestión de Eventos', 'Gestión')")
            for b_type in ['retail', 'distribuidora', 'resto']:
                db.execute("SELECT 1 FROM type_permissions WHERE business_type = %s AND module_code = 'eventos'", (b_type,))
                if not db.fetchone():
                    db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES (%s, 'eventos')", (b_type,))

        # 3. Resto Stats
        db.execute("SELECT code FROM modules WHERE code = 'resto_stats'")
        if not db.fetchone():
            db.execute("INSERT INTO modules (code, name, category) VALUES ('resto_stats', 'Estadísticas Restó', 'Gestión Restó')")
            db.execute("SELECT 1 FROM type_permissions WHERE business_type = 'resto' AND module_code = 'resto_stats'")
            if not db.fetchone():
                db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES ('resto', 'resto_stats')")

        # 4. Presupuestos en Restó (✨ Ref. Solicitud Usuario)
        for m_code in ['presupuestos', 'historial_presupuestos']:
            db.execute("SELECT 1 FROM type_permissions WHERE business_type = 'resto' AND module_code = %s", (m_code,))
            if not db.fetchone():
                db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES ('resto', %s)", (m_code,))
        
        g.db_conn.commit()

        db.execute("SELECT * FROM type_permissions")
        permissions = db.fetchall()

        result = {}
        for p in permissions:
            tipo = p['business_type']
            if tipo not in result:
                result[tipo] = []
            result[tipo].append(p['module_code'])

        return jsonify(result)
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/permissions', methods=['POST'])
@token_required
def update_permissions(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    business_type = data.get('business_type')
    modules = data.get('modules') # Lista de códigos de módulos

    if not business_type or modules is None:
        return jsonify({'message': 'Datos incompletos'}), 400

    db = get_db()
    try:
        db.execute("DELETE FROM type_permissions WHERE business_type = %s", (business_type,))
        for module_code in modules:
            db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES (%s, %s)", (business_type, module_code))
        g.db_conn.commit()
        return jsonify({'message': 'Permisos actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- PERMISOS POR ROL Y NEGOCIO ---

@bp.route('/admin/negocios/<int:negocio_id>/permisos-rol/<string:rol>', methods=['GET'])
@token_required
def get_negocio_rol_permissions(current_user, negocio_id, rol):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    db = get_db()
    try:
        db.execute("SELECT module_code FROM negocio_rol_permisos WHERE negocio_id = %s AND role = %s", (negocio_id, rol))
        rows = db.fetchall()
        return jsonify([r['module_code'] for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/permisos-rol/<string:rol>', methods=['POST'])
@token_required
def update_negocio_rol_permissions(current_user, negocio_id, rol):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    modules = data.get('modules')
    db = get_db()
    try:
        db.execute("DELETE FROM negocio_rol_permisos WHERE negocio_id = %s AND role = %s", (negocio_id, rol))
        for m in modules:
            db.execute("INSERT INTO negocio_rol_permisos (negocio_id, role, module_code) VALUES (%s, %s, %s)", (negocio_id, rol, m))
        g.db_conn.commit()
        return jsonify({'message': 'Permisos de rol actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- CONFIGURACIÓN DE MÓDULOS ---

@bp.route('/admin/negocios/<int:negocio_id>/modulos-config', methods=['GET'])
@token_required
def get_negocio_modules_config(current_user, negocio_id):
    # Ya no restringimos a superadmin para el GET, para que el frontend pueda cargar permisos
    db = get_db()
    try:
        db.execute("SELECT module_code, is_active FROM negocio_modulos_config WHERE negocio_id = %s", (negocio_id,))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/modulos-config', methods=['POST'])
@token_required
def update_negocio_modules_config(current_user, negocio_id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    data = request.get_json()
    configs = data.get('configs', [])
    db = get_db()
    try:
        db.execute("DELETE FROM negocio_modulos_config WHERE negocio_id = %s", (negocio_id,))
        for cfg in configs:
            db.execute("INSERT INTO negocio_modulos_config (negocio_id, module_code, is_active) VALUES (%s, %s, %s)", (negocio_id, cfg['module_code'], cfg['is_active']))
        g.db_conn.commit()
        return jsonify({'message': 'Configuración de módulos actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- SUSCRIPCIONES ---

@bp.route('/admin/suscripciones', methods=['GET'])
@token_required
def get_admin_suscripciones(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    db = get_db()
    try:
        db.execute("""
            SELECT n.id, n.nombre, n.tipo_app, n.cuota_mensual, n.suscripcion_activa, n.fecha_alta,
            (SELECT mes FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio
            FROM negocios n ORDER BY n.nombre
        """)
        return jsonify([dict(n) for n in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- SUMMARY Y TEST MERCADO PAGO ---

@bp.route('/admin/negocios/summary', methods=['GET'])
@token_required
def get_negocios_summary(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    db = get_db()
    try:
        # Una sola consulta optimizada: obtenemos los datos base y verificamos si 
        # existen AMBAS claves de configuración en la tabla configuraciones.
        db.execute("""
            SELECT n.id, n.nombre, n.tipo_app, n.logo_url, n.acceso_bloqueado, n.suscripcion_activa,
            COUNT(DISTINCT CASE WHEN c.clave IN ('mp_access_token', 'mp_device_id') 
                               AND c.valor IS NOT NULL AND TRIM(c.valor) != '' 
                          THEN c.clave END) = 2 as mp_configured
            FROM negocios n
            LEFT JOIN configuraciones c ON n.id = c.negocio_id
            GROUP BY n.id, n.nombre, n.tipo_app, n.logo_url, n.acceso_bloqueado, n.suscripcion_activa
            ORDER BY n.nombre
        """)
        return jsonify([dict(n) for n in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/mp-test', methods=['GET'])
@token_required
def test_negocio_mp(current_user, negocio_id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403
    manual_token = request.headers.get('X-MP-Token')
    mp_service = MercadoPagoService(negocio_id)
    if manual_token:
        mp_service.access_token = manual_token
    return jsonify(mp_service.test_connection())
