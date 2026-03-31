import sqlite3
import os
from werkzeug.security import generate_password_hash

# ASEGURARNOS DE QUE EL DIRECTORIO EXISTE
os.makedirs('/data', exist_ok=True)

try:
    db = sqlite3.connect('/data/inventario.db')
    cursor = db.cursor()
    
    # 1. INTENTAR SIEMPRE CREAR LA TABLA POR SI [init_db.py](cci:7://file:///c:/Users/usuario/Documents/MultinegocioBaboons/init_db.py:0:0-0:0) FALLÓ OTRA VEZ
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        sucursal_id INTEGER
    )
    ''')
    
    # 2. CREAR/ACTUALIZAR EL ADMIN
    cursor.execute("SELECT * FROM usuarios WHERE username='admin'")
    admin = cursor.fetchone()
    
    hashed_pw = generate_password_hash('admin123')
    
    if admin:
        cursor.execute("UPDATE usuarios SET password=?, role='admin' WHERE username='admin'", (hashed_pw,))
        print(">>> OK: Usuario admin YA EXISTIA, se actualizo su clave a admin123 y rol a admin <<<")
    else:
        cursor.execute("INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)", ('admin', hashed_pw, 'admin'))
        print(">>> OK: Usuario admin CREADO NUEVO con clave admin123 <<<")
        
    db.commit()
except Exception as e:
    print(f"Error Ocurrido: {e}")
finally:
    if 'db' in locals():
        db.close()
