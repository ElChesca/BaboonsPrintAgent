import psycopg2
from psycopg2.extras import RealDictCursor
from flask_bcrypt import Bcrypt
from flask import Flask

app = Flask(__name__)
bcrypt = Bcrypt(app)

db_url = "postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb"
conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

original_id = 7
demo_name = "Distribuidora DEMO"
demo_email = "demo@baboons.com"
demo_pass = "demo123"

hashed_pass = bcrypt.generate_password_hash(demo_pass).decode('utf-8')

try:
    # 0. Cleanup any previous failed attempts
    cur.execute("DELETE FROM usuarios_negocios WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM usuarios WHERE email = %s", (demo_email,))
    cur.execute("DELETE FROM productos WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM productos_categoria WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM listas_de_precios WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM unidades_medida WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM negocio_modulos_config WHERE negocio_id IN (SELECT id FROM negocios WHERE nombre = %s)", (demo_name,))
    cur.execute("DELETE FROM negocios WHERE nombre = %s", (demo_name,))
    conn.commit()

    # 1. Create Business
    cur.execute("""
        INSERT INTO negocios (nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa, acceso_bloqueado)
        SELECT %s, direccion, tipo_app, logo_url, CURRENT_DATE, 0, TRUE, FALSE
        FROM negocios WHERE id = %s
        RETURNING id
    """, (demo_name, original_id))
    demo_id = cur.fetchone()['id']
    print(f"Business Created: {demo_id}")

    # 2. Modules
    cur.execute("""
        INSERT INTO negocio_modulos_config (negocio_id, module_code, is_active)
        SELECT %s, module_code, is_active
        FROM negocio_modulos_config WHERE negocio_id = %s
    """, (demo_id, original_id))

    # 3. Categories
    cur.execute("""
        INSERT INTO productos_categoria (negocio_id, nombre)
        SELECT %s, nombre
        FROM productos_categoria WHERE negocio_id = %s
    """, (demo_id, original_id))

    # 4. Units
    cur.execute("""
        INSERT INTO unidades_medida (negocio_id, nombre, abreviatura)
        SELECT %s, nombre, abreviatura
        FROM unidades_medida WHERE negocio_id = %s
    """, (demo_id, original_id))

    # 5. Products
    cur.execute("""
        INSERT INTO productos (negocio_id, nombre, precio_costo, precio_venta, stock_minimo, categoria_id, codigo_barras, sku, activo, unidad_medida)
        SELECT 
            %s, 
            p.nombre, 
            p.precio_costo, 
            p.precio_venta, 
            p.stock_minimo,
            (SELECT id FROM productos_categoria WHERE negocio_id = %s AND nombre = (SELECT nombre FROM productos_categoria WHERE id = p.categoria_id)),
            p.codigo_barras, 
            p.sku, 
            p.activo,
            p.unidad_medida
        FROM productos p 
        WHERE p.negocio_id = %s
    """, (demo_id, demo_id, original_id))

    # 6. Create User
    cur.execute("""
        INSERT INTO usuarios (nombre, email, password, rol, activo)
        VALUES (%s, %s, %s, %s, TRUE)
        RETURNING id
    """, ("Usuario Demo", demo_email, hashed_pass, "admin"))
    user_id = cur.fetchone()['id']
    print(f"User Created: {user_id}")

    # 7. Link User to Business
    cur.execute("""
        INSERT INTO usuarios_negocios (usuario_id, negocio_id)
        VALUES (%s, %s)
    """, (user_id, demo_id))

    conn.commit()
    print("DEMO ENVIRONMENT READY")
    print(f"User: {demo_email}")
    print(f"Pass: {demo_pass}")

except Exception as e:
    conn.rollback()
    print(f"ERROR: {e}")

conn.close()
