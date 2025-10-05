# crear_hash.py
import getpass
from flask_bcrypt import Bcrypt

bcrypt = Bcrypt()
print("--- Creación de Usuario Administrador ---")

nombre_usuario = input("Introduce el nombre del usuario (ej: admin): ")
email_usuario = input(f"Introduce el email para '{nombre_usuario}' (con este iniciarás sesión): ")
password = getpass.getpass(f"Introduce la contraseña para '{email_usuario}': ")

hash_password = bcrypt.generate_password_hash(password).decode('utf-8')

# ✨ Ahora la consulta incluye tanto 'nombre' como 'email'
sql_query = f"INSERT INTO usuarios (nombre, email, password, rol) VALUES ('{nombre_usuario}', '{email_usuario}', '{hash_password}', 'admin');"

print("\n¡Listo! Copia y ejecuta la siguiente línea en el 'SQL Editor' de Neon (no olvides el COMMIT):\n")
print(sql_query)