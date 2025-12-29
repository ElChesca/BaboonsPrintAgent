from flask import Blueprint, request, jsonify, g
from app.database import get_db

bp = Blueprint('crm_leads', __name__)

@bp.route('/leads', methods=['GET'])
def get_leads():
    negocio_id = request.args.get('negocio_id')
    if not negocio_id:
        return jsonify({'error': 'negocio_id es requerido'}), 400

    db = get_db()
    db.execute(
        "SELECT id, nombre, email, telefono, estado, origen, notas, fecha_creacion FROM crm_leads WHERE negocio_id = %s ORDER BY fecha_creacion DESC",
        (negocio_id,)
    )
    leads = db.fetchall()

    # Convert rows to dicts
    leads_list = []
    for row in leads:
        leads_list.append({
            'id': row['id'],
            'nombre': row['nombre'],
            'email': row['email'],
            'telefono': row['telefono'],
            'estado': row['estado'],
            'origen': row['origen'],
            'notas': row['notas'],
            'fecha_creacion': row['fecha_creacion']
        })

    return jsonify(leads_list)

@bp.route('/leads', methods=['POST'])
def create_lead():
    data = request.get_json()
    negocio_id = data.get('negocio_id')
    nombre = data.get('nombre')

    if not negocio_id or not nombre:
        return jsonify({'error': 'negocio_id y nombre son requeridos'}), 400

    email = data.get('email')
    telefono = data.get('telefono')
    estado = data.get('estado', 'nuevo')
    origen = data.get('origen', 'manual')
    notas = data.get('notas', '')

    db = get_db()
    try:
        db.execute(
            "INSERT INTO crm_leads (negocio_id, nombre, email, telefono, estado, origen, notas) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (negocio_id, nombre, email, telefono, estado, origen, notas)
        )
        new_row = db.fetchone()
        g.db_conn.commit()
        return jsonify({'success': True, 'id': new_row['id'], 'message': 'Lead creado correctamente'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/leads/<int:lead_id>', methods=['PUT'])
def update_lead(lead_id):
    data = request.get_json()
    fields = ['nombre', 'email', 'telefono', 'estado', 'origen', 'notas']
    updates = []
    values = []

    for field in fields:
        if field in data:
            updates.append(f"{field} = %s")
            values.append(data[field])

    if not updates:
        return jsonify({'message': 'No changes provided'}), 200

    values.append(lead_id)
    query = f"UPDATE crm_leads SET {', '.join(updates)} WHERE id = %s"

    db = get_db()
    try:
        db.execute(query, values)
        g.db_conn.commit()
        return jsonify({'success': True, 'message': 'Lead actualizado'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/leads/stats', methods=['GET'])
def get_leads_stats():
    negocio_id = request.args.get('negocio_id')
    if not negocio_id:
        return jsonify({'error': 'negocio_id es requerido'}), 400

    db = get_db()
    # Count total leads
    db.execute("SELECT COUNT(*) as count FROM crm_leads WHERE negocio_id = %s", (negocio_id,))
    total = db.fetchone()['count']

    # Count new leads
    db.execute("SELECT COUNT(*) as count FROM crm_leads WHERE negocio_id = %s AND estado = 'nuevo'", (negocio_id,))
    nuevos = db.fetchone()['count']

    return jsonify({
        'total': total,
        'nuevos': nuevos
    })
