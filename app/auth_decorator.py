# app/auth_decorator.py
from functools import wraps
import jwt
import os
from flask import request, jsonify
from app.database import get_db

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401
        try:
            SECRET_KEY = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            db = get_db()
            db.execute('SELECT * FROM usuarios WHERE id = %s', (data['id'],))
            current_user = db.fetchone()
        except Exception as e:
            return jsonify({'message': 'Token inválido o expirado'}), 401
        if not current_user:
            return jsonify({'message': 'Token de usuario no encontrado'}), 401
        return f(dict(current_user), *args, **kwargs)
    return decorated