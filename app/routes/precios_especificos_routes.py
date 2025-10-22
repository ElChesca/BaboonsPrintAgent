# app/routes/precios_especificos_routes.py
from flask import Blueprint, jsonify, request, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('precios_especificos', __name__, url_prefix='/api')

@bp.route('/negocios/<int:negocio_id>/precios_especificos/bulk', methods=['POST'])
@token_required
def save_precios_especificos_bulk(current_user, negocio_id):
    """
    Recibe una lista de precios específicos para una lista de precios dada y los guarda (inserta o actualiza).
    Si el precio es nulo o vacío, elimina el precio específico existente.
    """
    data = request.get_json()
    lista_de_precio_id = data.get('lista_de_precio_id')
    precios = data.get('precios', []) # Espera una lista de {producto_id: X, precio: Y}

    if not lista_de_precio_id or not isinstance(precios, list):
        return jsonify({'error': 'Datos inválidos'}), 400

    db = get_db()
    try:
        # Usamos una sola transacción
        for item in precios:
            producto_id = item.get('producto_id')
            precio = item.get('precio')

            if not producto_id: continue # Saltar si falta producto_id

            if precio is not None and precio != '':
                # Si hay precio, hacemos UPSERT
                db.execute(
                    """
                    INSERT INTO precios_especificos (negocio_id, lista_de_precio_id, producto_id, precio)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (negocio_id, lista_de_precio_id, producto_id) 
                    DO UPDATE SET precio = EXCLUDED.precio
                    """,
                    (negocio_id, lista_de_precio_id, producto_id, precio)
                )
            else:
                # Si el precio es null o vacío, eliminamos el registro si existe
                db.execute(
                    """
                    DELETE FROM precios_especificos
                    WHERE negocio_id = %s AND lista_de_precio_id = %s AND producto_id = %s
                    """,
                    (negocio_id, lista_de_precio_id, producto_id)
                )
        
        g.db_conn.commit()
        return jsonify({'message': 'Precios específicos guardados con éxito'}), 200
    except Exception as e:
        g.db_conn.rollback()
        print(f"!!! ERROR saving specific prices: {e}")
        return jsonify({'error': f'Error al guardar precios: {str(e)}'}), 500
    

@bp.route('/negocios/<int:negocio_id>/listas_precios/<int:lista_id>/precios_especificos', methods=['GET'])
@token_required
def get_precios_especificos_por_lista(current_user, negocio_id, lista_id):
    """
    Devuelve un diccionario {producto_id: precio} con los precios específicos
    definidos para una lista y negocio específicos.
    """
    db = get_db()
    try:
        db.execute(
            """
            SELECT producto_id, precio 
            FROM precios_especificos 
            WHERE negocio_id = %s AND lista_de_precio_id = %s
            """,
            (negocio_id, lista_id)
        )
        precios = {row['producto_id']: float(row['precio']) for row in db.fetchall()}
        return jsonify(precios)
    except Exception as e:
        print(f"!!! ERROR getting specific prices for list {lista_id}: {e}")
        return jsonify({'error': f'Error al obtener precios específicos: {str(e)}'}), 500
    

@bp.route('/negocios/<int:negocio_id>/precios_especificos/importar', methods=['POST'])
@token_required
def importar_precios_especificos(current_user, negocio_id):
    data = request.get_json()
    lista_de_precio_id = data.get('lista_de_precio_id')
    precios_data = data.get('precios', []) # Lista de {sku: X, precio: Y}

    if not lista_de_precio_id or not isinstance(precios_data, list):
        return jsonify({'error': 'Datos inválidos (falta lista_id o formato de precios incorrecto)'}), 400

    db = get_db()
    errores = []
    exitosos = 0
    
    try:
        with db.cursor() as cursor: # Usamos un cursor para manejar transacciones
            for index, item in enumerate(precios_data):
                sku = item.get('sku')
                precio = item.get('precio')
                fila_num = index + 2 # +1 por índice base 0, +1 por cabecera Excel

                if not sku:
                    errores.append({'fila': fila_num, 'sku': sku, 'error': 'Falta SKU'})
                    continue

                # Buscar producto_id por SKU para este negocio
                cursor.execute("SELECT id FROM productos WHERE sku = %s AND negocio_id = %s", (str(sku), negocio_id))
                producto_row = cursor.fetchone()

                if not producto_row:
                    errores.append({'fila': fila_num, 'sku': sku, 'error': 'SKU no encontrado para este negocio'})
                    continue
                
                producto_id = producto_row['id']

                try:
                    # Validar y formatear precio
                    if precio is not None and precio != '':
                        precio_validado = float(precio)
                        # UPSERT
                        cursor.execute(
                            """
                            INSERT INTO precios_especificos (negocio_id, lista_de_precio_id, producto_id, precio)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (negocio_id, lista_de_precio_id, producto_id) 
                            DO UPDATE SET precio = EXCLUDED.precio
                            """,
                            (negocio_id, lista_de_precio_id, producto_id, precio_validado)
                        )
                        exitosos += 1
                    else:
                        # Si el precio es null o vacío, eliminar
                        cursor.execute(
                            "DELETE FROM precios_especificos WHERE negocio_id = %s AND lista_de_precio_id = %s AND producto_id = %s",
                            (negocio_id, lista_de_precio_id, producto_id)
                        )
                        # Consideramos la eliminación como exitosa si existía o no
                        exitosos += 1 

                except (ValueError, TypeError):
                     errores.append({'fila': fila_num, 'sku': sku, 'error': f'Precio inválido: {precio}'})
                except Exception as db_err:
                     errores.append({'fila': fila_num, 'sku': sku, 'error': f'Error DB: {db_err}'})
                     # Podríamos decidir si continuar o detener todo en caso de error de DB

            g.db_conn.commit() # Confirma todos los cambios si no hubo error grave

        mensaje = f"Importación completada. {exitosos} precios procesados."
        if errores:
            mensaje += f" Se encontraron {len(errores)} errores."
            
        return jsonify({'message': mensaje, 'errores': errores}), 200

    except Exception as e:
        g.db_conn.rollback() # Revierte todo si hubo un error general
        print(f"!!! ERROR importing specific prices: {e}")
        return jsonify({'error': f'Error general en la importación: {str(e)}'}), 500