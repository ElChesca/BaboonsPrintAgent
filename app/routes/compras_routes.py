# app/routes/compras_routes.py
from flask import Blueprint, request, jsonify, g, make_response, current_app
from app.database import get_db
from app.auth_decorator import token_required
import datetime
from decimal import Decimal

bp = Blueprint('compras', __name__)

# --- CRUD Órdenes de Compra ---

@bp.route('/negocios/<int:negocio_id>/compras/orden', methods=['POST'])
@token_required
def crear_orden_compra(current_user, negocio_id):
    data = request.get_json()
    proveedor_id = data.get('proveedor_id')
    detalles = data.get('detalles') # [{producto_id, cantidad, precio_costo}]
    observaciones = data.get('observaciones', '')
    
    if not proveedor_id or not detalles:
        return jsonify({'error': 'Faltan datos obligatorios (proveedor o productos)'}), 400

    db = get_db()
    try:
        # Generar número de OC correlativo (ej: OC-0001)
        db.execute("SELECT COUNT(*) as total FROM ordenes_compra WHERE negocio_id = %s", (negocio_id,))
        count = db.fetchone()['total']
        numero_oc = f"OC-{str(count + 1).zfill(4)}"

        total_estimado = sum(Decimal(str(d['cantidad'])) * Decimal(str(d.get('precio_costo', 0))) for d in detalles)

        # 1. Insertar cabecera
        db.execute(
            """
            INSERT INTO ordenes_compra (negocio_id, proveedor_id, usuario_id, numero_oc, total_estimado, observaciones, estado)
            VALUES (%s, %s, %s, %s, %s, %s, 'abierta') RETURNING id
            """,
            (negocio_id, proveedor_id, current_user['id'], numero_oc, float(total_estimado), observaciones)
        )
        orden_id = db.fetchone()['id']

        # 2. Insertar detalles
        for item in detalles:
            subtotal = Decimal(str(item['cantidad'])) * Decimal(str(item.get('precio_costo', 0)))
            db.execute(
                """
                INSERT INTO ordenes_compra_detalle (orden_id, producto_id, cantidad, precio_costo_actual, subtotal)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (orden_id, item['producto_id'], item['cantidad'], item.get('precio_costo', 0), float(subtotal))
            )

        g.db_conn.commit()
        return jsonify({'message': 'Orden de Compra creada con éxito', 'id': orden_id, 'numero_oc': numero_oc}), 201

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/ordenes', methods=['GET'])
@token_required
def listar_ordenes_compra(current_user, negocio_id):
    db = get_db()
    estado = request.args.get('estado')
    proveedor_id = request.args.get('proveedor_id')

    query = """
        SELECT oc.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        JOIN usuarios u ON oc.usuario_id = u.id
        WHERE oc.negocio_id = %s
    """
    params = [negocio_id]

    if estado:
        query += " AND oc.estado = %s"
        params.append(estado)
    
    if proveedor_id:
        query += " AND oc.proveedor_id = %s"
        params.append(int(proveedor_id))
    
    query += " ORDER BY oc.fecha DESC"
    try:
        db.execute(query, tuple(params))
        rows = db.fetchall()
        
        # Formatear decimales y fechas
        result = []
        for r in rows:
            d = dict(r)
            # Manejo robusto de tipos para JSON
            if 'total_estimado' in d and isinstance(d['total_estimado'], Decimal):
                d['total_estimado'] = float(d['total_estimado'])
            
            if 'fecha' in d and d['fecha']:
                if hasattr(d['fecha'], 'isoformat'):
                    d['fecha'] = d['fecha'].isoformat()
                else:
                    d['fecha'] = str(d['fecha']) # Fallback a string si ya lo es o es otro tipo

            result.append(d)
            
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>', methods=['GET'])
@token_required
def detalle_orden_compra(current_user, negocio_id, orden_id):
    db = get_db()
    db.execute("""
        SELECT oc.*, p.nombre as proveedor_nombre, p.email as proveedor_email, p.cuit as proveedor_cuit
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.id = %s
    """, (orden_id,))
    oc = db.fetchone()
    if not oc: return jsonify({'error': 'No encontrada'}), 404
    
    db.execute("""
        SELECT ocd.*, p.nombre as producto_nombre, p.sku
        FROM ordenes_compra_detalle ocd
        JOIN productos p ON ocd.producto_id = p.id
        WHERE ocd.orden_id = %s
    """, (orden_id,))
    detalles = db.fetchall()
    
    res = dict(oc)
    res['detalles'] = [dict(d) for d in detalles]
    
    # --- Trazabilidad: Buscar Ingreso vinculado ---
    db.execute("""
        SELECT id, factura_tipo, factura_prefijo, factura_numero, fecha
        FROM ingresos_mercaderia
        WHERE orden_compra_id = %s
    """, (orden_id,))
    ingreso = db.fetchone()
    if ingreso:
        res['ingreso_vinculado'] = dict(ingreso)
        if hasattr(res['ingreso_vinculado']['fecha'], 'isoformat'):
             res['ingreso_vinculado']['fecha'] = res['ingreso_vinculado']['fecha'].isoformat()
    
    # Conversión de tipos para JSON (Robust)
    for k, v in res.items():
        if isinstance(v, Decimal): res[k] = float(v)
        elif hasattr(v, 'isoformat'): res[k] = v.isoformat()
    
    for d in res['detalles']:
        for k, v in d.items():
            if isinstance(v, Decimal): d[k] = float(v)
            elif hasattr(v, 'isoformat'): d[k] = v.isoformat()
            
    return jsonify(res)



@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>/data-para-ingreso', methods=['GET'])
@token_required
def get_oc_data_for_income(current_user, negocio_id, orden_id):
    """Retorna los datos de la OC para precargar el ingreso de mercadería."""
    db = get_db()
    db.execute("""
        SELECT oc.*, p.nombre as proveedor_nombre
        FROM ordenes_compra oc
        JOIN proveedores p ON oc.proveedor_id = p.id
        WHERE oc.id = %s AND oc.negocio_id = %s
    """, (orden_id, negocio_id))
    oc = db.fetchone()
    if not oc: return jsonify({'error': 'No encontrada'}), 404
    
    db.execute("""
        SELECT ocd.*, p.nombre as producto_nombre, p.sku
        FROM ordenes_compra_detalle ocd
        JOIN productos p ON ocd.producto_id = p.id
        WHERE ocd.orden_id = %s
    """, (orden_id,))
    detalles = db.fetchall()
    
    res = {
        'proveedor_id': oc['proveedor_id'],
        'proveedor_nombre': oc['proveedor_nombre'],
        'referencia': f"Importado de OC: {oc['numero_oc']}",
        'detalles': [dict(d) for d in detalles]
    }
    # Conversión (Robust)
    for k, v in res.items():
        if isinstance(v, Decimal): res[k] = float(v)
        elif hasattr(v, 'isoformat'): res[k] = v.isoformat()
    
    for d in res['detalles']:
        for k, v in d.items():
            if isinstance(v, Decimal): d[k] = float(v)
            elif hasattr(v, 'isoformat'): d[k] = v.isoformat()

    return jsonify(res)

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>', methods=['DELETE'])
@token_required
def eliminar_orden_compra(current_user, negocio_id, orden_id):
    db = get_db()
    try:
        # 1. Verificar existencia y pertenencia
        db.execute("SELECT id FROM ordenes_compra WHERE id = %s AND negocio_id = %s", (orden_id, negocio_id))
        if not db.fetchone():
            return jsonify({'error': 'Orden de compra no encontrada'}), 404

        # 2. Verificar relacion con ingresos (IMPORTANTE)
        db.execute("SELECT id FROM ingresos_mercaderia WHERE orden_compra_id = %s LIMIT 1", (orden_id,))
        if db.fetchone():
            return jsonify({'error': 'No se puede eliminar la OC porque tiene ingresos de mercadería asociados.'}), 400

        # 3. Eliminar detalles y cabecera
        db.execute("DELETE FROM ordenes_compra_detalle WHERE orden_id = %s", (orden_id,))
        db.execute("DELETE FROM ordenes_compra WHERE id = %s", (orden_id,))
        
        g.db_conn.commit()
        return jsonify({'message': 'Orden de compra eliminada correctamente.'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/orden/<int:orden_id>/cancelar', methods=['PUT'])
@token_required
def cancelar_orden_compra(current_user, orden_id):
    db = get_db()
    try:
        db.execute("UPDATE ordenes_compra SET estado = 'cancelada' WHERE id = %s", (orden_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Orden cancelada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:negocio_id>/compras/config', methods=['GET'])
@token_required
def get_compras_config(current_user, negocio_id):
    db = get_db()
    db.execute("SELECT * FROM compras_configuracion WHERE negocio_id = %s", (negocio_id,))
    config = db.fetchone()
    if not config:
        return jsonify({})
    
    res = dict(config)
    if res.get('updated_at'):
        res['updated_at'] = res['updated_at'].isoformat()
    return jsonify(res)

@bp.route('/negocios/<int:negocio_id>/compras/config', methods=['POST'])
@token_required
def set_compras_config(current_user, negocio_id):
    db = get_db()
    data = request.json
    
    # Intentar buscar si ya existe
    db.execute("SELECT id FROM compras_configuracion WHERE negocio_id = %s", (negocio_id,))
    existing = db.fetchone()
    
    try:
        if existing:
            db.execute("""
                UPDATE compras_configuracion
                SET razon_social = %s, cuit = %s, condicion_iva = %s, domicilio = %s, 
                    telefono = %s, email = %s, horarios_entrega = %s, updated_at = CURRENT_TIMESTAMP
                WHERE negocio_id = %s
            """, (
                data.get('razon_social'), data.get('cuit'), data.get('condicion_iva'),
                data.get('domicilio'), data.get('telefono'), data.get('email'),
                data.get('horarios_entrega'), negocio_id
            ))
        else:
            db.execute("""
                INSERT INTO compras_configuracion (negocio_id, razon_social, cuit, condicion_iva, domicilio, telefono, email, horarios_entrega)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                negocio_id, data.get('razon_social'), data.get('cuit'), data.get('condicion_iva'),
                data.get('domicilio'), data.get('telefono'), data.get('email'), data.get('horarios_entrega')
            ))
        
        g.db_conn.commit()
        return jsonify({'message': 'Configuración guardada correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
