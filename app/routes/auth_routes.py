# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify, current_app, g
from app.database import get_db
from app.extensions import bcrypt
from app.auth_decorator import token_required
import jwt
import datetime
import os

bp = Blueprint('auth', __name__)


@bp.route('/health_db', methods=['GET'])
def health_db():
    try:
        db = get_db()
        # Verificar tipo de cursor/db
        db.execute("SELECT 1 as check_val")
        row = db.fetchone()
        
        # Verificar si es dict o tupla
        res_type = type(row).__name__
        # Si es RealDictRow, actúa como dict
        val = row['check_val'] if hasattr(row, '__getitem__') and 'check_val' in row else (row[0] if row else None)
        
        return jsonify({
            'status': 'ok',
            'db_result': val,
            'row_type': str(type(row)),
            'backend': 'Postgres' if os.environ.get("DATABASE_URL") else 'SQLite'
        })
    except Exception as e:
        import traceback
        return jsonify({'status': 'error', 'details': str(e), 'trace': traceback.format_exc()}), 500

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        return jsonify({'message': 'Credenciales incompletas'}), 401
    
    db = get_db()
    db.execute('SELECT * FROM usuarios WHERE email = %s', (data['nombre'],))
    user = db.fetchone()

    if not user or not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({'message': 'Usuario o contraseña incorrectos'}), 401

    if not user.get('activo', True):
        return jsonify({'message': 'Su cuenta ha sido desactivada. Contacte al administrador.'}), 403

    SECRET_KEY = current_app.config['SECRET_KEY']
    
    # --- ✨ VINCULACIÓN DE NEGOCIO PARA EL TOKEN ---
    vendedor_id = None
    negocio_id = None
    especialidad = None

    if user['rol'] == 'vendedor':
        # Buscamos primero en empleados para tener la especialidad real (Barman/Mozo)
        db.execute('SELECT id, negocio_id, rol FROM empleados WHERE email = %s', (user['email'],))
        emp_row = db.fetchone()
        if emp_row:
            negocio_id = emp_row['negocio_id']
            especialidad = emp_row['rol']
            empleado_id = emp_row['id']
        
        # Si no estaba en empleados o falta el negocio, probamos en vendedores (Legacy/Distribuidora)
        if not negocio_id:
            db.execute('SELECT id, negocio_id, especialidad_resto FROM vendedores WHERE email = %s AND negocio_id IS NOT NULL', (user['email'],))
            vendedor_row = db.fetchone()
            if vendedor_row:
                vendedor_id = vendedor_row['id']
                negocio_id = vendedor_row['negocio_id']
                if not especialidad:
                    especialidad = vendedor_row.get('especialidad_resto')

    # Si aún no tenemos negocio_id (ej: es admin/superadmin), buscamos el primero al que tenga acceso
    if not negocio_id:
        db.execute('SELECT negocio_id FROM usuarios_negocios WHERE usuario_id = %s LIMIT 1', (user['id'],))
        un_row = db.fetchone()
        if un_row:
            negocio_id = un_row['negocio_id']

    # If not vendedor but the usuario mismo tiene empleado_id
    empleado_id = user.get('empleado_id')
    
    # --- ✨ AUTO-VINCULACIÓN Y ESPECIALIDAD (Self-healing) ---
    if not empleado_id:
        db.execute('SELECT id, rol FROM empleados WHERE email = %s', (user['email'],))
        emp_row = db.fetchone()
        if emp_row:
            empleado_id = emp_row['id']
            # Priorizamos la especialidad del empleado si el rol de usuario es genérico
            if not especialidad or especialidad == 'vendedor':
                especialidad = emp_row.get('rol')
            db.execute('UPDATE usuarios SET empleado_id = %s WHERE id = %s', (empleado_id, user['id']))
            g.db_conn.commit()
    else:
        # Si ya teníamos empleado_id pero la especialidad es genérica o nula, la buscamos
        if not especialidad or especialidad == 'vendedor':
            db.execute('SELECT rol FROM empleados WHERE id = %s', (empleado_id,))
            emp_row = db.fetchone()
            if emp_row:
                especialidad = emp_row.get('rol')

    token_payload = {
        'id': user['id'],
        'rol': user['rol'],
        'especialidad': especialidad,
        'nombre': user['nombre'],
        'email': user['email'],
        'vendedor_id': vendedor_id,
        'empleado_id': empleado_id,
        'negocio_id': negocio_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }
    token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")
    
    return jsonify({'token': token})