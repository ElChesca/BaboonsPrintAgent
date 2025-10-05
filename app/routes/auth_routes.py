# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from app.database import get_db
from app.extensions import bcrypt
import jwt
import datetime
import os


bp = Blueprint('auth', __name__)

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

    SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    token = jwt.encode({
        'id': user['id'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }, SECRET_KEY, algorithm="HS256")
    return jsonify({'token': token})