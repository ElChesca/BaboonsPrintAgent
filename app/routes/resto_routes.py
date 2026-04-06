# app/routes/resto_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required
import datetime

bp = Blueprint('resto', __name__)

# --- MESAS ---

@bp.route('/negocios/<int:negocio_id>/stats', methods=['GET'])
@token_required
def get_resto_stats(current_user, negocio_id):
    db = get_db()
    try:
        # Asegurar columna para tiempos de demora
        try:
            db.execute("ALTER TABLE comandas_detalle ADD COLUMN IF NOT EXISTS fecha_estado_cambiado TIMESTAMP WITH TIME ZONE")
            # Crear tabla de cola de impresión si no existe (PostgreSQL)
            db.execute("""
                CREATE TABLE IF NOT EXISTS resto_cola_impresion (
                    id SERIAL PRIMARY KEY,
                    negocio_id INTEGER NOT NULL,
                    payload JSONB NOT NULL,
                    estado VARCHAR(20) DEFAULT 'pendiente',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            g.db_conn.commit()
        except:
            pass

        hoy = datetime.date.today()
        
        # 1. Resumen de Hoy
        db.execute("""
            SELECT COUNT(*) filter (where metodo_pago LIKE 'Ventas Restó%%') as total_ventas,
                   COALESCE(SUM(total) filter (where metodo_pago LIKE 'Ventas Restó%%'), 0) as monto_total
            FROM ventas 
            WHERE negocio_id = %s AND fecha::date = %s
        """, (negocio_id, hoy))
        resumen = db.fetchone()
        
        # 2. Ranking de Empleados (Ventas Restó Hoy)
        db.execute("""
            SELECT v.nombre, COALESCE(SUM(ve.total), 0) as total_vendido
            FROM vendedores v
            LEFT JOIN ventas ve ON v.id = ve.vendedor_id AND ve.fecha::date = %s AND ve.metodo_pago LIKE 'Ventas Restó%%'
            WHERE v.negocio_id = %s AND v.activo = TRUE
            GROUP BY v.id, v.nombre
            ORDER BY total_vendido DESC
        """, (hoy, negocio_id))
        ranking_staff = [dict(r) for r in db.fetchall()]
        
        # 3. Top 5 Productos del Menú (Hoy)
        db.execute("""
            SELECT mi.nombre, SUM(vd.cantidad) as total_cantidad
            FROM ventas_detalle vd
            JOIN ventas v ON vd.venta_id = v.id
            JOIN menu_items mi ON vd.producto_id = mi.producto_id
            WHERE v.negocio_id = %s AND v.fecha::date = %s AND v.metodo_pago LIKE 'Ventas Restó%%'
            GROUP BY mi.id, mi.nombre
            ORDER BY total_cantidad DESC
            LIMIT 5
        """, (negocio_id, hoy))
        top_productos = [dict(r) for r in db.fetchall()]
        
        # 4. Estado de Mesas actual
        db.execute("SELECT estado, COUNT(*) as cantidad FROM mesas WHERE negocio_id = %s GROUP BY estado", (negocio_id,))
        mesas_estado = {r['estado']: r['cantidad'] for r in db.fetchall()}

        # 5. Conteo de PAX (Cubiertos) del día
        db.execute("""
            SELECT COALESCE(SUM(num_comensales), 0) as total_pax
            FROM comandas 
            WHERE negocio_id = %s AND fecha_apertura::date = %s
        """, (negocio_id, hoy))
        pax_data = db.fetchone()

        # 6. Tiempo Promedio de Preparación (Hoy)
        db.execute("""
            SELECT AVG(EXTRACT(EPOCH FROM (fecha_estado_cambiado - fecha_pedido)) / 60) as promedio_min
            FROM comandas_detalle
            WHERE estado IN ('cobrado', 'entregado') 
              AND fecha_pedido::date = %s
              AND fecha_estado_cambiado IS NOT NULL
        """, (hoy,))
        tiempo_data = db.fetchone()
        promedio_preparacion = round(float(tiempo_data['promedio_min']), 1) if tiempo_data and tiempo_data['promedio_min'] else 0

        return jsonify({
            'resumen': dict(resumen),
            'ranking_staff': ranking_staff,
            'top_productos': top_productos,
            'mesas_estado': mesas_estado,
            'pax_hoy': int(pax_data['total_pax']) if pax_data else 0,
            'tiempo_promedio_min': promedio_preparacion
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- CATEGORÍAS Y LISTAS DE PRECIOS ---

@bp.route('/negocios/<int:negocio_id>/menu/setup-default', methods=['POST'])
@token_required
def setup_default_menu(current_user, negocio_id):
    db = get_db()
    try:
        # 1. Asegurar Tablas y Columnas (Migración Segura)
        db.execute("""
            CREATE TABLE IF NOT EXISTS menu_listas (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER REFERENCES negocios(id),
                nombre VARCHAR(100) NOT NULL,
                es_default BOOLEAN DEFAULT FALSE,
                activa BOOLEAN DEFAULT TRUE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS menu_item_precios (
                id SERIAL PRIMARY KEY,
                menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
                lista_id INTEGER REFERENCES menu_listas(id) ON DELETE CASCADE,
                precio NUMERIC(15, 2) NOT NULL,
                UNIQUE(menu_item_id, lista_id)
            )
        """)
        db.execute("ALTER TABLE menu_categorias ADD COLUMN IF NOT EXISTS orden INTEGER DEFAULT 0")
        db.execute("ALTER TABLE comandas ADD COLUMN IF NOT EXISTS lista_id INTEGER REFERENCES menu_listas(id)")
        g.db_conn.commit()

        # 2. Crear Lista "General" si no existe
        db.execute("SELECT id FROM menu_listas WHERE negocio_id = %s AND es_default = TRUE", (negocio_id,))
        if not db.fetchone():
            db.execute("INSERT INTO menu_listas (negocio_id, nombre, es_default) VALUES (%s, 'General', TRUE) RETURNING id", (negocio_id,))
            lista_gen_id = db.fetchone()['id']
            # Migrar precios actuales a la lista general
            db.execute("""
                INSERT INTO menu_item_precios (menu_item_id, lista_id, precio)
                SELECT id, %s, precio FROM menu_items WHERE negocio_id = %s
                ON CONFLICT DO NOTHING
            """, (lista_gen_id, negocio_id))
            g.db_conn.commit()

        # 3. Crear Categorías por Defecto (Desayunos, Almuerzos, Cenas, Eventos, Otra)
        cats_defecto = [
            ('Desayunos', 1), ('Almuerzos', 2), ('Cenas', 3), ('Eventos', 4), ('Otra', 5)
        ]
        for nombre, orden in cats_defecto:
            db.execute("SELECT id FROM menu_categorias WHERE negocio_id = %s AND nombre = %s", (negocio_id, nombre))
            if not db.fetchone():
                db.execute("INSERT INTO menu_categorias (negocio_id, nombre, orden) VALUES (%s, %s, %s)", (negocio_id, nombre, orden))
        
        # 4. Tabla de Impresoras (Relación KDS)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_impresoras (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER REFERENCES negocios(id),
                nombre VARCHAR(100),
                ip VARCHAR(50),
                estacion VARCHAR(50), -- Link con cat.estacion (cocina, barra, etc.)
                es_caja BOOLEAN DEFAULT FALSE,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        try:
            db.execute("ALTER TABLE resto_impresoras ADD COLUMN IF NOT EXISTS es_caja BOOLEAN DEFAULT FALSE")
            g.db_conn.commit()
        except:
            g.db_conn.rollback()
        g.db_conn.commit()
        return jsonify({'message': 'Entorno de Restó configurado correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- CONFIGURACIÓN DE IMPRESORAS ---

@bp.route('/negocios/<int:negocio_id>/impresoras', methods=['GET'])
@token_required
def get_impresoras(current_user, negocio_id):
    db = get_db()
    try:
        db.execute("SELECT * FROM resto_impresoras WHERE negocio_id = %s ORDER BY nombre", (negocio_id,))
        return jsonify([dict(r) for r in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/impresoras', methods=['POST'])
@token_required
def save_impresora(current_user, negocio_id):
    data = request.get_json()
    nombre = data.get('nombre')
    ip = data.get('ip')
    estacion = data.get('estacion', 'cocina') # barra, cocina, postre, etc.
    es_caja = data.get('es_caja', False)

    if not nombre or not ip:
        return jsonify({'error': 'Nombre e IP son obligatorios'}), 400

    db = get_db()
    try:
        # Si es_caja = True, desactivar otros para este negocio
        if es_caja:
            db.execute("UPDATE resto_impresoras SET es_caja = FALSE WHERE negocio_id = %s", (negocio_id,))

        db.execute(
            "INSERT INTO resto_impresoras (negocio_id, nombre, ip, estacion, es_caja) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, nombre, ip, estacion, es_caja)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Impresora registrada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/impresoras/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def manage_impresora(current_user, id):
    db = get_db()
    if request.method == 'DELETE':
        try:
            db.execute("DELETE FROM resto_impresoras WHERE id = %s", (id,))
            g.db_conn.commit()
            return jsonify({'message': 'Impresora eliminada'})
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # PUT
    data = request.get_json()
    campos = []
    valores = []
    
    # Obtener el negocio_id de esta impresora para el manejo de es_caja
    db.execute("SELECT negocio_id FROM resto_impresoras WHERE id = %s", (id,))
    imp_row = db.fetchone()
    if not imp_row:
        return jsonify({'error': 'Impresora no encontrada'}), 404
    negocio_id = imp_row['negocio_id']

    if data.get('es_caja') == True:
        db.execute("UPDATE resto_impresoras SET es_caja = FALSE WHERE negocio_id = %s", (negocio_id,))
        campos.append("es_caja = %s")
        valores.append(True)
    elif 'es_caja' in data:
        campos.append("es_caja = %s")
        valores.append(data['es_caja'])

    for k in ['nombre', 'ip', 'estacion']:
        if k in data:
            campos.append(f"{k} = %s")
            valores.append(data[k])
    
    if not campos:
        return jsonify({'error': 'Sin campos para editar'}), 400
        
    valores.append(id)
    try:
        db.execute(f"UPDATE resto_impresoras SET {', '.join(campos)} WHERE id = %s", tuple(valores))
        g.db_conn.commit()
        return jsonify({'message': 'Impresora actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/listas', methods=['GET'])
@token_required
def get_menu_listas(current_user, negocio_id):
    db = get_db()
    # Migración silenciosa
    try:
        db.execute("ALTER TABLE menu_listas ADD COLUMN IF NOT EXISTS mensaje_banner TEXT")
        db.execute("ALTER TABLE menu_listas ADD COLUMN IF NOT EXISTS banner_url TEXT")
        g.db_conn.commit()
    except:
        pass
    
    db.execute("SELECT * FROM menu_listas WHERE negocio_id = %s AND activa = TRUE ORDER BY es_default DESC, nombre", (negocio_id,))
    listas = db.fetchall()
    
    if not listas:
        # Auto-crear lista por defecto si no hay ninguna activa
        db.execute("INSERT INTO menu_listas (negocio_id, nombre, es_default, activa) VALUES (%s, 'General', TRUE, TRUE)", (negocio_id,))
        g.db_conn.commit()
        db.execute("SELECT * FROM menu_listas WHERE negocio_id = %s AND activa = TRUE ORDER BY es_default DESC, nombre", (negocio_id,))
        listas = db.fetchall()
        
    return jsonify([dict(r) for r in listas])

@bp.route('/negocios/<int:negocio_id>/menu/listas', methods=['POST'])
@token_required
def add_menu_lista(current_user, negocio_id):
    data = request.get_json()
    db = get_db()
    try:
        db.execute("INSERT INTO menu_listas (negocio_id, nombre, activa) VALUES (%s, %s, TRUE) RETURNING id", (negocio_id, data['nombre']))
        new_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': new_id, 'message': 'Lista creada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/listas/<int:lista_id>', methods=['PUT', 'DELETE'])
@token_required
def manage_menu_lista(current_user, negocio_id, lista_id):
    db = get_db()
    if request.method == 'DELETE':
        try:
            # No borrar físicamente por integridad de comandas históricas
            db.execute("UPDATE menu_listas SET activa = FALSE WHERE id = %s AND negocio_id = %s", (lista_id, negocio_id))
            g.db_conn.commit()
            return jsonify({'message': 'Lista eliminada (desactivada)'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # PUT
    data = request.get_json()
    validos = ['nombre', 'mensaje_banner', 'banner_url', 'activa']
    campos = [f"{k} = %s" for k in data.keys() if k in validos]
    valores = [v for k, v in data.items() if k in validos]
    
    if not campos:
        return jsonify({'error': 'Sin campos para actualizar'}), 400
        
    valores.append(lista_id)
    valores.append(negocio_id)
    try:
        db.execute(f"UPDATE menu_listas SET {', '.join(campos)} WHERE id = %s AND negocio_id = %s", tuple(valores))
        g.db_conn.commit()
        return jsonify({'message': 'Lista actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mesas', methods=['GET'])
@token_required
def get_mesas(current_user, negocio_id):
    db = get_db()
    try:
        # Migración segura: Añadir mozo_id y crear tabla de sectores
        try:
            db.execute("ALTER TABLE mesas ADD COLUMN IF NOT EXISTS mozo_id INTEGER REFERENCES vendedores(id)")
            db.execute("""
                CREATE TABLE IF NOT EXISTS mesas_sectores (
                    id SERIAL PRIMARY KEY,
                    negocio_id INTEGER REFERENCES negocios(id),
                    nombre VARCHAR(100) NOT NULL,
                    orden INTEGER DEFAULT 0,
                    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            g.db_conn.commit()
        except:
            pass

        # Traer mesas con mozo fijo y mozo activo (si hay comanda)
        db.execute("""
            SELECT m.*, 
                   v_f.nombre as mozo_fijo_nombre,
                   c.mozo_id as active_mozo_id, 
                   v_a.nombre as active_mozo_nombre, 
                   c.num_comensales as comanda_pax
            FROM mesas m
            LEFT JOIN vendedores v_f ON m.mozo_id = v_f.id
            LEFT JOIN comandas c ON m.comanda_id = c.id AND c.estado = 'abierta'
            LEFT JOIN vendedores v_a ON c.mozo_id = v_a.id
            WHERE m.negocio_id = %s
            ORDER BY m.zona, m.numero
        """, (negocio_id,))
        mesas = db.fetchall()
        return jsonify([dict(m) for m in mesas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- SECTORES DE MESAS ---

@bp.route('/negocios/<int:negocio_id>/sectores', methods=['GET'])
@token_required
def get_sectores(current_user, negocio_id):
    db = get_db()
    try:
        db.execute("SELECT * FROM mesas_sectores WHERE negocio_id = %s ORDER BY orden, nombre", (negocio_id,))
        return jsonify([dict(r) for r in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/sectores', methods=['POST'])
@token_required
def save_sectores(current_user, negocio_id):
    data = request.get_json()
    sectores = data.get('sectores', [])
    db = get_db()
    try:
        for s in sectores:
            if s.get('id'):
                db.execute("UPDATE mesas_sectores SET nombre = %s, orden = %s WHERE id = %s AND negocio_id = %s",
                           (s['nombre'], s.get('orden', 0), s['id'], negocio_id))
            else:
                db.execute("INSERT INTO mesas_sectores (negocio_id, nombre, orden) VALUES (%s, %s, %s)",
                           (negocio_id, s['nombre'], s.get('orden', 0)))
        g.db_conn.commit()
        return jsonify({'message': 'Sectores guardados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/sectores/<int:id>', methods=['DELETE'])
@token_required
def delete_sector(current_user, id):
    db = get_db()
    try:
        # Nota: Por ahora no borramos en cascada las mesas, solo quitamos la referencia o el usuario debe borrarlas antes.
        db.execute("DELETE FROM mesas_sectores WHERE id = %s", (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Sector eliminado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mozos', methods=['GET'])
@bp.route('/negocios/<int:negocio_id>/vendedores', methods=['GET'])
@token_required
def get_vendedores_negocio(current_user, negocio_id):
    db = get_db()
    try:
        db.execute("SELECT id, nombre FROM vendedores WHERE negocio_id = %s AND activo = TRUE ORDER BY nombre", (negocio_id,))
        vendedores = db.fetchall()
        return jsonify([dict(v) for v in vendedores])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mesas', methods=['POST'])
@token_required
def add_mesa(current_user, negocio_id):
    data = request.get_json()
    numero = data.get('numero')
    nombre = data.get('nombre', '')
    capacidad = data.get('capacidad', 2)
    zona = data.get('zona', 'Salon')

    if not numero:
        return jsonify({'error': 'El número de mesa es obligatorio'}), 400

    db = get_db()
    try:
        db.execute(
            "INSERT INTO mesas (negocio_id, numero, nombre, capacidad, zona) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, numero, nombre, capacidad, zona)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Mesa creada con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mesas/bulk-create', methods=['POST'])
@token_required
def bulk_create_mesas(current_user, negocio_id):
    data = request.get_json()
    desde = int(data.get('desde', 1))
    hasta = int(data.get('hasta', 1))
    capacidad = int(data.get('capacidad', 2))
    zona = data.get('zona', 'Salon')

    if hasta < desde:
        return jsonify({'error': 'El número final debe ser mayor o igual al inicial'}), 400

    db = get_db()
    try:
        creadas = 0
        for num in range(desde, hasta + 1):
            # Verificar si ya existe para evitar duplicados
            db.execute("SELECT id FROM mesas WHERE negocio_id = %s AND numero = %s", (negocio_id, num))
            if not db.fetchone():
                db.execute(
                    "INSERT INTO mesas (negocio_id, numero, capacidad, zona) VALUES (%s, %s, %s, %s)",
                    (negocio_id, num, capacidad, zona)
                )
                creadas += 1
        
        g.db_conn.commit()
        return jsonify({'message': f'Se crearon {creadas} mesas correctamente', 'total': creadas}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/mesas/<int:id>', methods=['PUT'])
@token_required
def update_mesa(current_user, id):
    data = request.get_json()
    db = get_db()
    
    campos_validos = ['numero', 'nombre', 'capacidad', 'estado', 'zona']
    fields = [f"{key} = %s" for key in data.keys() if key in campos_validos]
    values = [value for key, value in data.items() if key in campos_validos]

    if not fields:
        return jsonify({'error': 'No hay campos válidos para actualizar'}), 400

    values.append(id)
    try:
        db.execute(f"UPDATE mesas SET {', '.join(fields)} WHERE id = %s", tuple(values))
        g.db_conn.commit()
        return jsonify({'message': 'Mesa actualizada correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mesas/bulk', methods=['PATCH'])
@token_required
def bulk_update_mesas(current_user, negocio_id):
    data = request.get_json()
    ids = data.get('ids', [])
    zona = data.get('zona')
    mozo_id = data.get('mozo_id')

    if not ids:
        return jsonify({'error': 'No se proporcionaron IDs de mesas'}), 400

    db = get_db()
    
    campos = []
    valores = []
    
    if zona is not None:
        campos.append("zona = %s")
        valores.append(zona)
    
    if mozo_id is not None:
        campos.append("mozo_id = %s")
        valores.append(mozo_id if mozo_id != "" else None)

    if not campos:
        return jsonify({'error': 'No hay campos para actualizar'}), 400

    # Añadir negocio_id para seguridad adicional
    valores.append(negocio_id)
    
    try:
        # PostgreSQL permite usar IN con una tupla
        query = f"UPDATE mesas SET {', '.join(campos)} WHERE negocio_id = %s AND id IN %s"
        db.execute(query, tuple(valores + [tuple(ids)]))
        g.db_conn.commit()
        return jsonify({'message': f'{len(ids)} mesas actualizadas correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- COCINA / COMANDAS ---

@bp.route('/negocios/<int:negocio_id>/cocina/pendientes', methods=['GET'])
@token_required
def get_cocina_pendientes(current_user, negocio_id):
    db = get_db()
    try:
        estacion = request.args.get('estacion', 'cocina')
        
        # Primero aseguramos que la columna exista (Migración simple)
        try:
            db.execute("ALTER TABLE menu_categorias ADD COLUMN IF NOT EXISTS estacion VARCHAR(50) DEFAULT 'cocina'")
            db.execute("ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS destino_kds VARCHAR(50)")
            g.db_conn.commit()
        except:
            pass # Si falla (ej. SQLite no soporta IF NOT EXISTS en ALTER), seguimos con precaución
            
        # Traer detalles de comandas que no estén 'entregados' ni 'anulados'
        # Filtrando por la estación de la categoría
        db.execute("""
            SELECT 
                cd.id as detalle_id,
                cd.comanda_id,
                cd.cantidad,
                cd.estado as detalle_estado,
                c.mesa_id,
                m.numero as mesa_numero,
                c.num_comensales,
                mi.nombre as producto_nombre,
                cd.fecha_pedido as pedido_fecha,
                cd.notas as pedido_observaciones,
                cat.nombre as categoria_nombre,
                v.nombre as mozo_nombre
            FROM comandas_detalle cd
            JOIN comandas c ON cd.comanda_id = c.id
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            JOIN menu_categorias cat ON mi.categoria_id = cat.id
            JOIN mesas m ON c.mesa_id = m.id
            JOIN vendedores v ON c.mozo_id = v.id
            WHERE c.negocio_id = %s 
              AND c.estado = 'abierta'
              AND cd.estado IN ('pendiente', 'cocinando')
              AND LOWER(COALESCE(cat.estacion, 'cocina')) = %s
            ORDER BY cd.fecha_pedido ASC
        """, (negocio_id, estacion.lower()))
        pendientes = db.fetchall()
        return jsonify([dict(p) for p in pendientes])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/detalle/<int:id>/estado', methods=['PUT'])
@token_required
def update_detalle_comanda_estado(current_user, id):
    data = request.get_json()
    nuevo_estado = data.get('estado') # pendiente, cocinando, listo, entregado

    if not nuevo_estado:
        return jsonify({'error': 'Falta el estado'}), 400

    db = get_db()
    try:
        # 1. Asegurar columnas auxiliares
        db.execute("ALTER TABLE comandas_detalle ADD COLUMN IF NOT EXISTS fecha_estado_cambiado TIMESTAMP WITH TIME ZONE")
        db.execute("ALTER TABLE comandas_detalle ADD COLUMN IF NOT EXISTS stock_descontado BOOLEAN DEFAULT FALSE")
        
        # 2. Obtener detalle actual para chequear stock
        db.execute("""
            SELECT cd.*, mi.producto_id, mi.stock_control 
            FROM comandas_detalle cd
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            WHERE cd.id = %s
        """, (id,))
        detalle = db.fetchone()
        
        if not detalle:
            return jsonify({'error': 'Detalle no encontrado'}), 404

        # 3. Lógica de Descuento de Stock (SÓLO SI PASA A 'ENTREGADO' Y NO FUE DESCONTADO)
        if nuevo_estado == 'entregado' and not detalle['stock_descontado']:
            # A. Descuento de Receta (BOM)
            db.execute("SELECT * FROM menu_recetas WHERE menu_item_id = %s", (detalle['menu_item_id'],))
            receta = db.fetchall()
            
            if receta:
                for r in receta:
                    db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", 
                               (float(detalle['cantidad']) * float(r['cantidad']), r['insumo_id']))
                db.execute("UPDATE comandas_detalle SET stock_descontado = TRUE WHERE id = %s", (id,))
            
            # B. Descuento de Producto Directo (Si no tiene receta y tiene producto linkeado)
            elif detalle['stock_control'] and detalle['producto_id']:
                db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", 
                           (detalle['cantidad'], detalle['producto_id']))
                db.execute("UPDATE comandas_detalle SET stock_descontado = TRUE WHERE id = %s", (id,))

        # 4. Actualizar estado
        db.execute("UPDATE comandas_detalle SET estado = %s, fecha_estado_cambiado = CURRENT_TIMESTAMP WHERE id = %s", (nuevo_estado, id))
        
        g.db_conn.commit()
        return jsonify({'message': 'Estado actualizado correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/mozo/notificaciones', methods=['GET'])
@token_required
def get_mozo_notificaciones(current_user, negocio_id):
    db = get_db()
    try:
        # Buscamos items que estén 'listo' pero no entregados ni cobrados
        # que pertenezcan a comandas asignadas al usuario actual (si es mozo)
        # o a todas si es admin
        
        query = """
            SELECT 
                cd.id, cd.comanda_id, cd.cantidad, mi.nombre as producto_nombre,
                m.numero as mesa_numero, cd.fecha_pedido
            FROM comandas_detalle cd
            JOIN comandas c ON cd.comanda_id = c.id
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            JOIN mesas m ON c.mesa_id = m.id
            WHERE c.negocio_id = %s 
              AND cd.estado = 'listo'
              AND c.estado = 'abierta'
        """
        params = [negocio_id]
        
        # Opcional: Filtrar por mozo si el usuario es mozo
        # Para simplificar ahora, traemos todos los del negocio
        
        db.execute(query, tuple(params))
        notifs = db.fetchall()
        return jsonify([dict(n) for n in notifs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/mesas/<int:id>', methods=['DELETE'])
@token_required
def delete_mesa(current_user, id):
    db = get_db()
    try:
        # Verificar si la mesa tiene comandas activas
        db.execute("SELECT COUNT(*) as count FROM comandas WHERE mesa_id = %s AND estado = 'abierta'", (id,))
        if db.fetchone()['count'] > 0:
            return jsonify({'error': 'No se puede eliminar una mesa con comandas abiertas'}), 400

        db.execute("DELETE FROM mesas WHERE id = %s", (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Mesa eliminada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/reset-mesa/<int:mesa_id>', methods=['POST'])
@token_required
def reset_mesa_status(current_user, mesa_id):
    """Fuerza la liberación de una mesa en caso de error de sincronización."""
    db = get_db()
    try:
        # Buscamos si hay una comanda abierta para esa mesa y la cerramos por las dudas
        db.execute("UPDATE comandas SET estado = 'cancelada' WHERE mesa_id = %s AND estado = 'abierta'", (mesa_id,))
        # Liberamos la mesa
        db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (mesa_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Mesa liberada con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- CARTA (MENÚ) ---

@bp.route('/negocios/<int:negocio_id>/menu/categorias', methods=['GET'])
def get_menu_categorias(negocio_id):
    db = get_db()
    try:
        # Asegurar columna grupo
        db.execute("ALTER TABLE menu_categorias ADD COLUMN IF NOT EXISTS grupo VARCHAR(100)")
        g.db_conn.commit()

        db.execute("SELECT * FROM menu_categorias WHERE negocio_id = %s ORDER BY orden", (negocio_id,))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/categorias', methods=['POST'])
@token_required
def add_menu_categoria(current_user, negocio_id):
    data = request.get_json()
    nombre = data.get('nombre')
    orden = data.get('orden', 0)
    estacion = data.get('estacion', 'cocina')
    
    if not nombre:
        return jsonify({'error': 'El nombre es obligatorio'}), 400
        
    db = get_db()
    try:
        grupo = data.get('grupo')
        db.execute(
            "INSERT INTO menu_categorias (negocio_id, nombre, orden, estacion, grupo) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, nombre, orden, estacion, grupo)
        )
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Categoría creada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/menu/categorias/<int:id>', methods=['PUT', 'DELETE'])
@token_required
def manage_menu_categoria(current_user, id):
    db = get_db()
    if request.method == 'DELETE':
        try:
            db.execute("DELETE FROM menu_categorias WHERE id = %s", (id,))
            g.db_conn.commit()
            return jsonify({'message': 'Categoría eliminada'})
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500
            
    # PUT
    data = request.get_json()
    campos = []
    valores = []
    if 'nombre' in data:
        campos.append("nombre = %s")
        valores.append(data['nombre'])
    if 'orden' in data:
        campos.append("orden = %s")
        valores.append(data['orden'])
    if 'activo' in data:
        campos.append("activo = %s")
        valores.append(data['activo'])
    if 'estacion' in data:
        campos.append("estacion = %s")
        valores.append(data['estacion'])
    if 'grupo' in data:
        campos.append("grupo = %s")
        valores.append(data['grupo'])
        
    if not campos:
        return jsonify({'error': 'No hay campos para actualizar'}), 400
        
    valores.append(id)
    try:
        db.execute(f"UPDATE menu_categorias SET {', '.join(campos)} WHERE id = %s", tuple(valores))
        g.db_conn.commit()
        return jsonify({'message': 'Categoría actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# ITEMS DEL MENÚ
@bp.route('/negocios/<int:negocio_id>/menu/items', methods=['GET'])
def get_menu_items(negocio_id):
    db = get_db()
    cat_id = request.args.get('categoria_id')
    lista_id = request.args.get('lista_id') # Opcional: Para traer precios de una lista específica
    
    try:
        # 1. Definir JOINS base
        joins = """
            JOIN menu_categorias mc ON mi.categoria_id = mc.id 
            LEFT JOIN productos p ON mi.producto_id = p.id
        """
        
        # 2. Definir WHERE base (Filtra por disponible y stock si corresponde)
        where = """
            WHERE mi.negocio_id = %s 
              AND (p.id IS NULL OR p.tipo_producto IN ('producto_final', 'final'))
              AND mi.precio > 0
              AND mi.disponible = TRUE
              AND (mi.stock_control = FALSE OR p.id IS NULL OR p.stock > 0)
        """
        params = [negocio_id]

        # 3. Construir query según lista_id
        if lista_id:
            query = f"""
                SELECT mi.*, mc.nombre as categoria_nombre, mc.estacion as categoria_destino, 
                       COALESCE(mip.precio, mi.precio) as precio
                FROM menu_items mi 
                {joins}
                LEFT JOIN menu_item_precios mip ON mi.id = mip.menu_item_id AND mip.lista_id = %s
                {where}
            """
            # El orden de params es: lista_id (para el JOIN), negocio_id (para el WHERE)
            params = [lista_id, negocio_id]
        else:
            query = f"""
                SELECT mi.*, mc.nombre as categoria_nombre, mc.estacion as categoria_destino
                FROM menu_items mi 
                {joins}
                {where}
            """

        if cat_id:
            query += " AND mi.categoria_id = %s"
            params.append(cat_id)
            
        query += " ORDER BY mc.orden, mc.nombre, mi.nombre"
        
        db.execute(query, tuple(params))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/top-pedidos', methods=['GET'])
@token_required
def get_top_pedidos(current_user, negocio_id):
    db = get_db()
    lista_id = request.args.get('lista_id')
    try:
        # 1. Intentar obtener los 20 más pedidos de los últimos 30 días
        query_top = """
            SELECT cd.menu_item_id, SUM(cd.cantidad) as total_pedidos
            FROM comandas_detalle cd
            JOIN comandas c ON cd.comanda_id = c.id
            WHERE c.negocio_id = %s 
              AND c.fecha_apertura >= CURRENT_DATE - INTERVAL '30 days'
              AND cd.estado != 'anulado'
            GROUP BY cd.menu_item_id
            ORDER BY total_pedidos DESC
            LIMIT 20
        """
        db.execute(query_top, (negocio_id,))
        populares = db.fetchall()
        top_ids = [r['menu_item_id'] for r in populares]

        # 2. Fallback: Si no hay ventas, traer los primeros 20 items del menú
        if not top_ids:
            # Asegurar que la columna 'disponible' existe (MIGRACION RAPIDA)
            try:
                db.execute("ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS disponible BOOLEAN DEFAULT TRUE")
                g.db_conn.commit()
            except:
                pass
                
            db.execute("SELECT id FROM menu_items WHERE negocio_id = %s AND disponible = TRUE LIMIT 20", (negocio_id,))
            top_ids = [r['id'] for r in db.fetchall()]

        if not top_ids:
            return jsonify([])

        # 3. Construir consulta con JOINs correctos
        # El LEFT JOIN de precios debe ir antes del WHERE
        if lista_id:
            query = """
                SELECT mi.*, mc.nombre as categoria_nombre, mc.estacion as categoria_destino, 
                       COALESCE(mip.precio, mi.precio) as precio 
                FROM menu_items mi 
                JOIN menu_categorias mc ON mi.categoria_id = mc.id 
                LEFT JOIN productos p ON mi.producto_id = p.id
                LEFT JOIN menu_item_precios mip ON mi.id = mip.menu_item_id AND mip.lista_id = %s
                WHERE mi.id IN %s AND mi.disponible = TRUE
                  AND (mi.stock_control = FALSE OR p.id IS NULL OR p.stock > 0)
            """
            db.execute(query, (lista_id, tuple(top_ids)))
        else:
            query = """
                SELECT mi.*, mc.nombre as categoria_nombre, mc.estacion as categoria_destino
                FROM menu_items mi 
                JOIN menu_categorias mc ON mi.categoria_id = mc.id 
                LEFT JOIN productos p ON mi.producto_id = p.id
                WHERE mi.id IN %s AND mi.disponible = TRUE
                  AND (mi.stock_control = FALSE OR p.id IS NULL OR p.stock > 0)
            """
            db.execute(query, (tuple(top_ids),))

        rows = db.fetchall()
        
        # 4. Re-ordenar por la popularidad/orden original
        order_map = {id: i for i, id in enumerate(top_ids)}
        sorted_rows = sorted([dict(r) for r in rows], key=lambda x: order_map.get(x['id'], 999))
        
        return jsonify(sorted_rows)
    except Exception as e:
        print(f"Error en get_top_pedidos: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/sync-inventory/list', methods=['GET'])
@token_required
def list_inventory_for_sync(current_user, negocio_id):
    db = get_db()
    try:
        db.execute("""
            SELECT p.id, p.nombre, c.nombre as cat_nombre, p.precio_venta, p.alias, p.imagen_url
            FROM productos p 
            LEFT JOIN productos_categoria c ON p.categoria_id = c.id
            WHERE p.negocio_id = %s 
              AND p.tipo_producto IN ('producto_final', 'final') 
              AND p.activo = TRUE
              AND p.precio_venta > 0
        """, (negocio_id,))
        productos = db.fetchall()
        return jsonify([dict(p) for p in productos])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/sync-inventory/batch', methods=['POST'])
@token_required
def sync_menu_batch(current_user, negocio_id):
    data = request.get_json()
    productos = data.get('productos', [])
    db = get_db()
    total_sync = 0
    
    try:
        for p in productos:
            # 1. Asegurar categoría
            cat_name = p.get('cat_nombre') or 'General'
            db.execute("SELECT id FROM menu_categorias WHERE negocio_id = %s AND LOWER(nombre) = LOWER(%s)", (negocio_id, cat_name))
            cat_menu = db.fetchone()
            
            if not cat_menu:
                db.execute("INSERT INTO menu_categorias (negocio_id, nombre) VALUES (%s, %s) RETURNING id", (negocio_id, cat_name))
                cat_menu_id = db.fetchone()['id']
            else:
                cat_menu_id = cat_menu['id']
            
            # 2. Sincronizar Item
            db.execute("SELECT id FROM menu_items WHERE negocio_id = %s AND producto_id = %s", (negocio_id, p['id']))
            item_existente = db.fetchone()
            
            if not item_existente:
                db.execute("""
                    INSERT INTO menu_items (negocio_id, categoria_id, nombre, descripcion, precio, imagen_url, stock_control, producto_id)
                    VALUES (%s, %s, %s, %s, %s, %s, TRUE, %s)
                """, (negocio_id, cat_menu_id, p['nombre'], p.get('alias') or '', p.get('precio_venta') or 0, p.get('imagen_url') or '', p['id']))
            else:
                db.execute("""
                    UPDATE menu_items 
                    SET categoria_id = %s, nombre = %s, precio = %s, descripcion = %s
                    WHERE id = %s
                """, (cat_menu_id, p['nombre'], p.get('precio_venta') or 0, p.get('alias') or '', item_existente['id']))
            total_sync += 1
            
        g.db_conn.commit()
        return jsonify({'message': f'Lote de {len(productos)} procesado', 'sync_count': total_sync})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/items', methods=['POST'])
@token_required
def add_menu_item(current_user, negocio_id):
    data = request.get_json()
    req = ['nombre', 'categoria_id', 'precio']
    for r in req:
        if r not in data:
            return jsonify({'error': f'Falta el campo {r}'}), 400
            
    db = get_db()
    try:
        db.execute(
            """INSERT INTO menu_items (negocio_id, categoria_id, nombre, descripcion, precio, imagen_url, stock_control, producto_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (negocio_id, data['categoria_id'], data['nombre'], data.get('descripcion', ''), data['precio'], 
             data.get('imagen_url', ''), data.get('stock_control', False), data.get('producto_id'))
        )
        nuevo_id = db.fetchone()['id']
        
        # Guardar precios adicionales si existen
        if 'precios_listas' in data:
            for pl in data['precios_listas']:
                db.execute("""
                    INSERT INTO menu_item_precios (menu_item_id, lista_id, precio)
                    VALUES (%s, %s, %s)
                """, (nuevo_id, pl['lista_id'], pl['precio']))

        g.db_conn.commit()
        return jsonify({'id': nuevo_id, 'message': 'Ítem creado con éxito'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/menu/items/<int:id>', methods=['GET', 'PUT', 'DELETE'])
@token_required
def manage_menu_item(current_user, id):
    db = get_db()
    
    if request.method == 'GET':
        try:
            db.execute("SELECT mi.*, mc.nombre as categoria_nombre FROM menu_items mi JOIN menu_categorias mc ON mi.categoria_id = mc.id WHERE mi.id = %s", (id,))
            item = db.fetchone()
            if not item: return jsonify({'error': 'No encontrado'}), 404
            
            # Traer todos los precios específicos
            db.execute("SELECT lista_id, precio FROM menu_item_precios WHERE menu_item_id = %s", (id,))
            precios = db.fetchall()
            
            res = dict(item)
            res['precios'] = [dict(p) for p in precios]
            return jsonify(res)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'DELETE':
        try:
            db.execute("DELETE FROM menu_items WHERE id = %s", (id,))
            g.db_conn.commit()
            return jsonify({'message': 'Ítem eliminado'})
        except Exception as e:
            g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/menu/bulk-update', methods=['POST'])
@token_required
def bulk_update_menu(current_user, negocio_id):
    data = request.get_json()
    ids = data.get('ids', [])
    field = data.get('field') # 'precio', 'categoria_id', 'disponible'
    value = data.get('value')
    
    if not ids or not field:
        return jsonify({'error': 'Falta IDs o campo a actualizar'}), 400
        
    db = get_db()
    try:
        if field == 'precio':
            str_val = str(value)
            if '%' in str_val:
                factor = 1 + (float(str_val.replace('%', '')) / 100)
                db.execute(f"UPDATE menu_items SET precio = ROUND(precio * %s, 2) WHERE id IN ({','.join(['%s']*len(ids))})", (factor, *ids))
            else:
                db.execute(f"UPDATE menu_items SET precio = %s WHERE id IN ({','.join(['%s']*len(ids))})", (value, *ids))
        
        elif field == 'categoria_id':
            db.execute(f"UPDATE menu_items SET categoria_id = %s WHERE id IN ({','.join(['%s']*len(ids))})", (value, *ids))
            
        elif field == 'disponible':
            db.execute(f"UPDATE menu_items SET disponible = %s WHERE id IN ({','.join(['%s']*len(ids))})", (value, *ids))
            
        elif field == 'destino_kds':
            db.execute(f"UPDATE menu_items SET destino_kds = %s WHERE id IN ({','.join(['%s']*len(ids))})", (value, *ids))
            
        g.db_conn.commit()
        return jsonify({'message': f'{len(ids)} items actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
            
    # PUT
    data = request.get_json()
    validos = ['categoria_id', 'nombre', 'descripcion', 'precio', 'imagen_url', 'disponible', 'stock_control', 'producto_id', 'destino_kds']
    campos = [f"{k} = %s" for k in data.keys() if k in validos]
    valores = [v for k, v in data.items() if k in validos]
    
    if not campos and 'precios_listas' not in data:
        return jsonify({'error': 'Sin campos válidos'}), 400
        
    try:
        if campos:
            valores.append(id)
            db.execute(f"UPDATE menu_items SET {', '.join(campos)} WHERE id = %s", tuple(valores))
        
        # Procesar precios por lista
        if 'precios_listas' in data:
            for pl in data['precios_listas']:
                db.execute("""
                    INSERT INTO menu_item_precios (menu_item_id, lista_id, precio)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (menu_item_id, lista_id) DO UPDATE SET precio = EXCLUDED.precio
                """, (id, pl['lista_id'], pl['precio']))
        
        g.db_conn.commit()
        return jsonify({'message': 'Ítem actualizado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- POS / OPERATIVA MOZOS ---

@bp.route('/negocios/<int:negocio_id>/mesas/<int:mesa_id>/comanda', methods=['POST'])
@token_required
def abrir_comanda_mesa(current_user, negocio_id, mesa_id):
    data = request.get_json()
    mozo_id = data.get('mozo_id')
    lista_id = data.get('lista_id') # NUEVO: Carta seleccionada
    num_pax = data.get('num_comensales', 1)
    obs = data.get('observaciones', '')
    
    db = get_db()
    try:
        # 1. Verificar si la mesa ya está ocupada
        db.execute("SELECT estado, comanda_id FROM mesas WHERE id = %s", (mesa_id,))
        mesa = db.fetchone()
        if mesa and mesa['estado'] == 'ocupada':
            return jsonify({'error': 'La mesa ya tiene una comanda activa', 'id': mesa['comanda_id']}), 409

        # 1.5 Verificar que el mozo pertenezca al negocio
        db.execute("SELECT id FROM vendedores WHERE id = %s AND negocio_id = %s", (mozo_id, negocio_id))
        if not db.fetchone():
            return jsonify({'error': 'El mozo seleccionado no pertenece a este negocio'}), 400
            
        # 2. Crear Comanda
        db.execute(
            """INSERT INTO comandas (negocio_id, mozo_id, mesa_id, num_comensales, observaciones, estado, total, fecha_apertura, lista_id)
               VALUES (%s, %s, %s, %s, %s, 'abierta', 0, CURRENT_TIMESTAMP, %s) RETURNING id""",
            (negocio_id, mozo_id, mesa_id, num_pax, obs, lista_id)
        )
        comanda_id = db.fetchone()['id']
        
        # 3. Actualizar Mesa
        db.execute("UPDATE mesas SET estado = 'ocupada', comanda_id = %s WHERE id = %s", (comanda_id, mesa_id))
        
        g.db_conn.commit()
        
        # 4. Retornar la comanda completa
        db.execute("SELECT c.*, v.nombre as mozo_nombre FROM comandas c JOIN vendedores v ON c.mozo_id = v.id WHERE c.id = %s", (comanda_id,))
        comanda = db.fetchone()
        res = dict(comanda)
        res['detalles'] = []
        return jsonify(res), 201
        
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>', methods=['GET'])
@token_required
def get_comanda_detail(current_user, id):
    db = get_db()
    try:
        db.execute("SELECT c.*, v.nombre as mozo_nombre FROM comandas c JOIN vendedores v ON c.mozo_id = v.id WHERE c.id = %s", (id,))
        comanda = db.fetchone()
        if not comanda:
            return jsonify({'error': 'Comanda no encontrada'}), 404
            
        res = dict(comanda)
        
        db.execute("""
            SELECT cd.*, mi.nombre as producto_nombre, mi.imagen_url, mc.estacion
            FROM comandas_detalle cd
            LEFT JOIN menu_items mi ON cd.menu_item_id = mi.id
            LEFT JOIN menu_categorias mc ON mi.categoria_id = mc.id
            WHERE cd.comanda_id = %s
        """, (id,))
        res['detalles'] = [dict(d) for d in db.fetchall()]
        
        return jsonify(res)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/items', methods=['POST'])
@token_required
def add_items_to_comanda(current_user, id):
    data = request.get_json()
    items = data.get('detalles', [])
    
    if not items:
        return jsonify({'error': 'No hay items para agregar'}), 400
        
    db = get_db()
    try:
        total_a_sumar = 0
        added_ids = []
        for item in items:
            subt = float(item['cantidad']) * float(item['precio_unitario'])
            total_a_sumar += subt
            
            db.execute(
                """INSERT INTO comandas_detalle (comanda_id, menu_item_id, cantidad, precio_unitario, subtotal, estado, notas)
                   VALUES (%s, %s, %s, %s, %s, 'pendiente', %s) RETURNING id""",
                (id, item['menu_item_id'], item['cantidad'], item['precio_unitario'], subt, item.get('notas', ''))
            )
            added_ids.append(db.fetchone()['id'])
            
        db.execute("UPDATE comandas SET total = total + %s WHERE id = %s", (total_a_sumar, id))
        
        # --- NUEVO: Generar trabajos de impresión ---
        print_jobs = []
        if added_ids:
            # Traer los datos extra de los items agregados (estación y nombres)
            db.execute("""
                SELECT 
                    cd.cantidad, cd.notas, mi.nombre, 
                    COALESCE(mi.destino_kds, cat.estacion, 'cocina') as destino,
                    m.numero as mesa_num, v.nombre as mozo_nom, c.num_comensales,
                    c.negocio_id
                FROM comandas_detalle cd
                JOIN menu_items mi ON cd.menu_item_id = mi.id
                JOIN menu_categorias cat ON mi.categoria_id = cat.id
                JOIN comandas c ON cd.comanda_id = c.id
                JOIN mesas m ON c.mesa_id = m.id
                JOIN vendedores v ON c.mozo_id = v.id
                WHERE cd.id IN %s
            """, (tuple(added_ids),))
            rows = db.fetchall()
            
            if rows:
                negocio_id = rows[0]['negocio_id']
                pax_val = int(rows[0]['num_comensales'] or 0)
                header_info = { 'mesa': rows[0]['mesa_num'], 'mozo': rows[0]['mozo_nom'], 'pax': pax_val }
                
                # Agrupar items por destino
                grouped_items = {}
                for r in rows:
                    dest = (r['destino'] or 'cocina').lower()
                    if dest not in grouped_items: grouped_items[dest] = []
                    grouped_items[dest].append(r)

                # Obtener nombre negocio y configuraciones
                db.execute("SELECT nombre FROM negocios WHERE id = %s", (negocio_id,))
                neg_row = db.fetchone()
                negocio_nombre = neg_row['nombre'] if neg_row else "Baboons Restó"

                db.execute("SELECT clave, valor FROM configuraciones WHERE negocio_id = %s", (negocio_id,))
                configs = {r['clave']: r['valor'] for r in db.fetchall()}
                sz_mesa = configs.get('resto_print_sz_mesa', '2')
                sz_mozo = configs.get('resto_print_sz_mozo', '1')

                # Consultar impresoras
                db.execute("""
                    SELECT ip, nombre as printer_name, estacion, es_caja
                    FROM resto_impresoras 
                    WHERE negocio_id = %s
                """, (negocio_id,))
                impresoras = db.fetchall()
                
                for printer in impresoras:
                    target_estacion = (printer['estacion'] or "").lower()
                    
                    items_para_esta_imp = []
                    if printer['es_caja']:
                        items_para_esta_imp = rows
                    elif target_estacion in grouped_items:
                        items_para_esta_imp = grouped_items[target_estacion]

                    if items_para_esta_imp:
                        lineas = [
                            f"[S{sz_mesa}]COMANDA", 
                            f"[S{sz_mesa}]Mesa: {header_info['mesa']}", 
                            f"[S{sz_mozo}]Mozo: {header_info['mozo']}", 
                            f"Pax: {header_info['pax']}",
                            "-" * 20
                        ]
                        items_payload = []
                        for it in items_para_esta_imp:
                            cant_float = float(it['cantidad'])
                            lineas.append(f"[{int(cant_float)}] {it['nombre']}")
                            if it.get('notas'): lineas.append(f"  > {it['notas']}")
                            items_payload.append({
                                'nombre': it['nombre'], 
                                'cantidad': cant_float, 
                                'notas': it.get('notas') or ""
                            })

                        payload = {
                            'printer_name': printer['printer_name'],
                            'id_orden': id,
                            'negocio_nombre': negocio_nombre,
                            'content': "\n".join(lineas),
                            'mesa': header_info['mesa'],
                            'mozo': header_info['mozo'],
                            'items': items_payload,
                            'ip_destino': printer['ip'],
                            'pax': header_info['pax']
                        }
                        print_jobs.append({'ip': printer['ip'], 'payload': payload})
                        
                        import json
                        db.execute("INSERT INTO resto_cola_impresion (negocio_id, payload) VALUES (%s, %s)", 
                                   (negocio_id, json.dumps(payload)))

        g.db_conn.commit()
        return jsonify({'message': 'Items agregados correctamente', 'print_jobs': print_jobs})

    except Exception as e:
        g.db_conn.rollback()
        print(f"❌ ERROR AGREGAR ITEMS: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/reimprimir', methods=['POST'])
@token_required
def reimprimir_comanda(current_user, id):
    db = get_db()
    try:
        db.execute("""
            SELECT 
                cd.cantidad, cd.notas, mi.nombre, 
                COALESCE(mi.destino_kds, cat.estacion, 'cocina') as it_dest,
                m.numero as mesa_num, v.nombre as mozo_nom, 
                c.num_comensales, c.negocio_id
            FROM comandas_detalle cd
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            JOIN menu_categorias cat ON mi.categoria_id = cat.id
            JOIN comandas c ON cd.comanda_id = c.id
            JOIN mesas m ON c.mesa_id = m.id
            JOIN vendedores v ON c.mozo_id = v.id
            WHERE cd.comanda_id = %s AND cd.estado != 'borrado'
        """, (id,))
        rows = db.fetchall()
        
        if not rows: return jsonify({'error': 'No hay items'}), 404

        neg_id = rows[0]['negocio_id']
        pax_val = int(rows[0].get('num_comensales', 0) or 0)
        db.execute("SELECT nombre FROM negocios WHERE id = %s", (neg_id,))
        neg_nom = db.fetchone()['nombre']
        
        # Obtener configuraciones de impresión
        db.execute("SELECT clave, valor FROM configuraciones WHERE negocio_id = %s", (neg_id,))
        configs = {r['clave']: r['valor'] for r in db.fetchall()}
        sz_mesa = configs.get('resto_print_sz_mesa', '2')
        sz_mozo = configs.get('resto_print_sz_mozo', '1')

        # Consultar impresoras (SOLO COLUMNAS REALES)
        db.execute("SELECT nombre, ip, estacion, es_caja FROM resto_impresoras WHERE negocio_id = %s", (neg_id,))
        impresoras = db.fetchall() or []
        
        # Agrupar items por destino (estandarizar como en add_items)
        grouped_items = {}
        for r_it in rows:
            dest_val = (r_it['it_dest'] or 'cocina').lower()
            if dest_val not in grouped_items: grouped_items[dest_val] = []
            grouped_items[dest_val].append(r_it)

        print_jobs = []
        for printer in impresoras:
            target_estacion = (printer['estacion'] or "").lower()
            
            items_para_esta_imp = []
            if printer['es_caja']:
                items_para_esta_imp = rows
            elif target_estacion in grouped_items:
                items_para_esta_imp = grouped_items[target_estacion]

            if items_para_esta_imp:
                lineas = [
                    f"[S{sz_mesa}]REIMPRESION", 
                    f"[S{sz_mesa}]Mesa: {rows[0]['mesa_num']}", 
                    f"[S{sz_mozo}]Mozo: {rows[0]['mozo_nom']}", 
                    f"Pax: {pax_val}",
                    "-" * 20
                ]
                
                items_payload = []
                for it in items_para_esta_imp:
                    cant_float = float(it['cantidad'])
                    lineas.append(f"[{int(cant_float)}] {it['nombre']}")
                    if it['notas']: lineas.append(f"  > {it['notas']}")
                    items_payload.append({'nombre': it['nombre'], 'cantidad': cant_float, 'notas': it['notas'] or ""})
                
                payload = {
                    'printer_name': printer['nombre'], 'id_orden': id, 'negocio_nombre': neg_nom,
                    'reprint': True, 'content': "\n".join(lineas), 'mesa': rows[0]['mesa_num'], 'mozo': rows[0]['mozo_nom'],
                    'items': items_payload, 'ip_destino': printer['ip'], 'pax': pax_val
                }
                print_jobs.append({'ip': printer['ip'], 'payload': payload})
                
                import json
                db.execute("INSERT INTO resto_cola_impresion (negocio_id, payload) VALUES (%s, %s)", (neg_id, json.dumps(payload)))

        db.execute("COMMIT")
        return jsonify({'message': 'Reimpresión enviada', 'print_jobs': print_jobs})
    except Exception as e:
        g.db_conn.rollback()
        print(f"❌ ERROR REIMPRESION: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/lista', methods=['PUT'])
@token_required
def update_comanda_lista(current_user, id):
    data = request.get_json()
    lista_id = data.get('lista_id')
    
    if not lista_id:
        return jsonify({'error': 'Falta el ID de la lista'}), 400
        
    db = get_db()
    try:
        # Solo permitir si el negocio dueño de la comanda es el mismo del usuario
        db.execute("UPDATE comandas SET lista_id = %s WHERE id = %s", (lista_id, id))
        g.db_conn.commit()
        return jsonify({'message': 'Lista de precios actualizada correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/pax', methods=['PUT'])
@token_required
def update_comanda_pax(current_user, id):
    data = request.get_json()
    num_pax = data.get('num_comensales')
    if not num_pax:
        return jsonify({'error': 'Falta la cantidad de comensales'}), 400
        
    db = get_db()
    try:
        db.execute("UPDATE comandas SET num_comensales = %s WHERE id = %s", (num_pax, id))
        g.db_conn.commit()
        return jsonify({'message': 'Cubiertos actualizados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/mover-mesa', methods=['PUT'])
@token_required
def mover_mesa(current_user, id):
    data = request.get_json()
    nueva_mesa_id = data.get('nueva_mesa_id')
    
    if not nueva_mesa_id:
        return jsonify({'error': 'Falta la mesa de destino'}), 400
        
    db = get_db()
    try:
        # 1. Obtener comanda y validar
        db.execute("SELECT * FROM comandas WHERE id = %s AND estado = 'abierta'", (id,))
        comanda = db.fetchone()
        if not comanda:
            return jsonify({'error': 'Comanda no encontrada'}), 404
            
        # 2. Verificar que la mesa de destino esté libre
        db.execute("SELECT * FROM mesas WHERE id = %s", (nueva_mesa_id,))
        mesa_dest = db.fetchone()
        if not mesa_dest:
            return jsonify({'error': 'Mesa de destino no encontrada'}), 404
        if mesa_dest['estado'] != 'libre' and mesa_dest['comanda_id'] is not None:
            return jsonify({'error': 'La mesa de destino ya está ocupada'}), 400
            
        # 3. Mover comanda: Liberar mesa vieja, ocupar mesa nueva
        mesa_vieja_id = comanda['mesa_id']
        db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (mesa_vieja_id,))
        db.execute("UPDATE mesas SET estado = 'ocupada', comanda_id = %s WHERE id = %s", (id, nueva_mesa_id))
        db.execute("UPDATE comandas SET mesa_id = %s WHERE id = %s", (nueva_mesa_id, id))
        
        g.db_conn.commit()
        return jsonify({'message': 'Mesa cambiada con éxito', 'mesa_numero': mesa_dest['numero']})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/cerrar', methods=['POST'])
@token_required
def cerrar_comanda(current_user, id):
    db = get_db()
    try:
        # 1. Obtener comanda y validar
        db.execute("SELECT * FROM comandas WHERE id = %s AND estado = 'abierta'", (id,))
        comanda = db.fetchone()
        if not comanda:
            return jsonify({'error': 'Comanda no encontrada o ya cerrada'}), 404
            
        negocio_id = comanda['negocio_id']
        
        # 2. Verificar caja abierta
        db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'La caja está cerrada. Debe abrir la caja para cobrar.'}), 409
            
        # 0. Asegurar columnas de migración
        try:
            db.execute("ALTER TABLE comandas_detalle ADD COLUMN IF NOT EXISTS stock_descontado BOOLEAN DEFAULT FALSE")
            db.execute("ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS producto_nombre TEXT")
            g.db_conn.commit()
        except: pass

        # 3. Obtener detalles NO cobrados
        db.execute("""
            SELECT cd.*, mi.producto_id, mi.stock_control, mi.nombre as menu_nombre
            FROM comandas_detalle cd
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            WHERE cd.comanda_id = %s AND cd.estado NOT IN ('anulado', 'cobrado')
        """, (id,))
        detalles = db.fetchall()
        
        if not detalles:
            # All items already cobrado (e.g. via pago parcial) — auto-close comanda & free mesa
            db.execute("UPDATE comandas SET estado = 'cerrada' WHERE id = %s", (id,))
            db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (comanda['mesa_id'],))
            g.db_conn.commit()
            return jsonify({'message': 'Comanda cerrada (todos los ítems ya estaban cobrados)', 'venta_id': 0}), 200
            
        total_pago = sum(float(d['subtotal']) for d in detalles)
        
        # 4. Obtener un cliente por defecto (Consumidor Final)
        db.execute("SELECT id FROM clientes WHERE negocio_id = %s LIMIT 1", (negocio_id,))
        cliente_ref = db.fetchone()
        cliente_id = cliente_ref['id'] if cliente_ref else None

        # 5. Crear Venta Central (Categoría: Ventas Restó)
        db.execute(
            """INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, vendedor_id) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (negocio_id, cliente_id, current_user['id'], total_pago, 'Ventas Restó', datetime.datetime.now(), 
             sesion_abierta['id'], comanda['mozo_id'])
        )
        venta_id = db.fetchone()['id']
        
        # 6. Insertar detalles de venta y descontar stock
        for d in detalles:
            db.execute(
                "INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s)",
                (venta_id, d['producto_id'], d['cantidad'], d['precio_unitario'], d['subtotal'], d['menu_nombre'])
            )
            
            # Descontar stock si aún no fue marcado como entregado (prevent double discount)
            if not d.get('stock_descontado', False):
                # A. Descuento de Receta (BOM)
                db.execute("SELECT * FROM menu_recetas WHERE menu_item_id = %s", (d['menu_item_id'],))
                receta = db.fetchall()
                
                if receta:
                    for r in receta:
                        db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", 
                                   (float(d['cantidad']) * float(r['cantidad']), r['insumo_id']))
                
                # B. Descuento de Producto Directo
                elif d['stock_control'] and d['producto_id']:
                    db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (d['cantidad'], d['producto_id']))
                
            # Marcar ítem como cobrado y descontado
            db.execute("UPDATE comandas_detalle SET estado = 'cobrado', stock_descontado = TRUE WHERE id = %s", (d['id'],))

        # 6. Actualizar Comanda y Mesa
        db.execute("UPDATE comandas SET estado = 'cerrada' WHERE id = %s", (id,))
        db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (comanda['mesa_id'],))
        
        g.db_conn.commit()
        return jsonify({'message': 'Mesa cerrada y venta registrada correctamente', 'venta_id': venta_id})
        
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/comandas/pendientes-cobro', methods=['GET'])
@token_required
def get_comandas_pendientes_cobro(current_user, negocio_id):
    db = get_db()
    try:
        # Traer comandas de mesas que están 'en_cobro'
        db.execute("""
            SELECT 
                c.id, c.mesa_id, c.mozo_id, c.total, c.num_comensales,
                m.numero as mesa_numero, m.zona as zona_nombre,
                v.nombre as mozo_nombre,
                (SELECT COUNT(*) FROM comandas_detalle WHERE comanda_id = c.id AND estado != 'anulado') as items_count
            FROM comandas c
            JOIN mesas m ON c.mesa_id = m.id
            JOIN vendedores v ON c.mozo_id = v.id
            WHERE c.negocio_id = %s 
              AND c.estado = 'abierta'
              AND m.estado = 'en_cobro'
            ORDER BY c.fecha_apertura ASC
        """, (negocio_id,))
        comandas = db.fetchall()
        return jsonify([dict(c) for c in comandas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/solicitar-cuenta', methods=['POST'])
@token_required
def solicitar_cuenta_comanda(current_user, id):
    db = get_db()
    try:
        # 1. Obtener la coma completa con nombres
        db.execute("""
            SELECT c.*, m.numero as mesa_num, v.nombre as mozo_nom, n.nombre as negocio_nom
            FROM comandas c
            JOIN mesas m ON c.mesa_id = m.id
            JOIN vendedores v ON c.mozo_id = v.id
            JOIN negocios n ON c.negocio_id = n.id
            WHERE c.id = %s
        """, (id,))
        comanda = db.fetchone()
        if not comanda:
            return jsonify({'error': 'Comanda no encontrada'}), 404
        
        # 2. Marcar la mesa como 'en_cobro'
        db.execute("UPDATE mesas SET estado = 'en_cobro' WHERE id = %s", (comanda['mesa_id'],))
        
        # 3. Traer detalles para el ticket de cuenta
        db.execute("""
            SELECT cd.cantidad, cd.precio_unitario, cd.subtotal, mi.nombre
            FROM comandas_detalle cd
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            WHERE cd.comanda_id = %s AND cd.estado != 'anulado'
        """, (id,))
        detalles = db.fetchall()

        # 4. Encontrar impresora de CAJA designada
        db.execute("SELECT ip, nombre FROM resto_impresoras WHERE negocio_id = %s AND es_caja = TRUE LIMIT 1", (comanda['negocio_id'],))
        impresora_caja = db.fetchone()
        
        # Fallback a estacion='caja' o 'principal' si no hay una marcada como es_caja explicitly
        if not impresora_caja:
            db.execute("SELECT ip, nombre FROM resto_impresoras WHERE negocio_id = %s AND (LOWER(estacion) = 'caja' OR LOWER(estacion) = 'principal') LIMIT 1", (comanda['negocio_id'],))
            impresora_caja = db.fetchone()
        
        # Último recurso: cualquiera
        if not impresora_caja:
            db.execute("SELECT ip, nombre FROM resto_impresoras WHERE negocio_id = %s LIMIT 1", (comanda['negocio_id'],))
            impresora_caja = db.fetchone()

        # 5. Obtener configuraciones PRO para el ticket de cuenta
        db.execute("SELECT clave, valor FROM configuraciones WHERE negocio_id = %s", (comanda['negocio_id'],))
        configs = {r['clave']: r['valor'] for r in db.fetchall()}
        legend = configs.get('resto_print_legend', '')
        sz_mesa = configs.get('resto_print_sz_mesa', '2')
        sz_mozo = configs.get('resto_print_sz_mozo', '1')
        ticket_title = configs.get('resto_print_bill_title', 'PEDIDO DE CUENTA').upper()

        print_job = None
        if impresora_caja:
            # Formatear contenido con tamaños
            content = [
                f"[S2]{ticket_title}",
                f"*** PRE-CUENTA ***",
                f"NO VALIDO COMO FACTURA",
                f"--------------------------------",
                f"[S{sz_mesa}]Mesa: {comanda['mesa_num']}",
                f"[S{sz_mozo}]Mozo: {comanda['mozo_nom']}",
                f"Pax: {comanda.get('num_comensales', 0)}",
                f"Fecha: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')}",
                "--------------------------------",
            ]
            
            # Detalle itemizado: Nombre x Cant @ $Unit ... $Sub
            for d in detalles:
                # Línea 1: Nombre
                content.append(f"{d['nombre']}")
                # Línea 2: Cant x Price = Subtotal
                linea_det = f"  {int(d['cantidad'])} x ${float(d['precio_unitario']):.2f} = ${float(d['subtotal']):.2f}"
                content.append(linea_det)

            content.append("--------------------------------")
            content.append(f"[S2]TOTAL: ${float(comanda['total']):.2f}")
            
            if legend:
                content.append("--------------------------------")
                content.append(legend)
            
            content.append("\nGracias por su visita!")
            content.append("V.1.0")

            print_job = {
                'ip': impresora_caja['ip'],
                'payload': {
                    'printer_name': impresora_caja['nombre'],
                    'type': 'BILL',
                    'content': "\n".join(content),
                    'config': { 'legend': legend, 'size_mesa': sz_mesa, 'size_mozo': sz_mozo },
                    'mesa': comanda['mesa_num'],
                    'mozo': comanda['mozo_nom'],
                    'negocio_nombre': comanda['negocio_nom'],
                    'pax': comanda['num_comensales'],
                    'total': float(comanda['total']),
                    'items': [{ 'nombre': d['nombre'], 'qty': float(d['cantidad']), 'precio': float(d['precio_unitario']), 'subtotal': float(d['subtotal']), 'observaciones': "" } for d in detalles]
                }
            }

            # NUEVO: Guardar en la COLA CLOUD (para Tablets)
            try:
                import json
                db.execute("INSERT INTO resto_cola_impresion (negocio_id, payload) VALUES (%s, %s)", 
                           (comanda['negocio_id'], json.dumps(print_job['payload'])))
            except Exception as e:
                print(f"Error guardando en cola (cuenta): {e}")
        
        g.db_conn.commit()
        return jsonify({
            'message': 'Mesa marcada para cobro. Impresión enviada.',
            'print_job': print_job
        })
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/finalizar-cobro', methods=['POST'])
@token_required
def finalizar_cobro_comanda(current_user, id):
    db = get_db()
    # Solo ADMIN o ADICIONISTA (se asume existencia de rol o admin como fallback)
    permitidos = ['admin', 'superadmin', 'adicionista', 'cajero']
    if current_user['rol'].lower() not in permitidos:
        return jsonify({'error': 'No tiene permisos para realizar cobros (Solo Cajero/Admin)'}), 403

    data = request.get_json()
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    
    # Detalles de tarjeta (NUEVO)
    t_marca = data.get('tarjeta_marca')
    t_u4 = data.get('tarjeta_ultimos_4')
    t_lote = data.get('tarjeta_lote')
    t_cupon = data.get('tarjeta_cupon')

    # soporte mixto
    monto_efectivo = float(data.get('monto_efectivo', 0))
    monto_mp = float(data.get('monto_mp', 0))
    monto_cta_cte = float(data.get('monto_cta_cte', 0))

    try:
        # 1. Obtener comanda y validar

        db.execute("SELECT * FROM comandas WHERE id = %s", (id,))
        comanda = db.fetchone()
        if not comanda or comanda['estado'] == 'cerrada':
            return jsonify({'error': 'Comanda no encontrada o ya cerrada'}), 404
            
        negocio_id = comanda['negocio_id']
        
        # 2. Verificar caja abierta
        db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'La caja está cerrada. Debe abrir la caja para cobrar.'}), 409
            
        # 3. Obtener detalles NO cobrados
        db.execute("""
            SELECT cd.*, mi.producto_id, mi.stock_control, mi.nombre as menu_nombre
            FROM comandas_detalle cd
            JOIN menu_items mi ON cd.menu_item_id = mi.id
            WHERE cd.comanda_id = %s AND cd.estado NOT IN ('anulado', 'cobrado')
        """, (id,))
        detalles = db.fetchall()
        
        total_pago = sum(float(d['subtotal']) for d in detalles)
        
        # 4. Obtener un cliente por defecto
        db.execute("SELECT id FROM clientes WHERE negocio_id = %s LIMIT 1", (negocio_id,))
        cliente_ref = db.fetchone()
        cliente_id = cliente_ref['id'] if cliente_ref else None

        # 5. Calcular Próximo Número Interno para el Negocio
        db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
        proximo_nro = db.fetchone()[0]

        # 6. Crear Venta Central (Categoría: Ventas Restó)
        db.execute(
            """INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, vendedor_id,
                                   tarjeta_marca, tarjeta_ultimos_4, tarjeta_lote, tarjeta_cupon, numero_interno) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (negocio_id, cliente_id, current_user['id'], total_pago, f"Ventas Restó ({metodo_pago})", datetime.datetime.now(), 
             sesion_abierta['id'], comanda['mozo_id'], t_marca, t_u4, t_lote, t_cupon, proximo_nro)
        )
        venta_id = db.fetchone()['id']
        
        # 6. Insertar detalles y descontar stock
        for d in detalles:
            db.execute(
                "INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s)",
                (venta_id, d['producto_id'], d['cantidad'], d['precio_unitario'], d['subtotal'], d['menu_nombre'])
            )
            
            if not d.get('stock_descontado', False):
                # A. Descuento de Receta
                db.execute("SELECT * FROM menu_recetas WHERE menu_item_id = %s", (d['menu_item_id'],))
                receta = db.fetchall()
                if receta:
                    for r in receta:
                        db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", 
                                   (float(d['cantidad']) * float(r['cantidad']), r['insumo_id']))
                # B. Descuento Directo
                elif d['stock_control'] and d['producto_id']:
                    db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (d['cantidad'], d['producto_id']))
            
            db.execute("UPDATE comandas_detalle SET estado = 'cobrado', stock_descontado = TRUE WHERE id = %s", (d['id'],))

        # 7. Manejo Mixto (si aplica)
        if metodo_pago == 'Mixto':
             # Aquí podríamos registrar desgloses si existiera tabla de pagos por venta, de momento queda reflejado en el string de metodo_pago
             # y el total es el mismo. Si es CTA CTE, registrar deuda:
             if monto_cta_cte > 0 and cliente_id:
                 db.execute("INSERT INTO clientes_cuenta_corriente (cliente_id, venta_id, monto, fecha, tipo) VALUES (%s, %s, %s, %s, 'DEUDA')",
                            (cliente_id, venta_id, monto_cta_cte, datetime.datetime.now()))
        elif metodo_pago == 'Cuenta Corriente' and cliente_id:
             db.execute("INSERT INTO clientes_cuenta_corriente (cliente_id, venta_id, monto, fecha, tipo) VALUES (%s, %s, %s, %s, 'DEUDA')",
                        (cliente_id, venta_id, total_pago, datetime.datetime.now()))

        # 8. Actualizar Comanda y Mesa
        db.execute("UPDATE comandas SET estado = 'cerrada' WHERE id = %s", (id,))
        db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (comanda['mesa_id'],))
        
        g.db_conn.commit()
        return jsonify({'message': 'Mesa cobrada y liberada', 'venta_id': venta_id, 'numero_interno': proximo_nro})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/comandas/<int:id>/pago-parcial', methods=['POST'])
@token_required
def pago_parcial_comanda(current_user, id):
    data = request.get_json()
    items_a_pagar = data.get('items', []) # [{id, cantidad}, ...]
    
    if not items_a_pagar:
        return jsonify({'error': 'No hay ítems seleccionados para el pago parcial'}), 400
        
    db = get_db()
    try:
        # 0. Asegurar columnas de migración
        try:
            db.execute("ALTER TABLE comandas_detalle ADD COLUMN IF NOT EXISTS stock_descontado BOOLEAN DEFAULT FALSE")
            db.execute("ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS producto_nombre TEXT")
            g.db_conn.commit()
        except: pass

        db.execute("SELECT * FROM comandas WHERE id = %s AND estado = 'abierta'", (id,))
        comanda = db.fetchone()
        if not comanda:
            return jsonify({'error': 'Comanda no encontrada o ya cerrada'}), 404
            
        negocio_id = comanda['negocio_id']
        
        # Verificar caja abierta
        db.execute('SELECT id FROM caja_sesiones WHERE negocio_id = %s AND fecha_cierre IS NULL', (negocio_id,))
        sesion_abierta = db.fetchone()
        if not sesion_abierta:
            return jsonify({'error': 'La caja está cerrada. Debe abrir la caja para cobrar.'}), 409

        total_venta = 0
        detalles_finales = []

        for item_req in items_a_pagar:
            db.execute("""
                SELECT cd.*, mi.producto_id, mi.stock_control, mi.nombre as menu_nombre
                FROM comandas_detalle cd
                JOIN menu_items mi ON cd.menu_item_id = mi.id
                WHERE cd.id = %s AND cd.comanda_id = %s AND cd.estado NOT IN ('anulado', 'cobrado')
            """, (item_req['id'], id))
            d = db.fetchone()
            if not d: continue

            # Verificar si ya se descontó stock (ej: en KDS al marcar entregado)
            ya_descontado = d.get('stock_descontado', False)

            cant_cobrar = float(item_req['cantidad'])
            if cant_cobrar > float(d['cantidad']):
                cant_cobrar = float(d['cantidad'])

            subt = cant_cobrar * float(d['precio_unitario'])
            total_venta += subt
            detalles_finales.append({
                'id': d['id'],
                'producto_id': d['producto_id'],
                'cantidad': cant_cobrar,
                'precio_unitario': float(d['precio_unitario']),
                'subtotal': subt,
                'stock_control': d['stock_control']
            })

            # Ajustar comanda_detalle
            if cant_cobrar == float(d['cantidad']):
                db.execute("UPDATE comandas_detalle SET estado = 'cobrado' WHERE id = %s", (d['id'],))
            else:
                # Dividir el ítem
                db.execute("UPDATE comandas_detalle SET cantidad = cantidad - %s, subtotal = subtotal - %s WHERE id = %s", 
                           (cant_cobrar, subt, d['id']))
                db.execute("""INSERT INTO comandas_detalle (comanda_id, menu_item_id, cantidad, precio_unitario, subtotal, estado, notas)
                              VALUES (%s, %s, %s, %s, %s, 'cobrado', %s)""", 
                           (id, d['menu_item_id'], cant_cobrar, d['precio_unitario'], subt, d['notas']))

        if not detalles_finales:
             return jsonify({'error': 'No se procesaron ítems válidos para el pago'}), 400

        # Crear Venta
        db.execute("SELECT id FROM clientes WHERE negocio_id = %s LIMIT 1", (negocio_id,))
        cliente_ref = db.fetchone()
        cliente_id = cliente_ref['id'] if cliente_ref else None

        # Calcular Próximo Número Interno
        db.execute("SELECT COALESCE(MAX(numero_interno), 0) + 1 FROM ventas WHERE negocio_id = %s", (negocio_id,))
        proximo_nro_parcial = db.fetchone()[0]

        db.execute(
            """INSERT INTO ventas (negocio_id, cliente_id, usuario_id, total, metodo_pago, fecha, caja_sesion_id, vendedor_id, numero_interno) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (negocio_id, cliente_id, current_user['id'], total_venta, 'Ventas Restó (Parcial)', datetime.datetime.now(), 
             sesion_abierta['id'], comanda['mozo_id'], proximo_nro_parcial)
        )
        venta_id = db.fetchone()['id']

        for df in detalles_finales:
            # Recuperamos nombre para persistencia
            db.execute("SELECT mi.nombre FROM comandas_detalle cd JOIN menu_items mi ON cd.menu_item_id = mi.id WHERE cd.id = %s", (df['id'],))
            item_n = db.fetchone()
            p_nom = item_n['nombre'] if item_n else "Item s/n"

            db.execute(
                "INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal, producto_nombre) VALUES (%s, %s, %s, %s, %s, %s)",
                (venta_id, df['producto_id'], df['cantidad'], df['precio_unitario'], df['subtotal'], p_nom)
            )
            if not ya_descontado:
                if df['stock_control'] and df['producto_id']:
                    db.execute("UPDATE productos SET stock = stock - %s WHERE id = %s", (df['cantidad'], df['producto_id']))
                db.execute("UPDATE comandas_detalle SET stock_descontado = TRUE WHERE id = %s", (df['id'],))

        # Verificar si la comanda quedó vacía (sin items pendientes)
        db.execute("SELECT COUNT(*) FROM comandas_detalle WHERE comanda_id = %s AND estado NOT IN ('anulado', 'cobrado')", (id,))
        faltantes = db.fetchone()['count']
        
        liberada = False
        if faltantes == 0:
            db.execute("UPDATE comandas SET estado = 'cerrada' WHERE id = %s", (id,))
            db.execute("UPDATE mesas SET estado = 'libre', comanda_id = NULL WHERE id = %s", (comanda['mesa_id'],))
            liberada = True

        g.db_conn.commit()
        return jsonify({
            'message': 'Pago parcial registrado con éxito',
            'venta_id': venta_id,
            'numero_interno': proximo_nro_parcial,
            'comanda_finalizada': liberada
        })

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- PERSONAL / MOZOS / EMPLEADOS ---

@bp.route('/negocios/<int:negocio_id>/staff', methods=['GET'])
@token_required
def get_staff(current_user, negocio_id):
    db = get_db()
    esp = request.args.get('especialidad')
    try:
        query = "SELECT * FROM vendedores WHERE negocio_id = %s"
        params = [negocio_id]
        if esp:
            query += " AND especialidad_resto = %s"
            params.append(esp)
        query += " ORDER BY nombre"
        
        db.execute(query, tuple(params))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- GESTIÓN DE RECETAS (BOM) ---

@bp.route('/menu/items/<int:item_id>/receta', methods=['GET'])
@token_required
def get_receta(current_user, item_id):
    db = get_db()
    try:
        query = """
            SELECT r.*, p.nombre as insumo_nombre, p.precio_costo as costo_unitario, p.unidad_medida
            FROM menu_recetas r
            JOIN productos p ON r.insumo_id = p.id
            WHERE r.menu_item_id = %s
            ORDER BY p.nombre
        """
        db.execute(query, (item_id,))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/menu/items/<int:item_id>/receta', methods=['POST'])
@token_required
def add_insumo_receta(current_user, item_id):
    db = get_db()
    data = request.get_json()
    insumo_id = data.get('insumo_id')
    cantidad = data.get('cantidad')
    unidad = data.get('unidad')

    if not all([insumo_id, cantidad]):
        return jsonify({'error': 'Faltan datos de insumo o cantidad'}), 400

    try:
        # Verificar si el insumo existe
        db.execute("SELECT id FROM productos WHERE id = %s", (insumo_id,))
        if not db.fetchone():
            return jsonify({'error': 'Insumo no encontrado'}), 404

        # Insertar o actualizar si ya existe en la receta
        db.execute("SELECT id FROM menu_recetas WHERE menu_item_id = %s AND insumo_id = %s", (item_id, insumo_id))
        existente = db.fetchone()

        if existente:
            db.execute("UPDATE menu_recetas SET cantidad = %s, unidad = %s WHERE id = %s", (cantidad, unidad, existente['id']))
        else:
            db.execute("""INSERT INTO menu_recetas (menu_item_id, insumo_id, cantidad, unidad) 
                          VALUES (%s, %s, %s, %s)""", (item_id, insumo_id, cantidad, unidad))
        
        g.db_conn.commit()
        return jsonify({'message': 'Ingrediente guardado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/menu/recetas/<int:id>', methods=['DELETE'])
@token_required
def delete_insumo_receta(current_user, id):
    db = get_db()
    try:
        db.execute("DELETE FROM menu_recetas WHERE id = %s", (id,))
        g.db_conn.commit()
        return jsonify({'message': 'Ingrediente eliminado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- HISTÓRICO DE COMANDAS ---

@bp.route('/negocios/<int:negocio_id>/comandas', methods=['GET'])
@token_required
def get_historico_comandas(current_user, negocio_id):
    """Lista comandas cerradas/canceladas del negocio (por defecto hoy)."""
    db = get_db()
    try:
        estado = request.args.get('estado', 'cerrada')
        fecha = request.args.get('fecha')  # YYYY-MM-DD
        limit = request.args.get('limit', 50, type=int)

        if not fecha:
            fecha = datetime.date.today().isoformat()

        db.execute("""
            SELECT 
                c.id, c.mesa_id, c.mozo_id, c.num_comensales, c.total,
                c.estado, c.fecha_apertura, c.observaciones,
                m.numero as mesa_numero,
                v.nombre as mozo_nombre
            FROM comandas c
            LEFT JOIN mesas m ON c.mesa_id = m.id
            LEFT JOIN vendedores v ON c.mozo_id = v.id
            WHERE c.negocio_id = %s 
              AND c.estado = %s
              AND c.fecha_apertura::date = %s
            ORDER BY c.fecha_apertura DESC
            LIMIT %s
        """, (negocio_id, estado, fecha, limit))
        
        comandas = db.fetchall()
        return jsonify([dict(c) for c in comandas])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- COLA DE IMPRESIÓN PRO (POLLING) ---

@bp.route('/negocios/<int:negocio_id>/impresion-cola/pendientes', methods=['GET'])
@token_required
def get_print_queue_pendientes(current_user, negocio_id):
    """Endpoint para que el AGENTE consulte trabajos pendientes."""
    db = get_db()
    try:
        # AUTO-CREAR TABLA SI NO EXISTE (Solución para errores 500 en producción)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_cola_impresion (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER NOT NULL,
                payload JSONB NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        db.execute("""
            SELECT id, payload FROM resto_cola_impresion 
            WHERE negocio_id = %s AND estado = 'pendiente'
            ORDER BY created_at ASC
        """, (negocio_id,))
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/impresion-cola/<int:job_id>/listo', methods=['POST'])
@token_required
def mark_print_job_done(current_user, job_id):
    """Marca un trabajo como impreso."""
    db = get_db()
    try:
        db.execute("UPDATE resto_cola_impresion SET estado = 'impreso' WHERE id = %s", (job_id,))
        g.db_conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/impresion-cola/limpiar', methods=['POST'])
@token_required
def clear_print_queue(current_user, negocio_id):
    """Limpia la cola (mantenimiento)."""
    db = get_db()
    try:
        db.execute("DELETE FROM resto_cola_impresion WHERE negocio_id = %s AND (estado = 'impreso' OR created_at < NOW() - INTERVAL '2 days')", (negocio_id,))
        g.db_conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/agente/heartbeat', methods=['POST'])
@token_required
def agent_heartbeat(current_user, negocio_id):
    """Recibe la señal de vida del AGENTE LOCAL."""
    db = get_db()
    try:
        # ASEGURAR TABLA CONFIGURACIONES
        db.execute("""
            CREATE TABLE IF NOT EXISTS configuraciones (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER NOT NULL,
                clave VARCHAR(100),
                valor TEXT,
                UNIQUE(negocio_id, clave)
            )
        """)
        
        # Intentar borrado y re-inserción robusta
        db.execute("DELETE FROM configuraciones WHERE negocio_id = %s AND clave = 'agente_last_seen'", (negocio_id,))
        db.execute("INSERT INTO configuraciones (negocio_id, clave, valor) VALUES (%s, 'agente_last_seen', CURRENT_TIMESTAMP::text)", (negocio_id,))
        g.db_conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        g.db_conn.rollback()
        print(f"❌ FALLO HEARTBEAT: {str(e)}")
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/agente/status', methods=['GET'])
@token_required
def get_agent_status(current_user, negocio_id):
    """Informa si el agente está online (visto hace menos de 1 minuto)."""
    db = get_db()
    try:
        db.execute("SELECT valor FROM configuraciones WHERE negocio_id = %s AND clave = 'agente_last_seen'", (negocio_id,))
        row = db.fetchone()
        if not row:
            return jsonify({'status': 'offline'})
            
        last_seen = row['valor']
        # Comparación PostgreSQL
        db.execute("SELECT (CURRENT_TIMESTAMP - %s::timestamp < INTERVAL '1 minute') as is_online", (last_seen,))
        res = db.fetchone()
        is_online = res['is_online'] if res else False
        
        return jsonify({'status': 'online' if is_online else 'offline', 'last_seen': last_seen})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/impresion-cola/test', methods=['POST'])
@token_required
def test_print_queue(current_user, negocio_id):
    """Inserta un trabajo de prueba en la cola cloud."""
    db = get_db()
    try:
        data = request.get_json()
        payload = data.get('payload')
        
        # ASEGURAR TABLAS (Backup por si falla el startup)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_cola_impresion (
                id SERIAL PRIMARY KEY,
                negocio_id INTEGER NOT NULL,
                payload JSONB NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        import json
        db.execute("INSERT INTO resto_cola_impresion (negocio_id, payload) VALUES (%s, %s)", 
                   (negocio_id, json.dumps(payload)))
        g.db_conn.commit()
        return jsonify({'success': True})
    except Exception as e:
        g.db_conn.rollback()
        print(f"❌ FALLO TEST CLOUD: {str(e)}")
        return jsonify({'error': str(e)}), 500
