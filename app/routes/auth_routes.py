# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from app import get_db, bcrypt
import jwt
import datetime
from functools import wraps
import os

bp = Blueprint('auth', __name__)

# --- Decorador de Token ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401
        try:
            SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            db = get_db()
            current_user = db.execute(
                'SELECT * FROM usuarios WHERE id = %s', # ✨ Cambio aquí
                (data['id'],)
            ).fetchone()
        except Exception as e:
            return jsonify({'message': 'Token inválido o expirado', 'error': str(e)}), 401
        return f(dict(current_user), *args, **kwargs)
    return decorated

# --- Rutas de Autenticación ---
@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        return jsonify({'message': 'No se pudieron verificar las credenciales'}), 401
    
    db = get_db()
    user = db.execute(
        'SELECT * FROM usuarios WHERE nombre = %s', # ✨ Cambio aquí
        (data['nombre'],)
    ).fetchone()

    if not user:
        return jsonify({'message': 'Usuario no encontrado'}), 401

    if bcrypt.check_password_hash(user['password'], data['password']):
        SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
        token = jwt.encode({
            'id': user['id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=60)
        }, SECRET_KEY, algorithm="HS256")
        
        return jsonify({'token': token})

    return jsonify({'message': 'Contraseña incorrecta'}), 401

# ATENCIÓN: BORRAR O COMENTAR ESTA RUTA DESPUÉS DE USARLA
@bp.route('/setup/create_admin/<username>/<password>', methods=['GET'])
def create_admin_temp(username, password):
    db_cursor = get_db()
    try:
        # Borramos el usuario anterior si existe, para empezar de cero limpio
        db_cursor.execute('DELETE FROM usuarios WHERE nombre = %s', (username,))
        
        # Creamos el hash usando la misma instancia de bcrypt de la aplicación
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        
        # Insertamos el nuevo usuario admin
        db_cursor.execute(
            'INSERT INTO usuarios (nombre, password, rol) VALUES (%s, %s, %s)',
            (username, hashed_password, 'admin')
        )
        # Importante: con psycopg2, el commit se hace sobre la conexión
        db_cursor.connection.commit()
        
        return jsonify({'message': f"Usuario '{username}' creado con éxito. ¡Ya puedes iniciar sesión!"}), 201
    except Exception as e:
        db_cursor.connection.rollback()
        return jsonify({'error': str(e)}), 500
