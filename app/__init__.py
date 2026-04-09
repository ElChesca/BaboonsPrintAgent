import os
import time
from flask import Flask, render_template, send_from_directory, abort, request, render_template_string 
from flask_cors import CORS
# ✨ Forzar Zona Horaria de Argentina al inicio
os.environ['TZ'] = 'America/Argentina/Buenos_Aires'
if hasattr(time, 'tzset'):
    time.tzset()

# ── APScheduler ──────────────────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

scheduler = BackgroundScheduler(timezone=pytz.timezone('America/Argentina/Buenos_Aires'))


from .routes import facturacion_routes
from .extensions import bcrypt
from .database import close_db, get_db
from flask_mail import Mail, Message

mail = Mail()


def create_app():
    # Nota: Si tu carpeta static está fuera, Flask a veces necesita saberlo, 
    # pero para servir archivos manualmente como haremos abajo, esto funcionará igual.
    app = Flask(__name__, template_folder='templates', static_folder='static')
    CORS(app) # Habilitar CORS para peticiones entre Fly.io y Cloud Run
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
                        payments_routes, gastos_routes, consorcio_routes, club_puntos_routes, \
                        pedidos_routes, logistica_routes, eventos_routes, \
                        resto_routes, reservas_routes, bancos_routes, ctacte_routes, compras_routes, \
                        ia_routes
    from .crm_social import bp as crm_bp
    from .crm_social import leads_routes
    from .rentals import routes as rentals_routes
    from .routes import tickets_routes
    from .routes import admin_routes
    from .routes import distribucion_routes
    from .routes import import_routes
    from .routes import empleados_routes
    from .routes import mercado_pago_routes
    from .routes import agente_facturacion_routes

    blueprints = [
        (auth_routes.bp, '/api'), (product_routes.bp, '/api'), (negocios_routes.bp, '/api'),
        (user_routes.bp, '/api'), (clientes_routes.bp, '/api'), (income_routes.bp, '/api'),
        (sales_routes.bp, '/api'), (category_routes.bp, '/api'), (dashboard_routes.bp, '/api'),
        (config_routes.bp, '/api'), (caja_routes.bp, '/api'), (report_routes.bp, '/api'),
        (proveedor_routes.bp, '/api'), (ajuste_caja_routes.bp, '/api'), (presupuestos_routes.bp, '/api'),
        (facturacion_routes.bp, '/api'), (price_lists_routes.bp, '/api'), (unidades_medida_routes.bp, '/api'),
        (inventory_routes.bp, '/api'), (historial_inventario_routes.bp, '/api'), (precios_especificos_routes.bp, '/api'),
        (mobile_routes.bp, '/api'), (payments_routes.bp, '/api'), (gastos_routes.bp, '/api'),
        (consorcio_routes.bp, '/api'), (club_puntos_routes.bp, '/api'), (crm_bp, '/api/crm'),
        (leads_routes.bp, '/api/crm'), (rentals_routes.bp, '/api'),
        (admin_routes.bp, '/api'), (distribucion_routes.bp, '/api'), (pedidos_routes.bp, '/api'),
        (logistica_routes.bp, '/api'), (import_routes.bp, '/api'), (empleados_routes.bp, '/api'),
        (mercado_pago_routes.bp, '/api'), (agente_facturacion_routes.bp, '/api'),
        (eventos_routes.bp, ''), (tickets_routes.bp, '/api'),
        (resto_routes.bp, '/api'), (reservas_routes.bp, '/api'),
        (bancos_routes.bp, '/api'), (ctacte_routes.bp, '/api'), (compras_routes.bp, '/api'),
        (ia_routes.ia_bp, '/api')
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

    # ── Agente de Facturación — Scheduler diario ─────────────────────────────
    def _job_facturacion_diaria():
        """
        Job APScheduler: corre cada día a las 11:05 AM (hora argentina).
        Procesa las facturas correspondientes al día de hoy.
        """
        with app.app_context():
            try:
                from app.agente_facturacion import ejecutar_dia, NEGOCIO_ID, TOTAL_FACTURAS, \
                    MODO_EJECUCION, PUNTO_DE_VENTA, TIPO_FACTURA, CUIT_NEGOCIO
                app.logger.info("[Agente Facturación] ⏰ Iniciando job diario...")
                resultado = ejecutar_dia(
                    negocio_id=NEGOCIO_ID,
                    total_mensual=TOTAL_FACTURAS,
                    modo=MODO_EJECUCION,
                    punto_venta=PUNTO_DE_VENTA,
                    tipo_factura=TIPO_FACTURA,
                    cuit=CUIT_NEGOCIO,
                )
                app.logger.info(
                    f"[Agente Facturación] ✅ ok={resultado['ok']} "
                    f"errores={resultado['errores']} "
                    f"total=${resultado['total_facturado']:,.2f} "
                    f"modo={resultado['modo']}"
                )
            except Exception as e:
                app.logger.error(f"[Agente Facturación] ❌ Error en job diario: {e}")

    # Programar: todos los días a las 11:05 AM hora Argentina
    if not scheduler.running:
        scheduler.add_job(
            func=_job_facturacion_diaria,
            trigger=CronTrigger(hour=11, minute=5),
            id='agente_facturacion_diaria',
            name='Agente Facturación Re Pancho',
            replace_existing=True,
        )
        # ─── Job SLA Tickets ─────────────────────────────────────────────────
        from .routes.tickets_routes import job_chequeo_sla as _job_sla
        scheduler.add_job(
            func=_job_sla,
            args=[app],
            trigger='interval',
            minutes=30,
            id='tickets_sla_check',
            name='Tickets SLA Checker',
            replace_existing=True,
        )
        scheduler.start()
        app.logger.info("[Agente Facturación] 🚀 Scheduler iniciado — job diario 11:05 AM ARG")

    # --- CLI Commands ---
    from .commands import init_crm_db_command, init_rentals_db_command, init_compras_db_command, init_ocr_db_command
    app.cli.add_command(init_crm_db_command)
    app.cli.add_command(init_rentals_db_command)
    app.cli.add_command(init_compras_db_command)
    app.cli.add_command(init_ocr_db_command)

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

    # =================================================================
    # ✨ NUEVA RUTA CARTA DIGITAL (PÚBLICA)
    # =================================================================
    @app.route('/carta')
    def serve_digital_menu():
        try:
            negocio_id = request.args.get('id')
            lista_id = request.args.get('lista')
            
            og_title = "Carta Digital | Baboons"
            og_image = f"{request.url_root}static/img/logo_baboons.png"
            negocio_data = {}
            lista_data = {}

            if negocio_id:
                db = get_db()
                try:
                    # 1. Datos del Negocio
                    query = """
                        SELECT nombre, logo_url_resto, fondo_url_resto, 
                               direccion_resto, telefono_resto, 
                               instagram_url_resto, facebook_url_resto 
                        FROM negocios WHERE id = %s
                    """
                    db.execute(query, (negocio_id,))
                    row = db.fetchone()
                    if row:
                        negocio_data = dict(row)
                        og_title = f"Menú - {row['nombre']}"
                        
                        img_path = row['logo_url_resto'] or row['fondo_url_resto']
                        if img_path:
                            if img_path.startswith('http'):
                                og_image = img_path
                            else:
                                og_image = request.url_root.rstrip('/') + (img_path if img_path.startswith('/') else '/' + img_path)
                    
                    # 2. Datos de la Lista (si aplica)
                    if lista_id:
                        db.execute("SELECT nombre, mensaje_banner, banner_url FROM menu_listas WHERE id = %s AND negocio_id = %s", (lista_id, negocio_id))
                        l_row = db.fetchone()
                        if l_row:
                            lista_data = dict(l_row)
                            if l_row['mensaje_banner']:
                                og_title = f"{l_row['nombre']} - {row['nombre']}"
                except Exception as e:
                    app.logger.error(f"Error buscando negocio para Carta: {e}")

            # Leer el archivo HTML manualmente desde static/Resto
            resto_dir = os.path.join(app.root_path, 'static', 'Resto')
            file_path = os.path.join(resto_dir, 'carta_virtual.html')
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            return render_template_string(
                content, 
                negocio=negocio_data, 
                negocio_id=negocio_id,
                lista_id=lista_id,
                lista=lista_data,
                og_title=og_title, 
                og_image=og_image
            )
            
        except Exception as e:
            app.logger.error(f"Error sirviendo carta digital: {e}")
            return f"Error configurando ruta: {e}", 500

    # =================================================================
    # ✨ NUEVA RUTA PORTAL DE RESERVAS (PÚBLICO)
    # =================================================================
    @app.route('/reservas')
    def serve_public_reservas():
        try:
            token = request.args.get('t')
            # Fallback a ID numérico para compatibilidad previa (opcional, pero mejor forzar token)
            negocio_id = request.args.get('id')
            
            og_title = "Reservar Mesa | Baboons"
            og_image = f"{request.url_root}static/img/logo_baboons.png"
            negocio_data = {}

            db = get_db()
            try:
                if token:
                    db.execute("SELECT id, nombre, logo_url_resto FROM negocios WHERE reserva_token = %s", (token,))
                elif negocio_id:
                    db.execute("SELECT id, nombre, logo_url_resto FROM negocios WHERE id = %s", (negocio_id,))
                else:
                    return "Link de reserva inválido (Falta Token)", 400

                row = db.fetchone()
                if row:
                    negocio_data = dict(row)
                    og_title = f"Reserva tu mesa en {row['nombre']}"
                    if row['logo_url_resto']:
                        img_path = row['logo_url_resto']
                        if img_path.startswith('http'):
                            og_image = img_path
                        else:
                            og_image = request.url_root.rstrip('/') + (img_path if img_path.startswith('/') else '/' + img_path)
                else:
                    return "Negocio no encontrado", 404

            except Exception as e:
                app.logger.error(f"Error buscando negocio para Reserva: {e}")

            # Lógica Multitenant: Buscar template específico o genérico
            resto_dir = os.path.join(app.root_path, 'static', 'Resto')
            
            # 1. Intentar buscar por ID de negocio (ej: reservas_13.html)
            specific_file = f"reservas_{negocio_data.get('id')}.html"
            file_path = os.path.join(resto_dir, specific_file)
            
            # 2. Si no existe, usar el genérico
            if not os.path.exists(file_path):
                file_path = os.path.join(resto_dir, 'reservas_publico.html')
            
            if not os.path.exists(file_path):
                return "Portal de reservas en mantenimiento (E01)", 503

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            return render_template_string(
                content, 
                negocio=negocio_data, 
                token=token or "",
                negocio_id=negocio_data.get('id', ""),
                og_title=og_title, 
                og_image=og_image
            )
            
        except Exception as e:
            app.logger.error(f"Error sirviendo portal de reservas: {e}")
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