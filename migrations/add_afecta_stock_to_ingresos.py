import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def migrate():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Agregar columna afecta_stock a ingresos_mercaderia
        print("Agregando columna afecta_stock a ingresos_mercaderia...")
        cur.execute("""
            ALTER TABLE ingresos_mercaderia 
            ADD COLUMN IF NOT EXISTS afecta_stock BOOLEAN DEFAULT TRUE;
        """)
        
        conn.commit()
        print("Migración completada con éxito.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error durante la migración: {e}")

if __name__ == "__main__":
    migrate()
