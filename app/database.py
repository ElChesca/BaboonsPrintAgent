# app/database.py
import os
import sqlite3
import psycopg2
import psycopg2.extras
from flask import g, current_app

def get_db_conn():
    if 'db_conn' not in g:
        if 'DATABASE_URL' in os.environ:
            g.db_conn = psycopg2.connect(os.environ['DATABASE_URL'])
        else:
            db_path = os.path.join(current_app.root_path, '..', 'inventario.db')
            g.db_conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
            g.db_conn.row_factory = sqlite3.Row
    return g.db_conn

def get_db(): # Devuelve el cursor
    if 'db_cursor' not in g:
        conn = get_db_conn()
        if isinstance(conn, psycopg2.extensions.connection):
            g.db_cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        else:
            g.db_cursor = conn.cursor()
    return g.db_cursor

def close_connection(e=None):
    cursor = g.pop('db_cursor', None)
    if cursor is not None:
        cursor.close()
    conn = g.pop('db_conn', None)
    if conn is not None:
        conn.close()