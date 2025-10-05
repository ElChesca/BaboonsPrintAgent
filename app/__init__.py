# app/__init__.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import Flask, g, send_from_directory 
from .extensions import bcrypt

# --- LÓGICA DE LA BASE DE DATOS ---
def get_db_conn():
    if 'db_conn' not in g:
        if 'DATABASE_URL' in os.environ:
            g.db_conn = psycopg2.connect(os.environ['DATABASE_URL'])
        else:
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'inventario.db')
            g.db_conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
            g.db_conn.row_factory = sqlite3.Row
    return g.db_conn

def get_db():
    if 'db_cursor' not in g:
        conn = get_db_conn()
        if isinstance(conn, psycopg2.extensions.connection):
            g.db_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        else:
            g.db_cursor = conn.cursor()
    return g.db_cursor

def close_connection(e=None):
    cursor = g.pop('db_cursor', None)
    if cursor is not None:
        cursor.close()
    conn = g.pop('db_conn', None)
    if conn is not None:
        conn.close()

# --- FÁBRICA DE LA APLICACIÓN ---# --- FÁBRICA DE LA APLICACIÓN ---
def create_app():
    # ✨ 2. Definimos la app apuntando a la carpeta 'static'
    app = Flask(__name__, static_folder='static')
    
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    
    bcrypt.init_app(app)
    app.teardown_appcontext(close_connection)

    # --- REGISTRO DE BLUEPRINTS (Sin cambios) ---
    with app.app_context():
        from .routes import (
            auth_routes, product_routes, negocios_routes, user_routes, 
            clientes_routes, income_routes, sales_routes, category_routes,
            dashboard_routes, config_routes, caja_routes, report_routes, 
            proveedor_routes
        )
        # (El registro de todos los blueprints se queda igual)
        app.register_blueprint(auth_routes.bp, url_prefix='/api')
        # etc...
        app.register_blueprint(proveedor_routes.bp, url_prefix='/api')

    # --- RUTA PARA SERVIR EL FRONTEND ---
    # ✨ 3. Volvemos a la lógica que sirve archivos estáticos
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        # Si la ruta pedida es un archivo que existe en 'static' (como main.js, style.css), lo sirve.
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        # Para cualquier otra ruta, sirve el index.html (para que el router de JS funcione).
        else:
            return send_from_directory(app.static_folder, 'index.html')

    return app