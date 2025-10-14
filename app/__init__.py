import os
from flask import Flask, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from .database import init_db, get_db

# Creamos una instancia global de Bcrypt
bcrypt = Bcrypt()

def create_app():
    # Creamos la aplicación Flask
    app = Flask(__name__, static_folder='../static')
    
    # --- Configuración de la App ---
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_secret_key'),
        DATABASE=os.path.join(app.instance_path, 'flaskr.sqlite'), # Ejemplo, ajusta a tu config de BD
    )
    
    # Habilitamos CORS para permitir peticiones desde el frontend
    CORS(app)
    
    # Inicializamos Bcrypt con la app
    bcrypt.init_app(app)
    
    # Asegurarnos de que la carpeta de instancia exista
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # --- Registro de Comandos y Teardown ---
    @app.teardown_appcontext
    def teardown_db(exception=None):
        db = g.pop('db_conn', None)
        if db is not None:
            db.close()

    # --- REGISTRO DE BLUEPRINTS ---
    # Esta es la sección más importante. Aquí le decimos a Flask qué rutas existen.
    with app.app_context():
        from .routes import auth_routes, sales_routes, facturacion_routes # Y todos tus otros archivos de rutas
        
        app.register_blueprint(auth_routes.bp, url_prefix='/api')
        app.register_blueprint(sales_routes.bp, url_prefix='/api')
        app.register_blueprint(facturacion_routes.bp, url_prefix='/api')
        # ... Aquí irían los register_blueprint para clientes, presupuestos, etc.
        
        # Inicializar la base de datos
        init_db()

    # --- Ruta "Catch-All" para la Single Page Application ---
    # Esta ruta se asegura de que cualquier URL que no sea de la API devuelva el index.html
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    return app