# app/__init__.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import Flask, g, render_template
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

# --- FÁBRICA DE LA APLICACIÓN ---
def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    
    bcrypt.init_app(app)
    app.teardown_appcontext(close_connection)

    with app.app_context():
        from .routes import (
            auth_routes, product_routes, negocios_routes, user_routes, 
            clientes_routes, income_routes, sales_routes, category_routes,
            dashboard_routes, config_routes, caja_routes, report_routes, 
            proveedor_routes
            # ✨ 1. 'main_routes' ELIMINADO DE AQUÍ
        )
        app.register_blueprint(auth_routes.bp, url_prefix='/api')
        app.register_blueprint(product_routes.bp, url_prefix='/api')
        app.register_blueprint(negocios_routes.bp, url_prefix='/api')
        app.register_blueprint(user_routes.bp, url_prefix='/api')
        app.register_blueprint(clientes_routes.bp, url_prefix='/api')
        app.register_blueprint(income_routes.bp, url_prefix='/api')
        app.register_blueprint(sales_routes.bp, url_prefix='/api')
        app.register_blueprint(category_routes.bp, url_prefix='/api')
        app.register_blueprint(dashboard_routes.bp, url_prefix='/api')
        app.register_blueprint(config_routes.bp, url_prefix='/api')
        app.register_blueprint(caja_routes.bp, url_prefix='/api')
        app.register_blueprint(report_routes.bp, url_prefix='/api')
        app.register_blueprint(proveedor_routes.bp, url_prefix='/api')
        # ✨ 2. El registro de 'main_routes.bp' ELIMINADO DE AQUÍ

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        return render_template("index.html")

    return app