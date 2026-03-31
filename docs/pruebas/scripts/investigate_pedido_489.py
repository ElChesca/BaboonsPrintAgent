import psycopg2
from psycopg2.extras import RealDictCursor

db_url = "postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb"

def run_investigation():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    pedido_id = 489
    print(f"--- Detalle Pedido #{pedido_id} ---")
    
    cur.execute("SELECT * FROM pedidos WHERE id = %s", (pedido_id,))
    ped = cur.fetchone()
    print(f"Pedido Total: {ped['total']}")
    print(f"Observaciones: {ped['observaciones']}")

    cur.execute("SELECT pd.*, p.nombre FROM pedidos_detalle pd JOIN productos p ON pd.producto_id = p.id WHERE pd.pedido_id = %s", (pedido_id,))
    items = cur.fetchall()
    sum_items = 0
    for it in items:
        total_item = it['cantidad'] * it['precio_unitario']
        sum_items += total_item
        print(f"  Item: {it['nombre']}, Cant: {it['cantidad']}, PU: {it['precio_unitario']}, Total: {total_item}")
    
    print(f"Suma de Items: {sum_items}")
    print(f"Diferencia: {sum_items - ped['total']}")

    conn.close()

if __name__ == "__main__":
    run_investigation()
