
import sys
import os

# Añadir el directorio raíz al path para poder importar la app
sys.path.append(os.getcwd())

from app.database import get_db
from flask import Flask, g

app = Flask(__name__)

def sync():
    with app.app_context():
        db = get_db()
        print("--- Iniciando Migración y Sincronización de Numeración ---")

        # 1. Asegurar que las columnas existen
        print("Paso 1: Verificando columnas...")
        try:
            db.execute("ALTER TABLE caja_sesiones ADD COLUMN IF NOT EXISTS numero INTEGER")
            print("  - Columna 'numero' en caja_sesiones: OK")
        except Exception as e: print(f"  - Error en caja_sesiones (col): {e}")

        try:
            db.execute("ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS numero INTEGER")
            print("  - Columna 'numero' en presupuestos: OK")
        except Exception as e: print(f"  - Error en presupuestos (col): {e}")

        try:
            db.execute("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS numero_interno INTEGER")
            print("  - Columna 'numero_interno' en ventas: OK")
        except Exception as e: print(f"  - Error en ventas (col): {e}")

        if hasattr(g, 'db_conn'): g.db_conn.commit()

        # 2. Sincronizar Caja Sesiones
        print("\nPaso 2: Sincronizando caja_sesiones...")
        db.execute("""
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY fecha_apertura ASC) as row_num
                FROM caja_sesiones
            )
            UPDATE caja_sesiones
            SET numero = numbered.row_num
            FROM numbered
            WHERE caja_sesiones.id = numbered.id
        """)
        print("  - Caja Sesiones sincronizada.")

        # 3. Sincronizar Presupuestos
        print("\nPaso 3: Sincronizando presupuestos...")
        db.execute("""
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY fecha ASC) as row_num
                FROM presupuestos
            )
            UPDATE presupuestos
            SET numero = numbered.row_num
            FROM numbered
            WHERE presupuestos.id = numbered.id
        """)
        print("  - Presupuestos sincronizados.")

        # 4. Sincronizar Ventas
        print("\nPaso 4: Sincronizando ventas...")
        db.execute("""
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY fecha ASC) as row_num
                FROM ventas
            )
            UPDATE ventas
            SET numero_interno = numbered.row_num
            FROM numbered
            WHERE ventas.id = numbered.id
        """)
        print("  - Ventas sincronizadas.")

        if hasattr(g, 'db_conn'):
            g.db_conn.commit()
            print("\n--- ¡Sincronización completada con éxito! ---")
        else:
            print("\nAVISO: No se pudo realizar el commit final.")

if __name__ == "__main__":
    sync()
