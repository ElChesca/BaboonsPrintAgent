import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def apply_migration():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found")
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    try:
        # Create pedidos_historial table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pedidos_historial (
                id SERIAL PRIMARY KEY,
                pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
                negocio_id INTEGER NOT NULL,
                usuario_id INTEGER NOT NULL,
                fecha TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                datos_anteriores JSONB,
                motivo TEXT
            );
        """)
        
        # Add index for faster lookups
        cur.execute("CREATE INDEX IF NOT EXISTS idx_pedidos_historial_pedido_id ON pedidos_historial(pedido_id);")
        
        conn.commit()
        print("Migration applied successfully: pedidos_historial table created.")
    except Exception as e:
        conn.rollback()
        print(f"Error applying migration: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    apply_migration()
