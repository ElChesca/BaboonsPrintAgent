import sys
import os
import uuid
import jwt
import datetime
import traceback
from flask import Blueprint, request, jsonify, g, current_app
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from app.database import get_db
from app import bcrypt
from app.auth_decorator import token_required
from app import mail # Importas la instancia de mail
from flask_mail import Message
import json
import time
from flask import Response, stream_with_context

bp = Blueprint('club_puntos', __name__)
# Lista para mantener las "colas" de mensajes de los clientes conectados
notificadores = []


def ejecutar_notificacion_cliente(db, negocio_id, cliente_id, nuevos_puntos, mensaje_texto):
    """Calcula niveles y envía el mensaje al stream del cliente"""
    try:
        # 1. Nivel Actual
        db.execute("""
            SELECT nombre FROM niveles_club 
            WHERE negocio_id = %s AND puntos_minimos <= %s
            ORDER BY puntos_minimos DESC LIMIT 1
        """, (negocio_id, nuevos_puntos))
        res_actual = db.fetchone()
        nivel_nombre = res_actual['nombre'] if res_actual else "Miembro"
        
        # 2. Nivel Siguiente y Cálculo de lo que falta
        db.execute("""
            SELECT nombre, puntos_minimos FROM niveles_club 
            WHERE negocio_id = %s AND puntos_minimos > %s
            ORDER BY puntos_minimos ASC LIMIT 1
        """, (negocio_id, nuevos_puntos))
        res_sig = db.fetchone()

        puntos_faltantes = 0
        proximo_nivel = None
        if res_sig:
            puntos_faltantes = res_sig['puntos_minimos'] - nuevos_puntos
            proximo_nivel = res_sig['nombre']

        # 3. Construir JSON y enviar a la cola (notificadores es la lista global)
        payload = json.dumps({
            'puntos': nuevos_puntos,
            'mensaje': mensaje_texto,
            'nivel_nombre': nivel_nombre,
            'falta_para_subir': puntos_faltantes,
            'proximo_nivel': proximo_nivel
        })

        for cid, q in notificadores:
            if cid == cliente_id:
                q.put(payload)
                
    except Exception as e:
        print(f"⚠️ Error en sistema de notificación: {e}")

@bp.route('/admin/notificacion-general', methods=['POST'])
@token_required
def enviar_notificacion_general(current_user):
    """
    Envía un mensaje a TODOS los clientes conectados actualmente.
    """
    data = request.get_json()
    titulo = data.get('titulo', '¡Aviso del Club!')
    mensaje = data.get('mensaje')
    negocio_id = data.get('negocio_id')

    if not mensaje or not negocio_id:
        return jsonify({'error': 'Faltan datos'}), 400

    # Construimos el paquete de datos
    payload = json.dumps({
        'tipo': 'broadcast', # Identificador para que el JS sepa que no es carga de puntos
        'titulo': titulo,
        'mensaje': mensaje
    })

    # Contador para saber a cuántos les llegó
    enviados = 0

    # Recorremos todas las colas activas
    for cid, q in notificadores:
        # Aquí podrías filtrar si quieres que sea solo para un negocio_id específico
        # pero por ahora, vamos a enviarlo a todos los activos
        try:
            q.put(payload)
            enviados += 1
        except:
            continue

    return jsonify({
        'status': 'success',
        'mensaje': f'Notificación enviada a {enviados} clientes conectados.'
    }), 200

@bp.route('/stream')
@token_required
def stream_puntos(current_user):
    """
    Mantiene una conexión abierta con el cliente para enviarle 
    actualizaciones de puntos en tiempo real.
    """
    def event_stream():
        import queue
        q = queue.Queue()
        # Registramos al usuario (asociando su ID para enviarle solo lo suyo)
        notificadores.append((current_user['id'], q))
        
        try:
            while True:
                # Espera un mensaje de la cola
                mensaje = q.get()
                yield f"data: {mensaje}\n\n"
        except GeneratorExit:
            # Si el cliente cierra la app o pierde conexión, lo removemos
            for item in notificadores:
                if item[1] == q:
                    notificadores.remove(item)
                    break

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


# --- X. GESTIÓN DE NIVELES (Admin) ---
@bp.route('/admin/niveles', methods=['GET', 'POST', 'DELETE'])
@token_required
def gestion_niveles(current_user):
    db = get_db()
    
    # 1. ELIMINAR NIVEL
    if request.method == 'DELETE':
        nivel_id = request.args.get('id')
        try:
            db.execute("DELETE FROM niveles_club WHERE id = %s", (nivel_id,))
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Nivel eliminado'}), 200
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # 2. CREAR / ACTUALIZAR (POST)
    if request.method == 'POST':
        data = request.get_json()
        try:
            # Validamos campos obligatorios
            if not all(k in data for k in ('negocio_id', 'nombre', 'puntos_minimos')):
                return jsonify({'error': 'Faltan datos'}), 400
                
            if 'id' in data and data['id']:
                # Update
                db.execute("""
                    UPDATE niveles_club SET nombre=%s, puntos_minimos=%s, color=%s, icono=%s 
                    WHERE id=%s
                """, (data['nombre'], data['puntos_minimos'], data.get('color'), data.get('icono'), data['id']))
            else:
                # Insert
                db.execute("""
                    INSERT INTO niveles_club (negocio_id, nombre, puntos_minimos, color, icono)
                    VALUES (%s, %s, %s, %s, %s)
                """, (data['negocio_id'], data['nombre'], data['puntos_minimos'], data.get('color'), data.get('icono')))
            
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Guardado'}), 200
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # 3. LISTAR (GET)
    negocio_id = request.args.get('negocio_id')
    db.execute("SELECT * FROM niveles_club WHERE negocio_id = %s ORDER BY puntos_minimos ASC", (negocio_id,))
    return jsonify([dict(r) for r in db.fetchall()]), 200


def calcular_nivel_cliente(db, negocio_id, puntos_actuales):
    """Calcula el nivel actual, el siguiente y el progreso necesario."""
    # 1. Nivel Actual
    db.execute("""
        SELECT nombre, color, icono, puntos_minimos 
        FROM niveles_club 
        WHERE negocio_id = %s AND puntos_minimos <= %s
        ORDER BY puntos_minimos DESC LIMIT 1
    """, (negocio_id, puntos_actuales))
    actual = db.fetchone() or {'nombre': 'Miembro', 'color': '#6c757d', 'icono': 'fa-user', 'puntos_minimos': 0}

    # 2. Próximo Nivel
    db.execute("""
        SELECT nombre, puntos_minimos 
        FROM niveles_club 
        WHERE negocio_id = %s AND puntos_minimos > %s
        ORDER BY puntos_minimos ASC LIMIT 1
    """, (negocio_id, puntos_actuales))
    siguiente = db.fetchone()

    puntos_faltantes = 0
    if siguiente:
        puntos_faltantes = siguiente['puntos_minimos'] - puntos_actuales

    return {
        'nombre': actual['nombre'],
        'color': actual['color'],
        'icono': actual['icono'],
        'puntos_faltantes': puntos_faltantes,
        'proximo_nivel': siguiente['nombre'] if siguiente else None
    }
        
# =========================================================
# 🛠️ CORRECCIÓN DE TABLAS: "usuarios_club" -> "clientes"
# =========================================================
@bp.route('/perfil', methods=['GET'])
@token_required
def obtener_mi_perfil_club(current_user):
    db = get_db()
    try:
        # Buscamos los datos del cliente Y SUMAMOS su historial en la misma consulta
        db.execute("""
            SELECT 
                c.id, c.nombre, c.email, c.dni, c.token_qr, c.negocio_id,
                (SELECT COALESCE(SUM(monto), 0) FROM historial_cargas WHERE cliente_id = c.id) as puntos_reales
            FROM clientes c
            WHERE c.id = %s
        """, (current_user['id'],))
        
        usuario = db.fetchone()
        
        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        # El total real es la suma de todos sus movimientos
        total_puntos = usuario['puntos_reales']

        # Calculamos nivel con los puntos reales
        nivel_data = calcular_nivel_cliente(db, usuario['negocio_id'], total_puntos)

        return jsonify({
            'nombre': usuario['nombre'],
            'email': usuario['email'],
            'puntos_acumulados': total_puntos, # <--- Enviamos la suma real
            'token_qr': usuario['token_qr'],
            'nivel': nivel_data
        }), 200

    except Exception as e:
        print(f"🔥 Error perfil: {e}")
        return jsonify({'error': 'Error al cargar perfil'}), 500
    
# --- TERMINAL: INFO CLIENTE (SCAN QR) ---
@bp.route('/admin/cliente-info/<token_qr>', methods=['GET'])
@token_required
def info_cliente_por_qr(current_user, token_qr):
    # 1. Validación de Negocio ID
    negocio_id = request.args.get('negocio_id')
    # Si viene undefined o vacío, tratamos de sobrevivir o fallamos ordenadamente
    if not negocio_id or negocio_id == 'undefined':
        return jsonify({'error': 'Falta ID de negocio'}), 400

    db = get_db()
    
    try:
        # 2. Búsqueda de Usuario (QR o DNI) EN LA TABLA CORRECTA 'clientes'
        usuario = None
        
        # Intento A: QR
        db.execute("SELECT * FROM clientes WHERE token_qr = %s AND negocio_id = %s", (token_qr, negocio_id))
        usuario = db.fetchone()

        # Intento B: DNI (Fallback)
        if not usuario:
            db.execute("SELECT * FROM clientes WHERE dni = %s AND negocio_id = %s", (token_qr, negocio_id))
            usuario = db.fetchone()

        if usuario:
            # 3. Cálculo de Nivel
            puntos = usuario['puntos_acumulados'] or 0
            nivel_data = calcular_nivel_cliente(db, negocio_id, puntos)
            
            return jsonify({
                'encontrado': True,
                'nombre': usuario['nombre'],
                'dni': usuario['dni'],
                'puntos': puntos,
                'token_qr': usuario['token_qr'],
                'nivel': nivel_data 
            }), 200
        else:
            return jsonify({'encontrado': False}), 200

    except Exception as e:
        print(f"🔥 Error recuperando cliente: {e}")
        return jsonify({'error': str(e)}), 500
# =========================================================
# 👮 ÁREA ADMINISTRATIVA (Mozo / Dueño / Cajero)
# =========================================================

# --- 1. OBTENER INFO DEL CLIENTE (Al escanear QR) ---
@bp.route('/admin/cliente-info/<token_qr>', methods=['GET'])
@token_required
def obtener_info_cliente(current_user, token_qr):
    """
    Endpoint ligero para mostrar nombre y saldo apenas se escanea el QR.
    """
    negocio_id = request.args.get('negocio_id')
    
    if not negocio_id:
        return jsonify({'error': 'Falta negocio_id'}), 400

    db = get_db() # 'db' ya es un cursor inteligente (RealDictCursor)
    
    try:
        # Buscamos cliente por su Token QR
        db.execute("""
            SELECT nombre, puntos_acumulados, dni
            FROM clientes
            WHERE token_qr = %s AND negocio_id = %s
        """, (token_qr, negocio_id))
        
        cliente = db.fetchone()
        
        if cliente:
            return jsonify({
                'encontrado': True,
                'nombre': cliente['nombre'],
                'puntos': cliente['puntos_acumulados'] or 0,
                'dni': cliente['dni']
            }), 200
        else:
            return jsonify({'encontrado': False, 'mensaje': 'Cliente no encontrado en este negocio'}), 404
            
    except Exception as e:
        print(f"Error info cliente: {e}")
        return jsonify({'error': 'Error interno'}), 500


# --- 2. CARGAR PUNTOS (Acción principal del Mozo) ---
@bp.route('/admin/cargar-puntos', methods=['POST'])
@token_required
def cargar_puntos(current_user):
    data = request.get_json()
    token_qr = data.get('cliente_identificador')
    cantidad = data.get('cantidad')
    negocio_id = data.get('negocio_id')
    motivo = data.get('motivo', 'Carga Manual')

    if not token_qr or not cantidad or not negocio_id:
        return jsonify({'error': 'Faltan datos'}), 400

    db = get_db()

    try:
        # 1. Buscar cliente
        db.execute("SELECT id, nombre, puntos_acumulados FROM clientes WHERE (token_qr = %s OR dni = %s) AND negocio_id = %s", (token_qr, token_qr, negocio_id))
        cliente = db.fetchone()
        
        if not cliente: 
            return jsonify({'error': 'Cliente no encontrado'}), 404
        
        try:
            puntos_sumar = int(cantidad)
        except ValueError:
            return jsonify({'error': 'La cantidad debe ser un número'}), 400

        # 2. Calcular nuevo saldo
        nuevo_saldo = (cliente['puntos_acumulados'] or 0) + puntos_sumar

        # 3. ACTUALIZAR SALDO EN DB
        db.execute("""
            UPDATE clientes 
            SET puntos_acumulados = %s 
            WHERE id = %s
        """, (nuevo_saldo, cliente['id']))
        
        # 4. GUARDAR HISTORIAL
        admin_id = current_user.get('id') if isinstance(current_user, dict) else None
        
        db.execute("""
            INSERT INTO historial_cargas (negocio_id, cliente_id, monto, motivo, fecha, usuario_id)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
        """, (negocio_id, cliente['id'], puntos_sumar, motivo, admin_id))

        # 5. LÓGICA DE REFERIDOS (Solo si es la primera carga real)
        db.execute("SELECT COUNT(*) as cant FROM historial_cargas WHERE cliente_id = %s", (cliente['id'],))
        # Si la cuenta es 1, significa que acabamos de insertar la primera carga
        if db.fetchone()['cant'] == 1:
            db.execute("SELECT referido_por_dni FROM clientes WHERE id = %s", (cliente['id'],))
            ref_dni = db.fetchone().get('referido_por_dni')
            
            if ref_dni:
                # Pago al referente
                db.execute("""
                    UPDATE clientes SET puntos_acumulados = puntos_acumulados + 200 
                    WHERE dni = %s AND negocio_id = %s
                """, (ref_dni, negocio_id))
                # Historial del referente
                db.execute("""
                    INSERT INTO historial_cargas (negocio_id, cliente_id, monto, motivo, fecha)
                    VALUES (%s, (SELECT id FROM clientes WHERE dni=%s AND negocio_id=%s), 200, 'Premio Reclutamiento', CURRENT_TIMESTAMP)
                """, (negocio_id, ref_dni, negocio_id))

        # 6. COMMIT
        if hasattr(g, 'db_conn'): g.db_conn.commit()

        # 7. NOTIFICACIÓN EN TIEMPO REAL AL CELULAR ✅
        ejecutar_notificacion_cliente(db, negocio_id, cliente['id'], nuevo_saldo, f"¡Sumaste {puntos_sumar} puntos!")

        # 8. RESPUESTA AL ADMIN
        return jsonify({
            'mensaje': 'Carga exitosa', 
            'cliente': cliente['nombre'], 
            'nuevo_saldo': nuevo_saldo
        }), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"🔥 Error Carga Puntos: {e}")
        return jsonify({'error': f"Error interno: {str(e)}"}), 500
    
# --- 3. NUEVO ENDPOINT: HISTORIAL DE CARGAS (Para el Admin) ---
@bp.route('/admin/historial-cargas', methods=['GET'])
@token_required
def obtener_historial_cargas(current_user):
    negocio_id = request.args.get('negocio_id')
    db = get_db()
    
    try:
        db.execute("""
            SELECT 
                hc.id, 
                to_char(hc.fecha, 'DD/MM/YYYY HH24:MI') as fecha_fmt,
                c.nombre as cliente_nombre,
                hc.monto,
                hc.motivo
            FROM historial_cargas hc
            JOIN clientes c ON hc.cliente_id = c.id
            WHERE hc.negocio_id = %s
            ORDER BY hc.fecha DESC LIMIT 50
        """, (negocio_id,))
        
        historial = db.fetchall()
        # Como es RealDictCursor, ya es una lista de dicts. 
        # Hacemos conversión explícita por seguridad.
        return jsonify([dict(row) for row in historial]), 200
        
    except Exception as e:
        print(f"Error Historial Cargas: {e}")
        return jsonify({'error': str(e)}), 500


# --- 4. NUEVO ENDPOINT: MI HISTORIAL (Para la App del Cliente) ---
@bp.route('/mi-historial', methods=['GET'])
@token_required
def mi_historial_cliente(current_user):
    cliente_id = current_user['id']
    db = get_db()
    
    try:
        # Traemos TODO: Cargas (Suma) y Canjes (Resta)
        query = """
          SELECT 'carga' as tipo, monto as puntos, motivo as detalle, to_char(fecha, 'DD/MM/YYYY HH24:MI') as fecha 
            FROM historial_cargas WHERE cliente_id = %s
            UNION ALL
            SELECT 'canje' as tipo, puntos_gastados as puntos, p.nombre as detalle, to_char(c.fecha, 'DD/MM/YYYY HH24:MI') as fecha
            FROM canjes c 
            JOIN premios p ON c.premio_id = p.id 
            WHERE c.cliente_dni = (SELECT dni FROM clientes WHERE id = %s)
            ORDER BY fecha DESC LIMIT 20
        """
        db.execute(query, (cliente_id, cliente_id))
        
        return jsonify([dict(row) for row in db.fetchall()]), 200
    except Exception as e:
        print(e)
        return jsonify({'error': str(e)}), 500


# --- 5. CONFIGURACIÓN DEL CLUB ---
@bp.route('/admin/config', methods=['GET', 'POST'])
@token_required
def gestion_config_club(current_user):
    db = get_db()
    
    # GUARDAR (POST)
    if request.method == 'POST':
        data = request.get_json()
        try:
            negocio_id = data.get('negocio_id')
            monto = data.get('monto_pesos')
            puntos = data.get('puntos_otorgados')
            
            # Upsert
            db.execute("""
                INSERT INTO configuracion_club (negocio_id, monto_pesos, puntos_otorgados, activo)
                VALUES (%s, %s, %s, TRUE)
                ON CONFLICT (negocio_id) 
                DO UPDATE SET monto_pesos = EXCLUDED.monto_pesos, 
                              puntos_otorgados = EXCLUDED.puntos_otorgados
            """, (negocio_id, monto, puntos))
            
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Regla actualizada'}), 200
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # LEER (GET)
    negocio_id = request.args.get('negocio_id')
    if not negocio_id:
        return jsonify({'monto_pesos': 1000, 'puntos_otorgados': 1}), 200

    db.execute("SELECT * FROM configuracion_club WHERE negocio_id = %s", (negocio_id,))
    config = db.fetchone()
    
    if not config:
        return jsonify({'monto_pesos': 1000, 'puntos_otorgados': 1}), 200
    return jsonify(dict(config)), 200


# --- 6. GESTIÓN DE PREMIOS (Admin) ---
@bp.route('/admin/premios', methods=['GET', 'POST', 'DELETE'])
@token_required 
def gestion_premios(current_user):
    db = get_db()

    # BORRAR
    if request.method == 'DELETE':
        premio_id = request.args.get('id')
        try:
            db.execute("DELETE FROM premios WHERE id = %s", (premio_id,))
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Eliminado'}), 200
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500
    
    # LEER (GET)
    if request.method == 'GET':
        negocio_id = request.args.get('negocio_id')
        if not negocio_id: return jsonify([]), 200
        
        db.execute("SELECT * FROM premios WHERE negocio_id = %s AND activo = TRUE ORDER BY id DESC", (negocio_id,))
        premios = db.fetchall()
        return jsonify([dict(p) for p in premios]), 200

    # CREAR / EDITAR (POST)
    if request.method == 'POST':
        try:
            form = request.form
            files = request.files
            negocio_id = form.get('negocio_id')
            premio_id = form.get('id')
            nombre = form.get('nombre')
            descripcion = form.get('descripcion', '')
            
            try: costo = int(form.get('costo_puntos', 0))
            except: costo = 0
            
            try: stock = int(form.get('stock', 0))
            except: stock = 0

            # Manejo de Imagen
            imagen_filename = None
            if 'imagen' in files:
                file = files['imagen']
                if file and file.filename != '':
                    filename = secure_filename(f"{negocio_id}_{file.filename}")
                    upload_folder = os.path.join(current_app.static_folder, 'img', 'premios')
                    os.makedirs(upload_folder, exist_ok=True)
                    file.save(os.path.join(upload_folder, filename))
                    imagen_filename = filename

            # INSERT o UPDATE
            if premio_id: 
                # EDITAR
                if imagen_filename:
                    sql = "UPDATE premios SET nombre=%s, descripcion=%s, costo_puntos=%s, stock=%s, imagen_url=%s WHERE id=%s"
                    params = (nombre, descripcion, costo, stock, imagen_filename, premio_id)
                else:
                    sql = "UPDATE premios SET nombre=%s, descripcion=%s, costo_puntos=%s, stock=%s WHERE id=%s"
                    params = (nombre, descripcion, costo, stock, premio_id)
                db.execute(sql, params)
                msg = "Actualizado"
            else:
                # CREAR
                final_img = imagen_filename if imagen_filename else ''
                sql = "INSERT INTO premios (negocio_id, nombre, descripcion, costo_puntos, stock, imagen_url, activo) VALUES (%s, %s, %s, %s, %s, %s, TRUE)"
                params = (negocio_id, nombre, descripcion, costo, stock, final_img)
                db.execute(sql, params)
                msg = "Creado"

            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': msg}), 201

        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            print(f"!!! ERROR PREMIOS: {e}", file=sys.stderr)
            return jsonify({'error': str(e)}), 500


# --- 7. CANJEAR PREMIO ---
@bp.route('/admin/canjear', methods=['POST'])
@token_required
def canjear_premio(current_user):
    db = get_db()
    data = request.get_json()
    
    negocio_id = data.get('negocio_id')
    premio_id = data.get('premio_id')
    cliente_dni = data.get('cliente_dni')
    
    if not cliente_dni:
        return jsonify({'error': 'Falta el DNI'}), 400

    try:
        # 1. Buscar cliente
        db.execute("SELECT id, nombre, puntos_acumulados FROM clientes WHERE dni = %s AND negocio_id = %s", (cliente_dni, negocio_id))
        cliente = db.fetchone()
        
        if not cliente:
            return jsonify({'error': f'Cliente DNI {cliente_dni} no encontrado en este negocio.'}), 404

        # 2. Validar premio y stock
        db.execute("SELECT stock, costo_puntos, nombre FROM premios WHERE id = %s AND negocio_id = %s", (premio_id, negocio_id))
        premio = db.fetchone()
        
        if not premio:
            return jsonify({'error': 'Premio no encontrado'}), 404
            
        if premio['stock'] < 1:
            return jsonify({'error': '¡Sin stock disponible!'}), 400

        # Validación saldo suficiente
        if (cliente['puntos_acumulados'] or 0) < premio['costo_puntos']:
            return jsonify({'error': 'Puntos insuficientes'}), 400

        # 3. Procesar canje
        # Restar stock
        db.execute("UPDATE premios SET stock = stock - 1 WHERE id = %s", (premio_id,))
        # Restar puntos
        db.execute("UPDATE clientes SET puntos_acumulados = puntos_acumulados - %s WHERE id = %s", (premio['costo_puntos'], cliente['id']))

        # Guardar historial
        db.execute("""
            INSERT INTO canjes (negocio_id, cliente_dni, premio_id, puntos_gastados, fecha, usuario_id) 
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
        """, (negocio_id, cliente_dni, premio_id, premio['costo_puntos'], current_user['id']))
        
        if hasattr(g, 'db_conn'): g.db_conn.commit()
        return jsonify({'message': f'Entregado a {cliente["nombre"]}'}), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"ERROR CANJE: {e}") 
        return jsonify({'error': f"Fallo técnico: {str(e)}"}), 500


# --- 8. BUSCAR CLIENTE POR DNI (Para canje manual) ---
# app/routes/club_puntos_routes.py

# --- 8. BUSCAR CLIENTE POR DNI (Para canje manual) ---
@bp.route('/admin/cliente/<dni>', methods=['GET'])
@token_required
def buscar_cliente_club(current_user, dni):
    db = get_db()
    negocio_id = request.args.get('negocio_id') 

    try:
        db.execute("SELECT id, nombre, puntos_acumulados, dni FROM clientes WHERE dni = %s AND negocio_id = %s", (dni, negocio_id))
        row = db.fetchone()
        
        if not row:
            return jsonify({'error': 'Cliente no encontrado'}), 404
            
        # Limpiamos puntos
        puntos = row['puntos_acumulados'] if row['puntos_acumulados'] is not None else 0
        
        # 🔥 CALCULAMOS EL NIVEL 🔥
        nivel_data = calcular_nivel_cliente(db, negocio_id, puntos)
        
        cliente_data = {
            'id': row['id'],
            'nombre': row['nombre'],
            'puntos_acumulados': puntos,
            'dni': row['dni'],
            'nivel': nivel_data # <--- ¡Nuevo dato!
        }
        return jsonify(cliente_data), 200
        
    except Exception as e:
        print(f"ERROR BUSQUEDA: {e}")
        return jsonify({'error': f"Error técnico: {str(e)}"}), 500


# --- 9. HISTORIAL DE CANJES ---
@bp.route('/admin/historial', methods=['GET'])
@token_required
def obtener_historial_canjes(current_user):
    db = get_db()
    negocio_id = request.args.get('negocio_id')
    fecha_desde = request.args.get('desde')
    fecha_hasta = request.args.get('hasta')

    try:
        # Query corregida usando ::date
        query = """
            SELECT 
                c.id,
                to_char(c.fecha, 'DD/MM/YYYY HH24:MI') as fecha_fmt,
                cl.nombre as nombre_cliente,  
                c.cliente_dni,
                p.nombre as nombre_premio,
                c.puntos_gastados,
                u.nombre as nombre_usuario
            FROM canjes c
            LEFT JOIN clientes cl ON c.cliente_dni::varchar = cl.dni::varchar
            LEFT JOIN premios p ON c.premio_id = p.id
            LEFT JOIN usuarios u ON c.usuario_id = u.id 
            WHERE c.negocio_id = %s
        """
        params = [negocio_id]

        if fecha_desde:
            query += " AND date(c.fecha) >= %s::date"
            params.append(fecha_desde)
            
        if fecha_hasta:
            query += " AND date(c.fecha) <= %s::date"
            params.append(fecha_hasta)

        query += " ORDER BY c.fecha DESC LIMIT 100"

        db.execute(query, tuple(params))
        historial = db.fetchall()

        if not historial:
            return jsonify([]), 200

        resultado = []
        for h in historial:
            cliente_str = h.get('nombre_cliente') or f"DNI: {h['cliente_dni']}"
            operador_str = h.get('nombre_usuario') or 'Sistema'

            resultado.append({
                'id': h['id'],
                'fecha': h['fecha_fmt'],
                'cliente': cliente_str,
                'premio': h.get('nombre_premio') or '(Borrado)',
                'puntos': h['puntos_gastados'],
                'operador': operador_str
            })

        return jsonify(resultado), 200

    except Exception as e:
        print(f"ERROR HISTORIAL: {e}")
        return jsonify([]), 200


# =========================================================
# 📱 APP DEL CLIENTE (Pública / Usuario Final)
# =========================================================
# --- 10. REGISTRO DE USUARIO CON PREMIO DE BIENVENIDA ---
@bp.route('/register', methods=['POST'])
def register():
    db = get_db() 
    data = request.get_json()
    
    try:
        nombre = data.get('nombre')
        dni = data.get('dni')
        email = data.get('email')
        password = data.get('password')
        negocio_id = data.get('negocio_id')
        
        # Validación de campos obligatorios
        if not all([nombre, dni, email, password, negocio_id]):
            return jsonify({'error': 'Faltan datos obligatorios'}), 400

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        token_qr = str(uuid.uuid4())
      
        # INSERT: Iniciamos con 100 puntos de regalo
        db.execute("""
            INSERT INTO clientes (
                nombre, dni, email, password_hash, negocio_id,
                genero, fecha_nacimiento, acepta_terminos, token_qr, 
                referido_por_dni, app_registrado, puntos_acumulados,
                tipo_cliente, posicion_iva, condicion_venta
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, 100, 
                'Individuo', 'Consumidor Final', 'Contado')
            RETURNING id
        """, (nombre, dni, email, hashed_password, negocio_id, 
              data.get('genero'), data.get('fecha_nacimiento'), 
              data.get('acepta_terminos'), token_qr, data.get('ref')))

        nuevo_id = db.fetchone()['id']

        # Registramos el regalo en el Historial de Cargas para que el cliente lo vea
        db.execute("""
            INSERT INTO historial_cargas (negocio_id, cliente_id, monto, motivo, fecha)
            VALUES (%s, %s, 100, 'Regalo de Bienvenida App', CURRENT_TIMESTAMP)
        """, (negocio_id, nuevo_id))

        if hasattr(g, 'db_conn'): g.db_conn.commit()

        # ENVÍO DE EMAIL: Lo envolvemos para que si falla el correo, NO falle el registro
        try:
            msg = Message("¡Bienvenido a La Kosleña!", recipients=[email])
            msg.html = f"""
                <div style="font-family: Arial; border: 1px solid #ff7a21; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #ff7a21;">¡Felicidades {nombre}!</h2>
                    <p>Ya eres parte de nuestro club de beneficios.</p>
                    <p>Como regalo de bienvenida, te hemos acreditado <strong>100 puntos</strong> en tu cuenta.</p>
                    <p>Usa tu QR en el local para seguir sumando.</p>
                </div>
            """
            mail.send(msg)
        except Exception as e:
            print(f"⚠️ Error enviando mail: {e}") 

        return jsonify({
            'message': '¡Registro exitoso! Ganaste 100 puntos.', 
            'token_qr': token_qr
        }), 201

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        return jsonify({'error': f'Error técnico: {str(e)}'}), 500

# --- 11. LOGIN CLIENTE ---

@bp.route('/login', methods=['POST'])
def login_club():
    data = request.get_json()
    dni = data.get('dni')
    password = data.get('password')
    negocio_id = data.get('negocio_id')

    if not dni or not password:
        return jsonify({'error': 'Faltan datos'}), 400

    db = get_db()
    try:
        # SUMAMOS EL HISTORIAL DIRECTAMENTE EN EL LOGIN
        db.execute("""
            SELECT 
                c.id, c.nombre, c.token_qr, c.password_hash, c.dni,
                (SELECT COALESCE(SUM(monto), 0) FROM historial_cargas WHERE cliente_id = c.id) as puntos_reales
            FROM clientes c 
            WHERE c.dni = %s AND c.negocio_id = %s
        """, (dni, negocio_id))
        
        cliente = db.fetchone()

        if not cliente or not bcrypt.check_password_hash(cliente['password_hash'], password):
            return jsonify({'error': 'Credenciales inválidas'}), 401

        # Generar token de sesión
        token_payload = {
            'user_id': cliente['id'],
            'id': cliente['id'],
            'negocio_id': negocio_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }
        token = jwt.encode(token_payload, current_app.config['SECRET_KEY'], algorithm="HS256")

        # Calculamos el nivel para que el dashboard arranque con todo cargado
        nivel_data = calcular_nivel_cliente(db, negocio_id, cliente['puntos_reales'])

        return jsonify({
            'message': 'Login exitoso',
            'token': token,
            'usuario': { 
                'id': cliente['id'],
                'nombre': cliente['nombre'],
                'puntos_acumulados': cliente['puntos_reales'], # <--- AQUÍ MANDAMOS EL VALOR REAL
                'token_qr': cliente['token_qr'],
                'dni': cliente['dni'],
                'nivel': nivel_data
            }
        }), 200
    except Exception as e:
        print(f"ERROR LOGIN: {e}")
        return jsonify({'error': 'Error interno'}), 500


# --- 12. PERFIL (Ver Saldo) ---
@bp.route('/perfil', methods=['GET'])
@token_required 
def perfil_usuario(current_user):
    db = get_db()
    try:
        # Obtenemos datos incluyendo negocio_id para calcular nivel        
        db.execute("SELECT puntos_acumulados, token_qr, nombre, negocio_id, dni FROM clientes WHERE id = %s", (current_user['id'],))
        row = db.fetchone()
        
        if row:
            puntos = row['puntos_acumulados'] or 0
            # ✨ MAGIA: Calculamos el nivel al vuelo
            nivel = calcular_nivel_cliente(db, row['negocio_id'], puntos)
            
            return jsonify({
                'nombre': row['nombre'],
                'dni' : row['dni'],
                'puntos_acumulados': puntos,
                'token_qr': row['token_qr'],
                'nivel': nivel 
                
            }), 200
        
        return jsonify({'error': 'Usuario no encontrado'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- 13. CATALOGO DE PREMIOS (Público) ---
@bp.route('/premios', methods=['GET'])
def listar_premios_club():
    negocio_id = request.args.get('negocio_id')
    if not negocio_id: return jsonify([]), 200

    db = get_db()
    try:
        db.execute("""
            SELECT nombre, costo_puntos, descripcion, imagen_url 
            FROM premios 
            WHERE negocio_id = %s AND activo = TRUE AND stock > 0
            ORDER BY costo_puntos ASC
        """, (negocio_id,))
        premios = db.fetchall()
        return jsonify([dict(p) for p in premios]), 200
        
    except Exception as e:
        print(f"Error listar premios: {e}")
        return jsonify([]), 500


# --- 14. UTILS (Info Negocio) ---
@bp.route('/default-negocio', methods=['GET'])
def default_negocio():
    db = get_db()
    try:
        query = "SELECT id FROM negocios ORDER BY club_default DESC, id ASC LIMIT 1"
        db.execute(query)
        row = db.fetchone()
        if row: return jsonify({'id': row['id']}), 200
        return jsonify({'error': 'No hay negocios'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/info-negocio/<int:id>', methods=['GET'])
def info_negocio(id):
    db = get_db()
    db.execute("SELECT nombre, logo_url FROM negocios WHERE id = %s", (id,))
    row = db.fetchone()
    if row:
        return jsonify({
            'nombre': row['nombre'],
            'logo_url': row['logo_url'] if row['logo_url'] else ''
        }), 200
    return jsonify({'error': 'Negocio no encontrado'}), 404

# --- 15 . >>>>>>  📊 ESTADÍSTICAS PARA EL DASHBOARD ---
# En app/routes/club_puntos_routes.py
@bp.route('/admin/stats', methods=['GET'])
@token_required
def obtener_estadisticas_club(current_user):
    negocio_id = request.args.get('negocio_id')
    db = get_db()
    
    try:
        # --- 1. PUNTOS OTORGADOS (Unificado solo en historial_cargas) ---
        # Sumamos cargas manuales, encuestas y regalos de bienvenida
        db.execute("""
            SELECT COALESCE(SUM(monto), 0) as total 
            FROM historial_cargas 
            WHERE negocio_id = %s
        """, (negocio_id,))
        puntos_otorgados = int(db.fetchone()['total'])

        # --- 2. PUNTOS CANJEADOS ---
        db.execute("""
            SELECT COALESCE(SUM(puntos_gastados), 0) as total 
            FROM canjes 
            WHERE negocio_id = %s
        """, (negocio_id,))
        puntos_canjeados = int(db.fetchone()['total'])

        # --- 3. TOP 5 PREMIOS ---
        db.execute("""
            SELECT p.nombre, COUNT(c.id) as cantidad
            FROM canjes c
            JOIN premios p ON c.premio_id = p.id
            WHERE c.negocio_id = %s
            GROUP BY p.nombre
            ORDER BY cantidad DESC
            LIMIT 5
        """, (negocio_id,))
        top_data = db.fetchall()

        return jsonify({
            'balance': {
                'otorgados': puntos_otorgados,
                'canjeados': puntos_canjeados
            },
            'top_premios': {
                'labels': [row['nombre'] for row in top_data],
                'data': [row['cantidad'] for row in top_data]
            }
        }), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        return jsonify({'balance': {'otorgados':0, 'canjeados':0}, 'top_premios': {'labels':[], 'data':[]}}), 200
    


# - 16 -- ADMIN: GESTIÓN COMPLETA DE ENCUESTAS ---
@bp.route('/admin/encuestas', methods=['GET', 'POST', 'DELETE'])
@token_required
def gestion_encuestas_admin(current_user):
    db = get_db()
    
    # 1. LISTAR ENCUESTAS (GET)
    if request.method == 'GET':
        negocio_id = request.args.get('negocio_id')
        
        try:            
            db.execute("SELECT *, to_char(fecha_expiracion, 'YYYY-MM-DD') as fecha_exp FROM encuestas WHERE negocio_id = %s ORDER BY id DESC", (negocio_id,))

            encuestas = db.fetchall()
            return jsonify([dict(e) for e in encuestas]), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # 2. ELIMINAR ENCUESTA (DELETE)
    if request.method == 'DELETE':
        encuesta_id = request.args.get('id')
        try:
            # Borramos en orden: primero los nietos, luego los hijos, al final el padre
            db.execute("DELETE FROM respuestas_encuestas WHERE encuesta_id = %s", (encuesta_id,))
            db.execute("DELETE FROM preguntas_encuestas WHERE encuesta_id = %s", (encuesta_id,))
            db.execute("DELETE FROM encuestas WHERE id = %s", (encuesta_id,))
            
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Encuesta eliminada correctamente'}), 200
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500

    # 3. CREAR ENCUESTA (POST)
    if request.method == 'POST':
        data = request.get_json()
        try:
            # 1. Insertamos la encuesta (Maestro)
            db.execute("""
                INSERT INTO encuestas (negocio_id, titulo, puntos_premio, fecha_expiracion)
                VALUES (%s, %s, %s, %s) RETURNING id
            """, (data['negocio_id'], data['titulo'], data['puntos'], data.get('fecha_expiracion')))
            
            encuesta_id = db.fetchone()['id']
            
            # 2. Insertamos las preguntas (Detalle)
            preguntas = data.get('preguntas', []) # Viene como lista de strings
            for texto in preguntas:
                if texto.strip():
                    db.execute("INSERT INTO preguntas_encuestas (encuesta_id, texto_pregunta) VALUES (%s, %s)", 
                            (encuesta_id, texto))
            
            if hasattr(g, 'db_conn'): g.db_conn.commit()
            return jsonify({'message': 'Encuesta y preguntas creadas'}), 201
        except Exception as e:
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            return jsonify({'error': str(e)}), 500


# --- 17 -- CLIENTE: RESPONDER Y SUMAR (Versión Multi-Pregunta) ---
@bp.route('/encuesta/responder', methods=['POST'])
@token_required
def responder_encuesta(current_user):
    db = get_db()
    data = request.get_json()
    cliente_id = current_user['id']
    encuesta_id = data.get('encuesta_id')
    
    # "respuestas" ahora es un diccionario que mandamos desde el JS: { "id_preg": nota, "id_preg2": nota ... }
    respuestas = data.get('respuestas') 

    if not respuestas:
        return jsonify({'error': 'No se recibieron respuestas'}), 400

    try:
        # 1. Guardamos CADA respuesta individualmente en la tabla de detalle
        # Usamos .items() para recorrer el par (ID de pregunta, Nota)
        for pregunta_id, rating in respuestas.items():
            db.execute("""
                INSERT INTO respuestas_encuestas (encuesta_id, cliente_id, pregunta_id, rating)
                VALUES (%s, %s, %s, %s)
            """, (encuesta_id, cliente_id, pregunta_id, rating))
        
        # 2. Buscamos cuánto premio da esta encuesta (Maestro)
        db.execute("SELECT puntos_premio, titulo FROM encuestas WHERE id = %s", (encuesta_id,))
        encuesta = db.fetchone()
        
        if not encuesta:
            return jsonify({'error': 'Encuesta no encontrada'}), 404

        # 3. Sumamos los puntos al cliente (UNA SOLA VEZ por la encuesta completa)
        db.execute("""
            UPDATE clientes 
            SET puntos_acumulados = COALESCE(puntos_acumulados, 0) + %s 
            WHERE id = %s
        """, (encuesta['puntos_premio'], cliente_id))
        
        # 4. Dejamos el registro en el historial general de cargas
        db.execute("""
            INSERT INTO historial_cargas (negocio_id, cliente_id, monto, motivo, fecha)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (current_user['negocio_id'], cliente_id, encuesta['puntos_premio'], f"Encuesta: {encuesta['titulo']}"))

        if hasattr(g, 'db_conn'): g.db_conn.commit()
        
        return jsonify({'message': f'¡Encuesta completada! Sumaste {encuesta["puntos_premio"]} talentos.'}), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"Error al responder encuesta: {e}")
        return jsonify({'error': str(e)}), 500
    

# -- 18 -- ENCUESTAS DISPONIBLES (Seguridad Reforzada) ---
@bp.route('/encuestas-disponibles', methods=['GET'])
@token_required
def encuestas_disponibles(current_user):
    db = get_db()
    # Seguridad: Usamos el negocio_id del token, no de la URL
    negocio_id = current_user['negocio_id']
    cliente_id = current_user['id']
    
    # Buscamos encuestas activas no respondidas por este cliente
    db.execute("""
        SELECT id, titulo, puntos_premio 
        FROM encuestas 
        WHERE negocio_id = %s AND activo = TRUE 
        AND (fecha_expiracion IS NULL OR fecha_expiracion >= CURRENT_DATE)
        AND id NOT IN (SELECT encuesta_id FROM respuestas_encuestas WHERE cliente_id = %s)
    """, (negocio_id, cliente_id))
    
    encuestas = db.fetchall()
    resultado = []
    
    for enc in encuestas:
        # Traemos las preguntas de cada encuesta (Detalle)
        db.execute("SELECT id, texto_pregunta FROM preguntas_encuestas WHERE encuesta_id = %s", (enc['id'],))
        preguntas = db.fetchall()
        
        e_dict = dict(enc)
        e_dict['preguntas'] = [dict(p) for p in preguntas]
        resultado.append(e_dict)
        
    return jsonify(resultado), 200

# -19 -- ADMIN: VER RESPUESTAS DE ENCUESTAS ---
@bp.route('/admin/respuestas-encuestas', methods=['GET'])
@token_required
def ver_respuestas_encuestas(current_user):
    db = get_db()
    negocio_id = request.args.get('negocio_id')
    try:
        query = """
            SELECT 
                r.id,
                e.titulo as encuesta_titulo,
                c.nombre as cliente_nombre,
                c.dni as cliente_dni,
                r.rating,
                to_char(r.fecha, 'DD/MM/YYYY HH24:MI') as fecha_fmt
            FROM respuestas_encuestas r
            INNER JOIN encuestas e ON r.encuesta_id = e.id
            INNER JOIN clientes c ON r.cliente_id = c.id
            WHERE e.negocio_id = %s
            ORDER BY r.fecha DESC
        """
        db.execute(query, (negocio_id,))
        return jsonify([dict(row) for row in db.fetchall()]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
# -20-- ADMIN: VER PREGUNTAS DE UNA ENCUESTA ---
@bp.route('/admin/encuesta/<int:id>/preguntas', methods=['GET'])
@token_required
def ver_preguntas_encuesta(current_user, id):
    db = get_db()
    try:
        db.execute("SELECT texto_pregunta FROM preguntas_encuestas WHERE encuesta_id = %s", (id,))
        return jsonify([dict(p) for p in db.fetchall()]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    