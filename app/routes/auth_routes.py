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
# app/routes/auth_routes.py

@bp.route('/login', methods=['POST'])
def login():
    print("\n--- INTENTO DE LOGIN RECIBIDO ---")
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        print("Error: Faltan datos en la petición (nombre o password).")
        return jsonify({'message': 'No se pudieron verificar las credenciales'}), 401
    
    nombre_usuario = data.get('nombre')
    password_usuario = data.get('password')
    print(f"Buscando al usuario: '{nombre_usuario}'")
    db = get_db()
    
    try:
        db.execute(
            'SELECT * FROM usuarios WHERE nombre = %s',
            (nombre_usuario,)
        )
        user = db.fetchone()
    except Exception as e:
        # Esto nos dirá si la consulta SQL tiene un error de sintaxis (como usar '?' en vez de '%s')
        print(f"!!!!!!!! ERROR DE SQL AL BUSCAR USUARIO: {str(e)}")
        return jsonify({'message': 'Error en la base de datos'}), 500

    if not user:
        print("RESULTADO: Usuario no encontrado en la base de datos.")
        return jsonify({'message': 'Usuario no encontrado'}), 401

    print("Usuario encontrado. Verificando contraseña...")
    user_dict = dict(user)

    try:
        if bcrypt.check_password_hash(user_dict['password'], password_usuario):
            print("RESULTADO: ¡Contraseña CORRECTA!")
            SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
            token = jwt.encode({
                'id': user_dict['id'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=60)
            }, SECRET_KEY, algorithm="HS256")
            
            return jsonify({'token': token})
        else:
            print("RESULTADO: Contraseña INCORRECTA.")
            return jsonify({'message': 'Contraseña incorrecta'}), 401
    except Exception as e:
        print(f"!!!!!!!! ERROR EN BCRYPT: {str(e)}")
        return jsonify({'message': 'Error al verificar contraseña'}), 500