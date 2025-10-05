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
# app/routes/auth_routes.py
# ... (el resto de tus funciones va aquí arriba) ...

# --- ✨ RUTA DE DIAGNÓSTICO TEMPORAL ---
# ATENCIÓN: BORRAR O COMENTAR ESTA RUTA DESPUÉS DE USARLA
@bp.route('/debug-login/<username>/<password>')
def debug_login(username, password):
    print("--- INICIANDO DIAGNÓSTICO DE LOGIN ---")
    
    try:
        db_cursor = get_db()
        print("PASO 1: Conexión a la base de datos obtenida.")

        # Buscamos al usuario
        print(f"PASO 2: Buscando usuario '{username}' en la base de datos...")
        db_cursor.execute('SELECT * FROM usuarios WHERE nombre = %s', (username,))
        user = db_cursor.fetchone()

        if not user:
            print("PASO 3: ¡FALLO! Usuario no encontrado.")
            return jsonify({'resultado': 'Usuario no encontrado'}), 404
        
        print("PASO 3: ¡ÉXITO! Usuario encontrado.")
        user_dict = dict(user)
        print(f"PASO 4: Datos del usuario recuperados. Hash guardado: {user_dict.get('password')}")

        # Comparamos la contraseña
        print(f"PASO 5: Comparando la contraseña proporcionada ('{password}') con el hash guardado...")
        password_matches = bcrypt.check_password_hash(user_dict['password'], password)

        if password_matches:
            print("PASO 6: ¡ÉXITO! Las contraseñas coinciden.")
            return jsonify({'resultado': 'Login exitoso', 'usuario': user_dict['nombre']})
        else:
            print("PASO 6: ¡FALLO! Las contraseñas NO coinciden.")
            return jsonify({'resultado': 'Contraseña incorrecta'}), 401

    except Exception as e:
        print(f"--- ERROR INESPERADO DURANTE EL DIAGNÓSTICO ---")
        print(str(e))
        return jsonify({'error': str(e)}), 500