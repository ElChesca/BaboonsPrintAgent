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
            db.execute("SELECT id, nombre, direccion, tipo_app, logo_url, fecha_alta, cuota_mensual, suscripcion_activa, acceso_bloqueado, anuncio_texto, anuncio_version FROM negocios ORDER BY nombre")
        else: # Admin u Operador
             db.execute("""
                 SELECT n.id, n.nombre, n.direccion, n.tipo_app, n.logo_url, n.acceso_bloqueado
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

@bp.route('/negocios/<int:id>', methods=['GET'])
@token_required
def get_negocio(current_user, id):
    db = get_db()
    try:
        # Asegurar columnas de branding
        try:
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS logo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS fondo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS instagram_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS facebook_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS direccion_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS telefono_resto TEXT")
            g.db_conn.commit()
        except: g.db_conn.rollback()

        db.execute("SELECT * FROM negocios WHERE id = %s", (id,))
        negocio = db.fetchone()
        if not negocio:
            return jsonify({'error': 'Negocio no encontrado'}), 404
        
        res = dict(negocio)
        if res.get('fecha_alta'): res['fecha_alta'] = res['fecha_alta'].isoformat()
        if res.get('cuota_mensual'): res['cuota_mensual'] = float(res['cuota_mensual'])
        
        return jsonify(res)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/public/negocios/<int:id>', methods=['GET'])
def get_negocio_public_info(id):
    """Retorna información básica del negocio para portales públicos (no requiere login)."""
    db = get_db()
    try:
        db.execute("SELECT id, nombre, logo_url, logo_url_resto, fondo_url_resto, direccion_resto, telefono_resto FROM negocios WHERE id = %s", (id,))
        negocio = db.fetchone()
        if not negocio:
            return jsonify({'error': 'Negocio no encontrado'}), 404
        return jsonify(dict(negocio))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios', methods=['POST'])
@token_required
def add_negocio(current_user):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    data = request.get_json()
    if not data or 'nombre' not in data:
        return jsonify({'error': 'El campo "nombre" es obligatorio'}), 400

    db = get_db()
    try:
        # Asegurar columnas
        try:
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS logo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS fondo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS instagram_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS facebook_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS direccion_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS telefono_resto TEXT")
            g.db_conn.commit()
        except: g.db_conn.rollback()

        campos = []
        placeholders = []
        valores = []
        for k, v in data.items():
            campos.append(k)
            placeholders.append("%s")
            valores.append(v)

        query = f"INSERT INTO negocios ({', '.join(campos)}) VALUES ({', '.join(placeholders)}) RETURNING id"
        db.execute(query, tuple(valores))
        nuevo_id = db.fetchone()['id']

        db.execute(
            'INSERT INTO usuarios_negocios (usuario_id, negocio_id) VALUES (%s, %s)',
            (current_user['id'], nuevo_id)
        )
        g.db_conn.commit()

        return jsonify({'id': nuevo_id, 'message': 'Negocio creado con éxito'}), 201

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
        db = get_db()

        # Asegurar columnas branding antes de update
        try:
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS logo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS fondo_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS instagram_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS facebook_url_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS direccion_resto TEXT")
            db.execute("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS telefono_resto TEXT")
            g.db_conn.commit()
        except: g.db_conn.rollback()

        campos = []
        valores = []
        for k, v in datos.items():
            if k == 'id': continue
            campos.append(f"{k} = %s")
            valores.append(v)
        
        if not campos:
            return jsonify({'error': 'No hay datos para actualizar'}), 400

        valores.append(id)
        db.execute(f"UPDATE negocios SET {', '.join(campos)} WHERE id = %s", tuple(valores))
        
        g.db_conn.commit()
        return jsonify({'message': 'Negocio actualizado con éxito'})
    except Exception as e:
        g.db_conn.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/negocios/<int:id>', methods=['DELETE'])
@token_required
def eliminar_negocio(current_user, id):
    if current_user['rol'] != 'superadmin':
        return jsonify({'message': 'Acción no permitida'}), 403
    
    db = get_db()
    try:
        # 1. Eliminar relaciones de permisos y usuarios primero (generalmente no tienen mucha data crítica)
        db.execute('DELETE FROM usuarios_negocios WHERE negocio_id = %s', (id,))
        db.execute('DELETE FROM negocio_rol_permisos WHERE negocio_id = %s', (id,))
        
        # 2. Intentar eliminar el negocio. 
        # Si hay FKs en cascada, funcionará. Si no, lanzará un error que capturamos.
        db.execute('DELETE FROM negocios WHERE id = %s', (id,))
        
        g.db_conn.commit()
        return jsonify({'message': 'Negocio eliminado con éxito y todas sus configuraciones base.'})
    except Exception as e:
        g.db_conn.rollback()
        # Si es un error de Foreign Key, damos un mensaje más amigable
        error_msg = str(e).lower()
        if 'foreign key' in error_msg or 'violates foreign key' in error_msg:
             return jsonify({'error': 'No se puede eliminar el negocio porque tiene datos asociados (Ventas, Productos, Clientes, etc). Debe eliminar esos datos manualmente primero o contactar a soporte para un borrado total.'}), 400
        return jsonify({'error': f'Error al eliminar negocio: {str(e)}'}), 500

def get_status_suscripcion_internal(negocio_id):
    """Lógica interna de verificación de suscripción sin dependencia de request/user context."""
    db = get_db()
    try:
        import datetime
        hoy = datetime.date.today()
        
        # Verificar si la suscripción está activa para este negocio
        db.execute("SELECT suscripcion_activa, fecha_alta, acceso_bloqueado FROM negocios WHERE id = %s", (negocio_id,))
        negocio = db.fetchone()
        
        if not negocio:
             return {'status': 'ok', 'mensaje': ''}

        if negocio['acceso_bloqueado']:
             return {
                 'status': 'blocked',
                 'mensaje': 'Acceso Suspendido por Falta de Pago. Comuníquese con la administración.'
             }

        if not negocio['suscripcion_activa']:
            return {'status': 'ok', 'mensaje': ''}

        fecha_alta = negocio['fecha_alta']
        # Si no tiene fecha de alta o la fecha es futura, no exigimos pago
        if not fecha_alta or (isinstance(fecha_alta, datetime.date) and fecha_alta > hoy):
             return {'status': 'ok', 'mensaje': ''}

        mes_actual = hoy.month
        anio_actual = hoy.year
        dia_actual = hoy.day

        db.execute("""
            SELECT 1 FROM suscripciones_pagos 
            WHERE negocio_id = %s AND mes = %s AND anio = %s
        """, (negocio_id, mes_actual, anio_actual))
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

        return {
            'status': status,
            'mensaje': mensaje,
            'mes': mes_actual,
            'anio': anio_actual,
            'dia_vencimiento': 10
        }
    except Exception as e:
        print(f"Error en get_status_suscripcion_internal: {e}")
        return {'status': 'ok', 'mensaje': f'Error verificando: {str(e)}'}

@bp.route('/negocios/<int:id>/suscripcion-status', methods=['GET'])
@token_required
def get_subscription_status(current_user, id):
    if current_user['rol'] != 'superadmin':
        db = get_db()
        db.execute("SELECT 1 FROM usuarios_negocios WHERE usuario_id = %s AND negocio_id = %s", (current_user['id'], id))
        if not db.fetchone():
            return jsonify({'message': 'Acceso denegado'}), 403

    res = get_status_suscripcion_internal(id)
    return jsonify(res)