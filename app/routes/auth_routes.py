# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify, g
from app import get_cursor, bcrypt
import jwt
import datetime
from functools import wraps
import os

bp = Blueprint('auth', __name__)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401
        try:
            SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            db = get_cursor()
            db.execute('SELECT * FROM usuarios WHERE id = %s', (data['id'],))
            current_user = db.fetchone()
        except Exception as e:
            return jsonify({'message': 'Token inválido o expirado'}), 401
        if not current_user:
            return jsonify({'message': 'Token de usuario no encontrado'}), 401
        return f(dict(current_user), *args, **kwargs)
    return decorated

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('nombre') or not data.get('password'):
        return jsonify({'message': 'Credenciales incompletas'}), 401
    
    db = get_cursor()
    db.execute('SELECT * FROM usuarios WHERE email = %s', (data['nombre'],))
    user = db.fetchone()

    if not user or not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({'message': 'Usuario o contraseña incorrectos'}), 401

    SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    token = jwt.encode({
        'id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }, SECRET_KEY, algorithm="HS256")
    return jsonify({'token': token})