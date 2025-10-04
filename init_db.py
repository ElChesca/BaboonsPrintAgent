import sqlite3

# Conectarse a la base de datos (se creará si no existe)
connection = sqlite3.connect('inventario.db')

# Leer el contenido del archivo schema.sql
with open('schema.sql') as f:
    connection.executescript(f.read())

# Crear un negocio de ejemplo para empezar
cur = connection.cursor()
cur.execute("INSERT INTO negocios (nombre, descripcion) VALUES (?, ?)",
            ('Mi Primer Almacén', 'Tienda de ramos generales de prueba')
            )
connection.commit()
connection.close()

print("¡Base de datos inicializada con éxito y un negocio de prueba creado!")