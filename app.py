import sqlite3
from flask import Flask, jsonify, request, g, send_from_directory
from flask_bcrypt import Bcrypt
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
bcrypt = Bcrypt(app)
app.config['SECRET_KEY'] = 'qqqq' # ¡Cámbiala por algo seguro y aleatorio!

DATABASE = 'inventario.db'

# --- Gestión Profesional de la Base de Datos ---
def get_db():
    """
    Abre una nueva conexión a la base de datos si no existe una para la solicitud actual.
    """
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row # Nos permite acceder a las columnas por nombre
    return db

@app.teardown_appcontext
def close_connection(exception):
    """
    Cierra la conexión a la base de datos automáticamente al final de la solicitud.
    """
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

# --- Rutas para servir la aplicación Frontend ---
@app.route('/')
def serve_index():
    """Sirve el archivo principal de la aplicación (index.html)."""
    return send_from_directory('.', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Sirve los archivos de la carpeta static (inventario.html, etc.)."""
    return send_from_directory('static', path)
    
# --- Decorador para proteger rutas con JWT ---
 # DECORADOR PARA PROTEGER RUTAS
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1] # Bearer <token>
        
        if not token:
            return jsonify({'message': 'Token no encontrado'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            # Guardamos los datos del usuario logueado para usarlos en la ruta
            current_user = data 
        except:
            return jsonify({'message': 'Token inválido'}), 401

        return f(current_user, *args, **kwargs)
    return decorated
# --- API para la gestión de Negocios ---
@app.route('/api/negocios', methods=['GET'])
@token_required # <-- Aplicamos el decorador de seguridad
def get_negocios(current_user): # <-- El decorador nos pasa el usuario
    """Devuelve una lista de negocios según los permisos del usuario."""
    db = get_db()
    
    if current_user['rol'] == 'admin':
        # El admin obtiene todos los negocios
        negocios = db.execute('SELECT * FROM negocios ORDER BY nombre').fetchall()
    else:
        # Un operador solo obtiene los negocios asignados
        negocios = db.execute('''
            SELECT n.* FROM negocios n
            JOIN usuarios_negocios un ON n.id = un.negocio_id
            WHERE un.usuario_id = ?
            ORDER BY n.nombre
        ''', (current_user['id'],)).fetchall()
        
    return jsonify([dict(row) for row in negocios])

@app.route('/api/negocios', methods=['POST'])
def add_negocio():
    """Añade un nuevo negocio a la base de datos."""
    nuevo_negocio = request.get_json()
    if not nuevo_negocio or 'nombre' not in nuevo_negocio:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400

    nombre = nuevo_negocio['nombre']
    # CORREGIDO: Usamos 'direccion' en lugar de 'descripcion' para consistencia
    direccion = nuevo_negocio.get('direccion', '') 

    db = get_db()
    cursor = db.cursor()
    # CORREGIDO: Insertamos en la columna 'direccion'
    cursor.execute('INSERT INTO negocios (nombre, direccion) VALUES (?, ?)',
                     (nombre, direccion))
    db.commit()

    nuevo_id = cursor.lastrowid
    return jsonify({'id': nuevo_id, 'nombre': nombre, 'direccion': direccion}), 201
    
# CORREGIDO: Ruta GET para obtener un solo negocio
@app.route('/api/negocios/<int:id>', methods=['GET'])
def obtener_negocio(id):
    # CORREGIDO: Se usa la función correcta get_db()
    db = get_db()
    negocio = db.execute('SELECT * FROM negocios WHERE id = ?', (id,)).fetchone()
    
    # CORREGIDO: No se necesita db.close(), se cierra solo con teardown_appcontext
    
    if negocio is None:
        return jsonify({'error': 'Negocio no encontrado'}), 404
    
    return jsonify(dict(negocio))
    
# CORREGIDO: Ruta PUT para actualizar un negocio
@app.route('/api/negocios/<int:id>', methods=['PUT'])
def actualizar_negocio(id):
    try:
        datos = request.get_json()
        nombre = datos['nombre']
        direccion = datos.get('direccion', '')

        # CORREGIDO: Se usa la función correcta get_db()
        db = get_db()
        db.execute('UPDATE negocios SET nombre = ?, direccion = ? WHERE id = ?',
                     (nombre, direccion, id))
        db.commit()
        
        # CORREGIDO: No se necesita db.close()
        
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- API para la gestión de Productos (dentro de un Negocio) ---
@app.route('/api/negocios/<int:negocio_id>/productos', methods=['GET'])
def get_productos(negocio_id):
    """Devuelve una lista de todos los productos para un negocio específico."""
    db = get_db()
    productos = db.execute(
        'SELECT * FROM productos WHERE negocio_id = ? ORDER BY nombre', (negocio_id,)
    ).fetchall()
    
    if not productos:
        return jsonify([]), 200
         
    return jsonify([dict(row) for row in productos])

@app.route('/api/negocios/<int:negocio_id>/productos', methods=['POST'])
def add_producto(negocio_id):
    """Añade un nuevo producto al inventario de un negocio específico."""
    nuevo_producto = request.get_json()

    campos_requeridos = ['nombre', 'stock', 'precio_venta']
    for campo in campos_requeridos:
        if campo not in nuevo_producto:
            return jsonify({'error': f'El campo "{campo}" es obligatorio'}), 400

    db = get_db()
    
    negocio = db.execute('SELECT id FROM negocios WHERE id = ?', (negocio_id,)).fetchone()
    if negocio is None:
        return jsonify({'error': 'El negocio especificado no existe'}), 404

    cursor = db.cursor()
    cursor.execute(
        """
        INSERT INTO productos (negocio_id, nombre, codigo_barras, stock, precio_costo, precio_venta, unidad_medida)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            negocio_id,
            nuevo_producto['nombre'],
            nuevo_producto.get('codigo_barras'),
            nuevo_producto['stock'],
            nuevo_producto.get('precio_costo'),
            nuevo_producto['precio_venta'],
            nuevo_producto.get('unidad_medida', 'unidades')
        )
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    producto_creado = db.execute('SELECT * FROM productos WHERE id = ?', (nuevo_id,)).fetchone()

    return jsonify(dict(producto_creado)), 201

# --- API para Actualizar y Borrar Productos ---
@app.route('/api/productos/<int:producto_id>', methods=['PUT'])
def update_producto(producto_id):
    """Actualiza la información de un producto existente."""
    update_data = request.get_json()
    if not update_data:
        return jsonify({'error': 'No se recibieron datos para actualizar'}), 400

    fields = []
    values = []
    for key, value in update_data.items():
        if key in ['nombre', 'stock', 'precio_venta', 'precio_costo', 'unidad_medida', 'codigo_barras']:
            fields.append(f"{key} = ?")
            values.append(value)

    if not fields:
        return jsonify({'error': 'No hay campos válidos para actualizar'}), 400
    
    values.append(producto_id)

    db = get_db()
    db.execute(f"UPDATE productos SET {', '.join(fields)} WHERE id = ?", tuple(values))
    db.commit()

    producto_actualizado = db.execute('SELECT * FROM productos WHERE id = ?', (producto_id,)).fetchone()
    return jsonify(dict(producto_actualizado))

@app.route('/api/productos/<int:producto_id>', methods=['DELETE'])
def delete_producto(producto_id):
    """Elimina un producto de la base de datos."""
    db = get_db()
    db.execute('DELETE FROM productos WHERE id = ?', (producto_id,))
    db.commit()
    return jsonify({'mensaje': 'Producto eliminado con éxito'})


# --- API para Autenticación de Usuarios ---
@app.route('/api/login', methods=['POST'])
def login():
    auth = request.get_json()
    if not auth or not auth.get('email') or not auth.get('password'):
        return jsonify({'message': 'No se pudo verificar'}), 401

    db = get_db()
    user_row = db.execute('SELECT * FROM usuarios WHERE email = ?', (auth.get('email'),)).fetchone()

    if not user_row:
        return jsonify({'message': 'Usuario no encontrado'}), 401

    user = dict(user_row)
    if bcrypt.check_password_hash(user['password'], auth.get('password')):
        token = jwt.encode({
            'id': user['id'],
            'rol': user['rol'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({'token': token})

    return jsonify({'message': 'Contraseña incorrecta'}), 401
# --- Ejecución de la aplicación ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)

# En app.py

# --- API para la Gestión de Usuarios (SOLO ADMINS) ---

@app.route('/api/usuarios', methods=['GET'])
@token_required
def get_usuarios(current_user):
    """Devuelve una lista de todos los usuarios y sus negocios asignados."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    db = get_db()
    # Obtenemos todos los usuarios
    users_rows = db.execute('SELECT id, nombre, email, rol FROM usuarios').fetchall()
    usuarios = [dict(row) for row in users_rows]

    # Para cada usuario, buscamos los negocios que tiene asignados
    for user in usuarios:
        negocios_rows = db.execute('''
            SELECT n.id, n.nombre FROM negocios n
            JOIN usuarios_negocios un ON n.id = un.negocio_id
            WHERE un.usuario_id = ?
        ''', (user['id'],)).fetchall()
        user['negocios_asignados'] = [dict(row) for row in negocios_rows]
        
    return jsonify(usuarios)

@app.route('/api/usuarios', methods=['POST'])
@token_required
def create_usuario(current_user):
    """Crea un nuevo usuario."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    nombre = data.get('nombre')
    email = data.get('email')
    password = data.get('password')
    rol = data.get('rol')

    if not all([nombre, email, password, rol]):
        return jsonify({'message': 'Faltan datos'}), 400

    # Hasheamos la contraseña ANTES de guardarla
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    db = get_db()
    try:
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
            (nombre, email, hashed_password, rol)
        )
        db.commit()
        nuevo_id = cursor.lastrowid
        return jsonify({'id': nuevo_id, 'message': 'Usuario creado con éxito'}), 201
    except db.IntegrityError: # Esto ocurre si el email ya existe
        return jsonify({'message': 'El email ya está en uso'}), 409

@app.route('/api/usuarios/<int:id>', methods=['PUT'])
@token_required
def update_usuario(current_user, id):
    """Actualiza el rol y los permisos de un usuario."""
    if current_user['rol'] != 'admin':
        return jsonify({'message': 'Acción no permitida'}), 403

    data = request.get_json()
    rol = data.get('rol')
    negocios_ids = data.get('negocios_ids', []) # Esperamos una lista de IDs de negocios

    db = get_db()
    # Actualizamos el rol del usuario
    db.execute('UPDATE usuarios SET rol = ? WHERE id = ?', (rol, id))

    # Actualizamos los permisos (la forma más fácil es borrar los viejos e insertar los nuevos)
    db.execute('DELETE FROM usuarios_negocios WHERE usuario_id = ?', (id,))
    if rol == 'operador' and negocios_ids:
        for negocio_id in negocios_ids:
            db.execute('INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (?, ?)',
                         (id, negocio_id))
    
    db.commit()
    return jsonify({'message': 'Usuario actualizado con éxito'})

   # En app.py

@app.route('/api/negocios/<int:negocio_id>/ingresos', methods=['POST'])
@token_required
def registrar_ingreso(current_user, negocio_id):
    """
    Registra un nuevo ingreso de mercadería y actualiza el stock de los productos.
    Es una operación transaccional.
    """
    data = request.get_json()
    detalles = data.get('detalles') # Esperamos una lista de productos y cantidades

    if not detalles:
        return jsonify({'message': 'No se proporcionaron detalles del ingreso'}), 400

    db = get_db()
    try:
        # --- INICIO DE LA TRANSACCIÓN ---
        # 1. Crear el registro de cabecera del ingreso
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO ingresos_mercaderia (negocio_id, proveedor, referencia) VALUES (?, ?, ?)',
            (negocio_id, data.get('proveedor'), data.get('referencia'))
        )
        ingreso_id = cursor.lastrowid

        # 2. Recorrer los detalles y actualizar stock
        for item in detalles:
            # 2a. Insertar en la tabla de detalle
            cursor.execute(
                'INSERT INTO ingresos_mercaderia_detalle (ingreso_id, producto_id, cantidad, precio_costo_unitario) VALUES (?, ?, ?, ?)',
                (ingreso_id, item['producto_id'], item['cantidad'], item.get('precio_costo'))
            )
            # 2b. Actualizar el stock del producto
            cursor.execute(
                'UPDATE productos SET stock = stock + ? WHERE id = ?',
                (item['cantidad'], item['producto_id'])
            )
        
        # 3. Si todo salió bien, confirmar la transacción
        db.commit()
        # --- FIN DE LA TRANSACCIÓN ---
        
        return jsonify({'message': 'Ingreso registrado y stock actualizado con éxito', 'ingreso_id': ingreso_id}), 201

    except Exception as e:
        # Si algo falla, deshacer todos los cambios
        db.rollback()
        return jsonify({'error': f'Ocurrió un error: {str(e)}'}), 500
    

    # En app.py

@app.route('/api/negocios/<int:negocio_id>/ingresos', methods=['GET'])
@token_required
def get_historial_ingresos(current_user, negocio_id):
    """Devuelve la lista maestra de ingresos para un negocio."""
    db = get_db()
    ingresos = db.execute('''
        SELECT id, fecha, proveedor, referencia 
        FROM ingresos_mercaderia 
        WHERE negocio_id = ? 
        ORDER BY fecha DESC
    ''', (negocio_id,)).fetchall()
    return jsonify([dict(row) for row in ingresos])

@app.route('/api/ingresos/<int:ingreso_id>/detalles', methods=['GET'])
@token_required
def get_detalles_ingreso(current_user, ingreso_id):
    """Devuelve los productos de un ingreso específico."""
    db = get_db()
    detalles = db.execute('''
        SELECT d.cantidad, d.precio_costo_unitario, p.nombre 
        FROM ingresos_mercaderia_detalle d
        JOIN productos p ON d.producto_id = p.id
        WHERE d.ingreso_id = ?
    ''', (ingreso_id,)).fetchall()
    return jsonify([dict(row) for row in detalles])

# En app.py

# Ruta para obtener los clientes de un negocio
@app.route('/api/negocios/<int:negocio_id>/clientes', methods=['GET'])
@token_required
def get_clientes(current_user, negocio_id):
    db = get_db()
    clientes = db.execute('SELECT id, nombre FROM clientes WHERE negocio_id = ? ORDER BY nombre', (negocio_id,)).fetchall()
    return jsonify([dict(row) for row in clientes])

# Ruta para registrar la venta (la más importante)
@app.route('/api/negocios/<int:negocio_id>/ventas', methods=['POST'])
@token_required
def registrar_venta(current_user, negocio_id):
    data = request.get_json()
    cliente_id = data.get('cliente_id')
    detalles = data.get('detalles')
    total_venta = 0

    if not detalles:
        return jsonify({'message': 'La venta no tiene productos'}), 400

    db = get_db()
    cursor = db.cursor()
    
    try:
        # Chequeo de Stock
        for item in detalles:
            producto = cursor.execute('SELECT stock FROM productos WHERE id = ?', (item['producto_id'],)).fetchone()
            if producto is None or producto['stock'] < item['cantidad']:
                db.rollback()
                return jsonify({'error': f"Stock insuficiente para el producto ID {item['producto_id']}"}), 409

        # Si hay stock, procedemos
        for item in detalles:
            total_venta += item['cantidad'] * item['precio_unitario']

        # ✨ CORRECCIÓN AQUÍ: Añadimos 'fecha' al INSERT
        cursor.execute(
            'INSERT INTO ventas (negocio_id, cliente_id, total, metodo_pago, fecha) VALUES (?, ?, ?, ?, ?)',
            (negocio_id, cliente_id, total_venta, data.get('metodo_pago'), datetime.datetime.now()) # <-- Y pasamos la fecha actual
        )
        venta_id = cursor.lastrowid

        # Insertar los detalles y descontar stock (esto no cambia)
        for item in detalles:
            subtotal = item['cantidad'] * item['precio_unitario']
            cursor.execute(
                'INSERT INTO ventas_detalle (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
                (venta_id, item['producto_id'], item['cantidad'], item['precio_unitario'], subtotal)
            )
            cursor.execute(
                'UPDATE productos SET stock = stock - ? WHERE id = ?',
                (item['cantidad'], item['producto_id'])
            )

        db.commit()
        return jsonify({'message': 'Venta registrada con éxito', 'venta_id': venta_id}), 201

    except Exception as e:
        db.rollback()
        return jsonify({'error': f'Ocurrió un error: {str(e)}'}), 500

# --- API para la Gestión de Clientes ---

@app.route('/api/negocios/<int:negocio_id>/clientes', methods=['POST'])
@token_required
def create_cliente(current_user, negocio_id):
    """Crea un nuevo cliente para un negocio específico."""
    data = request.get_json()
    if not data or not data.get('nombre'):
        return jsonify({'error': 'El nombre es obligatorio'}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        'INSERT INTO clientes (negocio_id, nombre, documento, telefono, email, direccion) VALUES (?, ?, ?, ?, ?, ?)',
        (negocio_id, data['nombre'], data.get('documento'), data.get('telefono'), data.get('email'), data.get('direccion'))
    )
    db.commit()
    return jsonify({'id': cursor.lastrowid, 'message': 'Cliente creado con éxito'}), 201

@app.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@token_required
def update_cliente(current_user, cliente_id):
    """Actualiza un cliente existente."""
    data = request.get_json()
    db = get_db()
    # Aquí podríamos añadir una verificación de permisos extra si fuera necesario
    db.execute(
        'UPDATE clientes SET nombre = ?, documento = ?, telefono = ?, email = ?, direccion = ? WHERE id = ?',
        (data.get('nombre'), data.get('documento'), data.get('telefono'), data.get('email'), data.get('direccion'), cliente_id)
    )
    db.commit()
    return jsonify({'message': 'Cliente actualizado con éxito'})

@app.route('/api/clientes/<int:cliente_id>', methods=['DELETE'])
@token_required
def delete_cliente(current_user, cliente_id):
    """Elimina un cliente."""
    db = get_db()
    db.execute('DELETE FROM clientes WHERE id = ?', (cliente_id,))
    db.commit()
    return jsonify({'message': 'Cliente eliminado con éxito'})

# En app.py
# En app.py, reemplaza esta función completa

@app.route('/api/negocios/<int:negocio_id>/ventas', methods=['GET'])
@token_required
def get_historial_ventas(current_user, negocio_id):
    """Devuelve la lista maestra de ventas para un negocio, con filtro de fecha."""
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    
    db = get_db()
    query = '''
        SELECT v.id, v.fecha, v.total, c.nombre as cliente_nombre
        FROM ventas v
        LEFT JOIN clientes c ON v.cliente_id = c.id
        WHERE v.negocio_id = ?
    '''
    params = [negocio_id]

    if fecha_desde:
        query += ' AND date(v.fecha) >= ?'
        params.append(fecha_desde)
    if fecha_hasta:
        query += ' AND date(v.fecha) <= ?'
        params.append(fecha_hasta)
    
    query += ' ORDER BY v.fecha DESC'
    
    # ✨ CORRECCIÓN AQUÍ: Convertimos la lista 'params' a una tupla ✨
    ventas = db.execute(query, tuple(params)).fetchall()
    
    return jsonify([dict(row) for row in ventas])

@app.route('/api/ventas/<int:venta_id>/detalles', methods=['GET'])
@token_required
def get_detalles_venta(current_user, venta_id):
    """Devuelve los productos de una venta específica."""
    db = get_db()
    detalles = db.execute('''
        SELECT d.cantidad, d.precio_unitario, p.nombre 
        FROM ventas_detalle d
        JOIN productos p ON d.producto_id = p.id
        WHERE d.venta_id = ?
    ''', (venta_id,)).fetchall()
    return jsonify([dict(row) for row in detalles])
