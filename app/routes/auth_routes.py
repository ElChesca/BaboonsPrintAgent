# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from app.database import get_db
from app.extensions import bcrypt
from app.auth_decorator import token_required
import jwt
import datetime
import os

bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    # Corregido: buscar 'email' en lugar de 'nombre'
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Credenciales incompletas'}), 401
    
    db = get_db()
    # Corregido: usar data['email'] para la consulta y '?' para sqlite3
    db.execute('SELECT * FROM usuarios WHERE email = ?', (data['email'],))
    user = db.fetchone()

    if not user or not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({'message': 'Usuario o contraseña incorrectos'}), 401

    SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta')
    
    # --- ✨ CORRECCIÓN CLAVE AQUÍ ---
    # Añadimos el 'nombre' y 'rol' del usuario al contenido del token
    token_payload = {
        'id': user['id'],
        'rol': user['rol'],
        'nombre': user['nombre'], # <-- ESTA LÍNEA ES LA QUE FALTABA
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }
    token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")
    
    return jsonify({'token': token})