from app.database import get_db
from flask import Flask
import os
import json

app = Flask(__name__)

with app.app_context():
    db = get_db()
    
    print("--- IMPRESORAS ---")
    db.execute("SELECT id, nombre, ip, estacion, es_caja FROM resto_impresoras WHERE negocio_id = 13")
    for r in db.fetchall():
        print(f"ID: {r['id']} | {r['nombre']} | IP: {r['ip']} | Est: {r['estacion']} | Caja: {r['es_caja']}")
    
    print("\n--- ULTIMOS 10 TRABAJOS ---")
    db.execute("SELECT id, estado, created_at, payload FROM resto_cola_impresion ORDER BY created_at DESC LIMIT 10")
    for r in db.fetchall():
        payload_data = r['payload'] or {}
        if isinstance(payload_data, str): payload_data = json.loads(payload_data)
        print(f"ID: {r['id']} | Status: {r['estado']} | Order: {payload_data.get('id_orden')} | At: {r['created_at']}")
    
    print("\n--- AGENTE ---")
    db.execute("SELECT clave, valor FROM configuraciones WHERE clave LIKE 'agente_last_seen%'")
    for r in db.fetchall():
        print(f"{r['clave']}: {r['valor']}")
