from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('empleados', __name__)

# --- CRUD EMPLEADOS ---

@bp.route('/empleados', methods=['GET'])
@token_required
def get_empleados(current_user):
    negocio_id = request.args.get('negocio_id')
    rol = request.args.get('rol')
    activo = request.args.get('activo')
    
    if not negocio_id:
        return jsonify({'error': 'Falta negocio_id'}), 400

    db = get_db()
    
    query = "SELECT * FROM empleados WHERE negocio_id = %s"
    params = [negocio_id]
    
    if rol:
        query += " AND rol = %s"
        params.append(rol)
        
    if activo is not None:
        is_active = activo.lower() == 'true'
        query += " AND activo = %s"
        params.append(is_active)
        
    query += " ORDER BY nombre ASC"
    
    try:
        db.execute(query, params)
        empleados = db.fetchall()
        return jsonify([dict(e) for e in empleados])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/empleados/unlinked', methods=['GET'])
@token_required
def get_unlinked_entities(current_user):
    """
    Devuelve usuarios y vendedores que NO están vinculados a ningún empleado.
    Útil para asociar una cuenta existente a un nuevo legajo de empleado.
    """
    negocio_id = request.args.get('negocio_id')
    if not negocio_id:
        return jsonify({'error': 'Falta negocio_id'}), 400

    db = get_db()
    try:
        # Usuarios no vinculados (rol != vendedor para evitar duplicados si ya existen en vendedores)
        # Ojo: Un usuario 'vendedor' podría estar en tabla usuarios y NO en vendedores? 
        # Asumimos que tabla usuarios es login, vendedores es la entidad de negocio.
        
        # Traer usuarios del negocio (vía usuarios_negocios para filtrar, si existiera esa relación directa o asumimos todos)
        # Simplificación: Traer usuarios que tengan rol admin/encargado/etc y empleado_id NULL
        # Como usuarios es global, filtrar por los que tienen acceso a este negocio es complejo sin join usuarios_negocios
        # SELECT u.id, u.nombre, u.email, u.rol FROM usuarios u JOIN usuarios_negocios un ON u.id = un.usuario_id WHERE un.negocio_id = ...
        
        db.execute("""
            SELECT u.id, u.nombre, u.email, u.rol 
            FROM usuarios u
            JOIN usuarios_negocios un ON u.id = un.usuario_id
            WHERE un.negocio_id = %s AND u.empleado_id IS NULL
            ORDER BY u.nombre
        """, (negocio_id,))
        usuarios = [dict(u) for u in db.fetchall()]

        # Traer vendedores del negocio con empleado_id NULL
        db.execute("""
            SELECT id, nombre, email, 'vendedor' as rol 
            FROM vendedores 
            WHERE negocio_id = %s AND empleado_id IS NULL
            ORDER BY nombre
        """, (negocio_id,))
        vendedores = [dict(v) for v in db.fetchall()]

        return jsonify({'usuarios': usuarios, 'vendedores': vendedores})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/empleados', methods=['POST'])
@token_required
def create_empleado(current_user):
    data = request.json
    db = get_db()
    
    # Flags de vinculación
    link_user_id = data.get('link_user_id')      # ID de tabla usuarios
    link_seller_id = data.get('link_seller_id')  # ID de tabla vendedores
    
    try:
        # 1. Insertar Empleado
        db.execute("""
            INSERT INTO empleados (
                negocio_id, nombre, apellido, dni, fecha_nacimiento, 
                direccion, telefono, email, fecha_ingreso, 
                estado_civil, hijos, contacto_emergencia_nombre, 
                contacto_emergencia_telefono, rol
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data['negocio_id'], data['nombre'], data['apellido'], data.get('dni'), data.get('fecha_nacimiento') or None,
            data.get('direccion'), data.get('telefono'), data.get('email'), data.get('fecha_ingreso') or None,
            data.get('estado_civil'), data.get('hijos', 0), data.get('contacto_emergencia_nombre'),
            data.get('contacto_emergencia_telefono'), data['rol']
        ))
        empleado_id = db.fetchone()['id']
        
        # 2. Lógica de Vinculación o Creación Automática
        
        if data['rol'] in ['mozo', 'cocinero', 'barman', 'dolce', 'adicionista', 'bachero']:
            if link_seller_id:
                # Vincular a vendedor existente y propagar especialidad
                db.execute("UPDATE vendedores SET empleado_id = %s, especialidad_resto = %s WHERE id = %s", (empleado_id, data['rol'], link_seller_id))
                print(f"🔗 Empleado {empleado_id} vinculado a Vendedor {link_seller_id} con especialidad {data['rol']}")
            else:
                # Crear nuevo vendedor automático con su especialidad Restó
                nombre_completo = f"{data['nombre']} {data['apellido']}"
                db.execute("""
                    INSERT INTO vendedores (negocio_id, nombre, telefono, email, activo, empleado_id, especialidad_resto)
                    VALUES (%s, %s, %s, %s, TRUE, %s, %s)
                    RETURNING id
                """, (data['negocio_id'], nombre_completo, data.get('telefono'), data.get('email'), empleado_id, data['rol']))
                new_vid = db.fetchone()['id']
                print(f"✨ Vendedor creado automáticamente (ID: {new_vid}) con ROl {data['rol']}")
        
        elif data['rol'] == 'vendedor':
            # Vendedor genérico (Retail)
            if link_seller_id:
                db.execute("UPDATE vendedores SET empleado_id = %s WHERE id = %s", (empleado_id, link_seller_id))
            else:
                nombre_completo = f"{data['nombre']} {data['apellido']}"
                db.execute("""
                    INSERT INTO vendedores (negocio_id, nombre, telefono, email, activo, empleado_id)
                    VALUES (%s, %s, %s, %s, TRUE, %s)
                """, (data['negocio_id'], nombre_completo, data.get('telefono'), data.get('email'), empleado_id))
        
        else:
            # Otros roles (admin, administrativo, deposito, chofer)
            if link_user_id:
                # Vincular a usuario existente
                db.execute("UPDATE usuarios SET empleado_id = %s WHERE id = %s", (empleado_id, link_user_id))
                print(f"🔗 Empleado {empleado_id} vinculado a Usuario existente {link_user_id}")


        db.connection.commit()
        return jsonify({'message': 'Empleado creado', 'id': empleado_id}), 201
        
    except Exception as e:
        db.connection.rollback()
        print(f"Error creating empleado: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/empleados/<int:id>', methods=['GET'])
@token_required
def get_empleado(current_user, id):
    db = get_db()
    db.execute("SELECT * FROM empleados WHERE id = %s", (id,))
    emp = db.fetchone()
    if not emp:
        return jsonify({'error': 'Empleado no encontrado'}), 404
    return jsonify(dict(emp))

@bp.route('/empleados/<int:id>', methods=['PUT'])
@token_required
def update_empleado(current_user, id):
    data = request.json
    db = get_db()
    
    try:
        db.execute("""
            UPDATE empleados SET 
                nombre=%s, apellido=%s, dni=%s, fecha_nacimiento=%s,
                direccion=%s, telefono=%s, email=%s, fecha_ingreso=%s,
                estado_civil=%s, hijos=%s, contacto_emergencia_nombre=%s,
                contacto_emergencia_telefono=%s, rol=%s
            WHERE id = %s
        """, (
            data['nombre'], data['apellido'], data.get('dni'), data.get('fecha_nacimiento') or None,
            data.get('direccion'), data.get('telefono'), data.get('email'), data.get('fecha_ingreso') or None,
            data.get('estado_civil'), data.get('hijos', 0), data.get('contacto_emergencia_nombre'),
            data.get('contacto_emergencia_telefono'), data['rol'], id
        ))
        
        # --- ✨ LÓGICA DE VINCULACIÓN POST-UPDATE ---
        # Si el email cambió o se actualizó, buscamos si existe un usuario con ese email
        # para asegurar que tengan el empleado_id vinculado.
        if data.get('email'):
            db.execute("UPDATE usuarios SET empleado_id = %s WHERE email = %s AND empleado_id IS NULL", (id, data['email']))
        
        # Propagar especialidad a vendedores vinculados
        db.execute("UPDATE vendedores SET especialidad_resto = %s WHERE empleado_id = %s", (data['rol'], id))
        
        db.connection.commit()
        return jsonify({'message': 'Empleado actualizado'})
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/empleados/<int:id>/activo', methods=['PUT'])
@token_required
def toggle_activo_empleado(current_user, id):
    data = request.json
    activo = data.get('activo', True)
    db = get_db()
    try:
        db.execute("UPDATE empleados SET activo = %s WHERE id = %s RETURNING id, rol", (activo, id))
        emp = db.fetchone()
        
        if emp and emp['rol'] == 'vendedor':
            db.execute("UPDATE vendedores SET activo = %s WHERE empleado_id = %s", (activo, id))
            
        db.connection.commit()
        return jsonify({'message': f"Empleado {'activado' if activo else 'desactivado'}"})
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500

# --- DOCUMENTACIÓN ---

@bp.route('/empleados/<int:id>/documentacion', methods=['GET'])
@token_required
def get_documentacion_empleado(current_user, id):
    db = get_db()
    try:
        db.execute("""
            SELECT * FROM documentacion 
            WHERE entity_type = 'empleado' AND entity_id = %s 
            ORDER BY fecha_vencimiento ASC
        """, (id,))
        docs = db.fetchall()
        return jsonify([dict(d) for d in docs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/empleados/<int:id>/documentacion', methods=['POST'])
@token_required
def add_documentacion_empleado(current_user, id):
    data = request.json
    db = get_db()
    try:
        db.execute("""
            INSERT INTO documentacion (entity_type, entity_id, tipo_documento, fecha_vencimiento, archivo_path, observaciones)
            VALUES ('empleado', %s, %s, %s, %s, %s)
            RETURNING id
        """, (id, data['tipo_documento'], data['fecha_vencimiento'], data.get('archivo_path'), data.get('observaciones')))
        new_id = db.fetchone()['id']
        
        db.connection.commit()
        return jsonify({'message': 'Documento agregado', 'id': new_id})
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500
