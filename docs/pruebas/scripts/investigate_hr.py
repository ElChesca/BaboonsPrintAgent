import os
import psycopg2
from psycopg2.extras import RealDictCursor

def check_hr(hr_id):
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print(f"--- Investigando HR #{hr_id} ---")

    # 1. Total Teórico (Calculado en la ruta como SUM(pedidos.total))
    cur.execute("SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE hoja_ruta_id = %s AND estado != 'anulado'", (hr_id,))
    total_teorico = cur.fetchone()['total']
    print(f"Total Teórico (pedidos.total where hr_id={hr_id}): {total_teorico}")

    # 2. Total Vendido (Entregados)
    cur.execute("SELECT COALESCE(SUM(total), 0) as total FROM pedidos WHERE hoja_ruta_id = %s AND estado = 'entregado'", (hr_id,))
    total_entregado = cur.fetchone()['total']
    print(f"Total Entregado (pedidos.total where estado='entregado'): {total_entregado}")

    # 3. Diferencia de Precios
    sql_dif = """
        SELECT
            SUM(pd.cantidad * (p.precio_venta - pd.precio_unitario)) as diferencia_total
        FROM
            pedidos ped
        JOIN pedidos_detalle pd ON ped.id = pd.pedido_id
        JOIN productos p ON pd.producto_id = p.id
        WHERE
            ped.hoja_ruta_id = %s
            AND ped.estado = 'entregado'
    """
    cur.execute(sql_dif, (hr_id,))
    dif = cur.fetchone()['diferencia_total']
    print(f"Diferencia de Precios Total: {dif}")
    
    # 4. Detalle de Pedidos
    cur.execute("SELECT id, cliente_id, total, estado, metodo_pago FROM pedidos WHERE hoja_ruta_id = %s", (hr_id,))
    pedidos = cur.fetchall()
    print("\nPedidos en esta HR:")
    for p in pedidos:
        print(f"  ID: {p['id']}, Cliente: {p['cliente_id']}, Total: {p['total']}, Estado: {p['estado']}, Pago: {p['metodo_pago']}")

    # 5. Detalle de Items y Precios
    sql_items = """
        SELECT pd.pedido_id, p.nombre, pd.cantidad, pd.precio_unitario, p.precio_venta, (p.precio_venta - pd.precio_unitario) as dif
        FROM pedidos ped
        JOIN pedidos_detalle pd ON ped.id = pd.pedido_id
        JOIN productos p ON pd.producto_id = p.id
        WHERE ped.hoja_ruta_id = %s AND ped.estado = 'entregado'
    """
    cur.execute(sql_items, (hr_id,))
    items = cur.fetchall()
    print("\nItems Entregados y Diferencia de Precios:")
    for it in items:
        if it['dif'] != 0:
            print(f"  Ped: {it['pedido_id']}, Prod: {it['nombre']}, Cant: {it['cantidad']}, Pr.Pedido: {it['precio_unitario']}, Pr.Sistema: {it['precio_venta']}, Dif: {it['dif']}")

    conn.close()

if __name__ == "__main__":
    check_hr(66)
