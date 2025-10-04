# app/routes/auth_routes.py
from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
import datetime
# Correcto: bcrypt viene del nuevo archivo de extensiones
from app.extensions import bcrypt 
# Correcto: get_db viene del paquete principal 'app' (es decir, de __init__.py)
from app import get_db
# Creamos el Blueprint
bp = Blueprint('auth', __name__)

@bp.route('/login', methods=['POST'])
def login():
    auth = request.get_json()
    if not auth or not auth.get('email') or not auth.get('password'):
        return jsonify({'message': 'No se pudo verificar'}), 401

    db = get_db()
    user_row = db.execute('SELECT * FROM usuarios WHERE email = ?', (auth.get('email'),)).fetchone()

    if not user_row:
        return jsonify({'message': 'Usuario no encontrado'}), 401

    user = dict(user_row)
    # Usamos la instancia de bcrypt que importamos
    if bcrypt.check_password_hash(user['password'], auth.get('password')):
        # Necesitamos la secret_key, la obtenemos de la app actual
        from flask import current_app
        token = jwt.encode({
            'id': user['id'],
            'rol': user['rol'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, current_app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token})

    return jsonify({'message': 'Contraseña incorrecta'}), 401

# El decorador también lo podemos dejar aquí, ya que es parte de la autenticación
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401

        try:
            from flask import current_app
            data = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data 
        except:
            return jsonify({'message': 'Token inválido'}), 401

        return f(current_user, *args, **kwargs)
    return decorated