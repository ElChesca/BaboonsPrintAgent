# crear_hash.py
from flask import Flask
from flask_bcrypt import Bcrypt

app = Flask(__name__)
bcrypt = Bcrypt(app)

# Pedimos la contraseña por la terminal de forma segura
password_a_hashear = input("Introduce la contraseña para el admin: ")

# Generamos el hash
hashed_password = bcrypt.generate_password_hash(password_a_hashear).decode('utf-8')

print("\n¡Copiá este hash! Es tu contraseña segura:\n")
print(hashed_password)