# app/__init__.py
import os
from flask import Flask, render_template
from .extensions import bcrypt
from .database import close_connection, get_db

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta-para-desarrollo')
    
    bcrypt.init_app(app)
    app.teardown_appcontext(close_connection)

    with app.app_context():
        # Asegúrate de que todos tus archivos de rutas estén aquí
        from .routes import (
            auth_routes, product_routes, negocios_routes, user_routes, 
            clientes_routes, income_routes, sales_routes, category_routes,
            dashboard_routes, config_routes, caja_routes, report_routes, 
            proveedor_routes
        )
        # Registra todos los blueprints
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

    # Ruta "catch-all" para servir la aplicación de página única
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        return render_template("index.html")

    return app