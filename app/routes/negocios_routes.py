# app/routes/negocios_routes.py
from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('negocios', __name__)

@bp.route('/negocios', methods=['GET'])
@token_required
def get_negocios(current_user):
    if not current_user or 'rol' not in current_user or 'id' not in current_user:
        return jsonify({'error': 'Error interno de autenticación'}), 500

    db = get_db()
    try:
        if current_user['rol'] == 'superadmin':
            db.execute("SELECT id, nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa FROM negocios ORDER BY nombre")
        else: # Admin u Operador
             db.execute("""
                 SELECT n.id, n.nombre, n.direccion, n.tipo_app, n.logo_url
                 FROM negocios n
                 JOIN usuarios_negocios un ON n.id = un.negocio_id
                 WHERE un.usuario_id = %s
                 ORDER BY n.nombre
             """, (current_user['id'],))

        negocios = db.fetchall()
        resultado = []
        for row in negocios:
            r = dict(row)
            # Manejo de tipos para JSON
            if 'fecha_alta' in r and r['fecha_alta']:
                r['fecha_alta'] = r['fecha_alta'].isoformat()
            if 'cuota_mensual' in r and r['cuota_mensual'] is not None:
                r['cuota_mensual'] = float(r['cuota_mensual'])
            
            if not r.get('logo_url'): r['logo_url'] = '' 
            resultado.append(r)
            
        return jsonify(resultado)

    except Exception as e:
        print(f"!!! DATABASE ERROR in get_negocios: {e}")
        g.db_conn.rollback()
        return jsonify({'error': f'Error al obtener negocios: {str(e)}'}), 500

@bp.route('/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or 'nombre' not in data:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400

    nombre = data['nombre']
    direccion = data.get('direccion', '')
    tipo_app = data.get('tipo_app', 'retail')
    logo_url = data.get('logo_url', '')
    fecha_alta = data.get('fecha_alta')
    cuota_mensual = data.get('cuota_mensual', 0)
    suscripcion_activa = data.get('suscripcion_activa', False)
    
    db = get_db()
    try:
        db.execute(
            'INSERT INTO negocios (nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id',
            (nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa)
        )
        nuevo_id = db.fetchone()['id']

        db.execute(
            'INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)',
            (current_user['id'], nuevo_id)
        )
        g.db_conn.commit()

        return jsonify({
            'id': nuevo_id, 'nombre': nombre, 'direccion': direccion,
            'tipo_app': tipo_app, 'logo_url': logo_url,
            'fecha_alta': fecha_alta, 'cuota_mensual': cuota_mensual,
            'suscripcion_activa': suscripcion_activa
        }), 201

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': f'Error al crear negocio: {str(e)}'}), 500

@bp.route('/negocios/<int:id>', methods=['PUT'])
@token_required
def actualizar_negocio(current_user, id):
    if current_user['rol'] not in ['superadmin', 'admin']: 
        return jsonify({'message': 'Acción no permitida'}), 403
        
    try:
        datos = request.get_json()
        nombre = datos['nombre']
        direccion = datos.get('direccion', '')
        tipo_app = datos.get('tipo_app', 'retail')
        logo_url = datos.get('logo_url', '')
        fecha_alta = datos.get('fecha_alta')
        cuota_mensual = datos.get('cuota_mensual', 0)
        suscripcion_activa = datos.get('suscripcion_activa', False)

        db = get_db()
        db.execute(
            'UPDATE negocios SET nombre = %s, direccion = %s, tipo_app = %s, logo_url = %s, fecha_alta = %s, cuota_mensual = %s, suscripcion_activa = %s WHERE id = %s', 
            (nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa, id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:id>/suscripcion-status', methods=['GET'])
@token_required
def get_subscription_status(current_user, id):
    db = get_db()
    if current_user['rol'] != 'superadmin':
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403

    try:
        import datetime
        hoy = datetime.date.today()
        
        # Verificar si la suscripción está activa para este negocio
        db.execute("SELECT suscripcion_activa, fecha_alta FROM negocios WHERE id = %s", (id,))
        negocio = db.fetchone()
        
        if not negocio or not negocio['suscripcion_activa']:
            return jsonify({'status': 'ok', 'mensaje': ''})

        fecha_alta = negocio['fecha_alta']
        # Si no tiene fecha de alta o la fecha es futura, no exigimos pago
        if not fecha_alta or fecha_alta > hoy:
             return jsonify({'status': 'ok', 'mensaje': ''})

        mes_actual = hoy.month
        anio_actual = hoy.year
        dia_actual = hoy.day

        db.execute("""
            SELECT 1 FROM suscripciones_pagos 
            WHERE negocio_id = %s AND mes = %s AND anio = %s
        """, (id, mes_actual, anio_actual))
        pago_existente = db.fetchone()

        status = "ok"
        mensaje = ""

        if not pago_existente:
            if dia_actual > 10:
                status = "overdue"
                mensaje = f"Suscripción Vencida (Mes {mes_actual}/{anio_actual}). Por favor, regularice su situación."
            else:
                status = "pending"
                mensaje = f"Aviso de Vencimiento: El pago del mes {mes_actual}/{anio_actual} vence el día 10."

        return jsonify({
            'status': status,
            'mensaje': mensaje,
            'mes': mes_actual,
            'anio': anio_actual,
            'dia_vencimiento': 10
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500