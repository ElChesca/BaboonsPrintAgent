# app.py (el nuevo archivo en la raíz)
import os
from flask import Flask, render_template, g
from app.extensions import bcrypt
from app.database import close_connection

def create_app():
    # Ahora Flask busca /templates y /static desde la raíz del proyecto
    app = Flask(__name__) 
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu-clave-secreta')

    bcrypt.init_app(app)
    app.teardown_appcontext(close_connection)

    with app.app_context():
        # ✨ CORRECCIÓN CLAVE: La importación ahora empieza con "app."
        from app.routes import (
            auth_routes, product_routes, negocios_routes, user_routes, 
            clientes_routes, income_routes, sales_routes, category_routes,
            dashboard_routes, config_routes, caja_routes, report_routes, 
            proveedor_routes
        )
        # (Registro de blueprints sin cambios)
        app.register_blueprint(auth_routes.bp, url_prefix='/api')
        # ... etc

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        return render_template("index.html")

    return app