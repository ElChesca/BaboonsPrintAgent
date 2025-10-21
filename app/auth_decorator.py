# app/auth_decorator.py
from functools import wraps
from flask import request, jsonify
import jwt
from app.database import get_db
import os # Es buena práctica obtener la SECRET_KEY de variables de entorno

# --- DECORADOR `@token_required` ACTUALIZADO ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # ✨ --- LOG 1: ¿Llega el decorador? --- ✨
        print("--- Token Decorator Triggered ---")
        # 1. Busca el token en el encabezado 'Authorization'
        if 'Authorization' in request.headers:
            # El formato es "Bearer <token>", así que separamos y tomamos la segunda parte
            print(f"Auth Header received: {auth_header}") # ✨ LOG 2
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                print("!!! ERROR: Auth Header malformed.") # ✨ LOG 3
                return jsonify({'message': 'Formato de token inválido. Debe ser "Bearer <token>"'}), 401

        # Si después de buscar no hay token, rechazamos
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401
        else:
            print("!!! ERROR: No Authorization Header.") # ✨ LOG 4
        if not token:
             print("!!! ERROR: Token is missing!") # ✨ LOG 5
             return jsonify({'message': 'Falta el token'}), 401
        
        try:
            # 2. Decodifica el token usando la SECRET_KEY
            # Es más seguro obtenerla de la configuración de la app
            # from flask import current_app
            # secret_key = current_app.config['SECRET_KEY']
            secret_key = os.environ.get('SECRET_KEY', 'tu-clave-secreta-larga-y-dificil')
            data = jwt.decode(token, secret_key, algorithms=["HS256"])
            
            # 3. Busca al usuario en la BD para asegurarse de que existe
            db = get_db()
            db.execute('SELECT * FROM usuarios WHERE id = %s', (data['id'],))
            current_user = db.fetchone()
            
            if not current_user:
                return jsonify({'message': 'Usuario del token no encontrado'}), 401

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'El token ha expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token inválido'}), 401
        except Exception as e:
            return jsonify({'message': f'Error procesando el token: {str(e)}'}), 500

        # 4. Pasa el usuario decodificado a la ruta
        return f(dict(current_user), *args, **kwargs)

    return decorated