# app/__init__.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import Flask, g, send_from_directory
from .extensions import bcrypt # Asumo que tienes un archivo app/extensions.py con: from flask_bcrypt import Bcrypt; bcrypt = Bcrypt()

# --- LÓGICA DE LA BASE DE DATOS (AHORA ES FLEXIBLE) ---
def get_db():
    if 'db' not in g:
        # Si estamos en producción (Render), usamos la URL de PostgreSQL
        if 'DATABASE_URL' in os.environ:
            g.db = psycopg2.connect(os.environ['DATABASE_URL'])
            g.cursor = g.db.cursor(cursor_factory=psycopg2.extras.DictCursor)
        # Si estamos en local, usamos el archivo SQLite
        else:
            g.db = sqlite3.connect('inventario.db', detect_types=sqlite3.PARSE_DECLTYPES)
            g.db.row_factory = sqlite3.Row
            g.cursor = g.db.cursor()
    return g.cursor

def close_connection(e=None):
    cursor = g.pop('cursor', None)
    if cursor is not None:
        cursor.close()
    db = g.pop('db', None)
    if db is not None:
        db.close()

# --- FÁBRICA DE LA APLICACIÓN ---
def create_app():    
    app = Flask(__name__, static_folder='static') # Ajustamos la ruta de static
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    
    bcrypt.init_app(app)

    # ✨ El decorador se registra aquí, dentro de la función create_app
    app.teardown_appcontext(close_connection)

    # --- REGISTRO DE BLUEPRINTS ---
    with app.app_context():
        from .routes.auth_routes import bp as auth_blueprint
        from .routes.product_routes import bp as product_blueprint
        from .routes.negocios_routes import bp as negocio_blueprint
        from .routes.user_routes import bp as user_blueprint 
        from .routes.clientes_routes import bp as clientes_blueprint
        from .routes.income_routes import bp as income_blueprint
        from .routes.sales_routes import bp as sales_blueprint
        from .routes.category_routes import bp as category_blueprint
        from .routes.dashboard_routes import bp as dashboard_blueprint
        from .routes.config_routes import bp as config_blueprint
        from .routes.caja_routes import bp as caja_blueprint
        from .routes.report_routes import bp as report_blueprint    
        from .routes.proveedor_routes import bp as proveedor_blueprint
        
        app.register_blueprint(auth_blueprint, url_prefix='/api')
        app.register_blueprint(product_blueprint, url_prefix='/api')
        app.register_blueprint(negocio_blueprint, url_prefix='/api')
        app.register_blueprint(user_blueprint, url_prefix='/api')
        app.register_blueprint(clientes_blueprint, url_prefix='/api')
        app.register_blueprint(income_blueprint, url_prefix='/api')
        app.register_blueprint(sales_blueprint, url_prefix='/api')
        app.register_blueprint(category_blueprint, url_prefix='/api')
        app.register_blueprint(dashboard_blueprint, url_prefix='/api')
        app.register_blueprint(config_blueprint, url_prefix='/api')  
        app.register_blueprint(caja_blueprint, url_prefix='/api')
        app.register_blueprint(report_blueprint, url_prefix='/api')
        app.register_blueprint(proveedor_blueprint, url_prefix='/api')

   # --- RUTA PARA SERVIR EL FRONTEND ---     
# Dentro de create_app() en app/__init__.py
    @app.route('/')
    def serve_index():
        # Construimos una ruta absoluta al directorio raíz del proyecto
        root_dir = os.path.dirname(os.path.abspath(os.path.join(__file__, '..')))
        return send_from_directory(root_dir, 'index.html')

