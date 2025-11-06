import os
# --- CAMBIO AQUÍ: Quitamos 'safe_join' ---
from flask import Flask, render_template, send_from_directory, abort 

from .routes import facturacion_routes
from .extensions import bcrypt
from .database import close_db

def create_app():
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'una_clave_muy_secreta')
    bcrypt.init_app(app)
    app.teardown_appcontext(close_db)

    # --- Registro de Blueprints ---
    from .routes import auth_routes, product_routes, negocios_routes, user_routes, \
                         clientes_routes, income_routes, sales_routes, category_routes, \
                         dashboard_routes, config_routes, caja_routes, report_routes, \
                         proveedor_routes, ajuste_caja_routes, presupuestos_routes, \
                         price_lists_routes, unidades_medida_routes, inventory_routes, \
                         historial_inventario_routes, precios_especificos_routes, mobile_routes, \
                         payments_routes, gastos_routes, consorcio_routes 
    blueprints = [
        (auth_routes.bp, '/api'), (product_routes.bp, '/api'), (negocios_routes.bp, '/api'),
        (user_routes.bp, '/api'), (clientes_routes.bp, '/api'), (income_routes.bp, '/api'),
        (sales_routes.bp, '/api'), (category_routes.bp, '/api'), (dashboard_routes.bp, '/api'),
        (config_routes.bp, '/api'), (caja_routes.bp, '/api'), (report_routes.bp, '/api'),
        (proveedor_routes.bp, '/api'), (ajuste_caja_routes.bp, '/api'), (presupuestos_routes.bp, '/api'),
        (facturacion_routes.bp, '/api'), (price_lists_routes.bp, '/api'), (unidades_medida_routes.bp, '/api'),
        (inventory_routes.bp,'/api'), (historial_inventario_routes.bp,'/api'), (precios_especificos_routes.bp,'/api'),
        (mobile_routes.bp, '/api/mobile'),(payments_routes.bp, '/api'), (gastos_routes.bp, '/api') ,
        (consorcio_routes.bp, '/api')
    ]
    for bp, prefix in blueprints:
        app.register_blueprint(bp, url_prefix=prefix)

    # --- RUTAS PWA SIN safe_join ---
    @app.route('/manifest.json')
    def serve_manifest():
        try:
            # app.root_path es la carpeta 'app'. os.path.dirname sube un nivel a la raíz del proyecto.
            root_dir = os.path.dirname(app.root_path) 
            app.logger.info(f"Intentando servir manifest desde directorio: {root_dir}")
            # send_from_directory es seguro y busca 'manifest.json' dentro de root_dir
            return send_from_directory(root_dir, 'manifest.json', mimetype='application/manifest+json')
        except FileNotFoundError: # Captura específica si el archivo no existe
             app.logger.error(f"manifest.json no encontrado en {root_dir}")
             abort(404)
        except Exception as e:
            app.logger.error(f"Error sirviendo manifest.json: {e}")
            abort(500) 

    @app.route('/service-worker.js')
    def serve_sw():
        try:
            root_dir = os.path.dirname(app.root_path)
            app.logger.info(f"Intentando servir Service Worker desde directorio: {root_dir}")
            # Servir con mimetype correcto y deshabilitar caché
            response = send_from_directory(root_dir, 'service-worker.js', mimetype='application/javascript')
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
            return response
        except FileNotFoundError:
             app.logger.error(f"service-worker.js no encontrado en {root_dir}")
             abort(404)
        except Exception as e:
            app.logger.error(f"Error sirviendo service-worker.js: {e}")
            abort(500)
    # --- FIN DE RUTAS PWA ---

    # --- RUTA CATCH-ALL REVISADA ---
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def catch_all(path):
        # Ignorar rutas que deberían manejar otros handlers
        if path.startswith('api/') or path.startswith('static/') or \
           path == 'manifest.json' or path == 'service-worker.js':
            app.logger.warn(f"Ruta '{path}' llegó a catch_all por error, devolviendo 404.")
            abort(404)
            
        app.logger.debug(f"Ruta '{path}' no reconocida, sirviendo index.html.")
        return render_template("index.html")

    print(app.url_map)
    return app

