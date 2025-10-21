# app/auth_decorator.py
from functools import wraps
from flask import request, jsonify
import jwt
import os # Necesario para leer la SECRET_KEY
# Asumo que tienes una forma de buscar el usuario, por ejemplo, en database.py
# from .database import get_db 

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Verifica si el encabezado de autorización existe
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                # Intenta extraer el token (asume formato 'Bearer [token]')
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'message': 'Token malformado'}), 401
        
        # Si no hay token después de verificar el encabezado
        if not token:
            return jsonify({'message': 'Falta el token'}), 401

        try:
            # Decodifica el token usando tu SECRET_KEY
            secret_key = os.environ.get('SECRET_KEY')
            if not secret_key:
                 # Es importante tener una SECRET_KEY configurada
                 return jsonify({'message': 'Error de configuración del servidor (SK)'}), 500
                 
            data = jwt.decode(token, secret_key, algorithms=["HS256"])
            
            # --- Opcional pero recomendado: Buscar el usuario en la BD ---
            # Para asegurar que el usuario todavía existe y obtener datos actualizados
            # db = get_db()
            # db.execute("SELECT id, nombre, rol FROM usuarios WHERE id = %s", (data['user_id'],)) # Asume que guardas user_id en el token
            # current_user = db.fetchone()
            # if not current_user:
            #     return jsonify({'message': 'Usuario del token no encontrado'}), 401
            # --- Fin Opcional ---
            
            # Si no buscas en DB, usa los datos del token directamente (menos seguro si borras usuarios)
            current_user = data # Asume que el token contiene 'id', 'rol', etc.

        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'El token ha expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Token inválido'}), 401
        except Exception as e:
             # Captura cualquier otro error inesperado durante la validación
             print(f"Error inesperado validando token: {e}") # Mantenemos un log por si acaso
             return jsonify({'message': 'Error al procesar el token'}), 500

        # Si todo está bien, llama a la función de la ruta original, pasando el usuario
        return f(dict(current_user), *args, **kwargs) # Convertimos a dict si viene de DB
    return decorated