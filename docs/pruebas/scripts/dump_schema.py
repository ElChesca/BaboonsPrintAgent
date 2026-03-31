import sqlite3
import os

# Try to find the right DB
paths = ['/data/inventario.db', 'inventario.db', 'app/inventario.db']
db_path = None
for p in paths:
    if os.path.exists(p):
        db_path = p
        print(f"Using DB: {p}")
        break

if not db_path:
    print("DB not found")
    exit(1)

db = sqlite3.connect(db_path)
cursor = db.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
all_tables = [r[0] for r in cursor.fetchall()]

tables = ['ventas', 'pedidos', 'usuarios', 'negocios', 'vendedores', 'hoja_ruta']
found_tables = [t for t in tables if t in all_tables]
print(f"Found tables: {found_tables}")

with open('schema_dump.txt', 'w', encoding='utf-8') as f:
    for table in found_tables:
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,))
        result = cursor.fetchone()
        if result and result[0]:
            f.write(f"-- TABLE: {table}\n")
            f.write(result[0] + "\n\n")
print("Schema dumped successfully.")
