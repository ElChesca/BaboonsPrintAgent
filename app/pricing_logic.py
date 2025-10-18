# app/pricing_logic.py

def get_precio_producto(db_cursor, producto_id, negocio_id, cliente_id=None, cantidad=1):
    """
    Calcula el precio final de un producto aplicando la lógica de listas de precios.
    
    Orden de prioridad:
    1. Precio de una regla específica para el producto en la lista del cliente.
    2. Precio de una regla de categoría en la lista del cliente.
    3. Precio de venta base del producto.
    """
    
    # 1. Obtener el precio base del producto y su categoría como fallback
    db_cursor.execute("SELECT precio_venta, categoria_id FROM productos WHERE id = %s", (producto_id,))
    producto_info = db_cursor.fetchone()
    if not producto_info:
        return None # O lanzar un error
    
    precio_base = producto_info['precio_venta']
    categoria_id_producto = producto_info['categoria_id']

    # 2. Determinar qué lista de precios usar
    lista_de_precio_id = None
    if cliente_id:
        db_cursor.execute(
            "SELECT lista_de_precio_id FROM clientes WHERE id = %s AND negocio_id = %s",
            (cliente_id, negocio_id)
        )
        cliente_info = db_cursor.fetchone()
        if cliente_info and cliente_info['lista_de_precio_id']:
            lista_de_precio_id = cliente_info['lista_de_precio_id']

    # Si no hay lista asignada, el precio es el base. Fin de la lógica.
    if not lista_de_precio_id:
        return precio_base

   # ✨ --- CONSULTA MEJORADA CON NUEVA LÓGICA DE PRIORIDAD --- ✨
    # Ahora busca reglas de producto, de categoría O reglas globales.
    query_regla = """
        SELECT precio_fijo, porcentaje_descuento
        FROM listas_de_precios_reglas
        WHERE lista_de_precio_id = %s
          AND (
                producto_id = %s OR
                categoria_id = %s OR
                aplicar_a_todas_categorias = TRUE
              )
          AND cantidad_minima <= %s
        ORDER BY
            producto_id IS NOT NULL DESC,      -- 1. Máxima prioridad: Regla por producto específico.
            categoria_id IS NOT NULL DESC,     -- 2. Media prioridad: Regla por categoría específica.
            aplicar_a_todas_categorias DESC,   -- 3. Baja prioridad: Regla para "todas las categorías".
            cantidad_minima DESC               -- 4. Desempate por cantidad.
        LIMIT 1
    """
    db_cursor.execute(query_regla, (lista_de_precio_id, producto_id, categoria_id_producto, cantidad))
    regla = db_cursor.fetchone()

    # 4. Calcular el precio final
    if not regla:
        return precio_base # No se encontró regla, usar precio base
    
    if regla['precio_fijo'] is not None:
        return float(regla['precio_fijo'])
    
    if regla['porcentaje_descuento'] is not None:
        descuento = float(regla['porcentaje_descuento'])
        precio_final = float(precio_base) * (1 - (descuento / 100))
        return round(precio_final, 2)
        
    return precio_base