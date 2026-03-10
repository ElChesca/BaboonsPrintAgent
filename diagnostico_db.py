import sqlite3
import os

db_path = r'C:\Users\usuario\Documents\MultinegocioBaboons\inventario.db'

if not os.path.exists(db_path):
    print(f"Error: Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

negocio_id = 7

print(f"--- Diagnóstico para Negocio ID: {negocio_id} ---")

# 1. Verificar si el negocio existe
cursor.execute("SELECT * FROM negocios WHERE id = ?", (negocio_id,))
negocio = cursor.fetchone()
if negocio:
    print(f"Negocio: {negocio['nombre']} (Tipo: {negocio['tipo_app']})")
else:
    print("Error: El negocio con ID 7 no existe en la tabla 'negocios'.")

# 2. Contar registros en caja_ajustes
cursor.execute("SELECT COUNT(*) as total FROM caja_ajustes WHERE negocio_id = ?", (negocio_id,))
count_ajustes_caja = cursor.fetchone()['total']
print(f"Ajustes de Caja (caja_ajustes): {count_ajustes_caja}")

# 3. Contar registros en inventario_ajustes
cursor.execute("SELECT COUNT(*) as total FROM inventario_ajustes WHERE negocio_id = ?", (negocio_id,))
count_ajustes_inv = cursor.fetchone()['total']
print(f"Ajustes de Inventario (inventario_ajustes): {count_ajustes_inv}")

# 4. Ver sesiones de caja abiertas
cursor.execute("SELECT COUNT(*) as total FROM caja_sesiones WHERE negocio_id = ? AND fecha_cierre IS NULL", (negocio_id,))
sesiones_abiertas = cursor.fetchone()['total']
print(f"Sesiones de caja abiertas: {sesiones_abiertas}")

# 5. Ver si hay algún ajuste "huérfano" (sin negocio_id o con otro)
cursor.execute("SELECT COUNT(*) as total FROM caja_ajustes")
total_ajustes = cursor.fetchone()['total']
print(f"Total global en caja_ajustes (todos los negocios): {total_ajustes}")

conn.close()
