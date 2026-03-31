import psycopg2
from urllib.parse import urlparse

url=urlparse('postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require')
conn=psycopg2.connect(dbname=url.path[1:], user=url.username, password=url.password, host=url.hostname, port=url.port)
curs=conn.cursor()

token = "APP_USR-7446977169398073-022418-b33c09d207ae8bd0a78dd8b72386ecda-7151365"
device_id = "NEWLAND_N950__N950NCC503382726"

curs.execute("UPDATE configuraciones SET valor = %s WHERE clave = 'mp_access_token'", (token,))
curs.execute("UPDATE configuraciones SET valor = %s WHERE clave = 'mp_device_id'", (device_id,))
conn.commit()

print("LISTO! Base de datos de produccion inyectada por Antigravity.")
