from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
from app.services.mercado_pago_service import MercadoPagoService
try:
    from psycopg2.extras import execute_values
except ImportError:
    execute_values = None

bp = Blueprint('admin_apps', __name__)

# Flag global para evitar sembrado redundante en cada request (Optimización Fly.io)
_modules_seeded = False  # resetear para forzar re-seed con nuevos módulos (resto_cocina standardized)

import time

def _ensure_modules_seeded(db):
    """Asegura que todos los módulos del ERP y sus permisos base existan (Regla 14)."""
    global _modules_seeded
    if _modules_seeded:
        return
    
    _modules_seeded = True
    start_time = time.time()
    print("⏳ [Seeding] Iniciando sincronización de catálogo de módulos (Optimizado)...")
    
    try:
        # ✨ MIGRACIÓN DE SALDOS DE INGRESOS (Safety Net - FORZADA)
        # Se ejecuta fuera del chequeo de módulos para asegurar integridad en cada inicio.
        db.execute("ALTER TABLE ingresos_mercaderia ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL DEFAULT 0")

        erp_catalogue = [
            # Administración
            ('tablero_control', 'Tablero de Control', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('negocios_gestion', 'Gestión de Locales/Negocios', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('usuarios', 'Gestión de Usuarios', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('configuracion_general', 'Configuración del Sistema', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('gastos', 'Gestión de Gastos', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('gastos_categorias', 'Categorías de Gastos', 'Administración', ['retail', 'distribuidora', 'resto']),
            ('empleados', 'Gestión de Empleados', 'Administración', ['retail', 'distribuidora', 'resto']),
            
            # Ventas
            ('ventas_nueva', 'Nueva Venta', 'Ventas', ['retail', 'distribuidora', 'resto']),
            ('pos', 'Caja Rápida (POS)', 'Ventas', ['retail', 'resto']),
            ('ventas_historial', 'Historial de Ventas', 'Ventas', ['retail', 'distribuidora', 'resto']),
            ('presupuestos', 'Generar Presupuesto', 'Ventas', ['retail', 'distribuidora', 'resto']),
            ('pedidos', 'Gestión de Pedidos', 'Ventas', ['retail', 'distribuidora']),
            ('historial_presupuestos', 'Historial de Presupuestos', 'Ventas', ['retail', 'distribuidora', 'resto']),
            
            # Compras & Abastecimiento
            ('proveedores', 'Gestión de Proveedores', 'Compras', ['retail', 'distribuidora', 'resto']),
            ('orden_compra', 'Órdenes de Compra', 'Compras', ['retail', 'distribuidora', 'resto']),
            ('ingresos', 'Ingreso de Mercadería', 'Compras', ['retail', 'distribuidora', 'resto']),
            ('cuentas_corrientes_proveedores', 'Cta. Cte. Proveedores', 'Compras', ['retail', 'distribuidora', 'resto']),
            ('historial_ingresos', 'Historial de Ingresos', 'Compras', ['retail', 'distribuidora', 'resto']),
            ('historial_pagos_proveedores', 'Historial Pagos Prov.', 'Compras', ['retail', 'distribuidora', 'resto']),
            
            # Inventario
            ('productos', 'Catálogo de Productos', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('stock_actual', 'Control de Stock', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('ajustes_stock', 'Ajustes Manuales', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('productos_categorias', 'Categorías de Productos', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('unidades_medida', 'Unidades de Medida', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('historial_inventario', 'Trazabilidad/Kardex', 'Inventario', ['retail', 'distribuidora', 'resto']),
            ('historial_ajustes', 'Historial de Ajustes', 'Inventario', ['retail', 'distribuidora', 'resto']),
            
            # Tesorería
            ('caja_control', 'Control de Caja', 'Tesorería', ['retail', 'distribuidora', 'resto']),
            ('caja_movimientos', 'Movimientos Manuales', 'Tesorería', ['retail', 'distribuidora', 'resto']),
            ('cuentas_corrientes_clientes', 'Cta. Cte. Clientes', 'Tesorería', ['retail', 'distribuidora', 'resto']),
            ('clientes_gestion', 'Gestión de Clientes', 'Tesorería', ['retail', 'distribuidora', 'resto']),
            ('cobro_ctacte', 'Cobro Cuenta Corriente', 'Tesorería', ['retail', 'distribuidora', 'resto']),
    
            # Logística (Distribuidora)
            ('hoja_ruta', 'Hojas de Ruta / Repartos', 'Logística', ['distribuidora']),
            ('repartidores', 'Gestión de Repartidores', 'Logística', ['distribuidora']),
            ('vendedores', 'Gestión de Vendedores', 'Logística', ['distribuidora']),
            ('mapa_clientes', 'Geolocalización Clientes', 'Logística', ['distribuidora']),
            ('logistica', 'Gestión de Flota', 'Logística', ['distribuidora']),
            
            # Gestión Restó
            ('salon_digital', 'Salón y Mesas', 'Gestión Restó', ['resto']),
            ('resto_mozo', 'POS de Mozos (Comandas)', 'Gestión Restó', ['resto']),
            ('resto_menu', 'Gestión de Carta', 'Gestión Restó', ['resto']),
            ('resto_cocina', 'Monitor de Cocina (KDS)', 'Gestión Restó', ['resto']),
            ('resto_bar', 'Monitor de Bar (KDS)', 'Gestión Restó', ['resto']),
            ('resto_dolce', 'Monitor de Postres (KDS)', 'Gestión Restó', ['resto']),
            ('reservas', 'Gestión de Reservas', 'Gestión Restó', ['resto']),
            ('mozos', 'Gestión de Mozos', 'Gestión Restó', ['resto']),
            ('resto_roles', 'Roles y Estaciones Restó', 'Gestión Restó', ['resto']),
            ('gestion_mesas', 'Adm. de Mesas', 'Gestión Restó', ['resto']),
            ('resto_stats', 'Estadísticas Restó', 'Gestión Restó', ['resto']),
            ('resto_impresoras', 'Adm. de Impresoras', 'Gestión Restó', ['resto']),
            ('gestion_destinos_kds', 'Gestión de Destinos KDS', 'Gestión Restó', ['resto']),
            
            # CRM & Marketing
            ('crm_social', 'CRM & Marketing Digital', 'Ventas', ['resto']),
            ('crm_contactos', 'CRM Contactos / Leads', 'Ventas', ['resto', 'distribuidora', 'retail']),
            ('agente_facturacion', 'Agente de Facturación (ARCA)', 'Administración', ['retail', 'distribuidora', 'resto']),
            
            # DASHBOARDS / HOMES
            ('home_retail', 'Home Retail', 'Dashboards', ['retail']),
            ('home_distribuidora', 'Home Distribuidora', 'Dashboards', ['distribuidora']),
            ('home_resto', 'Home Restó', 'Dashboards', ['resto']),
            ('negocio_roles', 'Roles y Permisos', 'Reglas', ['retail', 'distribuidora', 'resto', 'consorcio']),
            ('seller', 'App Vendedores Mobile', 'Operaciones', ['distribuidora', 'retail']),
            ('home_chofer', 'App Repartidores Mobile', 'Operaciones', ['distribuidora'])
        ]
        valid_codes = [item[0] for item in erp_catalogue]
        mod_values = [(item[0], item[1], item[2]) for item in erp_catalogue]
        
        # Optimización: Solo realizar purga e inserción si el conteo de módulos cambió
        db.execute("SELECT COUNT(*) as cnt FROM modules")
        current_count = db.fetchone()['cnt']
        if current_count == len(valid_codes):
            print("✅ [Seeding] Catálogo de módulos sincronizado. Saltando paso pesado.")
            return
        # 1. Purga masiva
        db.execute("DELETE FROM type_permissions WHERE module_code NOT IN %s", (tuple(valid_codes),))
        db.execute("DELETE FROM negocio_modulos_config WHERE module_code NOT IN %s", (tuple(valid_codes),))
        db.execute("DELETE FROM modules WHERE code NOT IN %s", (tuple(valid_codes),))

        # 1. Sincronización de módulos
        for code, name, cat in mod_values:
            db.execute("""
                INSERT INTO modules (code, name, category) 
                VALUES (%s, %s, %s)
                ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category
            """, (code, name, cat))

        # 2. Sincronización de permisos de tipo
        type_perms = []
        for code, _, _, allowed_types in erp_catalogue:
            for b_type in allowed_types:
                type_perms.append((b_type, code))
        
        for bt, mc in type_perms:
            db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES (%s, %s) ON CONFLICT DO NOTHING", (bt, mc))

        # 3. Migración de nombres antiguos en permisos de roles (Safety Net)
        old_codes = ['ingreso_mercaderia', 'ingresos_mercaderia', 'mercaderia_ingreso']
        db.execute("""
            UPDATE negocio_rol_permisos 
            SET module_code = 'ingresos' 
            WHERE module_code IN %s
        """, (tuple(old_codes),))

        # 4. Inserción masiva de configuración por negocio (Activar todos los módulos válidos para cada tipo)
        db.execute("""
            INSERT INTO negocio_modulos_config (negocio_id, module_code, is_active)
            SELECT n.id, tp.module_code, TRUE
            FROM negocios n
            JOIN type_permissions tp ON n.tipo_app = tp.business_type
            ON CONFLICT (negocio_id, module_code) DO NOTHING
        """)
        
    except Exception as e:
        _modules_seeded = False
        print(f"❌ [Seeding] Error: {e}")
        raise e
    finally:
        end_time = time.time()
        print(f"✅ [Seeding] Sincronización completada en {end_time - start_time:.4f} segundos.")

@bp.route('/admin/modules', methods=['GET'])
@token_required
def get_modules(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acceso denegado'}), 403

    db = get_db()
    try:
        _ensure_modules_seeded(db)
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
        _ensure_modules_seeded(db)
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
    db = get_db()
    # Si no es superadmin, verificar si el usuario pertenece a este negocio
    if current_user['rol'] != 'superadmin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403
    try:
        # Usamos LOWER para evitar problemas de mayúsculas/minúsculas entre el login y el ABM
        db.execute("SELECT module_code FROM negocio_rol_permisos WHERE negocio_id = %s AND LOWER(role) = LOWER(%s)", (negocio_id, rol))
        rows = db.fetchall()
        permissions = [r['module_code'] for r in rows]
        
        # 🚀 LÓGICA DE ROLES ESTÁNDAR Y REFUERZO (Safety Net)
        rol_norm = rol.lower().strip()
        
        # Obtener tipo de negocio para saber qué inyectar
        db.execute("SELECT tipo_app FROM negocios WHERE id = %s", (negocio_id,))
        negocio = db.fetchone()
        b_type = negocio['tipo_app'] if negocio else 'retail'

        # Solo inyectamos mínimos SI LA LISTA ESTÁ TOTALMENTE VACÍA (0 permisos)
        if not permissions:
            if 'bar' in rol_norm: permissions.extend(['resto_bar', 'home_resto', 'home_retail'])
            elif 'cocina' in rol_norm or 'cocinero' in rol_norm: permissions.extend(['resto_cocina', 'home_resto', 'home_retail'])
            elif 'dolce' in rol_norm or 'pastel' in rol_norm: permissions.extend(['resto_dolce', 'home_resto', 'home_retail'])
            elif 'mozo' in rol_norm: permissions.extend(['salon_digital', 'home_resto', 'home_retail', 'resto_mozo'])
            elif 'adicionista' in rol_norm: permissions.extend(['home_resto', 'home_retail'])

        # ✨ REFUERZO Y FALLBACK PARA DISTRIBUIDORAS
        if b_type == 'distribuidora':
            # Roles que consideramos 'de gestión'
            if rol_norm in ['admin', 'administrativo', 'vendedor', 'gerente', 'repartidor', 'driver']:
                # Si la lista está vacía, inyectamos el pack de supervivencia
                if not permissions:
                    # Permisos base comunes
                    base = ['home_distribuidora', 'negocio_roles', 'home_retail']
                    
                    if rol_norm == 'vendedor':
                        permissions = base + ['presupuestos', 'seller', 'pedidos', 'clientes_gestion']
                    elif rol_norm in ['driver', 'repartidor']:
                        permissions = base + ['hoja_ruta', 'home_chofer', 'clientes_gestion']
                    else:
                        permissions = base + ['pedidos', 'hoja_ruta', 'clientes_gestion', 'productos', 'caja_control', 'ventas_nueva']
                
                # Siempre aseguramos que tengan acceso a la gestión de roles si son admin/gerente/administrativo
                # para evitar que se bloqueen a sí mismos accidentalmente.
                if rol_norm in ['admin', 'gerente', 'administrativo']:
                    if 'negocio_roles' not in permissions:
                        permissions.append('negocio_roles')

        return jsonify(list(set(permissions)))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/permisos-rol-all', methods=['GET'])
@token_required
def get_negocio_all_rol_permissions(current_user, negocio_id):
    db = get_db()
    # Si no es superadmin, verificar si pertenece a este negocio
    if current_user['rol'] != 'superadmin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone(): return jsonify({'message': 'Acceso denegado'}), 403
    try:
        db.execute("SELECT role, module_code FROM negocio_rol_permisos WHERE negocio_id = %s", (negocio_id,))
        rows = db.fetchall()
        
        # Agrupar por rol (normalizando a minúsculas para consistencia)
        result = {}
        for r in rows:
            rol_key = r['role'].lower().strip()
            if rol_key not in result: result[rol_key] = []
            result[rol_key].append(r['module_code'])
            
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/permisos-rol/<string:rol>', methods=['POST'])
@token_required
def update_negocio_rol_permissions(current_user, negocio_id, rol):
    db = get_db()
    # Si no es superadmin, verificar si el usuario pertenece a este negocio
    if current_user['rol'] != 'superadmin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403
            
    data = request.get_json()
    modules = data.get('modules', [])
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
        # Asegurar que la tabla de pagos exista (Regla 14 de persistencia si fuera necesario, 
        # pero aquí es solo query. Si la tabla no existe fallará y detectaremos falta de migración).
        db.execute("""
            SELECT n.id, n.nombre, n.tipo_app, n.cuota_mensual, n.suscripcion_activa, n.fecha_alta,
            (SELECT mes FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_mes,
            (SELECT anio FROM suscripciones_pagos WHERE negocio_id = n.id ORDER BY anio DESC, mes DESC LIMIT 1) as ultimo_anio,
            (SELECT SUM(cuota_mensual) FROM negocios WHERE id = n.id) as deuda_simulada 
            -- Nota: Esto es un ejemplo, la deuda real requeriría lógica compleja de meses adeudados
            FROM negocios n ORDER BY n.nombre
        """)
        return jsonify([dict(n) for n in db.fetchall()])
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
    monto = data.get('monto')

    db = get_db()
    try:
        db.execute("""
            INSERT INTO suscripciones_pagos (negocio_id, mes, anio, monto, fecha_registro, registrado_por)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
        """, (negocio_id, mes, anio, monto, current_user['nombre']))
        g.db_conn.commit()
        return jsonify({'message': 'Pago registrado correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/admin/negocios/<int:negocio_id>/pagos-historial', methods=['GET'])
@token_required
def get_historial_pagos_suscripcion(current_user, negocio_id):
    db = get_db()
    # Si no es superadmin, verificar si el usuario pertenece a este negocio
    if current_user['rol'] != 'superadmin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], negocio_id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403
    try:
        db.execute("""
            SELECT mes, anio, monto, fecha_registro, registrado_por as registrador 
            FROM suscripciones_pagos WHERE negocio_id = %s ORDER BY anio DESC, mes DESC
        """, (negocio_id,))
        return jsonify([dict(r) for r in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- SUMMARY Y TEST MERCADO PAGO ---

@bp.route('/admin/init-context', methods=['GET'])
@token_required
def get_init_context(current_user):
    """
    ✨ UNIFICACIÓN DE CONTEXTO INICIAL (RE Pancho)
    Reduce de 5 a 1 el número de llamadas desde el Home al cargar.
    """
    db = get_db()
    try:
        start_time = time.time()
        # 1. Asegurar seeding (Solo una vez por worker)
        _ensure_modules_seeded(db)
        
        negocio_id = request.args.get('negocio_id')
        
        # 2. Cargar todos los Negocios asignados al usuario
        # (Si es superadmin ve todos, si no solo los suyos. Esto depende de la lógica de negocios_routes)
        # Para simplificar y mantener compatibilidad, llamamos a la misma lógica que /api/negocios
        db.execute("""
            SELECT n.id, n.nombre, n.tipo_app, n.logo_url 
            FROM negocios n
            JOIN usuarios_negocios un ON n.id = un.negocio_id
            WHERE un.usuario_id = %s
            ORDER BY n.nombre
        """, (current_user['id'],))
        negocios = [dict(n) for n in db.fetchall()]
        
        # Si no tiene negocios asignados y es superadmin, le damos todos
        if not negocios and current_user['rol'] == 'superadmin':
            db.execute("SELECT id, nombre, tipo_app, logo_url FROM negocios ORDER BY nombre")
            negocios = [dict(n) for n in db.fetchall()]

        # 3. Cargar Permisos Globales (Estructura de la App)
        db.execute("SELECT * FROM type_permissions")
        perms_rows = db.fetchall()
        permissions = {}
        for p in perms_rows:
            t = p['business_type']
            if t not in permissions: permissions[t] = []
            permissions[t].append(p['module_code'])

        # 4. Datos específicos del Negocio Activo (si se envió ID)
        business_info = {}
        if negocio_id:
            # Suscripción
            from app.routes.negocios_routes import get_status_suscripcion_internal
            business_info['suscripcion'] = get_status_suscripcion_internal(negocio_id)
            
            # Exclusiones de módulos
            db.execute("SELECT module_code, is_active FROM negocio_modulos_config WHERE negocio_id = %s", (negocio_id,))
            business_info['modulos_config'] = [dict(r) for r in db.fetchall()]
            
            # Estado de Caja (Detectamos abierta si fecha_cierre es NULL)
            db.execute("""
                SELECT id FROM caja_sesiones 
                WHERE negocio_id = %s AND fecha_cierre IS NULL
                ORDER BY fecha_apertura DESC LIMIT 1
            """, (negocio_id,))
            caja = db.fetchone()
            business_info['caja'] = {'id': caja['id'], 'estado': 'abierta'} if caja else {'estado': 'cerrada'}

        g.db_conn.commit()
        print(f"🚀 [Init] Contexto cargado en {time.time() - start_time:.4f}s")
        
        return jsonify({
            'user': {
                'id': current_user['id'],
                'nombre': current_user['nombre'],
                'rol': current_user['rol'],
                'especialidad': current_user.get('especialidad')
            },
            'negocios': negocios,
            'permissions_map': permissions,
            'business_active': business_info
        })
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
