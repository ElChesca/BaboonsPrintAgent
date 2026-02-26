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

        # --- AUTO-SEEDING MEJORADO: Asegurar módulos y permisos para distribuidora ---
        default_distri = [
            'home_distribuidora', 'vendedores', 'hoja_ruta', 'logistica', 'mapa_clientes', 
            'clientes', 'ventas', 'caja', 'inventario', 'presupuestos', 
            'proveedores', 'gastos', 'ingresos', 'dashboard', 'configuracion', 
            'categorias', 'listas_precios', 'unidades_medida', 'usuarios', 'negocios',
            'historial_presupuestos', 'historial_ajustes', 'historial_pagos_proveedores', 
            'historial_ingresos', 'empleados', 'home_chofer', 'historial_ventas'
        ]
        distri_perms = result.get('distribuidora', [])
        
        missing_perms = [m for m in default_distri if m not in distri_perms]
        
        if missing_perms:
            from flask import g
            print(f"Detectados permisos faltantes para distribuidora: {missing_perms}")
            for m in missing_perms:
                # Asegurar que el módulo existe en la tabla 'modules'
                db.execute("SELECT 1 FROM modules WHERE code = %s", (m,))
                if not db.fetchone():
                    name = m.replace('_', ' ').title()
                    category = 'Distribución' if m in ['vendedores', 'hoja_ruta', 'logistica', 'mapa_clientes'] else 'Otros'
                    db.execute("INSERT INTO modules (code, name, category) VALUES (%s, %s, %s)", (m, name, category))
                
                # Insertar el permiso
                db.execute("INSERT INTO type_permissions (business_type, module_code) VALUES ('distribuidora', %s)", (m,))
            
            g.db_conn.commit()
            result['distribuidora'] = default_distri  # Actualizar resultado local
        
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
