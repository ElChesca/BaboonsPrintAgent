import psycopg2
from psycopg2.extras import RealDictCursor

db_url = "postgresql://neondb_owner:npg_dk8qBgW3QOnf@ep-billowing-dust-ad24iwb1-pooler.c-2.us-east-1.aws.neon.tech/neondb"

def run_investigation():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    hr_id = 66
    print(f"--- Investigando Discrepancia en HR #{hr_id} ---")

    sql_check = """
        SELECT
            p.id, p.total as ped_total, v.total as v_total, v.descuento as v_desc,
            (SELECT SUM(cantidad * precio_unitario) FROM pedidos_detalle WHERE pedido_id = p.id) as sum_items
        FROM
            pedidos p
        LEFT JOIN ventas v ON p.venta_id = v.id
        WHERE
            p.hoja_ruta_id = %s AND p.estado = 'entregado'
    """
    cur.execute(sql_check, (hr_id,))
    rows = cur.fetchall()
    
    total_ped = 0
    total_items = 0
    total_desc = 0
    
    print(f"{'ID':<6} | {'Ped.Total':<10} | {'Sum Items':<10} | {'V.Total':<10} | {'V.Desc':<7}")
    print("-" * 55)
    for r in rows:
        print(f"{r['id']:<6} | {float(r['ped_total']):<10.2f} | {float(r['sum_items']):<10.2f} | {float(r['v_total'] or 0):<10.2f} | {float(r['v_desc'] or 0):<7.2f}")
        total_ped += float(r['ped_total'])
        total_items += float(r['sum_items'])
        total_desc += float(r['v_desc'] or 0)

    print("-" * 55)
    print(f"{'TOTAL':<6} | {total_ped:<10.2f} | {total_items:<10.2f} | {'':<10} | {total_desc:<7.2f}")
    
    print(f"\nDiscrepancia (Items - Pedidos): {total_items - total_ped}")
    print(f"Suma de Descuentos en Ventas: {total_desc}")

    conn.close()

if __name__ == "__main__":
    run_investigation()
