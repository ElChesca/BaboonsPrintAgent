"""
crm_meta_routes.py
==================
Blueprint del módulo CRM Meta para el ERP Multinegocio Baboons.
Centraliza mensajes de WhatsApp, Facebook e Instagram vía API de Meta.

IMPORTANTE: Los contactos/leads se almacenan en la tabla existente `crm_leads`.
            El historial de mensajes se almacena en `crm_mensajes` (tabla nueva).

Mapeo de columnas crm_leads ↔ CRM Meta:
    - crm_leads.id             → lead_id (FK en crm_mensajes)
    - crm_leads.telefono       → número de destino para WhatsApp
    - crm_leads.wa_id          → ID interno de WhatsApp (del payload)
    - crm_leads.nombre         → nombre del contacto
    - crm_leads.plataforma_origen → whatsapp | instagram | facebook
    - crm_leads.origen         → fuente adicional (conservado para el CRM existente)
    - crm_leads.estado         → etiqueta de progresión del lead
    - crm_leads.notas          → notas del operador
    - crm_leads.fecha_creacion → cuando se creó el registro (timestamp)
    - crm_leads.ultima_actividad → timestamp de última actualización
    - crm_leads.activo         → TRUE si está activo

Endpoints:
  - GET  /api/webhooks/meta                              → Verificación pública del Webhook
  - POST /api/webhooks/meta                              → Recepción de mensajes de Meta
  - GET  /api/negocios/<id>/crm/contactos               → Lista de leads/contactos
  - GET  /api/negocios/<id>/crm/chat/<lead_id>          → Historial de chat
  - POST /api/negocios/<id>/crm/enviar                  → Enviar mensaje desde el ERP
  - GET  /api/negocios/<id>/crm/meta-config             → Ver configuración Meta
  - POST /api/negocios/<id>/crm/meta-config             → Guardar configuración Meta
"""

import json
import logging
import traceback
import requests
import re

def _sanitizar_numero(numero):
    """Elimina caracteres no numéricos y normaliza el 549 de Argentina para Meta Sandbox."""
    if not numero: return ""
    num = re.sub(r'\D', '', str(numero))
    # Si es Argentina (54) y tiene el prefijo de celular (9), se lo sacamos para el Sandbox
    if num.startswith('549') and len(num) == 13:
        num = '54' + num[3:]
    return num

from flask import Blueprint, request, jsonify, g
from app.database import get_db
from app.auth_decorator import token_required

logger = logging.getLogger(__name__)

bp = Blueprint('crm_meta', __name__)

META_API_VERSION = 'v25.0'
META_GRAPH_URL   = f'https://graph.facebook.com/{META_API_VERSION}'


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS INTERNOS
# ─────────────────────────────────────────────────────────────────────────────

def _get_meta_config_by_phone(db, phone_number_id):
    """Retorna la config Meta asociada a un phone_number_id, o None si no existe."""
    db.execute(
        "SELECT * FROM meta_configuraciones WHERE phone_number_id = %s AND activo = TRUE",
        (phone_number_id,)
    )
    return db.fetchone()


def _upsert_lead(db, negocio_id, wa_id, nombre, telefono, plataforma='whatsapp'):
    """
    Inserta o actualiza un lead en crm_leads.
    - Si ya existe por (negocio_id, telefono, plataforma_origen) → actualiza wa_id y ultima_actividad.
    - Si es nuevo → lo inserta.
    Retorna el lead_id.
    Usa NULLIF(TRIM(...), '') para sanitizar strings vacíos.
    """
    db.execute("""
        INSERT INTO crm_leads
            (negocio_id, wa_id, nombre, telefono, plataforma_origen,
             origen, estado, activo, fecha_creacion, ultima_actividad, actualizado_en)
        VALUES
            (%s, %s, NULLIF(TRIM(%s), ''), NULLIF(TRIM(%s), ''), %s,
             'meta_webhook', 'nuevo', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (negocio_id, telefono, plataforma_origen)
        DO UPDATE SET
            wa_id            = EXCLUDED.wa_id,
            nombre           = COALESCE(NULLIF(TRIM(EXCLUDED.nombre), ''), crm_leads.nombre),
            ultima_actividad = CURRENT_TIMESTAMP,
            actualizado_en   = CURRENT_TIMESTAMP,
            activo           = TRUE
        RETURNING id
    """, (negocio_id, wa_id, nombre or '', telefono or '', plataforma))
    row = db.fetchone()
    return row['id'] if row else None


def _enviar_mensaje_meta(access_token, phone_number_id, to_number, texto, template_name=None, template_lang='es'):
    """
    Envía un mensaje a WhatsApp vía Meta Graph API v25.0.
    - Si template_name es None → texto libre (solo válido dentro de ventana de 24hs).
    - Si template_name es str  → mensaje de template (puede iniciar conversaciones).
    Retorna (ok: bool, detalle: dict).
    """
    url = f'{META_GRAPH_URL}/{phone_number_id}/messages'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type':  'application/json',
    }

    if template_name:
        payload = {
            'messaging_product': 'whatsapp',
            'to':                to_number,
            'type':              'template',
            'template': {
                'name':     template_name,
                'language': {'code': template_lang},
            },
        }
    else:
        payload = {
            'messaging_product': 'whatsapp',
            'recipient_type':    'individual',
            'to':                to_number,
            'type':              'text',
            'text':              {'preview_url': False, 'body': texto},
        }

    try:
        print(f"[CRM DEBUG] URL: {url} | Payload: {json.dumps(payload)}", flush=True)
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        data = resp.json()
        if not resp.ok:
            logger.warning('[CRM Meta] Meta API %s: %s | PAYLOAD ENVIADO: %s', resp.status_code, data, json.dumps(payload))
        return resp.ok, data
    except requests.RequestException as exc:
        logger.error('[CRM Meta] Error llamando a Meta Graph API:\n%s', traceback.format_exc())
        return False, {'error': str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# WEBHOOK META — ENDPOINTS PÚBLICOS (sin @token_required)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/webhooks/meta', methods=['GET'])
def webhook_meta_verify():
    """
    Verificación del Webhook por parte de Meta.
    Meta envía: hub.mode, hub.challenge y hub.verify_token.
    Retornamos el hub.challenge como texto plano si el verify_token coincide.
    Este endpoint es PÚBLICO por requerimiento de Meta.
    """
    mode       = request.args.get('hub.mode')
    challenge  = request.args.get('hub.challenge')
    token_recv = request.args.get('hub.verify_token')

    if not (mode and challenge and token_recv):
        return 'Parámetros insuficientes', 400

    if mode != 'subscribe':
        return 'Modo no soportado', 400

    db = get_db()
    try:
        db.execute(
            "SELECT id FROM meta_configuraciones WHERE verify_token = %s AND activo = TRUE",
            (token_recv,)
        )
        config = db.fetchone()
        if config:
            logger.info('[CRM Meta] Webhook verificado correctamente para config_id=%s', config['id'])
            return challenge, 200
        else:
            logger.warning('[CRM Meta] Verificación fallida: verify_token no encontrado')
            return 'Token inválido', 403
    except Exception as exc:
        logger.error('[CRM Meta] Error en verificación de webhook:\n%s', traceback.format_exc())
        return 'Error interno', 500


@bp.route('/webhooks/meta', methods=['POST'])
def webhook_meta_receive():
    """
    Recepción de mensajes entrantes desde Meta (WhatsApp/Instagram/Facebook).
    Meta espera SIEMPRE una respuesta 200 OK para no reintentar el envío.
    Los contactos se guardan/actualizan en crm_leads.
    """
    try:
        data = request.get_json(silent=True) or {}
        logger.debug('[CRM Meta] Payload recibido: %s', json.dumps(data))

        object_type = data.get('object', '')
        entries     = data.get('entry', [])

        if object_type not in ('whatsapp_business_account', 'instagram', 'page'):
            return jsonify({'status': 'ignored'}), 200

        db = get_db()

        for entry in entries:
            for change in entry.get('changes', []):
                value           = change.get('value', {})
                messages        = value.get('messages', [])
                metadata        = value.get('metadata', {})
                phone_number_id = metadata.get('phone_number_id', '')
                contacts_meta   = value.get('contacts', [])

                if not messages:
                    continue

                # Resolver negocio_id desde phone_number_id
                config = _get_meta_config_by_phone(db, phone_number_id)
                if not config:
                    logger.warning('[CRM Meta] phone_number_id=%s no tiene config activa', phone_number_id)
                    continue

                negocio_id = config['negocio_id']

                # Mapa nombre de contacto (viene en 'contacts' del payload de Meta)
                nombre_map = {}
                for c in contacts_meta:
                    wa_id = c.get('wa_id', '')
                    nombre_map[wa_id] = c.get('profile', {}).get('name', '')

                for msg in messages:
                    msg_type  = msg.get('type', 'text')
                    wa_id     = msg.get('from', '')
                    meta_id   = msg.get('id', '')
                    nombre    = nombre_map.get(wa_id, '')

                    # Extraer texto según tipo de mensaje
                    if msg_type == 'text':
                        texto = msg.get('text', {}).get('body', '')
                    elif msg_type == 'image':
                        texto = '[Imagen adjunta]'
                    elif msg_type == 'audio':
                        texto = '[Audio adjunto]'
                    elif msg_type == 'document':
                        texto = '[Documento adjunto]'
                    elif msg_type == 'video':
                        texto = '[Video adjunto]'
                    elif msg_type == 'sticker':
                        texto = '[Sticker]'
                    else:
                        texto = f'[Mensaje tipo: {msg_type}]'

                    telefono = wa_id  # En WhatsApp el wa_id es el número E.164

                    # Upsert del lead en crm_leads
                    lead_id = _upsert_lead(
                        db, negocio_id, wa_id, nombre, telefono, 'whatsapp'
                    )
                    if not lead_id:
                        logger.error('[CRM Meta] No se pudo obtener lead_id para wa_id=%s', wa_id)
                        continue

                    # Verificar duplicado por meta_msg_id (idempotencia ante reintentos)
                    if meta_id:
                        db.execute(
                            "SELECT id FROM crm_mensajes WHERE meta_msg_id = %s",
                            (meta_id,)
                        )
                        if db.fetchone():
                            logger.debug('[CRM Meta] Mensaje duplicado ignorado: %s', meta_id)
                            continue

                    # Insertar mensaje en crm_mensajes
                    db.execute("""
                        INSERT INTO crm_mensajes
                            (lead_id, mensaje, tipo_emisor, meta_msg_id)
                        VALUES
                            (%s, NULLIF(TRIM(%s), ''), 'cliente', NULLIF(TRIM(%s), ''))
                    """, (lead_id, texto, meta_id))

        g.db_conn.commit()
        return jsonify({'status': 'ok'}), 200

    except Exception as exc:
        logger.error('[CRM Meta] Error procesando webhook:\n%s', traceback.format_exc())
        try:
            g.db_conn.rollback()
        except Exception:
            pass
        # Siempre 200 para que Meta no reintente
        return jsonify({'status': 'error_interno'}), 200


# ─────────────────────────────────────────────────────────────────────────────
# ENDPOINTS PRIVADOS (requieren JWT)
# ─────────────────────────────────────────────────────────────────────────────

@bp.route('/negocios/<int:negocio_id>/crm/contactos', methods=['GET'])
@token_required
def get_crm_contactos(current_user, negocio_id):
    """
    Lista de leads/contactos del negocio con último mensaje y conteo de no leídos.
    Ordenados por ultima_actividad DESC (más reciente primero).
    """
    db = get_db()
    try:
        plataforma = request.args.get('plataforma', '')
        filtro_sql = "AND l.plataforma_origen = %s" if plataforma else ""
        params     = [negocio_id]
        if plataforma:
            params.append(plataforma)

        db.execute(f"""
            SELECT
                l.id,
                l.nombre,
                l.telefono,
                l.email,
                l.plataforma_origen,
                l.estado,
                l.etiqueta,
                l.wa_id,
                l.activo,
                l.fecha_creacion  creado_en,
                l.ultima_actividad actualizado_en,
                (
                    SELECT m.mensaje
                    FROM   crm_mensajes m
                    WHERE  m.lead_id = l.id
                    ORDER  BY m.fecha DESC
                    LIMIT  1
                ) ultimo_mensaje,
                (
                    SELECT COUNT(*)
                    FROM   crm_mensajes m
                    WHERE  m.lead_id = l.id AND m.leido = FALSE AND m.tipo_emisor = 'cliente'
                ) no_leidos
            FROM  crm_leads l
            WHERE l.negocio_id = %s
                AND l.activo = TRUE
                AND l.fecha_baja IS NULL
                {filtro_sql}
            ORDER BY l.ultima_actividad DESC NULLS LAST
        """, params)
        rows = db.fetchall()
        return jsonify([dict(r) for r in rows])
    except Exception as exc:
        logger.error('[CRM Meta] get_crm_contactos:\n%s', traceback.format_exc())
        return jsonify({'error': str(exc)}), 500


@bp.route('/negocios/<int:negocio_id>/crm/chat/<int:lead_id>', methods=['GET'])
@token_required
def get_crm_chat(current_user, negocio_id, lead_id):
    """
    Historial de mensajes de una conversación.
    Marca los mensajes del cliente como leídos.
    """
    db = get_db()
    try:
        # Verificar que el lead pertenece al negocio
        db.execute(
            "SELECT id FROM crm_leads WHERE id = %s AND negocio_id = %s",
            (lead_id, negocio_id)
        )
        if not db.fetchone():
            return jsonify({'error': 'Lead no encontrado en este negocio'}), 404

        # Traer mensajes ordenados por fecha ASC (cronológico)
        db.execute("""
            SELECT id, mensaje, tipo_emisor, media_url, media_tipo, leido, fecha
            FROM   crm_mensajes
            WHERE  lead_id = %s
            ORDER  BY fecha ASC
        """, (lead_id,))
        mensajes = [dict(m) for m in db.fetchall()]

        # Marcar mensajes del cliente como leídos
        db.execute("""
            UPDATE crm_mensajes
            SET    leido = TRUE
            WHERE  lead_id = %s AND tipo_emisor = 'cliente' AND leido = FALSE
        """, (lead_id,))

        # Actualizar ultima_actividad del lead
        db.execute("""
            UPDATE crm_leads
            SET    ultima_actividad = CURRENT_TIMESTAMP,
                   actualizado_en   = CURRENT_TIMESTAMP
            WHERE  id = %s
        """, (lead_id,))

        g.db_conn.commit()
        return jsonify(mensajes)
    except Exception as exc:
        g.db_conn.rollback()
        logger.error('[CRM Meta] get_crm_chat:\n%s', traceback.format_exc())
        return jsonify({'error': str(exc)}), 500


@bp.route('/negocios/<int:negocio_id>/crm/enviar', methods=['POST'])
@token_required
def enviar_mensaje_crm(current_user, negocio_id):
    """
    Envía un mensaje de texto al lead desde el ERP vía API de Meta.
    Body JSON esperado: { lead_id: int, mensaje: str }
    También acepta contacto_id como alias de lead_id (retrocompatibilidad).
    """
    data     = request.get_json(silent=True) or {}
    lead_id  = data.get('lead_id') or data.get('contacto_id')
    mensaje  = (data.get('mensaje') or '').strip()
    template = data.get('template') # Opcional: nombre del template (ej: 'hello_world')

    if not lead_id or (not mensaje and not template):
        return jsonify({'error': 'lead_id y (mensaje o template) son requeridos'}), 400

    # ── FASE 1: Consultas a la DB ───────────────────────────────────────────
    lead   = None
    config = None
    try:
        db = get_db()
        db.execute("""
            SELECT l.id, l.telefono, l.wa_id, l.plataforma_origen
            FROM   crm_leads l
            WHERE  l.id = %s AND l.negocio_id = %s
        """, (lead_id, negocio_id))
        lead = db.fetchone()
        if not lead:
            return jsonify({'error': 'Lead no encontrado en este negocio'}), 404

        db.execute(
            "SELECT phone_number_id, access_token FROM meta_configuraciones WHERE negocio_id = %s AND activo = TRUE",
            (negocio_id,)
        )
        config = db.fetchone()
        if not config:
            return jsonify({'error': 'El negocio no tiene configuración Meta activa.'}), 400

    except Exception as exc:
        logger.error('[CRM Meta] enviar_mensaje_crm (DB read):\n%s', traceback.format_exc())
        if hasattr(g, 'db_conn') and g.db_conn:
            try: g.db_conn.rollback()
            except: pass
        return jsonify({'error': 'Error de base de datos: ' + str(exc)}), 500

    # Convertir a dict para que .get() funcione tanto en SQLite (Row) como en Postgres (DictCursor)
    lead_data = dict(lead)
    # Prioridad: telefono (manual) > wa_id (webhook)
    raw_to    = (lead_data.get('telefono') or lead_data.get('wa_id') or '').strip()
    to_number = _sanitizar_numero(raw_to)

    if not to_number:
        return jsonify({'error': 'El lead no tiene número válido'}), 400

    # ── FASE 2: Llamada HTTP a Meta ────────────────────────────────────────
    # Si viene template, lo usamos. Si no, texto libre.
    ok, detalle = _enviar_mensaje_meta(
        config['access_token'],
        config['phone_number_id'],
        to_number,
        mensaje,
        template_name=template,
        template_lang=data.get('language', 'en_US' if template == 'hello_world' else 'es')
    )

    if not ok:
        logger.warning('[CRM Meta] Meta rechazó el mensaje: %s', detalle)
        return jsonify({
            'error': detalle.get('error', {}).get('message', 'Error en Meta API'),
            'meta_detail': detalle,
            'payload_was': {
                'messaging_product': 'whatsapp',
                'to': to_number,
                'type': 'template' if template else 'text',
                'template': {
                    'name': template,
                    'language': { 'code': data.get('language', 'en_US' if template == 'hello_world' else 'es') }
                } if template else None
            }
        }), 400

    # ── FASE 3: Guardar en DB el mensaje ───────────────────────────────────
    try:
        db = get_db()
        meta_msg_id = None
        try:
            messages_list = detalle.get('messages', [])
            if messages_list: meta_msg_id = messages_list[0].get('id')
        except: pass

        # Si fue template, guardamos el nombre del template como mensaje
        msg_to_save = f"[Template: {template}]" if template else mensaje

        db.execute("""
            INSERT INTO crm_mensajes (lead_id, mensaje, tipo_emisor, meta_msg_id)
            VALUES (%s, %s, 'agente', %s)
        """, (lead_id, msg_to_save, meta_msg_id))

        db.execute("UPDATE crm_leads SET ultima_actividad = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP WHERE id = %s", (lead_id,))
        g.db_conn.commit()
    except Exception as exc:
        logger.error('[CRM Meta] enviar_mensaje_crm (DB write error):\n%s', traceback.format_exc())
        if hasattr(g, 'db_conn') and g.db_conn:
            try: g.db_conn.rollback()
            except: pass

    return jsonify({'success': True, 'meta_message_id': meta_msg_id if 'meta_msg_id' in locals() else None})


@bp.route('/negocios/<int:negocio_id>/crm/meta-config', methods=['GET'])
@token_required
def get_meta_config_negocio(current_user, negocio_id):
    """Obtiene la configuración Meta del negocio (sin exponer el access_token completo)."""
    db = get_db()
    try:
        # Traer la fila completa y formatear el token en Python (evita LEFT() que puede fallar)
        db.execute("""
            SELECT id, negocio_id, phone_number_id, waba_id, activo, creado_en, actualizado_en,
                   access_token, verify_token
            FROM   meta_configuraciones
            WHERE  negocio_id = %s
        """, (negocio_id,))
        config = db.fetchone()
        if not config:
            return jsonify(None), 200

        result = dict(config)
        # Ocultar token: mostrar solo los primeros 8 chars + '...'
        raw_token = result.pop('access_token', '') or ''
        result['access_token_preview'] = (raw_token[:8] + '...') if len(raw_token) >= 8 else '***'
        return jsonify(result)
    except Exception as exc:
        logger.error('[CRM Meta] get_meta_config_negocio error:\n%s', traceback.format_exc())
        return jsonify({'error': str(exc)}), 500


@bp.route('/negocios/<int:negocio_id>/crm/meta-config', methods=['POST'])
@token_required
def save_meta_config_negocio(current_user, negocio_id):
    """Guarda o actualiza las credenciales Meta del negocio."""
    data            = request.get_json() or {}
    phone_number_id = (data.get('phone_number_id') or '').strip()
    access_token    = (data.get('access_token') or '').strip()
    verify_token    = (data.get('verify_token') or '').strip()
    waba_id         = (data.get('waba_id') or '').strip()

    if not phone_number_id or not access_token or not verify_token:
        return jsonify({'error': 'phone_number_id, access_token y verify_token son requeridos'}), 400

    db = get_db()
    try:
        db.execute("""
            INSERT INTO meta_configuraciones
                (negocio_id, phone_number_id, access_token, verify_token, waba_id, activo, actualizado_en)
            VALUES
                (%s, NULLIF(TRIM(%s), ''), NULLIF(TRIM(%s), ''), NULLIF(TRIM(%s), ''), NULLIF(TRIM(%s), ''), TRUE, CURRENT_TIMESTAMP)
            ON CONFLICT (negocio_id)
            DO UPDATE SET
                phone_number_id = EXCLUDED.phone_number_id,
                access_token    = EXCLUDED.access_token,
                verify_token    = EXCLUDED.verify_token,
                waba_id         = EXCLUDED.waba_id,
                activo          = TRUE,
                actualizado_en  = CURRENT_TIMESTAMP
        """, (negocio_id, phone_number_id, access_token, verify_token, waba_id))
        g.db_conn.commit()
        return jsonify({'success': True, 'message': 'Configuración Meta guardada correctamente'})
    except Exception as exc:
        g.db_conn.rollback()
        logger.error('[CRM Meta] save_meta_config_negocio:\n%s', traceback.format_exc())
        return jsonify({'error': str(exc)}), 500
@bp.route('/negocios/<int:negocio_id>/crm/lead-historial/<int:lead_id>', methods=['GET'])
@token_required
def get_lead_historial_consolidado(current_user, negocio_id, lead_id):
    """
    Obtiene un resumen de la actividad comercial del lead (Reservas, Ventas y Presupuestos)
    basado en su número de teléfono.
    """
    db = get_db()
    try:
        # 1. Obtener el teléfono del lead
        db.execute("SELECT telefono FROM crm_leads WHERE id = %s AND negocio_id = %s", (lead_id, negocio_id))
        lead = db.fetchone()
        if not lead or not lead['telefono']:
            return jsonify({'reservas': [], 'ventas': [], 'presupuestos': []})

        telefono = lead['telefono']
        # Normalizar para búsqueda (útlimos 8 dígitos)
        tel_search = f"%{telefono[-8:]}%" if len(telefono) >= 8 else f"%{telefono}%"

        # 2. Buscar últimas 3 Reservas
        db.execute("""
            SELECT id, fecha_reserva, hora_reserva, estado, num_comensales
            FROM   mesas_reservas
            WHERE  negocio_id = %s AND (telefono LIKE %s OR nombre_cliente LIKE %s)
            ORDER  BY fecha_reserva DESC, hora_reserva DESC
            LIMIT  3
        """, (negocio_id, tel_search, tel_search))
        reservas = []
        for r in db.fetchall():
            res_dict = dict(r)
            # JSON no soporta objetos 'time' ni 'date' directamente
            if res_dict.get('fecha_reserva'): res_dict['fecha_reserva'] = str(res_dict['fecha_reserva'])
            if res_dict.get('hora_reserva'): res_dict['hora_reserva'] = str(res_dict['hora_reserva'])[:5]
            reservas.append(res_dict)

        # 3. Buscar últimas 3 Ventas
        db.execute("""
            SELECT v.id, v.fecha, v.total, v.metodo_pago
            FROM   ventas v
            JOIN   clientes c ON v.cliente_id = c.id
            WHERE  v.negocio_id = %s AND (c.telefono LIKE %s OR c.nombre LIKE %s)
            ORDER  BY v.fecha DESC
            LIMIT  3
        """, (negocio_id, tel_search, tel_search))
        ventas = [dict(v) for v in db.fetchall()]

        # 4. Buscar últimos 3 Presupuestos
        db.execute("""
            SELECT p.id, p.fecha, p.bonificacion, p.descuento_fijo, p.interes, p.tipo_comprobante
            FROM   presupuestos p
            LEFT JOIN clientes c ON p.cliente_id = c.id
            WHERE  p.negocio_id = %s AND (c.telefono LIKE %s OR c.nombre LIKE %s)
            ORDER  BY p.fecha DESC
            LIMIT  3
        """, (negocio_id, tel_search, tel_search))
        presupuestos_rows = db.fetchall()
        presupuestos = []
        for p in presupuestos_rows:
            # Calcular total aproximado (el query original de presupuestos hace esto dinámicamente)
            db.execute("SELECT SUM(subtotal) as st FROM presupuestos_detalle WHERE presupuesto_id = %s", (p['id'],))
            st_row = db.fetchone()
            subtotal = float(st_row['st'] or 0)
            total = (subtotal - float(p['descuento_fijo'] or 0)) * (1 - float(p['bonificacion'] or 0)/100) * (1 + float(p['interes'] or 0)/100)
            
            p_dict = dict(p)
            p_dict['total'] = total
            presupuestos.append(p_dict)

        return jsonify({
            'reservas': reservas,
            'ventas': ventas,
            'presupuestos': presupuestos
        })
    except Exception as exc:
        logger.error('[CRM Meta] get_lead_historial_consolidado error:\n%s', traceback.format_exc())
        return jsonify({'error': str(exc)}), 500
