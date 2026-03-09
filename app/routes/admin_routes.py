from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('admin_apps', __name__)

@bp.route('/admin/modules', methods=['GET'])
@token_required
def get_modules(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        db.execute("SELECT * FROM modules ORDER BY category, name")
        modules = db.fetchall()
        return jsonify([dict(m) for m in modules])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/permissions', methods=['GET'])
@token_required
def get_permissions(current_user):
    db = get_db()
    try:
        db.execute("SELECT * FROM type_permissions")
        permissions = db.fetchall()

        result = {}
        for p in permissions:
            tipo = p['business_type']
            if tipo not in result:
                result[tipo] = []
            result[tipo].append(p['module_code'])

        # ─────────────────────────────────────────────────────────────────────
        # AUTO-SEEDING: módulos faltantes por tipo de negocio
        # ─────────────────────────────────────────────────────────────────────

        # ── Distribuidora ────────────────────────────────────────────────────
        default_distri = [
            'home_distribuidora', 'vendedores', 'hoja_ruta', 'logistica', 'mapa_clientes',
            'clientes', 'ventas', 'caja', 'inventario', 'presupuestos',
            'proveedores', 'gastos', 'ingresos', 'dashboard', 'configuracion',
            'categorias', 'listas_precios', 'unidades_medida', 'usuarios', 'negocios',
            'historial_presupuestos', 'historial_ajustes', 'historial_pagos_proveedores',
            'historial_ingresos', 'empleados', 'home_chofer', 'historial_ventas',
            'pedidos', 'agente_facturacion', 'eventos', 'tickets'
        ]

        # ── Retail ───────────────────────────────────────────────────────────
        default_retail = [
            'home_retail', 'ventas', 'historial_ventas', 'factura', 'historial_presupuestos',
            'inventario', 'crm_social', 'reportes', 'reporte_caja', 'reporte_ganancias',
            'historial_inventario', 'clientes', 'caja', 'ajuste_caja', 'dashboard',
            'configuracion', 'categorias', 'listas_precios', 'unidades_medida', 'usuarios',
            'negocios', 'proveedores', 'gastos', 'gastos_categorias', 'ingresos',
            'historial_ajustes', 'historial_pagos_proveedores', 'historial_ingresos',
            'presupuestos', 'payments', 'precios_especificos', 'empleados', 'verificador',
            'pos', 'inventario_movil', 'club_puntos', 'club_gestion', 'club_admin',
            'agente_facturacion', 'eventos', 'tickets'
        ]

        def seed_type(business_type, defaults):
            existing = result.get(business_type, [])
            missing = [m for m in defaults if m not in existing]
            if missing:
                print(f"Auto-seeding permisos faltantes para '{business_type}': {missing}")
                for m in missing:
                    # Asegurar que el módulo existe en la tabla 'modules'
                    db.execute("SELECT 1 FROM modules WHERE code = %s", (m,))
                    if not db.fetchone():
                        name = m.replace('_', ' ').title()
                        category = 'Facturación' if 'factur' in m else \
                                   'Distribución' if m in ['vendedores', 'hoja_ruta', 'logistica', 'mapa_clientes', 'pedidos'] else \
                                   'Gestión' if m == 'eventos' else \
                                   'Otros'
                        db.execute(
                            "INSERT INTO modules (code, name, category) VALUES (%s, %s, %s)",
                            (m, name, category)
                        )
                    # Insertar el permiso
                    db.execute(
                        "INSERT INTO type_permissions (business_type, module_code) VALUES (%s, %s)",
                        (business_type, m)
                    )
                g.db_conn.commit()
                result[business_type] = defaults

        seed_type('distribuidora', default_distri)
        seed_type('retail', default_retail)

        return jsonify(result)
    except Exception as e:
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
        # 1. Borrar permisos existentes para ese tipo
        db.execute("DELETE FROM type_permissions WHERE business_type = %s", (business_type,))
        
        # 2. Insertar nuevos
        for module_code in modules:
            db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES (%s, %s)", (business_type, module_code))
        
        g.db_conn.commit()
        return jsonify({'message': 'Permisos actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- NUEVOS ENDPOINTS PARA PERMISOS POR ROL Y NEGOCIO ---

@bp.route('/negocios/<int:negocio_id>/permisos-rol/<string:rol>', methods=['GET'])
@token_required
def get_negocio_rol_permissions(current_user, negocio_id, rol):
    # Solo admin de ese negocio o superadmin
    if current_user['rol'] != 'superadmin':
        db = get_db()
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        db.execute("SELECT module_code FROM negocio_rol_permisos WHERE negocio_id = %s AND role = %s", (negocio_id, rol))
        rows = db.fetchall()
        return jsonify([r['module_code'] for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/permisos-rol/<string:rol>', methods=['POST'])
@token_required
def update_negocio_rol_permissions(current_user, negocio_id, rol):
    # Solo admin de ese negocio o superadmin
    if current_user['rol'] != 'superadmin':
        db = get_db()
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
             return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    modules = data.get('modules') # Lista de códigos de módulos

    if modules is None:
        return jsonify({'message': 'Datos incompletos'}), 400

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
@bp.route('/negocios/<int:negocio_id>/modulos-config', methods=['GET'])
@token_required
def get_negocio_modules_config(current_user, negocio_id):
    # Solo admin de ese negocio o superadmin
    if current_user['rol'] != 'superadmin':
        db = get_db()
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        # Por defecto, todos los módulos permitidos para el tipo de negocio están activos
        # Solo devolvemos los que están explícitamente desactivados para simplificar
        db.execute("SELECT module_code, is_active FROM negocio_modulos_config WHERE negocio_id = %s", (negocio_id,))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/modulos-config', methods=['POST'])
@token_required
def update_negocio_modules_config(current_user, negocio_id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    configs = data.get('configs', []) # Lista de {module_code, is_active}

    db = get_db()
    try:
        # 1. Limpiar configuración previa para este negocio
        db.execute("DELETE FROM negocio_modulos_config WHERE negocio_id = %s", (negocio_id,))
        
        # 2. Insertar nuevas reglas
        for cfg in configs:
            db.execute(
                "INSERT INTO negocio_modulos_config (negocio_id, module_code, is_active) VALUES (%s, %s, %s)",
                (negocio_id, cfg['module_code'], cfg['is_active'])
            )
        
        g.db_conn.commit()
        return jsonify({'message': 'Configuración de módulos actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
@bp.route('/admin/suscripciones', methods=['GET'])
@token_required
def get_admin_suscripciones(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        import datetime
        hoy = datetime.date.today()
        
        # Obtenemos todos los negocios y su último pago si existe
        db.execute("""
            SELECT 
                n.id, n.nombre, n.tipo_app, n.cuota_mensual, n.suscripcion_activa, n.fecha_alta,
                (SELECT mes FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
                (SELECT anio FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio,
                (SELECT fecha_registro FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as fecha_ultimo_pago,
                (SELECT COUNT(*) FROM suscripciones_pagos WHERE negocio_id = n.id) as pagos_contados
            FROM negocios n
            ORDER BY n.nombre
        """)
        negocios = db.fetchall()
        
        result = []
        for n in negocios:
            d = dict(n)
            deuda = 0
            meses_adeudados = 0
            
            if d['suscripcion_activa'] and d['fecha_alta']:
                # Calcular meses transcurridos desde fecha_alta hasta hoy
                start = d['fecha_alta']
                # Normalizamos al primer día para contar meses completos
                cur_year = start.year
                cur_month = start.month
                
                total_meses_obligatorios = 0
                while (cur_year < hoy.year) or (cur_year == hoy.year and cur_month <= hoy.month):
                    total_meses_obligatorios += 1
                    cur_month += 1
                    if cur_month > 12:
                        cur_month = 1
                        cur_year += 1
                
                meses_adeudados = max(0, total_meses_obligatorios - d['pagos_contados'])
                deuda = meses_adeudados * (d['cuota_mensual'] or 0)
            
            d['meses_adeudados'] = meses_adeudados
            d['deuda_acumulada'] = deuda
            result.append(d)

        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/suscripciones/registrar-pago', methods=['POST'])
@token_required
def registrar_pago_suscripcion(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    data = request.get_json()
    negocio_id = data.get('negocio_id')
    mes = data.get('mes')
    anio = data.get('anio')
    monto = data.get('monto', 0)

    if not negocio_id or not mes or not anio:
        return jsonify({'message': 'Datos incompletos'}), 400

    db = get_db()
    try:
        db.execute("""
            INSERT INTO suscripciones_pagos (negocio_id, mes, anio, monto, usuario_registro_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (negocio_id, mes, anio) DO UPDATE SET monto = EXCLUDED.monto
        """, (negocio_id, mes, anio, monto, current_user['id']))
        g.db_conn.commit()
        return jsonify({'message': 'Pago registrado correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:id>/pagos-historial', methods=['GET'])
@token_required
def get_negocio_pagos_historial(current_user, id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        db.execute("""
            SELECT sp.*, u.nombre as registrador
            FROM suscripciones_pagos sp
            LEFT JOIN usuarios u ON sp.usuario_registro_id = u.id
            WHERE sp.negocio_id = %s
            ORDER BY sp.anio DESC, sp.mes DESC
        """, (id,))
        pagos = db.fetchall()
        return jsonify([dict(p) for p in pagos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
