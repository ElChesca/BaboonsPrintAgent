import psycopg2
import os

db_url = None
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('DATABASE_URL='):
            db_url = line.strip().split('=', 1)[1]
            break

try:
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    tables = ['ventas', 'ventas_detalle', 'pedidos', 'pedidos_detalle', 'pedidos_rebotes', 'negocios', 'vendedores', 'hoja_ruta', 'hoja_ruta_items', 'usuarios', 'clientes_cuenta_corriente']
    
    with open('schema_dump.txt', 'w', encoding='utf-8') as f:
        for t in tables:
            f.write(f"\n--- Table: {t} ---\n")
            cursor.execute(f"SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = '{t}';")
            for row in cursor.fetchall():
                f.write(f"{row[0]} | {row[1]} | {row[2]}\n")
            
    print("Schema exported.")
except Exception as e:
    print(f"Error: {e}")
