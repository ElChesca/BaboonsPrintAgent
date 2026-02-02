import os
import psycopg2
import psycopg2.extras # Importante para obtener resultados como diccionarios
import sqlite3
from flask import g
#from dotenv import load_dotenv

#load_dotenv() # Carga las variables del archivo .env si existe (para desarrollo local)

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
    Si DATABASE_URL no existe, intenta usar SQLite (para desarrollo local).
    """
    if 'db' not in g:
        # 1. Obtiene la URL de la base de datos de las variables de entorno (los "secrets" de Fly.io)
        db_url = os.environ.get("DATABASE_URL")

        if db_url:
            # 2. Se conecta a PostgreSQL
            try:
                g.db_conn = psycopg2.connect(db_url)
                # 3. Crea un cursor que devuelve filas como diccionarios (ej: row['nombre'])
                g.db = g.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
                # 🔥Configuramos la zona horaria para esta conexión/petición
                g.db.execute("SET TIME ZONE 'America/Argentina/Buenos_Aires';")
            except Exception as e:
                # Fallback simple si falla (aunque debería lanzar error)
                raise e
        else:
            # Fallback a SQLite
            g.db_conn = sqlite3.connect('inventario.db')
            g.db_conn.row_factory = sqlite3.Row # Para acceder por nombre como dict
            # Wrapper para soportar sintaxis %s
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
