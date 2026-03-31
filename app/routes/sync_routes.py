from flask import Blueprint, jsonify, g, request
from app.auth_decorator import token_required 
from app.database import get_db             
from datetime import datetime, timezone
import json

bp = Blueprint('sync', __name__)

@bp.route('/negocios/<int:negocio_id>/sync/snapshot', methods=['GET'])
@token_required
def get_sync_snapshot(current_user, negocio_id):
    db = get_db()
    
    # 1. CLIENTES (Solo los asignados a sus rutas activas)
    vendedor_id = current_user.get('vendedor_id')
    db.execute("""
        SELECT DISTINCT
            c.id, c.nombre, c.direccion, c.telefono, c.email, c.zona_id, c.latitud, c.longitud, 
            0.0 as saldo_ctacte
        FROM clientes c
        JOIN hoja_ruta_items hri ON c.id = hri.cliente_id
        JOIN hoja_ruta hr ON hri.hoja_ruta_id = hr.id
        WHERE c.negocio_id = %s AND hr.vendedor_id = %s AND hr.estado = 'activa'
    """, (negocio_id, vendedor_id))
    clientes = db.fetchall()
    
    # 2. PRODUCTOS
    db.execute('SELECT id, nombre, codigo_barras, stock, unidad_medida as unidad, precio_venta as precio_base, imagen_url FROM productos WHERE negocio_id = %s', (negocio_id,))
    productos = db.fetchall()
    
    # 3. LISTAS DE PRECIOS
    db.execute("SELECT id, nombre as nombre_lista, 'ARS' as moneda, 0.0 as margen_sugerido, descripcion as descripcion_regla FROM listas_de_precios WHERE negocio_id = %s", (negocio_id,))
    listas_precios = db.fetchall()
    
    # 4. PRECIOS
    db.execute('SELECT id, producto_id, lista_de_precio_id as lista_precio_id, precio as valor FROM precios_especificos WHERE negocio_id = %s', (negocio_id,))
    precios = db.fetchall()

    # 5. ZONAS
    db.execute('SELECT id, nombre, descripcion FROM zonas WHERE negocio_id = %s', (negocio_id,))
    zonas = db.fetchall()

    # 6. UNIDADES
    db.execute('SELECT id, nombre, abreviatura FROM unidades_medida WHERE negocio_id = %s', (negocio_id,))
    unidades = db.fetchall()
 
    # 7. HOJAS DE RUTA ACTIVAS (Solo del vendedor logueado)
    vendedor_id = current_user.get('vendedor_id')
    db.execute("""
        SELECT id, estado, fecha::text, vendedor_id
        FROM hoja_ruta 
        WHERE negocio_id = %s AND vendedor_id = %s AND estado IN ('borrador', 'activa')
    """, (negocio_id, vendedor_id))
    hojas_ruta = db.fetchall()

    # 8. ASIGNACIONES DE CLIENTES (HOJA_RUTA_ITEMS) de estas rutas
    if hojas_ruta:
        ids_rutas = tuple(r['id'] for r in hojas_ruta)
        # Handle single ID for tuple
        if len(ids_rutas) == 1:
            db.execute("SELECT id, hoja_ruta_id, cliente_id FROM hoja_ruta_items WHERE hoja_ruta_id = %s", (ids_rutas[0],))
        else:
            db.execute("SELECT id, hoja_ruta_id, cliente_id FROM hoja_ruta_items WHERE hoja_ruta_id IN %s", (ids_rutas,))
        hoja_ruta_clientes = db.fetchall()
    else:
        hoja_ruta_clientes = []

    # 9. NOMBRE DEL NEGOCIO
    db.execute("SELECT nombre FROM negocios WHERE id = %s", (negocio_id,))
    negocio_row = db.fetchone()
    negocio_nombre = negocio_row['nombre'] if negocio_row else "Mi Negocio"

    # 10. PEDIDOS RECIENTES (Hechos por este vendedor)
    db.execute("""
        SELECT 
            COALESCE(uuid_local, 'server-' || p.id::text) as uuid_local, 
            cliente_id, 
            total::FLOAT as total, 
            observaciones, 
            hoja_ruta_id, 'sincronizado' as estado_sync, 
            (extract(epoch from fecha_estado)*1000)::BIGINT as creado_en,
            c.nombre as cliente_nombre,
            p.negocio_id,
            '[]' as items_json
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        WHERE p.vendedor_id = %s AND p.negocio_id = %s
        ORDER BY fecha_estado DESC
        LIMIT 100
    """, (vendedor_id, negocio_id))
    recientes = db.fetchall()

    return jsonify({
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'negocio_id': negocio_id,
        'negocio_nombre': negocio_nombre,
        'clientes': clientes,
        'productos': productos,
        'listas_precios': listas_precios,
        'precios': precios,
        'zonas': zonas,
        'unidades': unidades,
        'hojas_ruta': hojas_ruta,
        'hoja_ruta_clientes': hoja_ruta_clientes,
        'pedidos_recientes': recientes
    }), 200


@bp.route('/negocios/<int:negocio_id>/sync/pedidos-offline', methods=['POST'])
@token_required
def sync_pedidos_offline(current_user, negocio_id):
    data = request.get_json()
    pedidos = data.get('pedidos', [])
    db = get_db()
    
    procesados = 0
    errores = []
    
    vendedor_id = current_user.get('vendedor_id')

    for p in pedidos:
        uuid_local = p.get('uuid_local')
        cliente_id = p.get('cliente_id')
        total = p.get('total', 0)
        observaciones = p.get('observaciones', '')
        
        items_raw = p.get('items_json', p.get('items', []))
        # si vienen como string JSON, parsearlo
        if isinstance(items_raw, str):
            try:
                items = json.loads(items_raw)
            except Exception:
                items = []
        else:
            items = items_raw

        if not uuid_local or not cliente_id or not items:
            errores.append({'uuid': uuid_local, 'error': 'Datos incompletos'})
            continue

        try:
            # 1. Verificar deduplicación usando UUID
            db.execute("SELECT id FROM pedidos WHERE uuid_local = %s AND negocio_id = %s", (uuid_local, negocio_id))
            if db.fetchone():
                procesados += 1 # Ya estaba procesado, saltar sin error
                continue
            
            hoja_ruta_id = p.get('hoja_ruta_id')
            
            # ✨ FALLBACK: Si no viene ruta, intentamos encontrar una ruta activa para este cliente/vendedor
            if not hoja_ruta_id or hoja_ruta_id == -1:
                db.execute("""
                    SELECT hr.id 
                    FROM hoja_ruta hr
                    JOIN hoja_ruta_items hri ON hr.id = hri.hoja_ruta_id
                    WHERE hr.negocio_id = %s AND hr.vendedor_id = %s 
                      AND hri.cliente_id = %s AND hr.estado = 'activa'
                    LIMIT 1
                """, (negocio_id, vendedor_id, cliente_id))
                row = db.fetchone()
                if row:
                    hoja_ruta_id = row['id']
                    
            # Insertar Cabecera (ahora con hoja_ruta_id!)
            db.execute(
                """
                INSERT INTO pedidos (negocio_id, cliente_id, vendedor_id, usuario_id, hoja_ruta_id, observaciones, total, fecha_estado, uuid_local, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pendiente') RETURNING id
                """,
                (negocio_id, cliente_id, vendedor_id, current_user['id'], hoja_ruta_id, observaciones, total, datetime.now(), uuid_local)
            )
            pedido_id = db.fetchone()['id']

            # 2. Guardar detalles
            total_real = 0
            for item in items:
                cantidad = float(item['cantidad'])
                precio_unitario = float(item['precio_unitario'])
                bonificacion = float(item.get('bonificacion', 0))
                
                cant_cobrada = max(0.0, cantidad - bonificacion)
                subtotal = cant_cobrada * precio_unitario
                total_real += subtotal
                
                db.execute(
                    """
                    INSERT INTO pedidos_detalle (pedido_id, producto_id, cantidad, precio_unitario, subtotal, bonificacion)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (pedido_id, item['producto_id'], cantidad, precio_unitario, subtotal, bonificacion)
                )

            # 3. Actualizar total real
            db.execute("UPDATE pedidos SET total = %s WHERE id = %s", (total_real, pedido_id))

            procesados += 1

        except Exception as e:
            errores.append({'uuid': uuid_local, 'error': str(e)})

    # Commit after batch
    g.db_conn.commit()

    return jsonify({
        'message': f'Sync finalizada. Procesados: {procesados}, Errores: {len(errores)}',
        'procesados': procesados,
        'errores': errores
    }), 200
