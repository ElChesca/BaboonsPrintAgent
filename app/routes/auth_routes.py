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
# En app/routes/auth_routes.py

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        return jsonify({'message': 'No se pudieron verificar las credenciales'}), 401

    db = get_db()
    # ✨ CAMBIO CLAVE: Buscamos por la columna 'email' usando el dato que llega como 'nombre'
    user = db.execute(
        'SELECT * FROM usuarios WHERE email = %s', 
        (data['nombre'],) # El frontend envía el email en la clave 'nombre'
    ).fetchone()

    if not user:
        return jsonify({'message': 'Usuario no encontrado'}), 401

    if bcrypt.check_password_hash(user['password'], data['password']):
        # ... (el resto de la función para generar el token no cambia)
        SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
        token = jwt.encode({
            'id': user['id'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=60)
        }, SECRET_KEY, algorithm="HS256")
        return jsonify({'token': token})

    return jsonify({'message': 'Contraseña incorrecta'}), 401
