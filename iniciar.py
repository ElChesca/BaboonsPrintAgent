import sqlite3
from werkzeug.security import generate_password_hash

try:
    db = sqlite3.connect('/data/inventario.db')
    cursor = db.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE username='admin'")
    admin = cursor.fetchone()
    
    hashed_pw = generate_password_hash('admin123')
    
    if admin:
        cursor.execute("UPDATE usuarios SET password=?, role='admin' WHERE username='admin'", (hashed_pw,))
    else:
        cursor.execute("INSERT INTO usuarios (username, password, role) VALUES (?, ?, ?)", ('admin', hashed_pw, 'admin'))
        
    db.commit()
    print(">>> OK: Usuario admin creado/actualizado con clave admin123 <<<")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'db' in locals():
        db.close()
