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

        # 3. Tabla de configuración de turnos
        db.execute("""
            CREATE TABLE IF NOT EXISTS resto_turnos_config (
                id SERIAL PRIMARY KEY,
                negocio_id INT NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
                dia_semana INT NOT NULL,
                hora_inicio TIME NOT NULL DEFAULT '20:00',
                hora_fin TIME NOT NULL DEFAULT '23:30',
                intervalo_min INT NOT NULL DEFAULT 30,
                activo BOOLEAN DEFAULT TRUE,
                UNIQUE (negocio_id, dia_semana)
            )
        """)

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
    if r.get('fecha_reserva'):
        res['fecha_reserva'] = r['fecha_reserva'].isoformat()
    if r.get('hora_reserva'):
        res['hora_reserva'] = str(r['hora_reserva'])[:5]
    if r.get('created_at'):
        res['created_at'] = r['created_at'].isoformat()
    return res


def _ensure_default_turns(negocio_id):
    """Asegura que el negocio tenga turnos base configurados (Lunes a Domingo 20:00-23:30)."""
    db = get_db()
    try:
        db.execute("SELECT 1 FROM resto_turnos_config WHERE negocio_id = %s", (negocio_id,))
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

def _serialize_reserva(r):
    """Convierte una fila de reserva a dict serializable."""
    d = dict(r)
    if d.get('fecha_reserva'):
        d['fecha_reserva'] = d['fecha_reserva'].isoformat()
    if d.get('hora_reserva'):
        d['hora_reserva'] = str(d['hora_reserva'])[:5]
    if d.get('created_at'):
        d['created_at'] = d['created_at'].isoformat()
    return d


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

    if not nombre or not apellido or not email or not password:
        return jsonify({'error': 'Nombre, Apellido, Email y Contraseña son obligatorios'}), 400

    db = get_db()
    try:
        # Verificar si ya existe en este negocio
        db.execute("SELECT id FROM reservas_clientes WHERE negocio_id = %s AND email = %s", (negocio_id, email))
        if db.fetchone():
            return jsonify({'error': 'Ya existe una cuenta con este email. Por favor iniciá sesión.'}), 409

        # Verificar que el negocio existe y es tipo resto
        db.execute("SELECT id, nombre FROM negocios WHERE id = %s AND tipo_app = 'resto'", (negocio_id,))
        negocio = db.fetchone()
        if not negocio:
            return jsonify({'error': 'Negocio no encontrado'}), 404

        pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')

        db.execute("""
            INSERT INTO reservas_clientes (negocio_id, nombre, apellido, email, celular, password_hash)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (negocio_id, nombre, apellido, email, celular, pw_hash))
        nuevo_id = db.fetchone()['id']
        g.db_conn.commit()

        # Generar token de sesión simple (JWT no necesario para invitados)
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
        current_app.logger.error(f"Error registro reserva invitado: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/public/reservas/<int:negocio_id>/login', methods=['POST'])
def portal_login(negocio_id):
    """Login de cuenta invitado en el portal de reservas."""
    _migrate_reservas()
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({'error': 'Email y contraseña requeridos'}), 400

    db = get_db()
    db.execute("SELECT * FROM reservas_clientes WHERE negocio_id = %s AND email = %s", (negocio_id, email))
    cliente = db.fetchone()

    if not cliente or not bcrypt.check_password_hash(cliente['password_hash'], password):
        return jsonify({'error': 'Email o contraseña incorrectos'}), 401

    import jwt, time
    token = jwt.encode(
        {'id': cliente['id'], 'negocio_id': negocio_id, 'email': email, 'exp': time.time() + 86400 * 7},
        current_app.config['SECRET_KEY'], algorithm='HS256'
    )
    return jsonify({
        'token': token,
        'cliente': {'id': cliente['id'], 'nombre': cliente['nombre'], 'apellido': cliente['apellido'], 'email': email}
    })


@bp.route('/public/reservas/<int:negocio_id>/disponibilidad', methods=['GET'])
def portal_disponibilidad(negocio_id):
    """Devuelve los slots disponibles para una fecha dada."""
    try:
        _migrate_reservas()
        _ensure_default_turns(negocio_id)
        fecha_str = request.args.get('fecha')
        if not fecha_str:
            return jsonify({'error': 'Parámetro fecha requerido (YYYY-MM-DD)'}), 400

        try:
            fecha = datetime.date.fromisoformat(fecha_str)
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido'}), 400

        dia_semana = fecha.weekday()  # 0=Lun, 6=Dom

        db = get_db()

        # Obtener configuración de turnos
        db.execute("""
            SELECT hora_inicio, hora_fin, intervalo_min
            FROM resto_turnos_config
            WHERE negocio_id = %s AND dia_semana = %s AND activo = TRUE
        """, (negocio_id, dia_semana))
        config = db.fetchone()

        if not config:
            return jsonify({'slots': [], 'message': 'No hay turnos disponibles para este día'})

        all_slots = _generar_slots(config['hora_inicio'], config['hora_fin'], config['intervalo_min'])

        # Obtener reservas ya existentes en esa fecha
        db.execute("""
            SELECT hora_reserva::text, COUNT(*) as cantidad
            FROM mesas_reservas
            WHERE negocio_id = %s AND fecha_reserva = %s AND estado NOT IN ('cancelada')
            GROUP BY hora_reserva
        """, (negocio_id, fecha))
        reservas_existentes = {str(r['hora_reserva'])[:5]: r['cantidad'] for r in db.fetchall()}

        # Obtener cantidad de mesas disponibles
        db.execute("SELECT COUNT(*) as total FROM mesas WHERE negocio_id = %s", (negocio_id,))
        total_mesas_row = db.fetchone()
        total_mesas = total_mesas_row['total'] if total_mesas_row else 5  # default

        slots_disponibles = []
        for slot in all_slots:
            ocupadas = reservas_existentes.get(slot, 0)
            disponible = ocupadas < total_mesas
            slots_disponibles.append({
                'hora': slot,
                'disponible': disponible,
                'ocupadas': ocupadas,
                'libres': max(0, total_mesas - ocupadas)
            })

        return jsonify({'slots': slots_disponibles, 'fecha': fecha_str})
    except Exception as e:
        current_app.logger.error(f"Error en portal_disponibilidad: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/public/reservas/<int:negocio_id>', methods=['POST'])
def portal_crear_reserva(negocio_id):
    """Crea una reserva desde el portal público (requiere token de invitado)."""
    _migrate_reservas()
    auth = request.headers.get('Authorization', '')
    token_str = auth.replace('Bearer ', '')

    cliente_id = None
    nombre_cliente = None
    email_cliente = None

    if token_str:
        try:
            import jwt
            payload = jwt.decode(token_str, current_app.config['SECRET_KEY'], algorithms=['HS256'])
            cliente_id = payload.get('id')
            email_cliente = payload.get('email')
            db_temp = get_db()
            db_temp.execute("SELECT nombre, apellido, email, celular FROM reservas_clientes WHERE id = %s", (cliente_id,))
            c = db_temp.fetchone()
            if c:
                nombre_cliente = f"{c['nombre']} {c['apellido']}"
                email_cliente = c['email']
        except Exception:
            return jsonify({'error': 'Sesión inválida o expirada. Por favor ingresá nuevamente.'}), 401
    else:
        return jsonify({'error': 'Debes iniciar sesión para hacer una reserva'}), 401

    data = request.get_json() or {}
    fecha_str = data.get('fecha')
    hora_str = data.get('hora')
    num_comensales = int(data.get('num_comensales', 2))
    notas = data.get('notas', '')

    if not fecha_str or not hora_str:
        return jsonify({'error': 'Fecha y hora son obligatorias'}), 400

    try:
        fecha = datetime.date.fromisoformat(fecha_str)
        hora = datetime.time.fromisoformat(hora_str)
    except ValueError:
        return jsonify({'error': 'Formato de fecha u hora inválido'}), 400

    token_reserva = uuid.uuid4().hex

    db = get_db()
    try:
        db.execute("""
            INSERT INTO mesas_reservas
            (negocio_id, reserva_cliente_id, nombre_cliente, email, fecha_reserva, hora_reserva, num_comensales, notas, token_confirmacion, origen, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'portal', 'pendiente')
            RETURNING id
        """, (negocio_id, cliente_id, nombre_cliente, email_cliente, fecha, hora, num_comensales, notas, token_reserva))

        nueva_id = db.fetchone()['id']
        g.db_conn.commit()

        return jsonify({
            'message': '¡Reserva solicitada con éxito! El local se comunicará para confirmarla.',
            'reserva_id': nueva_id,
            'token': token_reserva,
            'fecha': fecha_str,
            'hora': hora_str,
            'num_comensales': num_comensales
        }), 201
    except Exception as e:
        g.db_conn.rollback()
        current_app.logger.error(f"Error creando reserva: {e}")
        return jsonify({'error': str(e)}), 500


@bp.route('/public/reservas/mis-reservas', methods=['GET'])
def portal_mis_reservas():
    """Devuelve las reservas del cliente logueado en el portal."""
    auth = request.headers.get('Authorization', '')
    token_str = auth.replace('Bearer ', '')
    if not token_str:
        return jsonify({'error': 'No autorizado'}), 401
    try:
        import jwt
        payload = jwt.decode(token_str, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        cliente_id = payload.get('id')
    except Exception:
        return jsonify({'error': 'Sesión inválida'}), 401

    db = get_db()
    db.execute("""
        SELECT r.*, m.numero as mesa_numero
        FROM mesas_reservas r
        LEFT JOIN mesas m ON r.mesa_id = m.id
        WHERE r.reserva_cliente_id = %s
        ORDER BY r.fecha_reserva DESC, r.hora_reserva DESC
        LIMIT 20
    """, (cliente_id,))
    reservas = [_serialize_reserva(r) for r in db.fetchall()]
    return jsonify(reservas)


# ============================================================
# --- ENDPOINTS ADMIN (Token ERP requerido) ---
# ============================================================

@bp.route('/negocios/<int:negocio_id>/reservas', methods=['GET'])
@token_required
def admin_list_reservas(current_user, negocio_id):
    """Lista de reservas con filtros de fecha y estado."""
    _migrate_reservas()
    _ensure_default_turns(negocio_id)
    db = get_db()
    fecha = request.args.get('fecha', datetime.date.today().isoformat())
    estado = request.args.get('estado', 'all')

    query = """
        SELECT r.*, m.numero as mesa_numero,
               rc.nombre as cliente_nombre_reg, rc.apellido as cliente_apellido, rc.celular as cliente_celular_reg
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
    reservas = [_serialize_reserva(r) for r in db.fetchall()]
    return jsonify(reservas)


@bp.route('/negocios/<int:negocio_id>/reservas', methods=['POST'])
@token_required
def admin_crear_reserva(current_user, negocio_id):
    """Crea una reserva manual (teléfono, WhatsApp, presencial)."""
    _migrate_reservas()
    data = request.get_json() or {}
    nombre_cliente = data.get('nombre_cliente', '').strip()
    telefono = data.get('telefono', '').strip()
    email = data.get('email', '').strip()
    fecha_str = data.get('fecha_reserva')
    hora_str = data.get('hora_reserva')
    num_comensales = int(data.get('num_comensales', 2))
    notas = data.get('notas', '')
    origen = data.get('origen', 'manual')
    mesa_id = data.get('mesa_id')

    if not nombre_cliente or not fecha_str or not hora_str:
        return jsonify({'error': 'Nombre, fecha y hora son obligatorios'}), 400

    try:
        fecha = datetime.date.fromisoformat(fecha_str)
        hora = datetime.time.fromisoformat(hora_str)
    except ValueError:
        return jsonify({'error': 'Formato de fecha u hora inválido'}), 400

    token_reserva = uuid.uuid4().hex
    db = get_db()
    try:
        db.execute("""
            INSERT INTO mesas_reservas
            (negocio_id, nombre_cliente, telefono, email, fecha_reserva, hora_reserva,
             num_comensales, mesa_id, notas, token_confirmacion, origen, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmada')
            RETURNING id
        """, (negocio_id, nombre_cliente, telefono, email, fecha, hora, num_comensales,
              mesa_id or None, notas, token_reserva, origen))
        nueva_id = db.fetchone()['id']
        g.db_conn.commit()
        return jsonify({'id': nueva_id, 'token': token_reserva, 'message': 'Reserva creada'}), 201
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/<int:reserva_id>', methods=['PATCH'])
@token_required
def admin_update_reserva(current_user, negocio_id, reserva_id):
    """Actualiza estado, asigna mesa, agrega notas a una reserva."""
    data = request.get_json() or {}
    db = get_db()
    try:
        fields = []
        values = []
        for field in ['estado', 'mesa_id', 'notas', 'hora_reserva', 'num_comensales']:
            if field in data:
                fields.append(f"{field} = %s")
                values.append(data[field])

        if not fields:
            return jsonify({'error': 'No hay campos para actualizar'}), 400

        values.extend([negocio_id, reserva_id])
        db.execute(f"""
            UPDATE mesas_reservas SET {', '.join(fields)}
            WHERE negocio_id = %s AND id = %s
        """, values)
        g.db_conn.commit()
        return jsonify({'message': 'Reserva actualizada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/<int:reserva_id>', methods=['DELETE'])
@token_required
def admin_cancelar_reserva(current_user, negocio_id, reserva_id):
    """Cancela (marca como cancelada) una reserva."""
    db = get_db()
    try:
        db.execute("""
            UPDATE mesas_reservas SET estado = 'cancelada'
            WHERE negocio_id = %s AND id = %s
        """, (negocio_id, reserva_id))
        g.db_conn.commit()
        return jsonify({'message': 'Reserva cancelada'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/negocios/<int:negocio_id>/reservas/pendientes-count', methods=['GET'])
@token_required
def admin_pendientes_count(current_user, negocio_id):
    """Devuelve la cantidad de reservas pendientes del día para el badge."""
    db = get_db()
    try:
        _migrate_reservas()
        hoy = datetime.date.today()
        db.execute("""
            SELECT COUNT(*) as total
            FROM mesas_reservas
            WHERE negocio_id = %s AND fecha_reserva = %s AND estado = 'pendiente'
        """, (negocio_id, hoy))
        row = db.fetchone()
        return jsonify({'pendientes': row['total'] if row else 0})
    except Exception:
        return jsonify({'pendientes': 0})


# ============================================================
# --- CONFIGURACIÓN DE TURNOS (Admin) ---
# ============================================================

@bp.route('/negocios/<int:negocio_id>/reservas/turnos', methods=['GET'])
@token_required
def admin_get_turnos(current_user, negocio_id):
    """Obtiene la configuración de turnos del negocio."""
    _migrate_reservas()
    db = get_db()
    db.execute("SELECT * FROM resto_turnos_config WHERE negocio_id = %s ORDER BY dia_semana", (negocio_id,))
    rows = db.fetchall()
    result = {}
    for r in rows:
        result[r['dia_semana']] = {
            'id': r['id'],
            'hora_inicio': str(r['hora_inicio'])[:5],
            'hora_fin': str(r['hora_fin'])[:5],
            'intervalo_min': r['intervalo_min'],
            'activo': r['activo']
        }
    return jsonify(result)


@bp.route('/negocios/<int:negocio_id>/reservas/turnos', methods=['POST'])
@token_required
def admin_save_turnos(current_user, negocio_id):
    """Guarda la configuración de turnos (upsert por día de semana)."""
    data = request.get_json() or []
    db = get_db()
    try:
        for turno in data:
            dia = turno.get('dia_semana')
            db.execute("""
                INSERT INTO resto_turnos_config (negocio_id, dia_semana, hora_inicio, hora_fin, intervalo_min, activo)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (negocio_id, dia_semana)
                DO UPDATE SET hora_inicio = EXCLUDED.hora_inicio, hora_fin = EXCLUDED.hora_fin,
                              intervalo_min = EXCLUDED.intervalo_min, activo = EXCLUDED.activo
            """, (negocio_id, dia, turno.get('hora_inicio', '20:00'), turno.get('hora_fin', '23:30'),
                  turno.get('intervalo_min', 30), turno.get('activo', True)))
        g.db_conn.commit()
        return jsonify({'message': 'Turnos guardados correctamente'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500
