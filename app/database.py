# app/database.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import g

def get_db_conn():
    """Obtiene o crea la conexión a la base de datos."""
    if 'db_conn' not in g:
        if 'DATABASE_URL' in os.environ:
            g.db_conn = psycopg2.connect(os.environ['DATABASE_URL'])
        else:
            # Asume que inventario.db está en la carpeta raíz
            db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'inventario.db')
            g.db_conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
            g.db_conn.row_factory = sqlite3.Row
    return g.db_conn

def get_db():
    """Obtiene o crea un cursor para la solicitud actual."""
    if 'db_cursor' not in g:
        conn = get_db_conn()
        if isinstance(conn, psycopg2.extensions.connection):
            g.db_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        else:
            g.db_cursor = conn.cursor()
    return g.db_cursor

def close_connection(e=None):
    """Cierra el cursor y la conexión."""
    cursor = g.pop('db_cursor', None)
    if cursor is not None:
        cursor.close()
    conn = g.pop('db_conn', None)
    if conn is not None:
        conn.close()