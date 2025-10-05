# crear_hash.py
import getpass
from flask_bcrypt import Bcrypt

# No necesitamos la app completa de Flask para usar bcrypt
bcrypt = Bcrypt()

print("--- Creación de Usuario Administrador ---")

# 1. Pedimos el nombre de usuario
nombre_usuario = input("Introduce el nombre de usuario para el admin: ")

# 2. Pedimos la contraseña de forma seguraad
password = getpass.getpass(f"Introduce la contraseña para '{nombre_usuario}': ")

# 3. Generamos el hash
hash_password = bcrypt.generate_password_hash(password).decode('utf-8')

# 4. Construimos la consulta SQL completa
#    Importante: PostgreSQL usa comillas simples ' para los strings.
sql_query = f"INSERT INTO usuarios (nombre, password, rol) VALUES ('{nombre_usuario}', '{hash_password}', 'admin');"

# 5. Imprimimos el resultado final
print("\n¡Listo! Copia y ejecuta la siguiente línea en el 'SQL Editor' de Neon:\n")
print(sql_query)