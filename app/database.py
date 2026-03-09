import os
import psycopg2
import psycopg2.extras # Importante para obtener resultados como diccionarios
import sqlite3
from flask import g
from dotenv import load_dotenv

load_dotenv() # Carga las variables del archivo .env si existe (para desarrollo local)

class SQLiteCursorWrapper:
    def __init__(self, cursor):
        self.cursor = cursor

    def execute(self, sql, args=None):
        # Reemplazar %s por ? para SQLite
        # Nota: Esto es una aproximación simple. Si %s aparece dentro de literales de cadena, fallará.
        # Pero para las consultas parametrizadas típicas de este proyecto, funcionará.
        if sql:
            sql = sql.replace('%s', '?')

        try:
            if args is None:
                return self.cursor.execute(sql)
            return self.cursor.execute(sql, args)
        except Exception as e:
            import sys
            print(f"SQLite EXECUTE ERROR: {e} | SQL: {sql}", file=sys.stderr)
            raise e

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __getattr__(self, name):
        return getattr(self.cursor, name)

def get_db():
    """
    Crea una conexión a la base de datos PostgreSQL si no existe para la petición actual.
    En entorno de desarrollo o si no hay URL, usa SQLite.
    """
    if 'db' not in g:
        app_env = os.environ.get("APP_ENV", "production")
        db_url = os.environ.get("DATABASE_URL")

        # En producción usamos Postgres (Neon)
        # En desarrollo preferimos SQLite (Fly Volume) para no tocar la data real
        if db_url and app_env == "production":
            try:
                g.db_conn = psycopg2.connect(db_url)
                g.db = g.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                g.db.execute("SET TIME ZONE 'America/Argentina/Buenos_Aires';")
            except Exception as e:
                raise e
        else:
            # Fallback a SQLite (Local o Fly Dev Volume)
            # Buscamos la ruta en env var, por defecto raíz
            sqlite_path = os.environ.get("SQLITE_DB_PATH", "inventario.db")
            g.db_conn = sqlite3.connect(sqlite_path)
            g.db_conn.row_factory = sqlite3.Row
            g.db = SQLiteCursorWrapper(g.db_conn.cursor())
            # SQLite no soporta SET TIME ZONE igual que PG, pero podemos omitirlo o usar pragma si es necesario
        
    return g.db

def close_db(e=None):
    """Cierra la conexión a la base de datos al final de la petición."""
    db_conn = g.pop('db_conn', None)
    if db_conn is not None:
        db_conn.close()
    
    db = g.pop('db', None)
    # El cursor no necesita cerrarse explícitamente si la conexión se cierra.
