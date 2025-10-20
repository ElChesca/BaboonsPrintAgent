# app/database.py
import os
import psycopg2
import psycopg2.extras # Importante para obtener resultados como diccionarios
from flask import g
from dotenv import load_dotenv

load_dotenv() # Carga las variables del archivo .env si existe (para desarrollo local)

def get_db():
    """
    Crea una conexión a la base de datos PostgreSQL si no existe para la petición actual.
    """
    if 'db' not in g:
        # 1. Obtiene la URL de la base de datos de las variables de entorno (los "secrets" de Fly.io)
        db_url = os.environ.get("DATABASE_URL")
        if not db_url:
            raise ValueError("DATABASE_URL no está configurada en las variables de entorno")
            
        # 2. Se conecta a PostgreSQL
        g.db_conn = psycopg2.connect(db_url)
        # 3. Crea un cursor que devuelve filas como diccionarios (ej: row['nombre'])
        g.db = g.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    return g.db

def close_db(e=None):
    """Cierra la conexión a la base de datos al final de la petición."""
    db_conn = g.pop('db_conn', None)
    if db_conn is not None:
        db_conn.close()
    
    db = g.pop('db', None)
    # El cursor no necesita cerrarse explícitamente si la conexión se cierra.