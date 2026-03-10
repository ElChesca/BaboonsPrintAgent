import os
import sys

# Agregar el directorio raíz al path para poder importar módulos de la app
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(parent_dir)

from flask import Flask
from app.database import get_db

app = Flask(__name__)

with app.app_context():
    db = get_db()
    
    print("Base de datos conectada. Creando tablas de Rebotess...")

    # 1. Tabla motivos_rebote
    db.execute("""
    CREATE TABLE IF NOT EXISTS motivos_rebote (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id),
        descripcion VARCHAR(150) NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        UNIQUE(negocio_id, descripcion)
    );
    """)
    print("- Tabla motivos_rebote OK")
    
    # 2. Tabla pedidos_rebotes
    db.execute("""
    CREATE TABLE IF NOT EXISTS pedidos_rebotes (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id),
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        hoja_ruta_id INTEGER NOT NULL REFERENCES hoja_ruta(id) ON DELETE CASCADE,
        producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
        cantidad INTEGER NOT NULL CHECK (cantidad > 0),
        motivo_rebote_id INTEGER NOT NULL REFERENCES motivos_rebote(id) ON DELETE RESTRICT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    print("- Tabla pedidos_rebotes OK")

    try:
        from flask import g
        g.db_conn.commit()
    except Exception as e:
        print("No se requirio commit o fallo:", e)
        pass

    # 3. Insertar motivos requeridos por defecto
    try:
        db.execute("SELECT id FROM negocios")
        negocios = db.fetchall()
        
        motivos_defecto = ['Rechazo Parcial', 'Rotura / Merma', 'Local Cerrado', 'No tiene Dinero', 'Error de Carga / Faltante', 'Otro']
        
        insertados = 0
        for n in negocios:
            for motivo in motivos_defecto:
                try:
                    db.execute("""
                        INSERT INTO motivos_rebote (negocio_id, descripcion)
                        VALUES (%s, %s)
                        ON CONFLICT (negocio_id, descripcion) DO NOTHING;
                    """, (n['id'], motivo))
                    insertados += 1
                except Exception as inner_e:
                    print(f"Error insertando {motivo} para negocio {n['id']}: {inner_e}")
                    pass
        
        try:
            from flask import g
            g.db_conn.commit()
        except:
            pass
            
        print(f"Motivos de defecto procesados OK. (Intentos: {insertados})")
        
    except Exception as exc:
         print(f"Error procesando motivos: {exc}")
         try:
            from flask import g
            g.db_conn.rollback()
         except:
            pass
         
    print("Terminado.")
