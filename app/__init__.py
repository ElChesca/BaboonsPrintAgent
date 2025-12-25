import os
from flask import Flask, render_template, send_from_directory, abort, request, render_template_string 


from .routes import facturacion_routes
from .extensions import bcrypt
from .database import close_db, get_db
from flask_mail import Mail, Message

mail = Mail()


def create_app():
    # Nota: Si tu carpeta static está fuera, Flask a veces necesita saberlo, 
    # pero para servir archivos manualmente como haremos abajo, esto funcionará igual.
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'una_clave_muy_secreta')
    bcrypt.init_app(app)
    app.teardown_appcontext(close_db)

    # Configuración de MAIL de Baboons
    app.config['MAIL_SERVER'] = 'mail.baboons.com.ar'
    app.config['MAIL_PORT'] = 465
    app.config['MAIL_USE_SSL'] = True  # cPanel recomienda SSL para el puerto 465
    app.config['MAIL_USE_TLS'] = False # SSL y TLS no suelen ir juntos en el 465
    app.config['MAIL_USERNAME'] = 'info@baboons.com.ar'
    app.config['MAIL_PASSWORD'] = 'Nahufedelu00'
    app.config['MAIL_DEFAULT_SENDER'] = ('La Kosleña Club', 'info@baboons.com.ar')
        
    mail.init_app(app)

    # --- Registro de Blueprints ---
    from .routes import auth_routes, product_routes, negocios_routes, user_routes, \
                        clientes_routes, income_routes, sales_routes, category_routes, \
                        dashboard_routes, config_routes, caja_routes, report_routes, \
                        proveedor_routes, ajuste_caja_routes, presupuestos_routes, \
                        price_lists_routes, unidades_medida_routes, inventory_routes, \
                        historial_inventario_routes, precios_especificos_routes, mobile_routes, \
                        payments_routes, gastos_routes, consorcio_routes, club_puntos_routes 
    blueprints = [
        (auth_routes.bp, '/api'), (product_routes.bp, '/api'), (negocios_routes.bp, '/api'),
        (user_routes.bp, '/api'), (clientes_routes.bp, '/api'), (income_routes.bp, '/api'),
        (sales_routes.bp, '/api'), (category_routes.bp, '/api'), (dashboard_routes.bp, '/api'),
        (config_routes.bp, '/api'), (caja_routes.bp, '/api'), (report_routes.bp, '/api'),
        (proveedor_routes.bp, '/api'), (ajuste_caja_routes.bp, '/api'), (presupuestos_routes.bp, '/api'),
        (facturacion_routes.bp, '/api'), (price_lists_routes.bp, '/api'), (unidades_medida_routes.bp, '/api'),
        (inventory_routes.bp,'/api'), (historial_inventario_routes.bp,'/api'), (precios_especificos_routes.bp,'/api'),
        (mobile_routes.bp, '/api/mobile'),(payments_routes.bp, '/api'), (gastos_routes.bp, '/api'),
        (consorcio_routes.bp, '/api'),(club_puntos_routes.bp, '/api/club')
        
        
    ]
    for bp, prefix in blueprints:
        app.register_blueprint(bp, url_prefix=prefix)

    # --- RUTAS PWA ---
    @app.route('/manifest.json')
    def serve_manifest():
        try:
            root_dir = os.path.dirname(app.root_path) 
            return send_from_directory(root_dir, 'manifest.json', mimetype='application/manifest+json')
        except FileNotFoundError:
             abort(404)
        except Exception as e:
            abort(500) 

    @app.route('/service-worker.js')
    def serve_sw():
        try:
            root_dir = os.path.dirname(app.root_path)
            response = send_from_directory(root_dir, 'service-worker.js', mimetype='application/javascript')
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            return response
        except FileNotFoundError:
             abort(404)
        except Exception as e:
            abort(500)

    # =================================================================
    # ✨ NUEVA RUTA APP CLUB (Cliente) - OPCIÓN B (Static fuera de App)
    # =================================================================
    @app.route('/app-club')
    def serve_club_app():
        try:
            # 1. Obtener ID del negocio de la URL (?id=5)
            negocio_id = request.args.get('id')
            
            # Datos por defecto (Si no hay ID o falla)
            og_title = "Club de Puntos Baboons"
            og_image = f"{request.url_root}static/img/logo_baboons.png" # Asegúrate de tener un logo default
            
            # 2. Si hay ID, buscamos los datos reales en la BD
            if negocio_id:
                db = get_db()
                try:
                    # Buscamos nombre y logo
                    db.execute("SELECT nombre, logo_url FROM negocios WHERE id = %s", (negocio_id,))
                    row = db.fetchone()
                    
                    if row:
                        og_title = f"Club {row['nombre']}" # Ej: "Club La Kosleña"
                        
                        if row['logo_url']:
                            # WhatsApp NECESITA URL ABSOLUTA (https://...)
                            img_path = row['logo_url']
                            if img_path.startswith('http'):
                                og_image = img_path
                            else:
                                # Construimos la URL completa: Dominio + Ruta relativa
                                # .rstrip('/') evita duplicar barras //
                                og_image = request.url_root.rstrip('/') + (img_path if img_path.startswith('/') else '/' + img_path)
                                
                except Exception as e:
                    print(f"Error buscando negocio para OG: {e}")

            # 3. Leer el archivo HTML manualmente desde static/Club
            club_dir = os.path.join(app.root_path, 'static', 'Club')
            file_path = os.path.join(club_dir, 'club_app.html')
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 4. Inyectar las variables usando Jinja (render_template_string)
            return render_template_string(content, og_title=og_title, og_image=og_image)
            
        except Exception as e:
            app.logger.error(f"Error sirviendo app-club: {e}")
            return f"Error configurando ruta: {e}", 500

    # --- RUTA CATCH-ALL (Debe ir AL FINAL) ---
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