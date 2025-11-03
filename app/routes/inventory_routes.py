# app/routes/inventory_routes.py
# ✨ VERSIÓN CORREGIDA SIN CARACTERES INVÁLIDOS ✨

from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime
import io  # <--- ✨ AÑADIR ESTA IMPORTACIÓN
import csv # <--- ✨ AÑADIR ESTA IMPORTACIÓN

bp = Blueprint('inventario_ops', __name__, url_prefix='/api')

# --- TU FUNCIÓN ORIGINAL (SIN CAMBIOS) ---
@bp.route('/inventario/ajustar', methods=['POST'])
@token_required
def ajustar_stock(current_user):
    data = request.get_json()
    producto_id = data.get('producto_id')
    cantidad_nueva = data.get('cantidad_nueva')
    negocio_id = data.get('negocio_id') # Necesitamos saber a qué negocio pertenece

    if producto_id is None or cantidad_nueva is None or negocio_id is None:
        return jsonify({'error': 'Faltan datos requeridos (producto_id, cantidad_nueva, negocio_id)'}), 400

    try:
        cantidad_nueva = int(cantidad_nueva)
    except ValueError:
        return jsonify({'error': 'La cantidad nueva debe ser un número entero'}), 400

    db = get_db()
    try:
        # 1. Obtener stock actual para loguear
        db.execute("SELECT stock FROM productos WHERE id = %s AND negocio_id = %s", (producto_id, negocio_id))
        producto = db.fetchone()
        if not producto:
            return jsonify({'error': 'Producto no encontrado en este negocio'}), 404
        
        cantidad_anterior = producto['stock']
        diferencia = cantidad_nueva - cantidad_anterior

        # 2. Actualizar el stock en la tabla de productos
        db.execute("UPDATE productos SET stock = %s WHERE id = %s", (cantidad_nueva, producto_id))

        # 3. Registrar el ajuste en la tabla de historial
        db.execute(
            """
            INSERT INTO inventario_ajustes 
            (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (producto_id, current_user['id'], negocio_id, cantidad_anterior, cantidad_nueva, diferencia)
        )

        g.db_conn.commit()
        return jsonify({'message': 'Stock actualizado con éxito'}), 200

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# --- ✨ NUEVA RUTA DE IMPORTACIÓN ---
@bp.route('/negocios/<int:negocio_id>/productos/importar', methods=['POST'])
@token_required
def importar_productos(current_user, negocio_id):
    
    if 'archivo_productos' not in request.files:
        return jsonify({'error': 'No se encontró el archivo en la solicitud'}), 400

    file = request.files['archivo_productos']
    
    if file.filename == '':
        return jsonify({'error': 'No se seleccionó ningún archivo'}), 400

    if not (file and file.filename.endswith('.csv')):
        return jsonify({'error': 'Formato de archivo no válido. Solo se acepta .csv'}), 400

    db = get_db()
    creados = 0
    actualizados = 0
    errores = []
    
    # Usamos io.TextIOWrapper para leer el archivo como texto
    # 'utf-8-sig' maneja el BOM (Byte Order Mark) que Excel suele añadir
    try:
        stream = io.TextIOWrapper(file.stream, encoding='utf-8-sig')
        # Usamos DictReader para leer las filas como diccionarios
        csv_reader = csv.DictReader(stream, delimiter=';') # Asumimos ';' como delimitador
        
        # Normalizar nombres de cabecera (minúsculas, sin espacios/acentos)
        cabeceras_esperadas = [
            'sku', 'nombre', 'precio_venta', 'stock', 
            'precio_costo', 'stock_minimo', 'categoria', 'proveedor', 
            'codigo_barras', 'alias', 'unidad_medida'
        ]
        csv_reader.fieldnames = [
            f.strip().lower().replace(' ', '_').replace('ó', 'o').replace('í', 'i') 
            for f in csv_reader.fieldnames
        ]

        if 'sku' not in csv_reader.fieldnames or 'nombre' not in csv_reader.fieldnames or 'precio_venta' not in csv_reader.fieldnames:
            return jsonify({'error': 'El CSV debe contener al menos las columnas "SKU", "Nombre" y "Precio_Venta".'}), 400

        fila_num = 1
        for fila in csv_reader:
            fila_num += 1
            try:
                # --- 1. Limpieza y validación de datos ---
                sku = fila.get('sku') or None
                nombre = fila.get('nombre')
                precio_venta = float(fila.get('precio_venta', 0).replace(',', '.'))
                
                if not nombre or precio_venta is None:
                    errores.append(f"Fila {fila_num}: Faltan 'nombre' o 'precio_venta'. Se omite.")
                    continue
                
                # Datos opcionales con valores por defecto
                stock = float(fila.get('stock', 0) or 0)
                precio_costo = float(fila.get('precio_costo', 0) or 0) or None
                stock_minimo = float(fila.get('stock_minimo', 0) or 0)
                codigo_barras = fila.get('codigo_barras') or None
                alias = fila.get('alias') or None
                unidad_medida = fila.get('unidad_medida') or 'un'

                # --- 2. Resolución de IDs (Categoría y Proveedor) ---
                categoria_id = None
                nombre_cat = fila.get('categoria')
                if nombre_cat:
                    db.execute("SELECT id FROM categorias WHERE nombre = %s AND negocio_id = %s", (nombre_cat, negocio_id))
                    cat = db.fetchone()
                    if cat:
                        categoria_id = cat['id']
                    else:
                        errores.append(f"Fila {fila_num} (SKU: {sku}): No se encontró la categoría '{nombre_cat}'. Se asigna 'Sin categoría'.")

                proveedor_id = None
                nombre_prov = fila.get('proveedor')
                if nombre_prov:
                    db.execute("SELECT id FROM proveedores WHERE nombre = %s AND negocio_id = %s", (nombre_prov, negocio_id))
                    prov = db.fetchone()
                    if prov:
                        proveedor_id = prov['id']
                    else:
                        errores.append(f"Fila {fila_num} (SKU: {sku}): No se encontró el proveedor '{nombre_prov}'. Se asigna 'Sin proveedor'.")

                # --- 3. Lógica "UPSERT" (Crear o Actualizar) ---
                # Buscamos por SKU (si existe) o por Nombre (si SKU es nulo)
                producto_existente = None
                if sku:
                    db.execute("SELECT id, stock FROM productos WHERE sku = %s AND negocio_id = %s", (sku, negocio_id))
                    producto_existente = db.fetchone()
                
                if not producto_existente and not sku:
                    # Si no hay SKU, buscamos por nombre exacto para evitar duplicados
                    db.execute("SELECT id, stock FROM productos WHERE nombre = %s AND negocio_id = %s", (nombre, negocio_id))
                    producto_existente = db.fetchone()

                if producto_existente:
                    # --- ACTUALIZAR ---
                    producto_id = producto_existente['id']
                    cantidad_anterior = producto_existente['stock']
                    db.execute(
                        """
                        UPDATE productos SET
                            nombre = %s, precio_venta = %s, stock = %s, precio_costo = %s, 
                            stock_minimo = %s, categoria_id = %s, proveedor_id = %s,
                            codigo_barras = %s, alias = %s, unidad_medida = %s
                        WHERE id = %s
                        """,
                        (nombre, precio_venta, stock, precio_costo, stock_minimo, categoria_id, 
                         proveedor_id, codigo_barras, alias, unidad_medida, producto_id)
                    )
                    
                    # Loguear el ajuste de stock si cambió
                    diferencia = stock - cantidad_anterior
                    if diferencia != 0:
                        db.execute(
                            """
                            INSERT INTO inventario_ajustes 
                            (producto_id, usuario_id, negocio_id, cantidad_anterior, cantidad_nueva, diferencia, motivo)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (producto_id, current_user['id'], negocio_id, cantidad_anterior, stock, diferencia, 'Importación Masiva')
                        )
                    actualizados += 1
                
                else:
                    # --- CREAR ---
                    db.execute(
                        """
                        INSERT INTO productos
                        (negocio_id, sku, nombre, precio_venta, stock, precio_costo, 
                         stock_minimo, categoria_id, proveedor_id, codigo_barras, alias, unidad_medida)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (negocio_id, sku, nombre, precio_venta, stock, precio_costo, stock_minimo, 
                         categoria_id, proveedor_id, codigo_barras, alias, unidad_medida)
                    )
                    creados += 1

            except Exception as e_fila:
                # Captura error por fila (ej. 'abc' en un campo de número)
                errores.append(f"Fila {fila_num} (SKU: {fila.get('sku')}): Error de datos ({str(e_fila)}). Se omite.")

        # Si todo salió bien, confirma la transacción
        g.db_conn.commit()
        
        return jsonify({
            'message': 'Importación completada.',
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores
        }), 200

    except Exception as e:
        # Si hay un error grande (ej. cabeceras mal), revierte todo
        g.db_conn.rollback()
        return jsonify({'error': f'Error crítico durante el procesamiento: {str(e)}'}), 500
    
    