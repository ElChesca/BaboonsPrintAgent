# app/db_utils.py
from flask import g
from app.database import get_db

def execute_query(query, params=None, fetchone=False, fetchall=False, commit=False):
    """
    Ejecuta una consulta de base de datos adaptándose a PostgreSQL o SQLite.

    Args:
        query (str): La consulta SQL a ejecutar.
        params (tuple, optional): Los parámetros para la consulta. Defaults to None.
        fetchone (bool, optional): Si es True, devuelve el primer resultado. Defaults to False.
        fetchall (bool, optional): Si es True, devuelve todos los resultados. Defaults to False.
        commit (bool, optional): Si es True, hace commit de la transacción. Defaults to False.

    Returns:
        result: El resultado de la consulta (si fetchone o fetchall es True), de lo contrario None.
    """
    db = get_db()

    # Reemplazar el marcador de posición genérico '?' por el específico de la DB
    if g.db_type == 'postgres':
        query = query.replace('?', '%s')

    db.execute(query, params or ())

    result = None
    if fetchone:
        result = db.fetchone()
    if fetchall:
        result = db.fetchall()

    if commit:
        g.db_conn.commit()

    return result
