# app/routes/eventos_routes.py
from flask import Blueprint, request, jsonify, g, current_app
from app.database import get_db
from app.auth_decorator import token_required
from app.services.mercado_pago_service import MercadoPagoService
from app.services.eventos_notifications import EventosNotificationsService
import datetime
import traceback
import io
import csv
from flask import make_response

bp = Blueprint('eventos', __name__)

# --- RUTAS PÚBLICAS (LANDING) ---

# --- UTILERÍA DE SEGURIDAD PARA SLUGS VIRTUALES ---
import hashlib
SLUG_SALT = "baboons_event_security_2024"

def generate_virtual_slug(evento_id):
    """Genera un hash determinista a partir del ID para evitar enumeración."""
    return hashlib.sha256(f"{evento_id}{SLUG_SALT}".encode()).hexdigest()[:12]

@bp.route('/api/public/eventos/<string:identifier>', methods=['GET'])
def get_public_evento(identifier):
    """Busca evento por ID (vendedor) o por SLUG (público)."""
    db = get_db()
    try:
        # Intentamos buscar por ID numérico primero
        if identifier.isdigit():
            db.execute("SELECT * FROM eventos WHERE id = %s AND estado = 'activo'", (int(identifier),))
        else:
            # Buscamos por slug (recorriendo activos, es eficiente para pocos eventos)
            db.execute("SELECT * FROM eventos WHERE estado = 'activo'")
            all_events = db.fetchall()
            evento = next((e for e in all_events if generate_virtual_slug(e['id']) == identifier), None)
            if not evento:
                 return jsonify({'error': 'Evento no encontrado'}), 404
            return jsonify_evento(evento)

        evento = db.fetchone()
        if not evento:
            return jsonify({'error': 'Evento no encontrado o no disponible'}), 404
        
        return jsonify_evento(evento)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def jsonify_evento(evento):
    evento['precio'] = float(evento['precio'])
    evento['fecha_evento'] = evento['fecha_evento'].isoformat() if evento['fecha_evento'] else None
    evento['virtual_slug'] = generate_virtual_slug(evento['id'])
    return jsonify(evento)

# --- RUTA PARA SERVIR LA LANDING (Jinja2) ---

@bp.route('/landing/<string:identifier>')
def serve_event_landing(identifier):
    from flask import render_template
    db = get_db()
    try:
        # Buscamos el evento
        if identifier.isdigit():
            db.execute("SELECT * FROM eventos WHERE id = %s", (int(identifier),))
            evento = db.fetchone()
        else:
            db.execute("SELECT * FROM eventos WHERE estado = 'activo'")
            all_events = db.fetchall()
            evento = next((e for e in all_events if generate_virtual_slug(e['id']) == identifier), None)

        if not evento:
            return "Evento no encontrado", 404
        
        # 2. Obtener datos del negocio
        db.execute("SELECT nombre, logo_url FROM negocios WHERE id = %s", (evento['negocio_id'],))
        negocio = db.fetchone()
        
        # 3. Preparar variables para OG y Renderizado
        og_title = evento['titulo']
        og_image = ""
        if negocio and negocio['logo_url']:
            img_path = negocio['logo_url']
            if img_path.startswith('http'):
                og_image = img_path
            else:
                og_image = request.url_root.rstrip('/') + (img_path if img_path.startswith('/') else '/' + img_path)
        else:
            og_image = request.url_root.rstrip('/') + "/static/img/logo.png"

        return render_template('eventos_landing.html', 
                             og_title=og_title, 
                             og_image=og_image, 
                             evento_id=evento['id'],
                             virtual_slug=generate_virtual_slug(evento['id']))
    except Exception as e:
        current_app.logger.error(f"Error sirviendo landing de evento {identifier}: {e}")
        return f"Error en el servidor: {e}", 500

@bp.route('/api/public/eventos/<int:evento_id>/inscribir', methods=['POST'])
def inscribir_public_evento(evento_id):
    db = get_db()
    data = request.get_json()
    
    nombre = data.get('nombre', '').strip()
    email = data.get('email', '').strip()
    telefono = data.get('telefono', '').strip()
    metodo_pago = data.get('metodo_pago')
    honeypot = data.get('website') # Trampa para bots

    # 1. 🛡️ VERIFICACIÓN HONEYPOT
    if honeypot:
        current_app.logger.warning(f"Intento de bot detectado (Honeypot activado): {email}")
        return jsonify({'error': 'Registro rechazado por política de seguridad'}), 400

    if not nombre or not email:
        return jsonify({'error': 'Nombre y Email son obligatorios'}), 400

    # 2. 🛡️ VALIDACIÓN DE DATOS
    import re
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not re.match(email_regex, email):
        return jsonify({'error': 'Formato de email inválido'}), 400

    try:
        # 3. Validar Cupo
        db.execute("SELECT * FROM eventos WHERE id = %s FOR UPDATE", (evento_id,))
        evento = db.fetchone()
        
        if not evento or evento['estado'] != 'activo':
            return jsonify({'error': 'Evento no disponible'}), 404
        
        if evento['cupos_disponibles'] <= 0:
            return jsonify({'error': 'Lo sentimos, ya no hay cupos disponibles'}), 400

        # 2. Crear Inscripción
        monto = float(evento['precio'])
        negocio_id = evento['negocio_id']
        
        db.execute("""
            INSERT INTO eventos_inscripciones (evento_id, negocio_id, nombre_cliente, email, telefono, metodo_pago, monto_total)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, token_asistencia
        """, (evento_id, negocio_id, nombre, email, telefono, metodo_pago, monto))
        
        res_inscripcion = db.fetchone()
        inscripcion_id = res_inscripcion['id']
        token = res_inscripcion['token_asistencia']

        response_data = {
            'message': 'Pre-inscripción exitosa',
            'inscripcion_id': inscripcion_id,
            'metodo_pago': metodo_pago
        }

        # 3. Flujo Mercado Pago
        if metodo_pago == 'Mercado Pago' and monto > 0:
            try:
                mp_service = MercadoPagoService(negocio_id)
                if not mp_service.access_token:
                    return jsonify({'error': 'Este negocio aún no tiene configurado Mercado Pago para cobros online. Por favor, seleccione otro medio de pago.'}), 400
                    
                pref = mp_service.create_preference(
                    title=f"Entrada: {evento['titulo']}",
                    unit_price=monto,
                    external_reference=str(inscripcion_id),
                    notification_url=f"https://multinegociobaboons-fly.fly.dev/api/public/eventos/webhook/mp"
                )
                
                if "init_point" in pref:
                    db.execute("UPDATE eventos_inscripciones SET mp_preference_id = %s WHERE id = %s", (pref['id'], inscripcion_id))
                    response_data['payment_url'] = pref['init_point']
                else:
                    current_app.logger.error(f"Error MP Preference: {pref}")
                    return jsonify({'error': 'Error de comunicación con la plataforma de pagos. Intente nuevamente.'}), 500
            except Exception as mp_err:
                current_app.logger.error(f"Excepción MP: {mp_err}")
                return jsonify({'error': 'Error interno al procesar el pago online.'}), 500

        # 4. Bajar cupo (opcional: solo si se confirma, o reservar por X tiempo)
        # Por ahora bajamos al inscribir para prevenir sobreventa, si el pago falla se libera luego.
        db.execute("UPDATE eventos SET cupos_disponibles = cupos_disponibles - 1 WHERE id = %s", (evento_id,))

        g.db_conn.commit()
        return jsonify(response_data), 201

    except Exception as e:
        g.db_conn.rollback()
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- WEBHOOK MERCADO PAGO ---

@bp.route('/public/eventos/webhook/mp', methods=['POST'])
def mp_webhook():
    """Recibe la notificación de pago de Mercado Pago y confirma la inscripción."""
    data = request.args
    resource_id = data.get('id') or request.get_json().get('data', {}).get('id')
    topic = data.get('topic') or request.get_json().get('type')

    if topic == 'payment':
        # Nota: Aquí deberíamos consultar la API de MP para validar el pago
        # Pero simplificamos para la demo buscando por external_reference
        pass
        
    return "OK", 200

# --- RUTAS ADMIN (TOKEN REQUERIDO) ---

@bp.route('/api/negocios/<int:negocio_id>/eventos', methods=['GET'])
@token_required
def list_eventos(current_user, negocio_id):
    db = get_db()
    db.execute("SELECT * FROM eventos WHERE negocio_id = %s ORDER BY fecha_evento DESC", (negocio_id,))
    eventos = db.fetchall()
    for e in eventos:
        e['precio'] = float(e['precio'])
        e['fecha_evento'] = e['fecha_evento'].isoformat() if e['fecha_evento'] else None
        e['virtual_slug'] = generate_virtual_slug(e['id'])
    return jsonify(eventos)

@bp.route('/api/negocios/<int:negocio_id>/eventos', methods=['POST'])
@token_required
def create_evento(current_user, negocio_id):
    db = get_db()
    data = request.get_json()
    try:
        db.execute("""
            INSERT INTO eventos (negocio_id, titulo, descripcion, fecha_evento, ubicacion, precio, cupo_total, cupos_disponibles)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (negocio_id, data['titulo'], data.get('descripcion'), data['fecha_evento'], 
              data.get('ubicacion'), data.get('precio', 0), data['cupo_total'], data['cupo_total']))
        
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/eventos/asistencia', methods=['POST'])
@token_required
def registrar_asistencia(current_user):
    """El operador escanea el token del QR."""
    db = get_db()
    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify({'error': 'Token QR no proporcionado'}), 400

    try:
        db.execute("SELECT * FROM eventos_inscripciones WHERE token_asistencia = %s", (token,))
        inscripcion = db.fetchone()

        if not inscripcion:
            return jsonify({'error': 'Ticket inválido o no encontrado'}), 404

        if inscripcion['asistio']:
            return jsonify({'error': 'Este ticket ya fue utilizado para ingresar', 'nombre': inscripcion['nombre_cliente']}), 400

        if inscripcion['estado_pago'] != 'confirmado':
             return jsonify({'error': 'El pago de este ticket aún no ha sido confirmado', 'nombre': inscripcion['nombre_cliente']}), 400

        db.execute("""
            UPDATE eventos_inscripciones 
            SET asistio = TRUE, fecha_asistencia = CURRENT_TIMESTAMP 
            WHERE id = %s
        """, (inscripcion['id'],))
        
        g.db_conn.commit()
        return jsonify({
            'message': 'Ingreso Registrado con Éxito',
            'nombre': inscripcion['nombre_cliente']
        })

    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

# --- NUEVAS RUTAS DE GESTIÓN ---

@bp.route('/api/eventos/<int:evento_id>/inscriptos', methods=['GET'])
@token_required
def get_inscriptos(current_user, evento_id):
    db = get_db()
    try:
        db.execute("SELECT * FROM eventos_inscripciones WHERE evento_id = %s ORDER BY id DESC", (evento_id,))
        inscriptos = db.fetchall()
        for i in inscriptos:
            i['monto_total'] = float(i['monto_total'])
            i['fecha_asistencia'] = i['fecha_asistencia'].isoformat() if i['fecha_asistencia'] else None
        return jsonify(inscriptos)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/eventos/inscripciones/<int:inscripcion_id>', methods=['PATCH'])
@token_required
def update_inscripcion(current_user, inscripcion_id):
    db = get_db()
    data = request.get_json()
    try:
        allowed_fields = ['estado_pago', 'asistio']
        updates = []
        params = []
        for field in allowed_fields:
            if field in data:
                updates.append(f"{field} = %s")
                params.append(data[field])
        
        if not updates:
            return jsonify({'error': 'No hay campos válidos para actualizar'}), 400
            
        params.append(inscripcion_id)
        db.execute(f"UPDATE eventos_inscripciones SET {', '.join(updates)} WHERE id = %s", tuple(params))
        g.db_conn.commit()
        return jsonify({'message': 'Inscripción actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/eventos/<int:evento_id>/exportar', methods=['GET'])
@token_required
def export_inscriptos(current_user, evento_id):
    db = get_db()
    try:
        db.execute("SELECT nombre_cliente, email, telefono, metodo_pago, monto_total, estado_pago, asistio FROM eventos_inscripciones WHERE evento_id = %s", (evento_id,))
        rows = db.fetchall()
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Nombre', 'Email', 'Telefono', 'Metodo Pago', 'Monto', 'Estado Pago', 'Asistio'])
        for row in rows:
            writer.writerow([row['nombre_cliente'], row['email'], row['telefono'], row['metodo_pago'], row['monto_total'], row['estado_pago'], 'SI' if row['asistio'] else 'NO'])
            
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=inscriptos_evento_{evento_id}.csv"
        response.headers["Content-type"] = "text/csv"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/negocios/<int:negocio_id>/eventos/<int:evento_id>', methods=['PATCH'])
@token_required
def update_evento(current_user, negocio_id, evento_id):
    db = get_db()
    data = request.get_json()
    try:
        db.execute("""
            UPDATE eventos 
            SET titulo = %s, descripcion = %s, fecha_evento = %s, ubicacion = %s, precio = %s, cupo_total = %s
            WHERE id = %s AND negocio_id = %s
        """, (data['titulo'], data.get('descripcion'), data['fecha_evento'], 
              data.get('ubicacion'), data.get('precio', 0), data['cupo_total'], evento_id, negocio_id))
        
        g.db_conn.commit()
        return jsonify({'message': 'Evento actualizado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/api/negocios/<int:negocio_id>/eventos/<int:evento_id>', methods=['DELETE'])
@token_required
def delete_evento(current_user, negocio_id, evento_id):
    db = get_db()
    try:
        # Soft delete: cambiar estado a 'eliminado'
        db.execute("UPDATE eventos SET estado = 'eliminado' WHERE id = %s AND negocio_id = %s", (evento_id, negocio_id))
        g.db_conn.commit()
        return jsonify({'message': 'Evento eliminado'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
