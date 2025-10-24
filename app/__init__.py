import os
from flask import Flask, render_template

from .routes import facturacion_routes
from .extensions import bcrypt
from .database import close_db

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'una_clave_muy_secreta')
    bcrypt.init_app(app)
    app.teardown_appcontext(close_db)

    from .routes import auth_routes, product_routes, negocios_routes, user_routes, \
                        clientes_routes, income_routes, sales_routes, category_routes, \
                        dashboard_routes, config_routes, caja_routes, report_routes, \
                        proveedor_routes, ajuste_caja_routes, presupuestos_routes, \
                        price_lists_routes, unidades_medida_routes, inventory_routes, \
                        historial_inventario_routes, precios_especificos_routes, mobile_routes
    blueprints = [
        (auth_routes.bp, '/api'), (product_routes.bp, '/api'), (negocios_routes.bp, '/api'),
        (user_routes.bp, '/api'), (clientes_routes.bp, '/api'), (income_routes.bp, '/api'),
        (sales_routes.bp, '/api'), (category_routes.bp, '/api'), (dashboard_routes.bp, '/api'),
        (config_routes.bp, '/api'), (caja_routes.bp, '/api'), (report_routes.bp, '/api'),
        (proveedor_routes.bp, '/api'), (ajuste_caja_routes.bp, '/api'), (presupuestos_routes.bp, '/api'),
        (facturacion_routes.bp, '/api'), (price_lists_routes.bp, '/api'), (unidades_medida_routes.bp, '/api'),
        (inventory_routes.bp,'/api'), (historial_inventario_routes.bp,'/api'), (precios_especificos_routes.bp,'/api'),
        (mobile_routes.bp, '/api/mobile')
        

    ]
    for bp, prefix in blueprints:
        app.register_blueprint(bp, url_prefix=prefix)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        return render_template("index.html")

    return app

