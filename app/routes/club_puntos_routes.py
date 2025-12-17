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

bp = Blueprint('club_puntos', __name__)



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


# --- HELPER: CALCULAR NIVEL ACTUAL ---
# --- HELPER: CALCULAR NIVEL (BLINDADO) ---
def calcular_nivel_cliente(db, negocio_id, puntos_actuales):
    """
    Devuelve el nivel. Si algo falla, devuelve nivel básico para no romper la app.
    Maneja puntos None convirtiéndolos a 0.
    """
    nivel_default = {'nombre': 'Miembro', 'color': '#6c757d', 'icono': 'fa-user'}
    
    try:
        # Validación defensiva: Si puntos es None, es 0.
        if puntos_actuales is None:
            puntos_actuales = 0
            
        # Nos aseguramos que sean enteros
        puntos_actuales = int(puntos_actuales)
        
        # Buscamos el nivel más alto que cumpla el requisito
        db.execute("""
            SELECT nombre, color, icono, puntos_minimos 
            FROM niveles_club 
            WHERE negocio_id = %s AND puntos_minimos <= %s
            ORDER BY puntos_minimos DESC 
            LIMIT 1
        """, (negocio_id, puntos_actuales))
        
        nivel = db.fetchone()
        
        if nivel:
            # Convertimos a dict estándar para evitar problemas de tipos de cursor
            return {
                'nombre': nivel['nombre'],
                'color': nivel['color'],
                'icono': nivel['icono']
            }
            
        return nivel_default

    except Exception as e:
        print(f"⚠️ Error calculando nivel (no crítico): {e}")
        return nivel_default # Si falla, devuelve básico, PERO NO CRASHEA
        
# =========================================================
# 🛠️ CORRECCIÓN DE TABLAS: "usuarios_club" -> "clientes"
# =========================================================

# --- APP CLIENTE: PERFIL ---
@bp.route('/perfil', methods=['GET'])
@token_required
def obtener_mi_perfil_club(current_user):
    db = get_db()
    try:
        # CORREGIDO: Usamos la tabla 'clientes'
        db.execute("""
            SELECT u.nombre, u.email, u.dni, u.puntos_acumulados, u.token_qr, u.negocio_id 
            FROM clientes u 
            WHERE u.id = %s
        """, (current_user['id'],))
        usuario = db.fetchone()
        
        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        # Calculamos nivel (con tu función helper existente)
        # Usamos 'or 0' para evitar error si puntos es None
        nivel_data = calcular_nivel_cliente(db, usuario['negocio_id'], usuario['puntos_acumulados'] or 0)

        return jsonify({
            'nombre': usuario['nombre'],
            'email': usuario['email'],
            'puntos_acumulados': usuario['puntos_acumulados'] or 0,
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
        db.execute("SELECT id, nombre, puntos_acumulados FROM clientes WHERE token_qr = %s AND negocio_id = %s", (token_qr, negocio_id))
        cliente = db.fetchone()
        
        if not cliente: 
            return jsonify({'error': 'Cliente no encontrado o QR inválido'}), 404
        
        try:
            puntos_sumar = int(cantidad)
        except ValueError:
            return jsonify({'error': 'La cantidad debe ser un número'}), 400

        # 2. ACTUALIZAR SALDO
        db.execute("""
            UPDATE clientes 
            SET puntos_acumulados = COALESCE(puntos_acumulados, 0) + %s 
            WHERE id = %s
        """, (puntos_sumar, cliente['id']))
        
        # 3. GUARDAR HISTORIAL (REACTIVADO Y SEGURO) ✅
        # Verificamos si current_user es un dict y tiene 'id', si no, None (ej: terminal sin login)
        admin_id = None
        if isinstance(current_user, dict) and 'id' in current_user:
            admin_id = current_user['id']
        
        db.execute("""
            INSERT INTO historial_cargas (negocio_id, cliente_id, monto, motivo, fecha, usuario_id)
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
        """, (negocio_id, cliente['id'], puntos_sumar, motivo, admin_id))

        # 4. COMMIT
        if hasattr(g, 'db_conn'): g.db_conn.commit()

        nuevo_saldo = (cliente['puntos_acumulados'] or 0) + puntos_sumar
        return jsonify({
            'mensaje': 'Carga exitosa', 
            'cliente': cliente['nombre'], 
            'nuevo_saldo': nuevo_saldo
        }), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"🔥 Error Carga Puntos: {e}")
        traceback.print_exc()
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

# --- 10. REGISTRO DE USUARIO ---
@bp.route('/register', methods=['POST'])
def register():
    db = get_db() 
    data = request.get_json()

    print(f"--> REGISTRO DATOS: {data}") 

    try:
        nombre = data.get('nombre')
        dni = data.get('dni')
        email = data.get('email')
        password = data.get('password')
        negocio_id = data.get('negocio_id')
        genero = data.get('genero')
        acepta_terminos = data.get('acepta_terminos')
        fecha_raw = data.get('fecha_nacimiento')

        fecha_nacimiento = None
        if fecha_raw and len(fecha_raw) == 10 and '00' not in fecha_raw.split('-'):
             fecha_nacimiento = fecha_raw

        if not all([nombre, dni, password, negocio_id]):
            return jsonify({'error': 'Faltan datos obligatorios'}), 400

        db.execute("SELECT id FROM clientes WHERE dni = %s AND negocio_id = %s", (dni, negocio_id))
        if db.fetchone():
            return jsonify({'error': 'Ya existe un usuario con este DNI'}), 409

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        token_qr = str(uuid.uuid4())
        
        if not email or email.strip() == "": email = None
        
        query = """
            INSERT INTO clientes (
                nombre, dni, email, password_hash, negocio_id,
                genero, fecha_nacimiento, acepta_terminos, token_qr, 
                app_registrado, puntos_acumulados,
                tipo_cliente, posicion_iva, condicion_venta
            ) VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s, 
                true, 0,
                'Individuo', 'Consumidor Final', 'Contado'
            ) RETURNING id
        """
        
        db.execute(query, (
            nombre, dni, email, hashed_password, negocio_id,
            genero, fecha_nacimiento, acepta_terminos, token_qr
        ))

        nuevo_id = db.fetchone()['id']
        if hasattr(g, 'db_conn'): g.db_conn.commit()

        return jsonify({'message': 'Registro exitoso', 'id': nuevo_id, 'token_qr': token_qr}), 201

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print("ERROR REGISTER:")
        traceback.print_exc()
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
        query = "SELECT id, nombre, puntos_acumulados, token_qr, password_hash FROM clientes WHERE dni = %s"
        params = [dni]
        
        if negocio_id:
            query += " AND negocio_id = %s"
            params.append(negocio_id)
        
        db.execute(query, tuple(params))
        cliente = db.fetchone()

        if not cliente or not bcrypt.check_password_hash(cliente['password_hash'], password):
            return jsonify({'error': 'Credenciales inválidas'}), 401

        token_qr = cliente['token_qr']
        if not token_qr:
            token_qr = str(uuid.uuid4())
            db.execute("UPDATE clientes SET token_qr = %s WHERE id = %s", (token_qr, cliente['id']))
            if hasattr(g, 'db_conn'): g.db_conn.commit()

        token_payload = {
            'user_id': cliente['id'],
            'id': cliente['id'],
            'negocio_id': negocio_id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }
        
        token = jwt.encode(token_payload, current_app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'message': 'Login exitoso',
            'token': token,
            'usuario': { 
                'id': cliente['id'],
                'nombre': cliente['nombre'],
                'puntos': cliente['puntos_acumulados'] or 0,
                'token_qr': token_qr 
            }
        }), 200

    except Exception as e:
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"ERROR LOGIN: {e}")
        return jsonify({'error': 'Error interno'}), 500


# --- 12. PERFIL (Ver Saldo) ---
@bp.route('/perfil', methods=['GET'])
@token_required 
def perfil_usuario(current_user):
    db = get_db()
    try:
        # Obtenemos datos incluyendo negocio_id para calcular nivel
        db.execute("SELECT puntos_acumulados, token_qr, nombre, negocio_id FROM clientes WHERE id = %s", (current_user['id'],))
        row = db.fetchone()
        
        if row:
            puntos = row['puntos_acumulados'] or 0
            # ✨ MAGIA: Calculamos el nivel al vuelo
            nivel = calcular_nivel_cliente(db, row['negocio_id'], puntos)
            
            return jsonify({
                'nombre': row['nombre'],
                'puntos_acumulados': puntos,
                'token_qr': row['token_qr'],
                'nivel': nivel # <--- ENVIAMOS EL NIVEL AL FRONTEND
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
    print(f"\n📊 STATS PARA NEGOCIO ID: {negocio_id}")
    
    db = get_db()
    
    try:
        # --- 1. SUMAR PUNTOS OTORGADOS (Intentamos ambas tablas con seguridad) ---
        puntos_otorgados = 0
        
        # Intento A: historial_cargas
        try:
            db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM historial_cargas WHERE negocio_id = %s", (negocio_id,))
            row = db.fetchone()
            if row: puntos_otorgados += int(row['total'])
        except Exception as e:
            print(f"   (Info) No se pudo leer historial_cargas: {e}")
            if hasattr(g, 'db_conn'): g.db_conn.rollback() # <--- ¡ESTO FALTABA! Limpia el error

        # Intento B: historial_puntos
        try:
            db.execute("SELECT COALESCE(SUM(monto), 0) as total FROM historial_puntos WHERE negocio_id = %s", (negocio_id,))
            row = db.fetchone()
            if row: puntos_otorgados += int(row['total'])
        except Exception as e: 
            print(f"   (Info) No se pudo leer historial_puntos: {e}")
            if hasattr(g, 'db_conn'): g.db_conn.rollback() # <--- ¡ESTO FALTABA! Limpia el error

        print(f"   -> Total Otorgados: {puntos_otorgados}")


        # --- 2. PUNTOS CANJEADOS ---
        # Si fallaron las anteriores, el rollback ya limpió el camino para esta
        try:
            db.execute("""
                SELECT COALESCE(SUM(p.costo_puntos), 0) as total
                FROM canjes c
                JOIN premios p ON c.premio_id = p.id
                WHERE c.negocio_id = %s
            """, (negocio_id,))
            row = db.fetchone()
            puntos_canjeados = int(row['total']) if row else 0
        except Exception as e:
            print(f"   (Info) Error en canjes: {e}")
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            puntos_canjeados = 0
            
        print(f"   -> Total Canjeados: {puntos_canjeados}")


        # --- 3. TOP 5 PREMIOS ---
        try:
            db.execute("""
                SELECT p.nombre, COUNT(c.id) as cantidad
                FROM canjes c
                JOIN premios p ON c.premio_id = p.id
                WHERE c.negocio_id = %s
                GROUP BY p.nombre
                ORDER BY cantidad DESC
                LIMIT 5
            """, (negocio_id,))
            top_premios = db.fetchall()
        except Exception as e:
            print(f"   (Info) Error en Top 5: {e}")
            if hasattr(g, 'db_conn'): g.db_conn.rollback()
            top_premios = []

        # Formateo (usando claves de diccionario)
        top_labels = [row['nombre'] for row in top_premios]
        top_data = [row['cantidad'] for row in top_premios]

        return jsonify({
            'balance': {
                'otorgados': puntos_otorgados,
                'canjeados': puntos_canjeados
            },
            'top_premios': {
                'labels': top_labels,
                'data': top_data
            }
        }), 200

    except Exception as e:
        # Rollback final por si acaso
        if hasattr(g, 'db_conn'): g.db_conn.rollback()
        print(f"🔥 ERROR FATAL EN STATS: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'balance': {'otorgados':0, 'canjeados':0}, 'top_premios': {'labels':[], 'data':[]}}), 200