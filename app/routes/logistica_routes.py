from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('logistica', __name__)

@bp.route('/vehiculos', methods=['GET'])
@token_required
def get_vehiculos(current_user):
    db = get_db()
    negocio_id = request.args.get('negocio_id')
    
    if not negocio_id:
        return jsonify({'error': 'Falta negocio_id'}), 400
        
    try:
        db.execute("""
            SELECT id, patente, modelo, capacidad_kg, capacidad_volumen_m3, 
                   capacidad_pallets, tipo_vehiculo, propiedad, enganche_id, chofer_default_id,
                   activo, fecha_creacion
            FROM vehiculos
            WHERE negocio_id = %s
            ORDER BY patente ASC
        """, (negocio_id,))
        vehiculos = db.fetchall()
        
        # Convert to dict if not already (RealDictCursor handles it, but safety check)
        result = [dict(v) for v in vehiculos]
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos', methods=['POST'])
@token_required
def create_vehiculo(current_user):
    db = get_db()
    data = request.json
    
    patente = data.get('patente')
    modelo = data.get('modelo')
    negocio_id = data.get('negocio_id')
    
    if not patente or not modelo or not negocio_id:
        return jsonify({'error': 'Faltan campos obligatorios (patente, modelo, negocio_id)'}), 400
        
    try:
        db.execute("""
            INSERT INTO vehiculos (
                patente, modelo, capacidad_kg, capacidad_volumen_m3, 
                capacidad_pallets, tipo_vehiculo, propiedad, 
                enganche_id, chofer_default_id, negocio_id, activo
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            patente.upper(), modelo, 
            data.get('capacidad_kg', 0), data.get('capacidad_volumen_m3', 0),
            data.get('capacidad_pallets', 0), data.get('tipo_vehiculo', 'utilitario'),
            data.get('propiedad', 'propio'), data.get('enganche_id'),
            data.get('chofer_default_id'), negocio_id, data.get('activo', True)
        ))
        new_id = db.fetchone()['id']
        db.connection.commit()
        return jsonify({'id': new_id, 'mensaje': 'Vehículo creado con éxito'}), 201
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos/<int:id>', methods=['PUT'])
@token_required
def update_vehiculo(current_user, id):
    db = get_db()
    data = request.json
    
    try:
        db.execute("""
            UPDATE vehiculos 
            SET patente = %s, modelo = %s, 
                capacidad_kg = %s, capacidad_volumen_m3 = %s, capacidad_pallets = %s,
                tipo_vehiculo = %s, propiedad = %s, 
                enganche_id = %s, chofer_default_id = %s,
                activo = %s
            WHERE id = %s
        """, (
            data.get('patente').upper(), data.get('modelo'), 
            data.get('capacidad_kg'), data.get('capacidad_volumen_m3'),
            data.get('capacidad_pallets'), data.get('tipo_vehiculo'),
            data.get('propiedad'), data.get('enganche_id'),
            data.get('chofer_default_id'), data.get('activo', True),
            id
        ))
        db.connection.commit()
        return jsonify({'mensaje': 'Vehículo actualizado con éxito'})
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500

# --- Documentación Vehículos ---

@bp.route('/vehiculos/<int:id>/documentacion', methods=['GET'])
@token_required
def get_documentacion_vehiculo(current_user, id):
    db = get_db()
    try:
        db.execute("""
            SELECT * FROM documentacion 
            WHERE entity_type = 'vehiculo' AND entity_id = %s 
            ORDER BY fecha_vencimiento ASC
        """, (id,))
        docs = db.fetchall()
        return jsonify([dict(d) for d in docs])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/vehiculos/<int:id>/documentacion', methods=['POST'])
@token_required
def add_documentacion_vehiculo(current_user, id):
    db = get_db()
    data = request.json
    try:
        db.execute("""
            INSERT INTO documentacion (entity_type, entity_id, tipo_documento, fecha_vencimiento, archivo_path, observaciones)
            VALUES ('vehiculo', %s, %s, %s, %s, %s)
            RETURNING id
        """, (id, data['tipo_documento'], data['fecha_vencimiento'], data.get('archivo_path'), data.get('observaciones')))
        
        new_id = db.fetchone()['id']
        db.connection.commit()
        return jsonify({'mensaje': 'Documento agregado', 'id': new_id})
    except Exception as e:
        db.connection.rollback()
        return jsonify({'error': str(e)}), 500
@bp.route('/vehiculos/<int:id>/stock', methods=['GET'])
@token_required
def get_vehiculo_stock(current_user, id):
    db = get_db()
    try:
        db.execute("""
            SELECT vs.*, p.nombre as producto_nombre
            FROM vehiculos_stock vs
            JOIN productos p ON vs.producto_id = p.id
            WHERE vs.vehiculo_id = %s
            AND vs.cantidad != 0
            ORDER BY p.nombre ASC
        """, (id,))
        stock = db.fetchall()
        return jsonify([dict(s) for s in stock])
    except Exception as e:
        return jsonify({'error': str(e)}), 500
