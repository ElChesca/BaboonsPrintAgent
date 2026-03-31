# migrations/add_bloquear_pedido_stock_config.py
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv('DATABASE_URL')

def migrate():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cur = conn.cursor()
    
    try:
        print("Buscando negocios existentes...")
        cur.execute("SELECT id FROM negocios")
        negocios = cur.fetchall()
        
        for n in negocios:
            negocio_id = n['id']
            # Verificar si ya existe (por las dudas)
            cur.execute("SELECT 1 FROM configuraciones WHERE negocio_id = %s AND clave = 'bloquear_pedido_sin_stock'", (negocio_id,))
            if not cur.fetchone():
                print(f"Añadiendo configuración BLOQUEO CAPTURA pedidos para negocio {negocio_id}...")
                cur.execute(
                    "INSERT INTO configuraciones (negocio_id, clave, valor) VALUES (%s, %s, %s)",
                    (negocio_id, 'bloquear_pedido_sin_stock', 'No')
                )
        
        conn.commit()
        print("Migración completada con éxito.")
    except Exception as e:
        conn.rollback()
        print(f"Error en migración: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
