# app/scripts/migracion_eventos.py
import os
import psycopg2
from dotenv import load_dotenv

def migrate():
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL no encontrada.")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Leer el SQL de migración
        migration_path = os.path.join("migrations", "eventos_migration.sql")
        with open(migration_path, "r", encoding="utf-8") as f:
            sql = f.read()
        
        print("Aplicando migración de eventos...")
        cur.execute(sql)
        conn.commit()
        print("✅ Migración completada con éxito.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")

if __name__ == "__main__":
    migrate()
