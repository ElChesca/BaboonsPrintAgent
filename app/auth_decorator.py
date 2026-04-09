from functools import wraps
from flask import request, jsonify, current_app
import jwt
import os 

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # 0. Ignorar validación para peticiones OPTIONS (CORS preflight)
        if request.method == 'OPTIONS':
            return '', 200

        token = None
        
        # 1. Intenta obtener el token del encabezado Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token malformado'}), 401
        
        # 2. ✨ SI NO HAY TOKEN EN HEADER, LO BUSCA EN LA URL (Para el Stream SSE)
        elif 'token' in request.args:
            token = request.args.get('token')
        
        # Si después de ambas verificaciones no hay nada...
        if not token:
            return jsonify({'message': 'Falta el token'}), 401

        try:
            secret_key = current_app.config.get('SECRET_KEY')
            if not secret_key:
                return jsonify({'message': 'Error de configuración del servidor (SK)'}), 500
                 
            # Decodifica usando la clave secreta
            data = jwt.decode(token, secret_key, algorithms=["HS256"])
            
            # Usamos los datos del token directamente como venías haciendo
            current_user = data 

            # Validación de contenido básico
            if not current_user or 'id' not in current_user:
                return jsonify({'message': 'El contenido del token es inválido'}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'El token ha expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token inválido'}), 401
        except Exception as e:
            import sys
            print(f"Error inesperado validando token: {e}", file=sys.stderr)
            return jsonify({'message': 'Error al procesar el token'}), 500

        # Importante: pasamos los datos del usuario a la función original
        return f(dict(current_user), *args, **kwargs)
        
    return decorated