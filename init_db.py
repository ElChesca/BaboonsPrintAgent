import sqlite3
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()

# Conectarse a la base de datos (se creará si no existe)
connection = sqlite3.connect('inventario.db')

# Leer el contenido del archivo schema.sql
with open('schema.sql') as f:
    connection.executescript(f.read())

cur = connection.cursor()

# --- 1. Crear un negocio de ejemplo ---
cur.execute("INSERT INTO negocios (nombre, descripcion) VALUES (?, ?)",
            ('Mi Primer Almacén', 'Tienda de ramos generales de prueba')
            )
negocio_id = cur.lastrowid # Guardamos el ID del negocio recién creado

# --- 2. Crear un usuario de prueba ---
email_test = 'test@example.com'
password_test = 'password'
hash_password = bcrypt.generate_password_hash(password_test).decode('utf-8')

cur.execute("INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)",
            ('Test User', email_test, hash_password, 'admin')
            )
usuario_id = cur.lastrowid # Guardamos el ID del usuario recién creado

# --- 3. Asociar el usuario al negocio ---
cur.execute("INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (?, ?)",
            (usuario_id, negocio_id)
            )

connection.commit()
connection.close()

print("¡Base de datos inicializada con éxito!")
print("- Negocio de prueba 'Mi Primer Almacén' creado.")
print(f"- Usuario de prueba '{email_test}' con contraseña '{password_test}' creado y asociado al negocio.")
