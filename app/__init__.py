# app/__init__.py
import sqlite3
import os
from flask import Flask, g, send_from_directory
from .extensions import bcrypt # Importamos bcrypt desde el archivo de extensiones

# --- LÓGICA DE LA BASE DE DATOS ---
DATABASE_PATH = os.environ.get('DATABASE_PATH', 'inventario.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        # ✨ 3. Usa la nueva variable DATABASE_PATH aquí
        db = g._database = sqlite3.connect(DATABASE_PATH)
        db.row_factory = sqlite3.Row
    return db

def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# --- FÁBRICA DE LA APLICACIÓN (UNA SOLA VEZ) ---
def create_app():
    # Creamos la instancia de la aplicación
    app = Flask(__name__, static_folder='static')
    app.config['SECRET_KEY'] = 'tu-clave-secreta-larga-y-dificil'
    
    # Inicializamos las extensiones
    bcrypt.init_app(app)

    # Registramos las funciones de la base de datos
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

    # --- RUTAS PRINCIPALES ---
    @app.route('/')
    def serve_index():
        # index.html está en la raíz, un nivel "arriba" de la carpeta 'app'
        return send_from_directory('..', 'index.html')

    return app