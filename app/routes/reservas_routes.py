# app/routes/reservas_routes.py
# ✨ Módulo de Reservas de Mesas - Baboons Restó ✨

from flask import Blueprint, request, jsonify, g, current_app, render_template_string
import os
import datetime
import uuid
from app.database import get_db
from app.auth_decorator import token_required
from app.extensions import bcrypt

bp = Blueprint('reservas', __name__)

# ============================================================
# --- MIGRACIÓN AUTOMÁTICA (se ejecuta al primer request) ---
# ============================================================

def _migrate_reservas():
    """Crea las tablas necesarias si no existen."""
    db = get_db()
    try:
        # 1. Tabla de clientes invitados del portal
        db.execute("""
            CREATE TABLE IF NOT EXISTS reservas_clientes (
                id SERIAL PRIMARY KEY,
                negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
                nombre VARCHAR(100) NOT NULL,
                apellido VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL,
                celular VARCHAR(30),
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE (negocio_id, email)
            )
        """)

        # 2. Tabla de reservas
        db.execute("""
            CREATE TABLE IF NOT EXISTS mesas_reservas (
                id SERIAL PRIMARY KEY,
                negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
                reserva_cliente_id INT REFERENCES reservas_clientes(id) ON DELETE SET NULL,
                nombre_cliente VARCHAR(150),
                telefono VARCHAR(30),
                email VARCHAR(150),
                fecha_reserva DATE NOT NULL,
                hora_reserva TIME NOT NULL,
                num_comensales INT NOT NULL DEFAULT 2,
                mesa_id INT REFERENCES mesas(id) ON DELETE SET NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                origen VARCHAR(20) DEFAULT 'portal',
                notas TEXT,
                token_confirmacion VARCHAR(64) UNIQUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)

        # 3. MIGRACION: Nuevas columnas para reservas
        db.execute("ALTER TABLE mesas_reservas ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE")
        db.execute("ALTER TABLE mesas_reservas ADD COLUMN IF NOT EXISTS sector_preferido VARCHAR(50)")
        db.execute("ALTER TABLE reservas_clientes ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE")

        # 4. Tabla de configuración de turnos (mejorada para múltiples rangos)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_turnos_config (
                id SERIAL PRIMARY KEY,
                negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
                dia_semana INT NOT NULL,
                hora_inicio TIME NOT NULL DEFAULT '20:00',
                hora_fin TIME NOT NULL DEFAULT '23:30',
                intervalo_min INT NOT NULL DEFAULT 30,
                activo BOOLEAN DEFAULT TRUE
            )
        """)
        # Remover constraint vieja si existe
        db.execute("ALTER TABLE resto_turnos_config DROP CONSTRAINT IF EXISTS resto_turnos_config_negocio_id_dia_semana_key")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_resto_turns_unique ON resto_turnos_config (negocio_id, dia_semana, hora_inicio)")

        # 5. Tabla de configuración de reservas (WhatsApp template, aviso apertura, etc)
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_reservas_config (
                negocio_id INT PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
                wa_template TEXT,
                aviso_apertura_min INT DEFAULT 60,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        db.execute("ALTER TABLE resto_reservas_config ADD COLUMN IF NOT EXISTS aviso_apertura_min INT DEFAULT 60")

        # 6. MIGRACION: Columna de token de reserva en tabla negocios
        db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS reserva_token VARCHAR(100)")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_negocios_reserva_token ON negocios(reserva_token)")
        
        # Poblar tokens nulos
        db.execute("SELECT id FROM negocios WHERE reserva_token IS NULL")
        for row in db.fetchall():
            new_token = uuid.uuid4().hex[:12]
            db.execute("UPDATE negocios SET reserva_token = %s WHERE id = %s", (new_token, row['id']))

        g.db_conn.commit()
    except Exception as e:
        g.db_conn.rollback()
        current_app.logger.error(f"Error en migración de reservas: {e}")


# ============================================================
# --- HELPERS ---
# ============================================================

def _generar_slots(hora_inicio, hora_fin, intervalo_min):
    """Genera una lista de strings de horarios disponibles."""
    slots = []
    current = datetime.datetime.combine(datetime.date.today(), hora_inicio)
    end = datetime.datetime.combine(datetime.date.today(), hora_fin)
    while current < end:
        slots.append(current.strftime('%H:%M'))
        current += datetime.timedelta(minutes=intervalo_min)
    return slots

def _serialize_reserva(r):
    """Convierte un row de la BD en un diccionario serializable."""
    res = dict(r)
    if 'fecha_reserva' in r and r['fecha_reserva']:
        res['fecha_reserva'] = r['fecha_reserva'].isoformat()
    if 'hora_reserva' in r and r['hora_reserva']:
        res['hora_reserva'] = str(r['hora_reserva'])[:5]
    if 'fecha_nacimiento' in r and r['fecha_nacimiento']:
        res['fecha_nacimiento'] = r['fecha_nacimiento'].isoformat()
    if 'created_at' in r and r['created_at']:
        res['created_at'] = r['created_at'].isoformat()
    return res


def _ensure_default_turns(negocio_id):
    """Asegura que el negocio tenga turnos base configurados (Lunes a Domingo 20:00-23:30)."""
    db = get_db()
    try:
        db.execute("SELECT 1 FROM resto_turnos_config WHERE negocio_id = %s LIMIT 1", (negocio_id,))
        if not db.fetchone():
            # Crear turnos para todos los días de la semana
            for dia in range(7):
                db.execute("""
                    INSERT INTO resto_turnos_config (negocio_id, dia_semana, hora_inicio, hora_fin, intervalo_min, activo)
                    VALUES (%s, %s, '20:00', '23:30', 30, TRUE)
                """, (negocio_id, dia))
            g.db_conn.commit()
    except Exception as e:
        g.db_conn.rollback()
        current_app.logger.error(f"Error seeding default turns: {e}")


def _get_negocio_id_by_token(token):
    """Retorna el ID del negocio correspondiente a un token público."""
    if not token: return None
    db = get_db()
    db.execute("SELECT id FROM negocios WHERE reserva_token = %s", (token,))
    row = db.fetchone()
    return row['id'] if row else None


# ============================================================
# --- ENDPOINTS PÚBLICOS (Portal del cliente) ---
# ============================================================

@bp.route('/public/reservas/<int:negocio_id>/register', methods=['POST'])
def portal_register(negocio_id):
    """Registro de cuenta de invitado en el portal de reservas."""
    _migrate_reservas()
    data = request.get_json() or {}
    nombre = data.get('nombre', '').strip()
    apellido = data.get('apellido', '').strip()
    email = data.get('email', '').strip().lower()
    celular = data.get('celular', '').strip()
    password = data.get('password', '').strip()
    fecha_nac = data.get('fecha_nacimiento')

    if not nombre or not apellido or not email or not password:
        return jsonify({'error': 'Nombre, Apellido, Email y Contraseña son obligatorios'}), 400

    db = get_db()
    try:
        # Verificar si ya existe en este negocio
        db.execute("SELECT id FROM reservas_clientes WHERE negocio_id = %s AND email = %s", (negocio_id, email))
        if db.fetchone():
            return jsonify({'error': 'Ya existe una cuenta con este email. Por favor iniciá sesión.'}), 409

        pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')

        db.execute("""
            INSERT INTO reservas_clientes (negocio_id, nombre, apellido, email, celular, password_hash, fecha_nacimiento)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (negocio_id, nombre, apellido, email, celular, pw_hash, fecha_nac))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()

        # Generar token de sesión simple
        import jwt, time
        token = jwt.encode(
            {'id': nuevo_id, 'negocio_id': negocio_id, 'email': email, 'exp': time.time() + 86400 * 7},
            current_app.config['SECRET_KEY'], algorithm='HS256'
        )

        return jsonify({
            'message': '¡Cuenta creada exitosamente!',
            'token': token,
            'cliente': {'id': nuevo_id, 'nombre': nombre, 'apellido': apellido, 'email': email}
        }), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/public/reservas/<int:negocio_id>/disponibilidad', methods=['GET'])
def portal_disponibilidad_admin(negocio_id):
    """Versión para uso administrativo o interno por ID directo."""
    return _procesar_disponibilidad(negocio_id)

@bp.route('/public/reservas/disponibilidad', methods=['GET'])
def portal_disponibilidad_v2():
    """Versión que usa token público 't'."""
    token = request.args.get('t')
    negocio_id = _get_negocio_id_by_token(token)
    if not negocio_id:
        return jsonify({'error': 'Negocio no encontrado o link inválido'}), 404
    return _procesar_disponibilidad(negocio_id)

def _procesar_disponibilidad(negocio_id):
    try:
        _migrate_reservas()
        _ensure_default_turns(negocio_id)
        fecha_str = request.args.get('fecha')
        if not fecha_str:
            return jsonify({'error': 'Parámetro fecha requerido'}), 400

        try:
            fecha = datetime.date.fromisoformat(fecha_str)
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido'}), 400

        dia_semana = fecha.weekday()
        db = get_db()

        # Obtener TODOS los rangos configurados para ese día
        db.execute("""
            SELECT hora_inicio, hora_fin, intervalo_min
            FROM resto_turnos_config
            WHERE negocio_id = %s AND dia_semana = %s AND activo = TRUE
            ORDER BY hora_inicio ASC
        """, (negocio_id, dia_semana))
        configs = db.fetchall()

        all_slots_generated = []
        for config in configs:
            slots = _generar_slots(config['hora_inicio'], config['hora_fin'], config['intervalo_min'])
            all_slots_generated.extend(slots)
        
        all_slots_generated = sorted(list(set(all_slots_generated)))

        if not all_slots_generated:
            return jsonify({'slots': [], 'message': 'No hay turnos disponibles para este día'})

        db.execute("""
            SELECT hora_reserva::text, COUNT(*) as cantidad
            FROM mesas_reservas
            WHERE negocio_id = %s AND fecha_reserva = %s AND estado NOT IN ('cancelada')
            GROUP BY hora_reserva
        """, (negocio_id, fecha))
        reservas_existentes = {str(r['hora_reserva'])[:5]: r['cantidad'] for r in db.fetchall()}

        db.execute("SELECT COUNT(*) as total FROM mesas WHERE negocio_id = %s", (negocio_id,))
        row_m = db.fetchone()
        total_mesas = row_m['total'] if row_m else 5

        slots_disponibles = []
        for s in all_slots_generated:
            ocupadas = reservas_existentes.get(s, 0)
            slots_disponibles.append({
                'hora': s,
                'disponible': ocupadas < total_mesas,
                'ocupadas': ocupadas,
                'libres': max(0, total_mesas - ocupadas)
            })

        return jsonify({'slots': slots_disponibles, 'fecha': fecha_str})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/public/reservas/crear', methods=['POST'])
def portal_crear_reserva_v2():
    """Crea una reserva desde el portal público usando token 't'."""
    _migrate_reservas()
    data = request.get_json() or {}
    token_negocio = data.get('t')
    negocio_id = _get_negocio_id_by_token(token_negocio)
    
    if not negocio_id:
        return jsonify({'error': 'Negocio no identificado'}), 404

    db = get_db()
    try:
        nombre = data.get('nombre', '').strip()
        telefono = data.get('telefono', '').strip()
        email = data.get('email', '').strip()
        fecha_res = data.get('fecha')
        hora_res = data.get('hora')

        if not nombre or not fecha_res or not hora_res:
            return jsonify({'error': 'Nombre, fecha y hora son obligatorios'}), 400
        
        fecha = datetime.date.fromisoformat(fecha_res)
        hora = datetime.time.fromisoformat(hora_res)
        token_conf = uuid.uuid4().hex

        db.execute("""
            INSERT INTO mesas_reservas
            (negocio_id, nombre_cliente, telefono, email, fecha_reserva, hora_reserva, 
             num_comensales, notas, token_confirmacion, origen, estado, fecha_nacimiento, sector_preferido)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'portal', 'pendiente', %s, %s)
            RETURNING id
        """, (negocio_id, nombre, telefono, email, fecha, hora,
              data.get('num_comensales', 2), data.get('notas', ''), token_conf, 
              data.get('fecha_nacimiento'), data.get('sector_preferido')))
        
        rid = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'message': '¡Reserva recibida exitosamente!', 'id': rid}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================================
# --- ENDPOINTS ADMIN ---
# ============================================================

@bp.route('/negocios/<int:negocio_id>/reservas', methods=['GET'])
@token_required
def admin_list_reservas(current_user, negocio_id):
    _migrate_reservas()
    db = get_db()
    fecha = request.args.get('fecha', datetime.date.today().isoformat())
    estado = request.args.get('estado', 'all')
    
    query = """
        SELECT r.*, m.numero as mesa_numero, 
               rc.nombre as cliente_nombre_reg, rc.apellido as cliente_apellido
        FROM mesas_reservas r
        LEFT JOIN mesas m ON r.mesa_id = m.id
        LEFT JOIN reservas_clientes rc ON r.reserva_cliente_id = rc.id
        WHERE r.negocio_id = %s AND r.fecha_reserva = %s
    """
    params = [negocio_id, fecha]
    if estado != 'all':
        query += " AND r.estado = %s"
        params.append(estado)
    query += " ORDER BY r.hora_reserva ASC"
    
    db.execute(query, params)
    return jsonify([_serialize_reserva(r) for r in db.fetchall()])


@bp.route('/negocios/<int:negocio_id>/reservas', methods=['POST'])
@token_required
def admin_crear_reserva(current_user, negocio_id):
    _migrate_reservas()
    data = request.get_json() or {}
    db = get_db()
    try:
        token = uuid.uuid4().hex
        db.execute("""
            INSERT INTO mesas_reservas
            (negocio_id, nombre_cliente, telefono, email, fecha_reserva, hora_reserva, num_comensales, 
             mesa_id, notas, token_confirmacion, origen, estado, fecha_nacimiento, sector_preferido)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmada', %s, %s)
            RETURNING id
        """, (negocio_id, data.get('nombre_cliente'), data.get('telefono'), data.get('email'),
              data.get('fecha_reserva'), data.get('hora_reserva'), data.get('num_comensales'),
              data.get('mesa_id'), data.get('notas'), token, data.get('origen', 'manual'),
              data.get('fecha_nacimiento'), data.get('sector_preferido')))
        rid = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': rid, 'message': 'Reserva manual creada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/<int:reserva_id>', methods=['PATCH'])
@token_required
def admin_update_reserva(current_user, negocio_id, reserva_id):
    data = request.get_json() or {}
    db = get_db()
    try:
        fields = []
        values = []
        valid_fields = ['estado', 'mesa_id', 'notas', 'hora_reserva', 'num_comensales', 
                        'fecha_nacimiento', 'sector_preferido', 'telefono', 'nombre_cliente']
        for f in valid_fields:
            if f in data:
                fields.append(f"{f} = %s")
                values.append(data[f])
        
        if not fields: return jsonify({'error': 'Nada que actualizar'}), 400
        
        values.extend([negocio_id, reserva_id])
        db.execute(f"UPDATE mesas_reservas SET {', '.join(fields)} WHERE negocio_id = %s AND id = %s", values)
        g.db_conn.commit()
        return jsonify({'message': 'Reserva actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/<int:reserva_id>', methods=['DELETE'])
@token_required
def admin_cancelar_reserva(current_user, negocio_id, reserva_id):
    db = get_db()
    try:
        db.execute("UPDATE mesas_reservas SET estado = 'cancelada' WHERE negocio_id = %s AND id = %s", (negocio_id, reserva_id))
        g.db_conn.commit()
        return jsonify({'message': 'Cancelada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/pendientes-count', methods=['GET'])
@token_required
def admin_pendientes_count(current_user, negocio_id):
    db = get_db()
    try:
        db.execute("SELECT COUNT(*) as total FROM mesas_reservas WHERE negocio_id = %s AND estado = 'pendiente'", (negocio_id,))
        return jsonify({'pendientes': db.fetchone()['total']})
    except:
        return jsonify({'pendientes': 0})


# ============================================================
# --- CONFIGURACIÓN (Admin) ---
# ============================================================

@bp.route('/negocios/<int:negocio_id>/reservas/turnos', methods=['GET'])
@token_required
def admin_get_turnos(current_user, negocio_id):
    _migrate_reservas()
    db = get_db()
    db.execute("SELECT * FROM resto_turnos_config WHERE negocio_id = %s ORDER BY dia_semana, hora_inicio", (negocio_id,))
    rows = db.fetchall()
    
    # Agrupar por día de semana
    result = {}
    for r in rows:
        dia = r['dia_semana']
        if dia not in result: result[dia] = []
        result[dia].append({
            'id': r['id'],
            'hora_inicio': str(r['hora_inicio'])[:5],
            'hora_fin': str(r['hora_fin'])[:5],
            'intervalo_min': r['intervalo_min'],
            'activo': r['activo']
        })
    return jsonify(result)


@bp.route('/negocios/<int:negocio_id>/reservas/turnos', methods=['POST'])
@token_required
def admin_save_turnos(current_user, negocio_id):
    """Guarda configuración de turnos (reemplaza los del negocio)."""
    data = request.get_json() or []
    db = get_db()
    try:
        # Borrar configuración vieja
        db.execute("DELETE FROM resto_turnos_config WHERE negocio_id = %s", (negocio_id,))
        
        for t in data:
            db.execute("""
                INSERT INTO resto_turnos_config (negocio_id, dia_semana, hora_inicio, hora_fin, intervalo_min, activo)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (negocio_id, t['dia_semana'], t['hora_inicio'], t['hora_fin'], t.get('intervalo_min', 30), t.get('activo', True)))
        
        g.db_conn.commit()
        return jsonify({'message': 'Configuración de turnos guardada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/config', methods=['GET', 'POST'])
@token_required
def admin_reserva_config(current_user, negocio_id):
    _migrate_reservas()
    db = get_db()
    if request.method == 'GET':
        db.execute("""
            SELECT c.wa_template, c.aviso_apertura_min, n.reserva_token 
            FROM resto_reservas_config c
            JOIN negocios n ON c.negocio_id = n.id
            WHERE c.negocio_id = %s
        """, (negocio_id,))
        res = db.fetchone()
        if not res:
            # Si no hay config, al menos devolvemos el token del negocio
            db.execute("SELECT reserva_token FROM negocios WHERE id = %s", (negocio_id,))
            res = db.fetchone()
            return jsonify({
                'wa_template': None, 
                'aviso_apertura_min': 60, 
                'reserva_token': res['reserva_token'] if res else None
            })
            
        return jsonify({
            'wa_template': res['wa_template'], 
            'aviso_apertura_min': res['aviso_apertura_min'], 
            'reserva_token': res['reserva_token']
        })
    
    data = request.get_json() or {}
    wa_template = data.get('wa_template')
    aviso_min = data.get('aviso_apertura_min', 60)
    try:
        db.execute("""
            INSERT INTO resto_reservas_config (negocio_id, wa_template, aviso_apertura_min)
            VALUES (%s, %s, %s)
            ON CONFLICT (negocio_id) DO UPDATE 
            SET wa_template = EXCLUDED.wa_template, 
                aviso_apertura_min = EXCLUDED.aviso_apertura_min,
                updated_at = NOW()
        """, (negocio_id, wa_template, aviso_min))
        g.db_conn.commit()
        return jsonify({'message': 'Configuración guardada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
