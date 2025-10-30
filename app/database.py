# app/database.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import g
from dotenv import load_dotenv

load_dotenv()

def get_db():
    """
    Crea una conexión a la base de datos.
    Prioriza PostgreSQL si DATABASE_URL está configurada (producción).
    De lo contrario, usa SQLite local (desarrollo/testing).
    """
    if 'db' not in g:
        db_url = os.environ.get("DATABASE_URL")

        if db_url:
            # Conexión a PostgreSQL (Producción)
            g.db_conn = psycopg2.connect(db_url)
            g.db = g.db_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        else:
            # Conexión a SQLite (Desarrollo/Local)
            g.db_conn = sqlite3.connect('inventario.db')
            # Permite acceder a las filas por nombre de columna
            g.db_conn.row_factory = sqlite3.Row
            g.db = g.db_conn.cursor()
    return g.db

def close_db(e=None):
    """Cierra la conexión a la base de datos al final de la petición."""
    db_conn = g.pop('db_conn', None)
    if db_conn is not None:
        db_conn.close()
    
    # El cursor de sqlite3 no necesita un close() explícito si la conexión se cierra.
    g.pop('db', None)
