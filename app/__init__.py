import os
from flask import Flask, render_template, send_from_directory, safe_join, abort # <-- Añadir safe_join, abort

from .routes import facturacion_routes
from .extensions import bcrypt
from .database import close_db

def create_app():
    # static_url_path='' hace que /static/... no sea necesario, pero puede traer conflictos.
    # Es mejor dejar static_folder='static' y static_url_path='/static' (default)
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'una_clave_muy_secreta')
    bcrypt.init_app(app)
    app.teardown_appcontext(close_db)

    # --- Registro de Blueprints (sin cambios) ---
    from .routes import auth_routes, product_routes, negocios_routes, user_routes, \
                         clientes_routes, income_routes, sales_routes, category_routes, \
                         dashboard_routes, config_routes, caja_routes, report_routes, \
                         proveedor_routes, ajuste_caja_routes, presupuestos_routes, \
                         price_lists_routes, unidades_medida_routes, inventory_routes, \
                         historial_inventario_routes, precios_especificos_routes, mobile_routes, \
                         payments_routes # <-- Asegúrate de importar payments_routes
    blueprints = [
        (auth_routes.bp, '/api'), (product_routes.bp, '/api'), (negocios_routes.bp, '/api'),
        (user_routes.bp, '/api'), (clientes_routes.bp, '/api'), (income_routes.bp, '/api'),
        (sales_routes.bp, '/api'), (category_routes.bp, '/api'), (dashboard_routes.bp, '/api'),
        (config_routes.bp, '/api'), (caja_routes.bp, '/api'), (report_routes.bp, '/api'),
        (proveedor_routes.bp, '/api'), (ajuste_caja_routes.bp, '/api'), (presupuestos_routes.bp, '/api'),
        (facturacion_routes.bp, '/api'), (price_lists_routes.bp, '/api'), (unidades_medida_routes.bp, '/api'),
        (inventory_routes.bp,'/api'), (historial_inventario_routes.bp,'/api'), (precios_especificos_routes.bp,'/api'),
        (mobile_routes.bp, '/api/mobile'),
        (payments_routes.bp, '/api') # <-- Registrar el blueprint de pagos
    ]
    for bp, prefix in blueprints:
        app.register_blueprint(bp, url_prefix=prefix)

    # --- RUTAS PWA MÁS ROBUSTAS (ANTES DEL CATCH_ALL) ---
    @app.route('/manifest.json')
    def serve_manifest():
        try:
            # app.root_path es la carpeta 'app'. '../' sube a la raíz del proyecto.
            # safe_join construye la ruta de forma segura.
            root_dir = os.path.dirname(app.root_path) # Directorio padre de 'app'
            manifest_path = safe_join(root_dir, 'manifest.json')
            app.logger.info(f"Intentando servir manifest desde: {manifest_path}")
            if not os.path.exists(manifest_path):
                 app.logger.error("manifest.json no encontrado en la raíz del proyecto.")
                 abort(404)
            return send_from_directory(root_dir, 'manifest.json', mimetype='application/manifest+json')
        except Exception as e:
            app.logger.error(f"Error sirviendo manifest.json: {e}")
            abort(500) # Usar abort para errores internos

    @app.route('/service-worker.js')
    def serve_sw():
        try:
            root_dir = os.path.dirname(app.root_path)
            sw_path = safe_join(root_dir, 'service-worker.js')
            app.logger.info(f"Intentando servir Service Worker desde: {sw_path}")
            if not os.path.exists(sw_path):
                 app.logger.error("service-worker.js no encontrado en la raíz del proyecto.")
                 abort(404)
            # Servir con mimetype correcto y importante: deshabilitar caché del navegador para el SW
            response = send_from_directory(root_dir, 'service-worker.js', mimetype='application/javascript')
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        except Exception as e:
            app.logger.error(f"Error sirviendo service-worker.js: {e}")
            abort(500)
    # --- FIN DE RUTAS PWA ---

    # --- RUTA CATCH-ALL REVISADA ---
    # Captura explícitamente la raíz '/' y cualquier otra cosa que no sea API o PWA
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        # Ignorar explícitamente rutas que deberían manejar los blueprints o Flask
        # (Aunque Flask debería hacerlo solo, esto es una doble seguridad)
        if path.startswith('api/') or path.startswith('static/') or \
           path == 'manifest.json' or path == 'service-worker.js':
            app.logger.warn(f"Ruta '{path}' llegó a catch_all por error, devolviendo 404.")
            abort(404)
            
        # Para cualquier otra cosa (rutas de la SPA como /#proveedores), sirve index.html
        app.logger.debug(f"Ruta '{path}' no reconocida, sirviendo index.html.")
        # Usar render_template es más estándar para templates
        return render_template("index.html")

    return app

