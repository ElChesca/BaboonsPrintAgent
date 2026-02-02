from flask import Blueprint, jsonify, request, g, current_app, send_from_directory
from app.database import get_db
from app.auth_decorator import token_required
import os
import sys
import datetime
from werkzeug.utils import secure_filename

bp = Blueprint('rentals', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- UNITS (CONTENEDORES) ---

@bp.route('/negocios/<int:negocio_id>/rentals/units', methods=['GET'])
@token_required
def get_units(current_user, negocio_id):
    db = get_db()
    db.execute(
        "SELECT * FROM alquiler_unidades WHERE negocio_id = %s ORDER BY nombre",
        (negocio_id,)
    )
    units = db.fetchall()
    return jsonify([dict(row) for row in units])

@bp.route('/negocios/<int:negocio_id>/rentals/units', methods=['POST'])
@token_required
def create_unit(current_user, negocio_id):
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    try:
        print("DEBUG: Inside try block", file=sys.stderr)
        is_sqlite = 'sqlite' in str(type(g.db_conn))
        print(f"DEBUG: is_sqlite={is_sqlite}", file=sys.stderr)

        query = """
            INSERT INTO alquiler_unidades (negocio_id, nombre, descripcion, tipo, estado,
                                           costo_adquisicion, precio_base_alquiler, ubicacion_actual, fecha_adquisicion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
        if not is_sqlite:
            query += " RETURNING id"

        print(f"DEBUG: Query: {query}", file=sys.stderr)
        db.execute(query, (negocio_id, data.get('nombre'), data.get('descripcion'), data.get('tipo', 'Oficina'),
             data.get('estado', 'disponible'), data.get('costo_adquisicion'), data.get('precio_base_alquiler'),
             data.get('ubicacion_actual'), data.get('fecha_adquisicion')))

        if is_sqlite:
            new_id = db.lastrowid
        else:
            new_id = db.fetchone()['id']

        print(f"DEBUG: Inserted ID: {new_id}", file=sys.stderr)

        g.db_conn.commit()
        return jsonify({'id': new_id, 'message': 'Unidad creada con éxito'}), 201
    except Exception as e:
        import traceback
        print(f"DEBUG: EXCEPTION CAUGHT: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/rentals/units/<int:unit_id>', methods=['PUT'])
@token_required
def update_unit(current_user, unit_id):
    data = request.get_json()
    allowed_fields = ['nombre', 'descripcion', 'tipo', 'estado', 'costo_adquisicion',
                      'precio_base_alquiler', 'ubicacion_actual', 'fecha_adquisicion']

    set_parts = []
    values = []
    for field in allowed_fields:
        if field in data:
            set_parts.append(f"{field} = %s")
            values.append(data[field])

    if not set_parts:
        return jsonify({'error': 'No hay datos para actualizar'}), 400

    values.append(unit_id)

    db = get_db()
    try:
        db.execute(f"UPDATE alquiler_unidades SET {', '.join(set_parts)} WHERE id = %s", tuple(values))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/rentals/units/<int:unit_id>', methods=['DELETE'])
@token_required
def delete_unit(current_user, unit_id):
    db = get_db()
    try:
        # Check dependencies? For now, let FK constraints handle it or catch error
        db.execute("DELETE FROM alquiler_unidades WHERE id = %s", (unit_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Unidad eliminada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# --- CONTRACTS ---

@bp.route('/negocios/<int:negocio_id>/rentals/contracts', methods=['GET'])
@token_required
def get_contracts(current_user, negocio_id):
    db = get_db()
    # Join with Client and Unit names
    query = """
        SELECT ac.*, c.nombre as cliente_nombre, au.nombre as unidad_nombre
        FROM alquiler_contratos ac
        JOIN clientes c ON ac.cliente_id = c.id
        JOIN alquiler_unidades au ON ac.unidad_id = au.id
        WHERE ac.negocio_id = %s
        ORDER BY ac.fecha_inicio DESC
    """
    db.execute(query, (negocio_id,))
    contracts = db.fetchall()
    return jsonify([dict(row) for row in contracts])

@bp.route('/negocios/<int:negocio_id>/rentals/contracts', methods=['POST'])
@token_required
def create_contract(current_user, negocio_id):
    # Handle multipart/form-data
    if 'data' in request.form:
         import json
         data = json.loads(request.form['data'])
    else:
         data = request.form # Try direct form access

    # Validation
    required = ['cliente_id', 'unidad_id', 'fecha_inicio', 'fecha_fin', 'monto_mensual']
    for r in required:
        if r not in request.form:
             return jsonify({'error': f'Falta campo requerido: {r}'}), 400

    file = request.files.get('archivo_contrato')
    filename_saved = None

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        upload_folder = os.path.join(current_app.static_folder, 'rentals', 'uploads')
        os.makedirs(upload_folder, exist_ok=True)
        # Unique name
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        filename_saved = f"{timestamp}_{filename}"
        file.save(os.path.join(upload_folder, filename_saved))

    db = get_db()
    try:
        is_sqlite = 'sqlite' in str(type(g.db_conn))
        # New fields: latitud, longitud, costo_traslado, traslado_a_cargo
        lat = request.form.get('latitud')
        lng = request.form.get('longitud')
        costo_traslado = request.form.get('costo_traslado', 0)
        traslado_a_cargo = request.form.get('traslado_a_cargo', 'cliente')

        query = """
            INSERT INTO alquiler_contratos (negocio_id, cliente_id, unidad_id, fecha_inicio, fecha_fin,
                                            monto_mensual, dia_vencimiento_pago, archivo_contrato, notas,
                                            latitud, longitud, costo_traslado, traslado_a_cargo)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
        if not is_sqlite:
            query += " RETURNING id"

        db.execute(query, (negocio_id, request.form['cliente_id'], request.form['unidad_id'], request.form['fecha_inicio'],
             request.form['fecha_fin'], request.form['monto_mensual'], request.form.get('dia_vencimiento_pago', 1),
             filename_saved, request.form.get('notas'), lat, lng, costo_traslado, traslado_a_cargo))

        if is_sqlite:
            new_id = db.lastrowid
        else:
            new_id = db.fetchone()['id']

        # Handle "Fotos de Estado de Entrega"
        # files is a MultiDict
        photos = request.files.getlist('fotos_estado')
        if photos:
            upload_folder = os.path.join(current_app.static_folder, 'rentals', 'uploads')
            for p in photos:
                if p and allowed_file(p.filename):
                    fname = secure_filename(p.filename)
                    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
                    fname_saved = f"{timestamp}_{fname}"
                    p.save(os.path.join(upload_folder, fname_saved))

                    db.execute(
                        "INSERT INTO alquiler_fotos_estado (contrato_id, etapa, archivo) VALUES (%s, %s, %s)",
                        (new_id, 'entrega', fname_saved)
                    )

        # Mark unit as Rented
        db.execute("UPDATE alquiler_unidades SET estado = 'alquilado' WHERE id = %s", (request.form['unidad_id'],))

        g.db_conn.commit()
        return jsonify({'id': new_id, 'message': 'Contrato creado'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/rentals/contracts/expiring', methods=['GET'])
@token_required
def get_expiring_contracts(current_user):
    negocio_id = request.args.get('negocio_id')
    days = int(request.args.get('days', 30))

    db = get_db()
    # Postgres/SQLite date math diff check
    # Simplified logic: fetch all active and filter in python or use simple date comparison
    # Trying SQLite compatible date generic approach
    today = datetime.date.today()
    limit_date = today + datetime.timedelta(days=days)

    query = """
        SELECT ac.*, c.nombre as cliente_nombre, au.nombre as unidad_nombre
        FROM alquiler_contratos ac
        JOIN clientes c ON ac.cliente_id = c.id
        JOIN alquiler_unidades au ON ac.unidad_id = au.id
        WHERE ac.negocio_id = %s AND ac.estado = 'activo' AND ac.fecha_fin <= %s
    """

    db.execute(query, (negocio_id, limit_date))
    contracts = db.fetchall()
    return jsonify([dict(row) for row in contracts])


# --- PAYMENTS ---

@bp.route('/rentals/contracts/<int:contract_id>/payments', methods=['GET'])
@token_required
def get_contract_payments(current_user, contract_id):
    db = get_db()
    db.execute("SELECT * FROM alquiler_pagos WHERE contrato_id = %s ORDER BY created_at DESC", (contract_id,))
    payments = db.fetchall()
    return jsonify([dict(row) for row in payments])

@bp.route('/rentals/contracts/<int:contract_id>/payments', methods=['POST'])
@token_required
def register_payment(current_user, contract_id):
    data = request.get_json()
    # period should be YYYY-MM
    required = ['periodo', 'monto_pagado']
    for r in required:
         if r not in data: return jsonify({'error': f'Falta {r}'}), 400

    db = get_db()
    try:
        # Check if payment exists for this period? Maybe allows partials?
        # Assuming we just log a payment
        is_sqlite = 'sqlite' in str(type(g.db_conn))
        query = """
            INSERT INTO alquiler_pagos (contrato_id, periodo, monto_esperado, monto_pagado, fecha_pago, estado, metodo_pago, notas)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
        if not is_sqlite:
            query += " RETURNING id"

        db.execute(query, (contract_id, data['periodo'], data.get('monto_esperado', 0), data['monto_pagado'],
             datetime.date.today(), 'pagado', data.get('metodo_pago'), data.get('notas')))

        if is_sqlite:
            new_id = db.lastrowid
        else:
            new_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': new_id, 'message': 'Pago registrado'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
