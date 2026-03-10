# app/routes/tickets_routes.py
# Sistema de Tickets de Soporte Interno

import datetime
from flask import Blueprint, request, jsonify, g, current_app
from app.database import get_db
from app.auth_decorator import token_required

bp = Blueprint('tickets', __name__)

# ── SLA por prioridad ─────────────────────────────────────────────────────────
SLA_HORAS = {
    'urgente': 4,
    'alta': 24,
    'media': 72,
    'baja': None
}

def _calcular_fecha_limite(prioridad):
    horas = SLA_HORAS.get(prioridad)
    if horas is None:
        return None
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=horas)

def _check_permiso(negocio_id, current_user):
    """Verifica que el usuario esté asignado al negocio o sea superadmin."""
    if current_user['rol'] == 'superadmin':
        return None, None
    db = get_db()
    db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s",
               (current_user['id'], negocio_id))
    if not db.fetchone():
        return {'error': 'No autorizado para este negocio'}, 403
    return None, None


def _enviar_email_ticket(negocio_id, asunto, cuerpo, extra_recipients=None):
    """Envía email a todos los destinatarios configurados para el negocio."""
    try:
        from app import mail
        from flask_mail import Message
        db = get_db()
        db.execute(
            "SELECT email FROM ticket_alertas_config WHERE negocio_id = %s AND activo = TRUE",
            (negocio_id,)
        )
        destinatarios = [row['email'] for row in db.fetchall()]
        if extra_recipients:
            if isinstance(extra_recipients, str):
                destinatarios.append(extra_recipients)
            else:
                destinatarios.extend(extra_recipients)
        
        # Eliminar duplicados y nulos
        destinatarios = list(set([d for d in destinatarios if d]))

        if not destinatarios:
            return
        msg = Message(
            subject=asunto,
            recipients=destinatarios,
            sender=('Multinegocio Baboons', 'info@baboons.com.ar'),
            body=cuerpo
        )
        mail.send(msg)
        current_app.logger.info(f"[Tickets] Email enviado a {destinatarios}: {asunto}")
    except Exception as e:
        current_app.logger.error(f"[Tickets] Error enviando email: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LISTADO Y CREACIÓN DE TICKETS
# ═══════════════════════════════════════════════════════════════════════════════

@bp.route('/negocios/<int:negocio_id>/tickets', methods=['GET'])
@token_required
def get_tickets(current_user, negocio_id):
    error, status = _check_permiso(negocio_id, current_user)
    if error:
        return jsonify(error), status

    db = get_db()
    estado = request.args.get('estado')
    prioridad = request.args.get('prioridad')
    asignado_id = request.args.get('asignado_id')
    busqueda = request.args.get('q', '').strip()

    query = """
        SELECT
            t.id, t.titulo, t.descripcion, t.categoria, t.prioridad, t.estado,
            t.horas_estimadas, t.horas_reales, t.sla_vencido,
            t.fecha_creacion, t.fecha_actualizacion, t.fecha_limite, t.fecha_resolucion,
            creador.nombre  AS creador_nombre,
            asignado.nombre AS asignado_nombre,
            t.usuario_asignado_id,
            t.usuario_creador_id,
            (SELECT COUNT(*) FROM ticket_comentarios tc WHERE tc.ticket_id = t.id) AS comentarios_count
        FROM tickets t
        JOIN usuarios creador  ON t.usuario_creador_id  = creador.id
        LEFT JOIN usuarios asignado ON t.usuario_asignado_id = asignado.id
        WHERE t.negocio_id = %s
    """
    params = [negocio_id]

    if estado:
        query += " AND t.estado = %s"
        params.append(estado)
    if prioridad:
        query += " AND t.prioridad = %s"
        params.append(prioridad)
    if asignado_id:
        query += " AND t.usuario_asignado_id = %s"
        params.append(asignado_id)
    if busqueda:
        query += " AND (t.titulo ILIKE %s OR t.descripcion ILIKE %s)"
        params.extend([f'%{busqueda}%', f'%{busqueda}%'])

    query += " ORDER BY t.sla_vencido DESC, t.fecha_actualizacion DESC"

    try:
        db.execute(query, tuple(params))
        tickets = db.fetchall()
        return jsonify([dict(row) for row in tickets])
    except Exception as e:
        current_app.logger.error(f"[Tickets] Error get_tickets: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/tickets', methods=['POST'])
@token_required
def create_ticket(current_user, negocio_id):
    error, status = _check_permiso(negocio_id, current_user)
    if error:
        return jsonify(error), status

    data = request.get_json()
    if not data or not data.get('titulo'):
        return jsonify({'error': 'El título es obligatorio'}), 400

    prioridad = data.get('prioridad', 'media')
    fecha_limite = _calcular_fecha_limite(prioridad)

    # Si el usuario pasó una fecha_limite manual, usarla
    if data.get('fecha_limite'):
        try:
            fecha_limite = datetime.datetime.fromisoformat(data['fecha_limite'])
        except Exception:
            pass

    db = get_db()
    try:
        db.execute(
            """
            INSERT INTO tickets (
                negocio_id, titulo, descripcion, categoria, prioridad,
                usuario_creador_id, usuario_asignado_id, horas_estimadas, fecha_limite,
                email_contacto, recibir_notificaciones
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, titulo, prioridad, fecha_limite
            """,
            (
                negocio_id,
                data['titulo'],
                data.get('descripcion'),
                data.get('categoria', 'General'),
                prioridad,
                current_user['id'],
                data.get('usuario_asignado_id') or None,
                data.get('horas_estimadas') or None,
                fecha_limite,
                data.get('email_contacto'),
                data.get('recibir_notificaciones', True)
            )
        )
        nuevo = db.fetchone()
        nuevo_id = nuevo['id']

        # Comentario de creación automático
        db.execute(
            "INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, tipo) VALUES (%s, %s, %s, 'cambio_estado')",
            (nuevo_id, current_user['id'], f"Ticket creado por {current_user['nombre']} con prioridad {prioridad}.")
        )

        g.db_conn.commit()

        # Notificación email
        sla_texto = f"Fecha límite SLA: {fecha_limite.strftime('%d/%m/%Y %H:%M')}" if fecha_limite else "Sin fecha límite"
        _enviar_email_ticket(
            negocio_id,
            f"[Ticket #{nuevo_id}] Nuevo ticket: {data['titulo']}",
            f"Se creó un nuevo ticket de soporte:\n\n"
            f"ID: #{nuevo_id}\n"
            f"Título: {data['titulo']}\n"
            f"Prioridad: {prioridad.upper()}\n"
            f"Categoría: {data.get('categoria', 'General')}\n"
            f"Descripción: {data.get('descripcion', '-')}\n"
            f"{sla_texto}\n\n"
            f"Creado por: {current_user['nombre']}"
        )

        return jsonify({'message': 'Ticket creado con éxito', 'id': nuevo_id}), 201
    except Exception as e:
        g.db_conn.rollback()
        current_app.logger.error(f"[Tickets] Error create_ticket: {e}")
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 2. DETALLE, ACTUALIZACIÓN Y ELIMINACIÓN
# ═══════════════════════════════════════════════════════════════════════════════

@bp.route('/tickets/<int:ticket_id>', methods=['GET'])
@token_required
def get_ticket(current_user, ticket_id):
    db = get_db()
    db.execute("SELECT negocio_id FROM tickets WHERE id = %s", (ticket_id,))
    row = db.fetchone()
    if not row:
        return jsonify({'error': 'Ticket no encontrado'}), 404
    error, status = _check_permiso(row['negocio_id'], current_user)
    if error:
        return jsonify(error), status

    db.execute(
        """
        SELECT t.*, 
               creador.nombre  AS creador_nombre,
               asignado.nombre AS asignado_nombre
        FROM tickets t
        JOIN usuarios creador ON t.usuario_creador_id = creador.id
        LEFT JOIN usuarios asignado ON t.usuario_asignado_id = asignado.id
        WHERE t.id = %s
        """,
        (ticket_id,)
    )
    ticket = db.fetchone()
    return jsonify(dict(ticket))


@bp.route('/tickets/<int:ticket_id>', methods=['PUT'])
@token_required
def update_ticket(current_user, ticket_id):
    db = get_db()
    db.execute("SELECT negocio_id, estado, prioridad, usuario_asignado_id, email_contacto, recibir_notificaciones FROM tickets WHERE id = %s", (ticket_id,))
    ticket = db.fetchone()
    if not ticket:
        return jsonify({'error': 'Ticket no encontrado'}), 404
    error, status = _check_permiso(ticket['negocio_id'], current_user)
    if error:
        return jsonify(error), status

    data = request.get_json()
    nuevo_estado = data.get('estado', ticket['estado'])
    nueva_prioridad = data.get('prioridad', ticket['prioridad'])
    ahora = datetime.datetime.now(datetime.timezone.utc)

    fecha_resolucion = None
    if nuevo_estado in ('resuelto', 'cerrado') and ticket['estado'] not in ('resuelto', 'cerrado'):
        fecha_resolucion = ahora

    # Recalcular fecha_limite si cambia la prioridad
    fecha_limite = ticket.get('fecha_limite')
    if nueva_prioridad != ticket['prioridad']:
        fecha_limite = _calcular_fecha_limite(nueva_prioridad)
    if data.get('fecha_limite'):
        try:
            fecha_limite = datetime.datetime.fromisoformat(data['fecha_limite'])
        except Exception:
            pass

    try:
        db.execute(
            """
            UPDATE tickets SET
                titulo = %s,
                descripcion = %s,
                categoria = %s,
                prioridad = %s,
                estado = %s,
                usuario_asignado_id = %s,
                horas_estimadas = %s,
                horas_reales = %s,
                fecha_limite = %s,
                email_contacto = %s,
                recibir_notificaciones = %s,
                fecha_resolucion = COALESCE(%s, fecha_resolucion),
                fecha_actualizacion = %s
            WHERE id = %s
            """,
            (
                data.get('titulo'),
                data.get('descripcion'),
                data.get('categoria', 'General'),
                nueva_prioridad,
                nuevo_estado,
                data.get('usuario_asignado_id') or None,
                data.get('horas_estimadas') or None,
                data.get('horas_reales') or None,
                fecha_limite,
                data.get('email_contacto', ticket['email_contacto']),
                data.get('recibir_notificaciones', ticket['recibir_notificaciones']),
                fecha_resolucion,
                ahora,
                ticket_id
            )
        )

        # Registrar cambios de estado como actividad
        estado_cambiado = nuevo_estado != ticket['estado']
        asignado_cambiado = str(data.get('usuario_asignado_id') or '') != str(ticket['usuario_asignado_id'] or '')

        if estado_cambiado:
            db.execute(
                "INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, tipo) VALUES (%s, %s, %s, 'cambio_estado')",
                (ticket_id, current_user['id'], f"Estado cambiado a «{nuevo_estado}» por {current_user['nombre']}.")
            )
        if asignado_cambiado:
            db.execute(
                "INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, tipo) VALUES (%s, %s, %s, 'cambio_estado')",
                (ticket_id, current_user['id'], f"Reasignado por {current_user['nombre']}.")
            )
        
        # Notificación por email al creador si el estado cambió Y el usuario desea recibir notificaciones
        recibir = data.get('recibir_notificaciones', ticket['recibir_notificaciones'])
        if estado_cambiado and recibir:
            db.execute("SELECT u.email, t.titulo, t.email_contacto FROM tickets t JOIN usuarios u ON t.usuario_creador_id = u.id WHERE t.id = %s", (ticket_id,))
            res_creador = db.fetchone()
            
            # El email de destino es prioritariamente el email_contacto del ticket, sino el del usuario
            target_email = res_creador.get('email_contacto') or res_creador.get('email')
            
            if target_email:
                _enviar_email_ticket(
                    ticket['negocio_id'],
                    f"[Ticket #{ticket_id}] Cambio de estado: {res_creador['titulo']}",
                    f"Hola,\n\nTu ticket #{ticket_id} ha cambiado de estado.\n\n"
                    f"Nuevo estado: {nuevo_estado.upper()}\n"
                    f"Cambiado por: {current_user['nombre']}\n\n"
                    f"Puedes ver los detalles ingresando al sistema.",
                    extra_recipients=target_email
                )

        g.db_conn.commit()
        return jsonify({'message': 'Ticket actualizado'}), 200
    except Exception as e:
        g.db_conn.rollback()
        current_app.logger.error(f"[Tickets] Error update_ticket: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/tickets/<int:ticket_id>', methods=['DELETE'])
@token_required
def delete_ticket(current_user, ticket_id):
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'error': 'Solo administradores pueden eliminar tickets'}), 403
    db = get_db()
    db.execute("SELECT negocio_id FROM tickets WHERE id = %s", (ticket_id,))
    row = db.fetchone()
    if not row:
        return jsonify({'error': 'Ticket no encontrado'}), 404
    error, status = _check_permiso(row['negocio_id'], current_user)
    if error:
        return jsonify(error), status
    try:
        db.execute("DELETE FROM tickets WHERE id = %s", (ticket_id,))
        g.db_conn.commit()
        return jsonify({'message': 'Ticket eliminado'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 3. COMENTARIOS
# ═══════════════════════════════════════════════════════════════════════════════

@bp.route('/tickets/<int:ticket_id>/comentarios', methods=['GET'])
@token_required
def get_comentarios(current_user, ticket_id):
    db = get_db()
    db.execute("SELECT negocio_id FROM tickets WHERE id = %s", (ticket_id,))
    row = db.fetchone()
    if not row:
        return jsonify({'error': 'Ticket no encontrado'}), 404
    error, status = _check_permiso(row['negocio_id'], current_user)
    if error:
        return jsonify(error), status
    try:
        db.execute(
            """
            SELECT tc.id, tc.comentario, tc.tipo, tc.fecha_creacion, u.nombre AS usuario_nombre, u.rol AS usuario_rol
            FROM ticket_comentarios tc
            JOIN usuarios u ON tc.usuario_id = u.id
            WHERE tc.ticket_id = %s
            ORDER BY tc.fecha_creacion ASC
            """,
            (ticket_id,)
        )
        return jsonify([dict(row) for row in db.fetchall()])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/tickets/<int:ticket_id>/comentarios', methods=['POST'])
@token_required
def add_comentario(current_user, ticket_id):
    db = get_db()
    db.execute("SELECT negocio_id FROM tickets WHERE id = %s", (ticket_id,))
    row = db.fetchone()
    if not row:
        return jsonify({'error': 'Ticket no encontrado'}), 404
    error, status = _check_permiso(row['negocio_id'], current_user)
    if error:
        return jsonify(error), status

    data = request.get_json()
    texto = data.get('comentario', '').strip() if data else ''
    if not texto:
        return jsonify({'error': 'El comentario no puede estar vacío'}), 400

    try:
        db.execute(
            "INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, tipo) VALUES (%s, %s, %s, 'comentario')",
            (ticket_id, current_user['id'], texto)
        )
        db.execute(
            "UPDATE tickets SET fecha_actualizacion = %s WHERE id = %s",
            (datetime.datetime.now(datetime.timezone.utc), ticket_id)
        )
        g.db_conn.commit()
        return jsonify({'message': 'Comentario agregado'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CONFIGURACIÓN DE ALERTAS (EMAILS)
# ═══════════════════════════════════════════════════════════════════════════════

@bp.route('/negocios/<int:negocio_id>/tickets/alertas-config', methods=['GET'])
@token_required
def get_alertas_config(current_user, negocio_id):
    error, status = _check_permiso(negocio_id, current_user)
    if error:
        return jsonify(error), status
    db = get_db()
    db.execute("SELECT id, email, activo FROM ticket_alertas_config WHERE negocio_id = %s ORDER BY id", (negocio_id,))
    return jsonify([dict(row) for row in db.fetchall()])


@bp.route('/negocios/<int:negocio_id>/tickets/alertas-config', methods=['POST'])
@token_required
def update_alertas_config(current_user, negocio_id):
    if current_user['rol'] not in ('admin', 'superadmin'):
        return jsonify({'error': 'Solo administradores pueden configurar alertas'}), 403
    error, status = _check_permiso(negocio_id, current_user)
    if error:
        return jsonify(error), status

    data = request.get_json()
    accion = data.get('accion')  # 'agregar' | 'eliminar' | 'toggle'
    email = (data.get('email') or '').strip().lower()
    config_id = data.get('id')

    db = get_db()
    try:
        if accion == 'agregar' and email:
            db.execute(
                "INSERT INTO ticket_alertas_config (negocio_id, email) VALUES (%s, %s) ON CONFLICT (negocio_id, email) DO NOTHING",
                (negocio_id, email)
            )
        elif accion == 'eliminar' and config_id:
            db.execute("DELETE FROM ticket_alertas_config WHERE id = %s AND negocio_id = %s", (config_id, negocio_id))
        elif accion == 'toggle' and config_id:
            db.execute(
                "UPDATE ticket_alertas_config SET activo = NOT activo WHERE id = %s AND negocio_id = %s",
                (config_id, negocio_id)
            )
        g.db_conn.commit()
        return jsonify({'message': 'Configuración actualizada'}), 200
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 5. ESTADÍSTICAS / KPIs
# ═══════════════════════════════════════════════════════════════════════════════

@bp.route('/negocios/<int:negocio_id>/tickets/stats', methods=['GET'])
@token_required
def get_stats(current_user, negocio_id):
    error, status = _check_permiso(negocio_id, current_user)
    if error:
        return jsonify(error), status
    db = get_db()
    try:
        db.execute("""
            SELECT
                COUNT(*) FILTER (WHERE estado NOT IN ('resuelto','cerrado'))                AS abiertos,
                COUNT(*) FILTER (WHERE estado = 'en_progreso')                              AS en_progreso,
                COUNT(*) FILTER (WHERE sla_vencido = TRUE AND estado NOT IN ('resuelto','cerrado')) AS vencidos,
                COUNT(*) FILTER (WHERE estado IN ('resuelto','cerrado'))                    AS resueltos,
                COUNT(*) FILTER (WHERE prioridad = 'urgente' AND estado NOT IN ('resuelto','cerrado')) AS urgentes
            FROM tickets WHERE negocio_id = %s
        """, (negocio_id,))
        stats = db.fetchone()
        return jsonify(dict(stats))
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
# 6. JOB SLA — función llamada por el scheduler en __init__.py
# ═══════════════════════════════════════════════════════════════════════════════

def job_chequeo_sla(app):
    """Marca tickets vencidos y envía alertas. Llamado cada 30 min."""
    with app.app_context():
        try:
            db = get_db()
            ahora = datetime.datetime.now(datetime.timezone.utc)

            # Buscar tickets con SLA vencido que aún no estén marcados
            db.execute(
                """
                SELECT t.id, t.titulo, t.prioridad, t.negocio_id
                FROM tickets t
                WHERE t.fecha_limite IS NOT NULL
                  AND t.fecha_limite < %s
                  AND t.sla_vencido = FALSE
                  AND t.estado NOT IN ('resuelto', 'cerrado')
                """,
                (ahora,)
            )
            vencidos = db.fetchall()

            for t in vencidos:
                db.execute("UPDATE tickets SET sla_vencido = TRUE WHERE id = %s", (t['id'],))
                db.execute(
                    "INSERT INTO ticket_comentarios (ticket_id, usuario_id, comentario, tipo) SELECT %s, usuario_creador_id, '⚠️ SLA VENCIDO: El tiempo límite ha expirado.', 'cambio_estado' FROM tickets WHERE id = %s",
                    (t['id'], t['id'])
                )
                _enviar_email_ticket(
                    t['negocio_id'],
                    f"[ALERTA SLA] Ticket #{t['id']} vencido: {t['titulo']}",
                    f"El siguiente ticket ha superado su tiempo límite de SLA:\n\n"
                    f"ID: #{t['id']}\n"
                    f"Título: {t['titulo']}\n"
                    f"Prioridad: {t['prioridad'].upper()}\n\n"
                    f"Por favor, atender a la brevedad."
                )

            if vencidos:
                g.db_conn.commit()
                app.logger.info(f"[Tickets SLA] {len(vencidos)} ticket(s) marcados como vencidos.")
        except Exception as e:
            app.logger.error(f"[Tickets SLA] Error en job_chequeo_sla: {e}")
