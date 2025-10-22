# app/pricing_logic.py
def get_precio_producto(db_cursor, producto_id, negocio_id, cliente_id=None, cantidad=1, lista_de_precio_id_override=None):

    # 1. Obtener precio base y categoría (fallback)
    db_cursor.execute(
        "SELECT precio_venta, categoria_id FROM productos WHERE id = %s AND negocio_id = %s",
        (producto_id, negocio_id)
    )
    producto_info = db_cursor.fetchone()
    if not producto_info:
        print(f"!!! WARN: Producto {producto_id} no encontrado para negocio {negocio_id} en get_precio_producto")
        return None # Producto no existe o no pertenece al negocio

    precio_base = float(producto_info['precio_venta'])
    categoria_id_producto = producto_info['categoria_id']

    # 2. Determinar la lista de precios aplicable
    lista_de_precio_id = None
    if lista_de_precio_id_override:
        lista_de_precio_id = lista_de_precio_id_override
    elif cliente_id:
        db_cursor.execute(
            "SELECT lista_de_precio_id FROM clientes WHERE id = %s AND negocio_id = %s",
            (cliente_id, negocio_id)
        )
        cliente_info = db_cursor.fetchone()
        if cliente_info and cliente_info['lista_de_precio_id']:
            lista_de_precio_id = cliente_info['lista_de_precio_id']

    # Si no hay lista aplicable, devolvemos el precio base
    if not lista_de_precio_id:
        return precio_base

    # ✨ --- 3. NUEVO: Buscar Precio Específico (Máxima Prioridad) --- ✨
    try:
        db_cursor.execute(
            """
            SELECT precio
            FROM precios_especificos
            WHERE negocio_id = %s AND lista_de_precio_id = %s AND producto_id = %s
            """,
            (negocio_id, lista_de_precio_id, producto_id)
        )
        precio_especifico_row = db_cursor.fetchone()

        if precio_especifico_row:
            print(f"Precio específico encontrado para prod {producto_id}, lista {lista_de_precio_id}: {precio_especifico_row['precio']}")
            return float(precio_especifico_row['precio']) # Si existe, lo devolvemos

    except Exception as e:
         # Loguea el error pero no detiene el proceso, intentará buscar reglas
         print(f"!!! ERROR buscando precio específico: {e}")

    # --- 4. Si NO hay precio específico, buscar Reglas ---
    try:
        # (Asegúrate que tu tabla listas_de_precios_reglas tenga negocio_id si aplica)
        query_regla = """
            SELECT precio_fijo, porcentaje_descuento
            FROM listas_de_precios_reglas
            WHERE lista_de_precio_id = %s
              AND (producto_id = %s OR categoria_id = %s OR aplicar_a_todas_categorias = TRUE)
              AND cantidad_minima <= %s
            ORDER BY
                producto_id IS NOT NULL DESC,
                categoria_id IS NOT NULL DESC,
                aplicar_a_todas_categorias DESC,
                cantidad_minima DESC
            LIMIT 1
        """
        db_cursor.execute(query_regla, (lista_de_precio_id, producto_id, categoria_id_producto, cantidad))
        regla = db_cursor.fetchone()

        if regla:
            print(f"Regla encontrada para prod {producto_id}, lista {lista_de_precio_id}: {regla}")
            if regla['precio_fijo'] is not None:
                return float(regla['precio_fijo'])
            if regla['porcentaje_descuento'] is not None:
                descuento = float(regla['porcentaje_descuento'])
                precio_final = precio_base * (1 - (descuento / 100))
                return round(precio_final, 2)

    except Exception as e:
        # Loguea el error pero no detiene el proceso, usará precio base
        print(f"!!! ERROR buscando regla de precio: {e}")

    # --- 5. Si no hubo precio específico NI regla, devolver precio base ---
    print(f"No se encontró precio específico ni regla para prod {producto_id}, lista {lista_de_precio_id}. Usando precio base: {precio_base}")
    return precio_base